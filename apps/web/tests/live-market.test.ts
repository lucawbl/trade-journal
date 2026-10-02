import { describe, expect, it } from "vitest";
import { applyLiveTick, parseLiveTick, type LiveSnapshot } from "../src/lib/live-market";
const bar = { time: 60000, open: 100, high: 102, low: 99, close: 101, volume: 2 };
const snapshot: LiveSnapshot = {
  provider: "Binance Spot",
  symbol: "BTCUSDT",
  resolution: "1m",
  bars: [bar],
  price: 101,
  changePct: 1,
  marketTime: 60001,
  fetchedAt: "2026-10-02T10:00:00Z",
  truncated: false,
  warnings: [],
};
describe("live market frames", () => {
  it("replaces the forming candle and appends the next without duplicates", () => {
    const updated = applyLiveTick(snapshot, {
      symbol: "BTCUSDT",
      resolution: "1m",
      price: 102,
      marketTime: 60002,
      bar: { ...bar, close: 102 },
    });
    expect(updated.bars).toHaveLength(1);
    expect(updated.bars[0]!.close).toBe(102);
    const next = applyLiveTick(updated, {
      symbol: "BTCUSDT",
      resolution: "1m",
      price: 103,
      marketTime: 120001,
      bar: { ...bar, time: 120000, high: 104, close: 103 },
    });
    expect(next.bars).toHaveLength(2);
    expect(next.price).toBe(103);
  });
  it("rejects old frames and frames from another coin or timeframe", () => {
    for (const extra of [
      { marketTime: 0 },
      { symbol: "PEPEUSDT" },
      { resolution: "5m" as const },
    ]) {
      expect(
        applyLiveTick(snapshot, {
          symbol: "BTCUSDT",
          resolution: "1m",
          price: 999,
          marketTime: 60002,
          ...extra,
        }),
      ).toBe(snapshot);
    }
  });
  it("parses ticker updates and rejects invalid feed values", () => {
    const tick = parseLiveTick({
      data: { e: "24hrMiniTicker", s: "BTCUSDT", c: "110", o: "100", E: 60002 },
    });
    expect(tick?.changePct).toBeCloseTo(10);
    expect(applyLiveTick(snapshot, tick!).price).toBe(110);
    expect(
      parseLiveTick({ e: "24hrMiniTicker", s: "BTCUSDT", c: "NaN", o: "100", E: 60002 }),
    ).toBeNull();
    expect(
      parseLiveTick({
        e: "kline",
        s: "BTCUSDT",
        E: 60002,
        k: { i: "1m", t: 60000, o: "100", h: "80", l: "99", c: "101", v: "1" },
      }),
    ).toBeNull();
  });
  it("limits the rolling window to 300 candles", () => {
    const full = {
      ...snapshot,
      bars: Array.from({ length: 300 }, (_, i) => ({ ...bar, time: i * 60000 })),
    };
    expect(
      applyLiveTick(full, {
        symbol: "BTCUSDT",
        resolution: "1m",
        price: 101,
        marketTime: 18000001,
        bar: { ...bar, time: 18000000 },
      }).bars,
    ).toHaveLength(300);
  });
});
