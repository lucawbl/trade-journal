import { bad, handler, ok } from "@/server/api";
import { getTradeByKey, queryTrades } from "@/server/trades-query";
import { binance } from "@/server/market-data/public-crypto";
import { chartResolution } from "@/lib/bot-risk";
import { isResolution, RESOLUTIONS } from "@/lib/market-data";

export const GET = handler(
  async (request: Request, { params }: { params: Promise<{ key: string }> }) => {
    const { key } = await params;
    const trade = getTradeByKey(key);
    if (!trade) return bad("Trade introuvable", 404);
    if (!["DOGEUSDT", "PEPEUSDT", "BTCUSDT"].includes(trade.symbol))
      return bad("Symbole non pris en charge");
    const now = Date.now();
    const opened = Date.parse(trade.openedAt),
      closed = trade.closedAt ? Date.parse(trade.closedAt) : now;
    if (!Number.isFinite(opened) || !Number.isFinite(closed) || opened > now)
      return bad("Dates du trade invalides");
    const overview = new URL(request.url).searchParams.get("scope") === "symbol";
    const related = overview ? queryTrades({ symbol: trade.symbol }).rows : [];
    const earliest = overview
      ? Math.min(opened, ...related.map((row) => Date.parse(row.openedAt)).filter(Number.isFinite))
      : opened;
    const from = Math.max(0, earliest - 30 * 60_000),
      to = overview ? now : Math.min(now, closed + 30 * 60_000);
    const selected = new URL(request.url).searchParams.get("resolution");
    const resolution = selected && isResolution(selected) ? selected : chartResolution(from, to);
    if (selected && !isResolution(selected)) return bad("Unité de temps invalide");
    if ((to - from) / RESOLUTIONS[resolution] > 1500)
      return bad("Choisissez une unité de temps plus grande pour ce trade");
    try {
      const history = await binance.history(
        { symbol: trade.symbol, resolution, from, to, signal: request.signal },
        "",
      );
      return ok(history);
    } catch {
      return bad("Bougies indisponibles pour le moment. Réessayez.", 502);
    }
  },
);
