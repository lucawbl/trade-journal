import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const session = vi.hoisted(() => ({ token: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: session.token }) }),
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));
const originalDir = process.env.JOURNAL_DATA_DIR;
const scratch = mkdtempSync(join(tmpdir(), "journal-view-test-"));
process.env.JOURNAL_DATA_DIR = scratch;
const { db, accounts, executions, trades, settings } = await import("../src/db");
const { readJournalView, requireJournalSession } = await import("../src/server/journal-view");
const { sessionToken } = await import("../src/server/auth");
const { POST } = await import("../src/app/api/bot-ingest/route");
const fills = [
  {
    symbol: "DOGEUSDT",
    side: "buy",
    quantity: 10,
    price: 0.1,
    fee: 0.001,
    executedAt: "2026-10-01T10:00:00Z",
  },
  {
    symbol: "DOGEUSDT",
    side: "sell",
    quantity: 9,
    price: 0.12,
    fee: 0.001,
    executedAt: "2026-10-01T11:00:00Z",
  },
];
const ingest = (rows = fills, token = "test-ingest-secret") =>
  POST(
    new Request("http://localhost/api/bot-ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ executions: rows }),
    }),
  );
beforeEach(() => {
  vi.stubEnv("JOURNAL_PASSWORD", "");
  vi.stubEnv("JOURNAL_INGEST_SECRET", "test-ingest-secret");
  session.token = undefined;
  db.delete(settings).run();
  db.delete(trades).run();
  db.delete(executions).run();
  db.delete(accounts).run();
});
afterAll(() => {
  vi.unstubAllEnvs();
  db.$client.close();
  if (originalDir === undefined) delete process.env.JOURNAL_DATA_DIR;
  else process.env.JOURNAL_DATA_DIR = originalDir;
  rmSync(scratch, { recursive: true, force: true });
});
describe("server-rendered journal", () => {
  it("isolates PEPE and BTC from DOGE and rejects mismatched symbols", async () => {
    const post = (accountId: string, symbol: string) => POST(new Request("http://localhost/api/bot-ingest", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer test-ingest-secret" },
      body: JSON.stringify({ accountId, executions: fills.map(fill => ({ ...fill, symbol })) }),
    }));
    await ingest();
    expect((await post("binance-testnet-pepe", "PEPEUSDT")).status).toBe(200);
    expect((await post("binance-testnet-btc", "BTCUSDT")).status).toBe(200);
    expect(readJournalView().accounts).toHaveLength(3);
    expect(readJournalView({ accounts: "binance-testnet-pepe" }).rows[0]?.symbol).toBe("PEPEUSDT");
    expect((await post("binance-testnet-pepe", "BTCUSDT")).status).toBe(400);
    expect((await post("arbitrary", "BTCUSDT")).status).toBe(400);
    const retry = await post("binance-testnet-btc", "BTCUSDT");
    expect(await retry.json()).toMatchObject({ inserted: 0, duplicates: 2 });
    expect(db.select().from(executions).all()).toHaveLength(6);
  });

  it("keeps partial exits separate from closed-trade performance and filters consistently", async () => {
    expect((await ingest()).status).toBe(200);
    const view = readJournalView();
    expect(view.rows[0]).toMatchObject({ quantity: 10, openQuantity: 1, status: "open" });
    expect(view.rows[0]!.netPnl).toBeCloseTo(0.178);
    expect(view.overview.metrics).toMatchObject({
      totalTrades: 1,
      openTrades: 1,
      closedTrades: 0,
      netPnl: 0,
      winRate: null,
    });
    expect(view.overview.equity).toEqual([]);
    expect(readJournalView({ status: "closed" }).rows).toEqual([]);
    expect(readJournalView({ symbol: "BTCUSDT" }).overview.metrics.totalTrades).toBe(0);
    expect(
      (await ingest([{ ...fills[1]!, quantity: 1, executedAt: "2026-10-01T12:00:00Z" }])).status,
    ).toBe(200);
    expect(readJournalView({ status: "closed" }).overview.metrics).toMatchObject({
      closedTrades: 1,
      openTrades: 0,
      winRate: 1,
    });
    expect(readJournalView().overview.equity).toHaveLength(1);
  });
  it("keeps report groups and calendar totals in the reporting currency and journal timezone", async () => {
    await ingest();
    await ingest([{ ...fills[1]!, quantity: 1, executedAt: "2026-10-02T00:05:00Z" }]);
    db.update(accounts).set({ currency: "USD" }).run();
    db.insert(settings)
      .values([
        {
          key: "currencyConversion",
          value: JSON.stringify({ enabled: true, reportingCurrency: "EUR", rates: { USD: 0.9 } }),
        },
        { key: "timeZone", value: "America/New_York" },
      ])
      .run();
    const { bySymbol, calendarMonthFromDays } = await import("@luxalgo/journal-core");
    const view = readJournalView({ status: "closed" });
    const total = view.rows[0]!.netPnl * 0.9;
    expect(view.currencyScope.currency).toBe("EUR");
    expect(view.overview.metrics.netPnl).toBeCloseTo(total);
    expect(bySymbol(view.projectedTrades)[0]!.netPnl).toBeCloseTo(total);
    expect(view.overview.days[0]!.date).toBe("2026-10-01");
    const calendar = calendarMonthFromDays(view.overview.days, 2026, 10);
    expect(calendar.monthNetPnl).toBeCloseTo(total);
    expect(calendar.monthTrades).toBe(1);
    expect(readJournalView({ status: "closed", from: "2026-10-02" }).rows).toHaveLength(0);
    expect(db.select().from(trades).all()[0]!.netPnl).toBeCloseTo(total / 0.9);
  });
  it("records valid ingestion and duplicate retries without duplicating fills", async () => {
    expect((await ingest()).status).toBe(200);
    const first = readJournalView().accounts[0]!;
    expect(first.lastSyncAt).not.toBeNull();
    db.update(accounts).set({ lastSyncAt: "2026-01-01T00:00:00Z" }).run();
    const retry = await ingest();
    expect(await retry.json()).toMatchObject({ inserted: 0, duplicates: 2 });
    expect(readJournalView().accounts[0]!.lastSyncAt).not.toBe("2026-01-01T00:00:00Z");
    expect(db.select().from(executions).all()).toHaveLength(2);
    const sync = readJournalView().accounts[0]!.lastSyncAt;
    expect((await ingest(fills, "wrong-token")).status).toBe(401);
    expect((await ingest([{ ...fills[0]!, quantity: 0 }])).status).toBe(200);
    expect(readJournalView().accounts[0]!.lastSyncAt).toBe(sync);
  });
  it("does not expose credentials and tolerates an invalid broker snapshot", async () => {
    await ingest();
    db.update(accounts).set({ credentialsEnc: "encrypted-secret", snapshotJson: "bad JSON" }).run();
    expect(readJournalView().accounts[0]).not.toHaveProperty("credentialsEnc");
    expect(readJournalView().accounts[0]).not.toHaveProperty("snapshotJson");
    expect(readJournalView().accounts[0]!.equity).toBeNull();
    db.insert(accounts)
      .values({
        id: "usd",
        name: "USD account",
        currency: "USD",
        kind: "manual",
        createdAt: "2026-10-01",
      })
      .run();
    expect(readJournalView().currencyScope.monetary).toBe(false);
    expect(readJournalView({ accounts: "bybit-demo-doge" }).currencyScope.currency).toBe("USDT");
  });
  it("validates signed cookies on pages when password protection is enabled", async () => {
    await expect(requireJournalSession()).resolves.toBeUndefined();
    vi.stubEnv("JOURNAL_PASSWORD", "test-password");
    for (const token of [undefined, "forged"]) {
      session.token = token;
      await expect(requireJournalSession()).rejects.toThrow("redirect:/login");
    }
    session.token = sessionToken();
    await expect(requireJournalSession()).resolves.toBeUndefined();
  });
});
