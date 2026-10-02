import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const read = vi.hoisted(() => vi.fn());
vi.mock("../src/server/market-data/http", async (original) => ({
  ...(await original<object>()),
  readJson: read,
}));
const { readLiveMarket } = await import("../src/server/live-market");
beforeEach(() => read.mockReset());
afterEach(() => vi.restoreAllMocks());
describe("live market bootstrap", () => {
  it("includes the forming candle and bypasses cached history requests", async () => {
    read.mockImplementation(async (url: string) =>
      url.includes("klines")
        ? [[Date.now(), "100", "105", "99", "103", "2"]]
        : { lastPrice: "103", priceChangePercent: "3", closeTime: Date.now() },
    );
    const result = await readLiveMarket("BTCUSDT", "1m");
    expect(result.bars).toHaveLength(1);
    expect(result.price).toBe(103);
    expect(read.mock.calls.every((call) => call[3].cache === false)).toBe(true);
  });
  it("rejects an invalid ticker instead of displaying a fake zero price", async () => {
    read.mockImplementation(async (url: string) =>
      url.includes("klines")
        ? [[Date.now(), "100", "105", "99", "103", "2"]]
        : { lastPrice: "NaN", priceChangePercent: "3", closeTime: Date.now() },
    );
    await expect(readLiveMarket("BTCUSDT", "1m")).rejects.toThrow();
  });
});
