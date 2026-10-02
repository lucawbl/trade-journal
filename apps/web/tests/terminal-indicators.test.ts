import { describe, it, expect } from "vitest";
import { wma, mfi, aroon, testWma } from "../src/lib/terminal-indicators";
import type { MarketBar } from "../src/lib/market-data";
const bar = (close: number, i: number): MarketBar => ({
  time: i * 60000,
  open: close,
  high: close + 1,
  low: close - 1,
  close,
  volume: 10,
});
describe("terminal indicators", () => {
  it("weights recent WMA candles more strongly and preserves warmup", () => {
    expect(wma([1, 2, 3, 4].map(bar), 3)).toEqual([null, null, 14 / 6, 20 / 6]);
  });
  it("MFI handles rising, falling and equal flows without division by zero", () => {
    expect(mfi([10, 11, 12, 13].map(bar), 3).at(-1)).toBe(100);
    expect(mfi([13, 12, 11, 10].map(bar), 3).at(-1)).toBe(0);
    expect(mfi([10, 10, 10, 10].map(bar), 3).at(-1)).toBe(50);
  });
  it("Aroon uses the latest equal extreme in the inclusive lookback", () => {
    const value = aroon([10, 11, 12, 13].map(bar), 3);
    expect(value.up).toEqual([null, null, null, 100]);
    expect(value.down.at(-1)).toBe(0);
    expect(aroon([10, 10, 10, 10].map(bar), 3).down.at(-1)).toBe(100);
  });
  it("executes WMA crossing at the following open, not the signal close, and charges both sides", () => {
    const bars = [10, 9, 8, 12, 13, 7, 6].map(bar);
    bars[4].open = 20;
    bars[6].open = 5;
    const value = testWma(bars, 3);
    expect(value.trades).toHaveLength(1);
    expect(value.trades[0].entryTime).toBe(240000);
    expect(value.trades[0].exitTime).toBe(360000);
    expect(value.equity).toBeCloseTo(((1000 * 0.999) / 20) * 5 * 0.999);
    expect(value.open).toBe(false);
  });
});
