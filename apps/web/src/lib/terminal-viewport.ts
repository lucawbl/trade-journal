import type { MarketHistory } from "./market-data";
import { RESOLUTIONS, type Resolution } from "./market-data";
import type { TerminalTrade } from "./terminal-types";

/** Many fills can belong to one long position. Default to one recorded entry. */
export function focusedExecution(trade: TerminalTrade, id?: string, whole = false) {
  if (whole) return null;
  const events = [...trade.events].sort((a, b) => a.time - b.time);
  const selected = id
    ? events.find((event) => event.id === id)
    : !trade.closedAt || events.length > 8
      ? events.findLast((event) => event.kind === "entry")
      : undefined;
  if (!selected) return null;
  const next = events.find((event) => event.time > selected.time);
  return {
    id: selected.id,
    from: selected.time,
    to: Math.max(
      selected.time,
      Math.min(next?.time ?? selected.time + 45 * 60000, selected.time + 45 * 60000),
    ),
  };
}

export function compactTradeResolution(from: number, to: number): Resolution {
  return (
    (["1m", "5m", "15m", "1h", "1d"] as const).find(
      (resolution) => (to - from) / RESOLUTIONS[resolution] <= 120,
    ) ?? "1d"
  );
}

export function executionChartRange(opened: number, closed: number, at: number) {
  if (!Number.isFinite(at) || at < opened || at > closed) return null;
  return { from: Math.max(0, at - 5 * 60000), to: Math.min(closed + 5 * 60000, at + 45 * 60000) };
}

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

/** Magnification changes only the visible price range, never OHLC data. */
export function scaledCandleBounds(
  bounds: { min: number; max: number } | undefined,
  scale: number,
) {
  if (!bounds) return undefined;
  const middle = (bounds.min + bounds.max) / 2;
  const half = (bounds.max - bounds.min) / (2 * Math.min(8, Math.max(0.25, scale)));
  return { min: Math.max(Number.MIN_VALUE, middle - half), max: middle + half };
}
