import type { MarketBar } from "./market-data";

export function wma(bars: MarketBar[], period = 9): (number | null)[] {
  const divisor = (period * (period + 1)) / 2;
  return bars.map((_, i) =>
    i < period - 1
      ? null
      : bars.slice(i - period + 1, i + 1).reduce((sum, b, j) => sum + b.close * (j + 1), 0) /
        divisor,
  );
}
export function mfi(bars: MarketBar[], period = 14): (number | null)[] {
  const typical = (b: MarketBar) => (b.high + b.low + b.close) / 3;
  return bars.map((_, i) => {
    if (i < period) return null;
    let positive = 0,
      negative = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const flow = typical(bars[j]!) * bars[j]!.volume;
      if (typical(bars[j]!) > typical(bars[j - 1]!)) positive += flow;
      else if (typical(bars[j]!) < typical(bars[j - 1]!)) negative += flow;
    }
    return positive + negative === 0 ? 50 : (100 * positive) / (positive + negative);
  });
}
export function aroon(bars: MarketBar[], period = 14) {
  const up: (number | null)[] = [],
    down: (number | null)[] = [];
  bars.forEach((_, i) => {
    if (i < period) {
      up.push(null);
      down.push(null);
      return;
    }
    let high = i - period,
      low = high;
    for (let j = high + 1; j <= i; j++) {
      if (bars[j]!.high >= bars[high]!.high) high = j;
      if (bars[j]!.low <= bars[low]!.low) low = j;
    }
    up.push((100 * (period - (i - high))) / period);
    down.push((100 * (period - (i - low))) / period);
  });
  return { up, down };
}
/** Long-only research, signals on a closed candle, fills at next open; both sides pay fees. */
export function testWma(bars: MarketBar[], period = 9, feePct = 0.1) {
  const values = wma(bars, period);
  let equity = 1000,
    entry = 0,
    quantity = 0;
  const trades: { entryTime: number; exitTime: number; pnl: number }[] = [];
  let entryTime = 0,
    cost = 0;
  for (let i = period; i < bars.length; i++) {
    const prev = bars[i - 1]!,
      before = bars[i - 2]!;
    const a = values[i - 1],
      b = values[i - 2];
    if (a == null || b == null || !prev || !before) continue;
    if (!quantity && prev.close > a && before.close <= b) {
      entry = bars[i]!.open;
      cost = equity;
      quantity = (equity * (1 - feePct / 100)) / entry;
      entryTime = bars[i]!.time;
    } else if (quantity && prev.close < a && before.close >= b) {
      equity = quantity * bars[i]!.open * (1 - feePct / 100);
      trades.push({ entryTime, exitTime: bars[i]!.time, pnl: equity - cost });
      quantity = 0;
    }
  }
  const markedEquity = quantity
    ? quantity * (bars.at(-1)?.close ?? entry) * (1 - feePct / 100)
    : equity;
  return {
    trades,
    equity: markedEquity,
    returnPct: (markedEquity / 1000 - 1) * 100,
    open: quantity > 0,
  };
}
export type Drawing = {
  id: string;
  kind: "trend" | "horizontal" | "measure";
  points: [number, number][];
};
export type DrawingTool = "cursor" | Drawing["kind"];
