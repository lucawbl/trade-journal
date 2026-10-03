import { describe, expect, it } from "vitest";
import { drawingPath, isDrawing, percentAlertPrice, replayStart } from "../src/lib/terminal-tools";
import type { Drawing } from "../src/lib/terminal-indicators";
const bars = Array.from({ length: 10 }, (_, i) => ({
  time: i * 60000,
  open: 100,
  high: 110,
  low: 90,
  close: 100,
  volume: 1,
}));
const drawing = (kind: Drawing["kind"]): Drawing => ({
  id: "test",
  kind,
  points: [
    [120000, 100],
    [300000, 105],
  ],
});
describe("terminal drawings and price alerts", () => {
  it("rejects malformed device drawings before they can reach the chart", () => {
    expect(isDrawing(null)).toBe(false);
    expect(
      isDrawing({
        ...drawing("arc"),
        points: [
          [0, NaN],
          [60000, 100],
        ],
      }),
    ).toBe(false);
    expect(isDrawing({ ...drawing("vertical"), points: [[0, 100]] })).toBe(true);
    expect(isDrawing(drawing("arc"))).toBe(true);
  });
  it("anchors a rectangle to its real candle times and closes its outline", () => {
    expect(drawingPath(drawing("rectangle"), bars, "1m")).toEqual([
      [2, 100],
      [5, 100],
      [5, 105],
      [2, 105],
      [2, 100],
    ]);
    expect(
      drawingPath(
        {
          ...drawing("rectangle"),
          points: [
            [120000, 100],
            [99999999, 105],
          ],
        },
        bars,
        "1m",
      ),
    ).toEqual([]);
  });
  it("draws a curved arc with exact endpoints", () => {
    const path = drawingPath(drawing("arc"), bars, "1m");
    expect(path).toHaveLength(41);
    expect(path[0]).toEqual([2, 100]);
    expect(path.at(-1)).toEqual([5, 105]);
    expect(path[20]![1]).toBeGreaterThan(102.5);
  });
  it("extends a ray forwards or backwards without changing its slope", () => {
    expect(drawingPath(drawing("ray"), bars, "1m")).toEqual([
      [2, 100],
      [9, 100 + (5 * 7) / 3],
    ]);
    expect(
      drawingPath(
        {
          ...drawing("ray"),
          points: [
            [300000, 105],
            [120000, 100],
          ],
        },
        bars,
        "1m",
      ),
    ).toEqual([
      [5, 105],
      [0, 105 - 25 / 3],
    ]);
  });
  it("converts the entered percentage to a fixed positive target from the displayed reference", () => {
    expect(percentAlertPrice(100, 2, "above")).toBe(102);
    expect(percentAlertPrice(100, 2, "below")).toBe(98);
    expect(percentAlertPrice(0.000004, 10, "below")).toBeCloseTo(0.0000036, 12);
    expect(percentAlertPrice(100, 100, "below")).toBeNull();
    expect(percentAlertPrice(100, NaN, "above")).toBeNull();
  });
  it("keeps replay starting positions inside short and long datasets", () => {
    expect(replayStart(2)).toBe(1);
    expect(replayStart(10)).toBe(2);
    expect(replayStart(300)).toBe(240);
  });
});
