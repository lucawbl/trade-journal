import type { MarketBar, MarketHistory, Resolution } from "./market-data";
export const LIVE_SYMBOLS = ["DOGEUSDT", "PEPEUSDT", "BTCUSDT"] as const;
export type LiveSymbol = (typeof LIVE_SYMBOLS)[number];
export function isLiveSymbol(value: unknown): value is LiveSymbol {
  return LIVE_SYMBOLS.includes(value as LiveSymbol);
}
export interface LiveSnapshot extends MarketHistory {
  symbol: LiveSymbol;
  price: number;
  changePct: number;
  marketTime: number;
}
export interface LiveTick {
  symbol: string;
  resolution?: Resolution;
  bar?: MarketBar;
  price: number;
  changePct?: number;
  marketTime: number;
}

export function parseLiveTick(payload: unknown): LiveTick | null {
  if (!payload || typeof payload !== "object") return null;
  const packet = payload as { data?: unknown };
  const body = (packet.data ?? payload) as Record<string, unknown>;
  if (!body || !isLiveSymbol(body.s)) return null;
  const marketTime = Number(body.E);
  if (!Number.isFinite(marketTime)) return null;
  if (body.e === "24hrMiniTicker") {
    const price = Number(body.c),
      open = Number(body.o);
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(open) || open <= 0) return null;
    return { symbol: body.s, price, changePct: (price / open - 1) * 100, marketTime };
  }
  if (body.e !== "kline" || !body.k || typeof body.k !== "object") return null;
  const k = body.k as Record<string, unknown>;
  if (!["1m", "5m", "15m", "1h", "1d"].includes(String(k.i))) return null;
  const bar = {
    time: Number(k.t),
    open: Number(k.o),
    high: Number(k.h),
    low: Number(k.l),
    close: Number(k.c),
    volume: Number(k.v),
  };
  if (
    !Object.values(bar).every(Number.isFinite) ||
    bar.time < 0 ||
    bar.volume < 0 ||
    bar.low <= 0 ||
    bar.low > Math.min(bar.open, bar.close) ||
    bar.high < Math.max(bar.open, bar.close)
  )
    return null;
  return { symbol: body.s, resolution: k.i as Resolution, bar, price: bar.close, marketTime };
}

/** Replace the forming candle, append the next candle and reject stale feed frames. */
export function applyLiveTick(snapshot: LiveSnapshot, tick: LiveTick): LiveSnapshot {
  if (
    tick.symbol !== snapshot.symbol ||
    tick.marketTime < snapshot.marketTime ||
    (tick.resolution && tick.resolution !== snapshot.resolution)
  )
    return snapshot;
  let bars = snapshot.bars;
  if (tick.bar) {
    const last = bars.at(-1);
    if (last && tick.bar.time < last.time) return snapshot;
    bars =
      last?.time === tick.bar.time
        ? [...bars.slice(0, -1), tick.bar]
        : [...bars, tick.bar].slice(-300);
  }
  return {
    ...snapshot,
    bars,
    price: tick.price,
    changePct: tick.changePct ?? snapshot.changePct,
    marketTime: tick.marketTime,
    fetchedAt: new Date(tick.marketTime).toISOString(),
  };
}
