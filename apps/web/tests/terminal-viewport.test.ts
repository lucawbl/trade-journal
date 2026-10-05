import { describe, expect, it } from "vitest";
import { candleBounds, tradeWindow, zoomIndices } from "../src/lib/terminal-viewport";
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
