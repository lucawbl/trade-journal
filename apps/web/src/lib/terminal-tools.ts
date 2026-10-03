import type { MarketBar, Resolution } from "./market-data";
import { RESOLUTIONS } from "./market-data";
import type { Drawing } from "./terminal-indicators";

export const DRAWING_KINDS = [
  "trend",
  "horizontal",
  "vertical",
  "ray",
  "rectangle",
  "arc",
  "measure",
] as const;

export function isDrawing(value: unknown): value is Drawing {
  if (!value || typeof value !== "object") return false;
  const d = value as Drawing;
  const count = d.kind === "horizontal" || d.kind === "vertical" ? 1 : 2;
  return (
    typeof d.id === "string" &&
    DRAWING_KINDS.includes(d.kind) &&
    Array.isArray(d.points) &&
    d.points.length === count &&
    d.points.every(
      (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && p[1]! > 0,
    )
  );
}

/** Time anchors survive changing candle size. Out-of-range endpoints are not moved onto another date. */
export function drawingPath(
  d: Drawing,
  bars: MarketBar[],
  resolution: Resolution,
): [number, number][] {
  if (!isDrawing(d) || !bars.length) return [];
  const index = (time: number) =>
    bars.findIndex(
      (b) => b.time === Math.floor(time / RESOLUTIONS[resolution]) * RESOLUTIONS[resolution],
    );
  const start = d.points[0]!;
  const a = index(start[0]);
  if (d.kind === "horizontal")
    return [
      [0, start[1]],
      [bars.length - 1, start[1]],
    ];
  if (a < 0) return [];
  if (d.kind === "vertical")
    return [
      [a, Math.min(...bars.map((b) => b.low))],
      [a, Math.max(...bars.map((b) => b.high))],
    ];
  const end = d.points[1]!;
  const b = index(end[0]);
  if (b < 0) return [];
  if (d.kind === "rectangle")
    return [
      [a, start[1]],
      [b, start[1]],
      [b, end[1]],
      [a, end[1]],
      [a, start[1]],
    ];
  if (d.kind === "ray" && a !== b) {
    const x = b > a ? bars.length - 1 : 0;
    const y = start[1] + ((end[1] - start[1]) * (x - a)) / (b - a);
    return y > 0
      ? [
          [a, start[1]],
          [x, y],
        ]
      : [
          [a, start[1]],
          [b, end[1]],
        ];
  }
  if (d.kind === "arc") {
    const extent = Math.max(...bars.map((b) => b.high)) - Math.min(...bars.map((b) => b.low));
    const control = (start[1] + end[1]) / 2 + Math.max(Math.abs(end[1] - start[1]), extent * 0.12);
    return Array.from({ length: 41 }, (_, i) => {
      const t = i / 40;
      return [
        a + (b - a) * t,
        (1 - t) ** 2 * start[1] + 2 * (1 - t) * t * control + t ** 2 * end[1],
      ];
    });
  }
  return [
    [a, start[1]],
    [b, end[1]],
  ];
}

export function percentAlertPrice(
  reference: number,
  percent: number,
  direction: "above" | "below",
) {
  if (
    !Number.isFinite(reference) ||
    reference <= 0 ||
    !Number.isFinite(percent) ||
    percent <= 0 ||
    percent > 1000
  )
    return null;
  const price = reference * (1 + ((direction === "above" ? 1 : -1) * percent) / 100);
  return Number.isFinite(price) && price > 0 ? price : null;
}

export function replayStart(total: number) {
  return Math.max(1, Math.min(total - 1, Math.max(2, total - 60)));
}
