import { bad, handler, ok } from "@/server/api";
import { isLiveSymbol } from "@/lib/live-market";
import { isResolution } from "@/lib/market-data";
import { readLiveMarket } from "@/server/live-market";
export const GET = handler(async (request: Request) => {
  const params = new URL(request.url).searchParams;
  const symbol = params.get("symbol") ?? "DOGEUSDT",
    resolution = params.get("resolution") ?? "1m";
  if (!isLiveSymbol(symbol)) return bad("Choisissez DOGE, PEPE ou BTC");
  if (!isResolution(resolution)) return bad("Unité de temps invalide");
  try {
    return ok(await readLiveMarket(symbol, resolution, request.signal));
  } catch {
    return bad(
      "Le flux de prix est temporairement indisponible. Nouvelle tentative automatique.",
      502,
    );
  }
});
