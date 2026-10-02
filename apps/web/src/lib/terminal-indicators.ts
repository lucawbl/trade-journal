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

export const INDICATOR_CATALOG = [
  { key: "rsi", name: "RSI", description: "Force relative · 14 périodes", group: "Oscillateurs" },
  {
    key: "ema",
    name: "EMA",
    description: "Moyenne exponentielle · 20 périodes",
    group: "Sur le prix",
  },
  { key: "sma", name: "SMA", description: "Moyenne simple · 20 périodes", group: "Sur le prix" },
  { key: "macd", name: "MACD", description: "Momentum · 12 / 26 / 9", group: "Oscillateurs" },
  {
    key: "bollinger",
    name: "Bandes de Bollinger",
    description: "Volatilité · 20 périodes, 2 écarts types",
    group: "Sur le prix",
  },
  {
    key: "wma",
    name: "WMA",
    description: "Moyenne pondérée · période réglable",
    group: "Sur le prix",
  },
  { key: "volume", name: "Volume", description: "Volume échangé par bougie", group: "Sur le prix" },
  { key: "mfi", name: "MFI", description: "Flux monétaire · 14 périodes", group: "Oscillateurs" },
  { key: "aroon", name: "Aroon", description: "Tendance · 14 périodes", group: "Oscillateurs" },
] as const;
export type IndicatorKey = (typeof INDICATOR_CATALOG)[number]["key"];
export type IndicatorSelection = Record<IndicatorKey, boolean>;
export const NO_INDICATORS: IndicatorSelection = {
  wma: false,
  mfi: false,
  aroon: false,
  volume: false,
  rsi: false,
  ema: false,
  sma: false,
  macd: false,
  bollinger: false,
};
export function sma(bars: MarketBar[], period = 20): (number | null)[] {
  let sum = 0;
  return bars.map((b, i) => {
    sum += b.close;
    if (i >= period) sum -= bars[i - period]!.close;
    return i < period - 1 ? null : sum / period;
  });
}
export function emaValues(values: (number | null)[], period: number): (number | null)[] {
  let previous: number | null = null,
    seed: number[] = [];
  const alpha = 2 / (period + 1);
  return values.map((value) => {
    if (value == null) {
      previous = null;
      seed = [];
      return null;
    }
    if (previous == null) {
      seed.push(value);
      if (seed.length < period) return null;
      previous = seed.reduce((a, b) => a + b, 0) / period;
    } else previous = alpha * value + (1 - alpha) * previous;
    return previous;
  });
}
export const ema = (bars: MarketBar[], period = 20) =>
  emaValues(
    bars.map((b) => b.close),
    period,
  );
export function rsi(bars: MarketBar[], period = 14): (number | null)[] {
  let gain = 0,
    loss = 0;
  return bars.map((bar, i) => {
    if (i === 0) return null;
    const change = bar.close - bars[i - 1]!.close;
    if (i <= period) {
      gain += Math.max(change, 0);
      loss += Math.max(-change, 0);
      if (i < period) return null;
      gain /= period;
      loss /= period;
    } else {
      gain = (gain * (period - 1) + Math.max(change, 0)) / period;
      loss = (loss * (period - 1) + Math.max(-change, 0)) / period;
    }
    return gain + loss === 0 ? 50 : (100 * gain) / (gain + loss);
  });
}
export function macd(bars: MarketBar[]) {
  const fast = ema(bars, 12),
    slow = ema(bars, 26);
  const value = fast.map((v, i) => (v == null || slow[i] == null ? null : v - slow[i]!));
  const signal = emaValues(value, 9);
  return {
    value,
    signal,
    histogram: value.map((v, i) => (v == null || signal[i] == null ? null : v - signal[i]!)),
  };
}
export function bollinger(bars: MarketBar[], period = 20) {
  const middle = sma(bars, period);
  const deviation = middle.map((value, i) =>
    value == null
      ? null
      : Math.sqrt(
          bars.slice(i - period + 1, i + 1).reduce((sum, b) => sum + (b.close - value) ** 2, 0) /
            period,
        ),
  );
  return {
    middle,
    upper: middle.map((v, i) => (v == null ? null : v + 2 * deviation[i]!)),
    lower: middle.map((v, i) => (v == null ? null : v - 2 * deviation[i]!)),
  };
}

/** Stable axis slots with disabled panes collapsed; the price pane takes the free space. */
export function indicatorLayout(selection: IndicatorSelection) {
  const names = ["mfi", "aroon", "rsi", "macd"] as const;
  const active = names.filter((key) => selection[key]);
  const mainHeight = [90, 66, 48, 42, 38][active.length]!;
  const gap = 3.5,
    paneHeight = active.length ? (90 - mainHeight - gap * active.length) / active.length : 0;
  return {
    mainHeight,
    active,
    panes: names.map((key, index) => ({
      key,
      axis: index + 1,
      enabled: selection[key],
      top: selection[key] ? 6 + mainHeight + gap + active.indexOf(key) * (paneHeight + gap) : 0,
      height: selection[key] ? paneHeight : 0,
    })),
    lastAxis: active.length ? names.indexOf(active.at(-1)!) + 1 : 0,
  };
}
