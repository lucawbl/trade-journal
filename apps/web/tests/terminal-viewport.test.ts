import { describe, expect, it } from "vitest";
import {
  candleBounds,
  scaledCandleBounds,
  compactTradeResolution,
  executionChartRange,
  focusedExecution,
  tradeWindow,
  zoomIndices,
} from "../src/lib/terminal-viewport";
const bars = Array.from({ length: 100 }, (_, i) => ({
  time: i * 60000,
  open: 100,
  close: 101,
  high: 102,
  low: 99,
  volume: 1,
}));
describe("chart viewport", () => {
  it("frames the selected trade with a small context on each side", () => {
    expect(tradeWindow(bars, 40 * 60000, 50 * 60000)).toEqual({ start: 37, end: 53 });
    expect(tradeWindow(bars, 0, 200 * 60000)).toEqual({ start: 0, end: 99 });
  });
  it("ignores prices outside the visible window when scaling candles", () => {
    const data = bars.map((b) => ({ ...b }));
    data[0]!.low = 1;
    data[99]!.high = 100000;
    const bounds = candleBounds(data, 30, 50)!;
    expect(bounds.min).toBeGreaterThan(98);
    expect(bounds.max).toBeLessThan(103);
  });
  it("keeps flat PEPE prices visible with positive finite bounds", () => {
    const bounds = candleBounds(
      bars.map((b) => ({ ...b, low: 0.0000045, high: 0.0000045 })),
      0,
      99,
    )!;
    expect(bounds.min).toBeGreaterThan(0);
    expect(bounds.max).toBeGreaterThan(bounds.min);
  });
  it("zooms around a fixed point and stays inside the loaded candles", () => {
    expect(zoomIndices(204, 299, 300, 0.7, 1)).toEqual({ start: 233, end: 299 });
    const close = zoomIndices(204, 299, 300, 0.7);
    expect(close.end - close.start).toBeLessThan(95);
    expect(zoomIndices(0, 20, 300, 100)).toEqual({ start: 0, end: 299 });
    expect(zoomIndices(0, 2, 3, 0.01)).toEqual({ start: 0, end: 2 });
  });
});

import type { TerminalTrade } from "../src/lib/terminal-types";
const position = {
  closedAt: null,
  events: [
    { id: "first", time: 1000000, kind: "entry" },
    { id: "second", time: 2000000, kind: "entry" },
    { id: "sale", time: 2100000, kind: "exit" },
  ],
} as TerminalTrade;
it("focuses the latest recorded purchase of an open position and preserves its next execution", () => {
  expect(focusedExecution(position)).toEqual({ id: "second", from: 2000000, to: 2100000 });
  expect(focusedExecution(position, "first")?.to).toBe(2000000);
  expect(focusedExecution(position, "sale")?.id).toBe("sale");
  expect(focusedExecution(position, undefined, true)).toBeNull();
  expect(focusedExecution(position, "missing")).toBeNull();
});
it("loads a short real execution period and rejects times outside the position", () => {
  expect(executionChartRange(1000000, 3000000, 2000000)).toEqual({ from: 1700000, to: 3300000 });
  expect(executionChartRange(1000000, 3000000, 4000000)).toBeNull();
  expect(executionChartRange(1000000, 3000000, NaN)).toBeNull();
  expect(compactTradeResolution(0, 50 * 60000)).toBe("1m");
  expect(compactTradeResolution(0, 7 * 24 * 60 * 60000)).toBe("1d");
});
it("magnifies the vertical range around its center without changing candles", () => {
  const bounds = candleBounds(bars, 20, 40)!;
  const enlarged = scaledCandleBounds(bounds, 2)!;
  expect(enlarged.max - enlarged.min).toBeCloseTo((bounds.max - bounds.min) / 2);
  expect(enlarged.max + enlarged.min).toBeCloseTo(bounds.max + bounds.min);
  expect(scaledCandleBounds(bounds, 1)).toEqual(bounds);
  expect(bars[20]!.high).toBe(102);
});
