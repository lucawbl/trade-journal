import type { BotRisk } from "@/lib/bot-risk";

const BOTS: Record<string, { symbol: string; url: string }> = {
  "bybit-demo-doge": {
    symbol: "DOGEUSDT",
    url: "https://bot-production-15db.up.railway.app/api/status",
  },
  "binance-testnet-pepe": {
    symbol: "PEPEUSDT",
    url: "https://botpepe-production.up.railway.app/api/status",
  },
  "binance-testnet-btc": {
    symbol: "BTCUSDT",
    url: "https://determined-emotion-production-c6f5.up.railway.app/api/status",
  },
};

export async function readBotRisk(accountId: string, symbol: string): Promise<BotRisk | null> {
  const bot = BOTS[accountId];
  if (!bot || bot.symbol !== symbol) return null;
  try {
    const response = await fetch(bot.url, {
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const body = await response.json();
    const stop = body.stop_loss_pct,
      target = body.take_profit_pct;
    if (
      body.symbol !== symbol ||
      typeof stop !== "number" ||
      typeof target !== "number" ||
      !Number.isFinite(stop) ||
      !Number.isFinite(target) ||
      stop <= 0 ||
      stop >= 100 ||
      target <= 0 ||
      target > 1000
    )
      return null;
    return { stopLossPct: stop, takeProfitPct: target, fetchedAt: new Date().toISOString() };
  } catch {
    return null;
  }
}
