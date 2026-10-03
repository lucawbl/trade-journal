import { describe, it, expect } from "vitest";
import {
  wma,
  mfi,
  aroon,
  testWma,
  sma,
  ema,
  rsi,
  macd,
  bollinger,
  indicatorLayout,
  NO_INDICATORS,
} from "../src/lib/terminal-indicators";
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
    bars[4]!.open = 20;
    bars[6]!.open = 5;
    const value = testWma(bars, 3);
    expect(value.trades).toHaveLength(1);
    expect(value.trades[0]!.entryTime).toBe(240000);
    expect(value.trades[0]!.exitTime).toBe(360000);
    expect(value.equity).toBeCloseTo(((1000 * 0.999) / 20) * 5 * 0.999);
    expect(value.open).toBe(false);
  });
});

describe("popular indicators and pane layout", () => {
  it("uses the SMA seed then exponentially weights recent closes", () => {
    expect(sma([1, 2, 3, 4, 5].map(bar), 3)).toEqual([null, null, 2, 3, 4]);
    expect(ema([1, 2, 3, 7].map(bar), 3)).toEqual([null, null, 2, 4.5]);
  });
  it("RSI handles Wilder smoothing, flat prices and one-direction moves", () => {
    expect(rsi([10, 11, 12, 13].map(bar), 3)).toEqual([null, null, null, 100]);
    expect(rsi([13, 12, 11, 10].map(bar), 3).at(-1)).toBe(0);
    expect(rsi([10, 10, 10, 10].map(bar), 3).at(-1)).toBe(50);
    expect(rsi([10, 11, 12, 13, 12].map(bar), 3).at(-1)).toBeCloseTo(200 / 3);
  });
  it("MACD keeps its signal warmup and returns zero for flat prices", () => {
    const result = macd(Array.from({ length: 40 }, (_, i) => bar(10, i)));
    expect(result.value.slice(0, 25)).toEqual(Array(25).fill(null));
    expect(result.signal[32]).toBe(null);
    expect(result.signal[33]).toBe(0);
    expect(result.histogram.at(-1)).toBe(0);
  });
  it("Bollinger bands use population variance and enclose the moving mean", () => {
    const result = bollinger([1, 2, 3].map(bar), 3);
    expect(result.middle.at(-1)).toBe(2);
    expect(result.upper.at(-1)).toBeCloseTo(2 + 2 * Math.sqrt(2 / 3));
    expect(result.lower.at(-1)).toBeCloseTo(2 - 2 * Math.sqrt(2 / 3));
  });
  it("returns all available vertical space to candles without oscillators", () => {
    const empty = indicatorLayout(NO_INDICATORS),
      overlay = indicatorLayout({ ...NO_INDICATORS, ema: true });
    expect(empty.mainHeight).toBe(90);
    expect(empty.lastAxis).toBe(0);
    expect(empty.panes.every((p) => p.height === 0)).toBe(true);
    expect(overlay).toEqual(empty);
  });
  it("packs only enabled panes in order with no gaps reserved for disabled panes", () => {
    const layout = indicatorLayout({ ...NO_INDICATORS, rsi: true, macd: true });
    expect(layout.active).toEqual(["rsi", "macd"]);
    expect(layout.lastAxis).toBe(4);
    const active = layout.panes.filter((p) => p.enabled);
    expect(active[0]!.top).toBeCloseTo(6 + layout.mainHeight + 3.5);
    expect(active[1]!.top).toBeCloseTo(active[0]!.top + active[0]!.height + 3.5);
    expect(active[1]!.top + active[1]!.height).toBeCloseTo(96);
  });
});
