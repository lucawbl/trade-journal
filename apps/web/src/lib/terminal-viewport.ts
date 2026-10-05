import type { MarketHistory } from "./market-data";

export function tradeWindow(bars: MarketHistory["bars"], from: number, to: number) {
  const first = bars.findIndex((bar) => bar.time >= from);
  const after = bars.findIndex((bar) => bar.time > to);
  return {
    start: Math.max(0, first - 3),
    end: Math.min(bars.length - 1, (after < 0 ? bars.length - 1 : after - 1) + 3),
  };
}

export function candleBounds(bars: MarketHistory["bars"], start: number, end: number) {
  const visible = bars.slice(Math.max(0, start), Math.min(bars.length, end + 1));
  if (!visible.length) return undefined;
  const low = Math.min(...visible.map((bar) => bar.low));
  const high = Math.max(...visible.map((bar) => bar.high));
  const padding = Math.max((high - low) * 0.08, high * 0.00005, Number.EPSILON);
  return { min: Math.max(Number.MIN_VALUE, low - padding), max: high + padding };
}

export function zoomIndices(
  start: number,
  end: number,
  total: number,
  factor: number,
  anchor = 0.5,
) {
  const size = Math.min(
    total,
    Math.max(Math.min(8, total), Math.round((end - start + 1) * factor)),
  );
  const left = Math.max(
    0,
    Math.min(total - size, Math.round(start + (end - start + 1) * anchor - size * anchor)),
  );
  return { start: left, end: left + size - 1 };
}
