import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  trade: null as null | { symbol: string; openedAt: string; closedAt: string | null },
  history: vi.fn(),
}));
vi.mock("../src/server/trades-query", () => ({ getTradeByKey: () => state.trade }));
vi.mock("../src/server/market-data/public-crypto", () => ({ binance: { history: state.history } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
const { GET } = await import("../src/app/api/trades/[key]/chart/route");
const request = (query = "") =>
  GET(new Request(`http://localhost/api/trades/example/chart${query}`), {
    params: Promise.resolve({ key: "example" }),
  });
beforeEach(() => {
  vi.stubEnv("JOURNAL_PASSWORD", "");
  state.trade = {
    symbol: "BTCUSDT",
    openedAt: "2026-10-01T10:00:00Z",
    closedAt: "2026-10-01T11:00:00Z",
  };
  state.history.mockReset().mockResolvedValue({ bars: [], symbol: "BTCUSDT" });
});
afterEach(() => vi.unstubAllEnvs());
describe("trade candle endpoint", () => {
  it("authenticates before loading private trade data", async () => {
    vi.stubEnv("JOURNAL_PASSWORD", "private-password");
    expect((await request()).status).toBe(401);
    expect(state.history).not.toHaveBeenCalled();
  });
  it("chooses a bounded history window around the recorded trade", async () => {
    expect((await request()).status).toBe(200);
    expect(state.history).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: "BTCUSDT",
        resolution: "1m",
        from: Date.parse("2026-10-01T09:30:00Z"),
        to: Date.parse("2026-10-01T11:30:00Z"),
      }),
      "",
    );
  });
  it("rejects missing trades, unsupported symbols and oversized requests", async () => {
    expect((await request("?resolution=bad")).status).toBe(400);
    state.trade!.openedAt = "2026-09-01T10:00:00Z";
    expect((await request("?resolution=1m")).status).toBe(400);
    state.trade!.symbol = "UNSUPPORTED";
    expect((await request()).status).toBe(400);
    state.trade = null;
    expect((await request()).status).toBe(404);
    expect(state.history).not.toHaveBeenCalled();
  });
  it("returns a retryable error if the public candle provider is unavailable", async () => {
    state.history.mockRejectedValue(new Error("network"));
    expect((await request()).status).toBe(502);
  });
});
