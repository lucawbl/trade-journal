import { array, number, readJson, record, validateBars } from "./market-data/http";
import type { LiveSnapshot, LiveSymbol } from "@/lib/live-market";
import type { Resolution } from "@/lib/market-data";

/** Public market data only; include the forming candle and bypass history caches. */
export async function readLiveMarket(
  symbol: LiveSymbol,
  resolution: Resolution,
  signal?: AbortSignal,
): Promise<LiveSnapshot> {
  const base = "https://data-api.binance.vision/api/v3";
  const [rawBars, rawTicker] = await Promise.all([
    readJson(`${base}/klines?symbol=${symbol}&interval=${resolution}&limit=300`, {}, signal, {
      cache: false,
      timeoutMs: 10_000,
    }),
    readJson(`${base}/ticker/24hr?symbol=${symbol}`, {}, signal, {
      cache: false,
      timeoutMs: 10_000,
    }),
  ]);
  const bars = validateBars(
    array(rawBars).map((item) => {
      const row = array(item);
      return {
        time: number(row[0]),
        open: number(row[1]),
        high: number(row[2]),
        low: number(row[3]),
        close: number(row[4]),
        volume: number(row[5]),
      };
    }),
  );
  const ticker = record(rawTicker),
    price = number(ticker.lastPrice),
    changePct = number(ticker.priceChangePercent),
    marketTime = number(ticker.closeTime);
  if (
    !bars.length ||
    !Number.isFinite(price) ||
    price <= 0 ||
    !Number.isFinite(changePct) ||
    !Number.isFinite(marketTime)
  )
    throw new Error("Invalid live market response");
  return {
    provider: "Binance Spot",
    symbol,
    quoteCurrency: "USDT",
    resolution,
    bars,
    price,
    changePct,
    marketTime,
    fetchedAt: new Date().toISOString(),
    truncated: false,
    warnings: [],
  };
}
