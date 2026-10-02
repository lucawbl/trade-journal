import type { ImportedExecution } from "@luxalgo/journal-importers";
import { eq } from "drizzle-orm";
import { accounts, db } from "@/db";
import { bad, handler, ok } from "@/server/api";
import { insertExecutions } from "@/server/executions";
import { nowIso } from "@/server/ids";

const BOT_ACCOUNTS = {
  "bybit-demo-doge": { name: "DOGE Bot · Bybit Demo", broker: "bybit-demo", symbol: "DOGEUSDT", initialBalance: 50000 },
  "binance-testnet-pepe": { name: "PEPE Bot · Binance Testnet", broker: "binance-testnet", symbol: "PEPEUSDT", initialBalance: 0 },
  "binance-testnet-btc": { name: "BTC Bot · Binance Testnet", broker: "binance-testnet", symbol: "BTCUSDT", initialBalance: 0 },
} as const;

interface Body {
  accountId?: string;
  executions?: ImportedExecution[];
}

export const POST = handler(
  async (request: Request) => {
    const secret = process.env.JOURNAL_INGEST_SECRET;
    if (!secret) return bad("Ingest disabled", 503);
    if (request.headers.get("authorization") !== `Bearer ${secret}`)
      return bad("Unauthorized", 401);

    const body = (await request.json()) as Body;
    if (!Array.isArray(body.executions) || body.executions.length === 0) {
      return bad("A non-empty executions array is required");
    }

    const accountId = body.accountId ?? "bybit-demo-doge";
    if (!Object.hasOwn(BOT_ACCOUNTS, accountId)) return bad("Unknown bot account");
    const config = BOT_ACCOUNTS[accountId as keyof typeof BOT_ACCOUNTS];
    if (body.executions.some((row) => !row || String(row.symbol ?? "").trim().toUpperCase() !== config.symbol))
      return bad("Execution symbol does not match the bot account");

    const existing = db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .get();
    if (!existing) {
      db.insert(accounts)
        .values({
          id: accountId,
          name: config.name,
          broker: config.broker,
          kind: "manual",
          currency: "USDT",
          initialBalance: config.initialBalance,
          profitCalcMethod: "fifo",
          autoSync: false,
          createdAt: nowIso(),
        })
        .run();
    }

    const rows = body.executions.map((row) => ({
      ...row,
      symbol: String(row.symbol || "")
        .trim()
        .toUpperCase(),
      assetClass: row.assetClass ?? "crypto",
      fee: row.fee ?? 0,
    }));

    const result = insertExecutions(accountId, rows, "sync", undefined, { preserveFees: true });
    // Retries with valid duplicate fills also confirm the bot is still reaching us.
    if (result.inserted + result.duplicates > 0) {
      db.update(accounts).set({ lastSyncAt: nowIso() }).where(eq(accounts.id, accountId)).run();
    }
    return ok({ accountId: accountId, ...result });
  },
  { public: true },
);
