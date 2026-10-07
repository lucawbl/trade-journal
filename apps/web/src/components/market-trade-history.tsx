"use client";
import { useEffect, useState } from "react";
import { ArrowUpRight, ChartNoAxesCombined, ChevronRight } from "lucide-react";
import type { Execution } from "@luxalgo/journal-core";
import type { TerminalTrade } from "@/lib/terminal-types";
import { number, priceNumber, timestamp } from "@/lib/journal-format";
import { tradePath } from "@/lib/trade-links";
import { TradePositionVisuals, type TradePositionSummary } from "./trade-position-visuals";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";

type Detail = {
  trade: Omit<TradePositionSummary, "avgExit"> & {
    avgExit: number | null;
    openedAt: string;
    closedAt: string | null;
    currency: string;
    executionCount: number;
    notes: string | null;
    stopLoss: number | null;
    profitTarget: number | null;
    rating: number | null;
    durationMs: number | null;
    tagsJson: string;
    mistakesJson: string;
  };
  executions: Execution[];
};
const stateLabel = (status: string) =>
  status === "open"
    ? "Ouvert"
    : status === "win"
      ? "Gagnant"
      : status === "loss"
        ? "Perdant"
        : "Équilibre";

export function MarketTradeHistory({
  trades,
  symbol,
  timeZone,
  container,
  onShowTrade,
}: {
  trades: TerminalTrade[];
  symbol: string;
  timeZone: string;
  container: HTMLElement | null;
  onShowTrade: (trade: TerminalTrade, executionId?: string) => void;
}) {
  const [all, setAll] = useState(false);
  const [selected, setSelected] = useState<TerminalTrade | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [failure, setFailure] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    setDetail(null);
    setFailure("");
    if (!selected) return;
    const controller = new AbortController();
    void fetch(`/api/trades/${encodeURIComponent(selected.key)}`, {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
      cache: "no-store",
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Détails indisponibles.");
        if (!controller.signal.aborted) setDetail(data);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setFailure(error instanceof Error ? error.message : "Détails indisponibles.");
      });
    return () => controller.abort();
  }, [selected?.key, retry]);
  const visible = trades
    .filter((t) => all || t.symbol === symbol)
    .sort((a, b) => b.openedAt.localeCompare(a.openedAt) || a.key.localeCompare(b.key));
  const currentCount = trades.filter((t) => t.symbol === symbol).length;
  return (
    <section
      id="market-trade-history"
      className="border-t border-border bg-[#0b0e14] p-3 sm:p-5"
      aria-label="Historique des trades sous le graphique"
      data-market-trade-history
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">
          Trades <span className="ml-1 text-muted-foreground">{visible.length}</span>
        </h2>
        <div className="flex gap-1 rounded-lg bg-secondary p-1" aria-label="Trades affichés">
          <button
            className={`rounded-md px-3 py-2 text-xs ${!all ? "bg-card text-brand" : "text-muted-foreground"}`}
            aria-pressed={!all}
            onClick={() => setAll(false)}
          >
            {symbol.replace("USDT", "")} · {currentCount}
          </button>
          <button
            className={`rounded-md px-3 py-2 text-xs ${all ? "bg-card text-brand" : "text-muted-foreground"}`}
            aria-pressed={all}
            onClick={() => setAll(true)}
          >
            Tous · {trades.length}
          </button>
        </div>
      </div>
      <div className="grid gap-2 lg:grid-cols-2">
        {visible.map((trade) => (
          <button
            type="button"
            key={trade.key}
            onClick={() => {
              setDetail(null);
              setFailure("");
              setSelected(trade);
            }}
            aria-label={`Détails du trade ${trade.symbol} ${timestamp(trade.openedAt, timeZone)}`}
            className="grid min-w-0 grid-cols-[1fr_auto] items-center gap-2 rounded-lg border border-border bg-card p-3 text-left hover:border-brand focus-visible:outline focus-visible:outline-brand"
            data-trade-key={trade.key}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <strong>{trade.symbol.replace("USDT", "")}</strong>
                <span className="text-xs text-muted-foreground">
                  {trade.direction === "long" ? "Long" : "Short"}
                </span>
                <span
                  className={`text-[11px] ${trade.status === "open" ? "text-brand" : trade.status === "loss" ? "text-loss" : "text-profit"}`}
                >
                  {stateLabel(trade.status)}
                </span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {timestamp(trade.openedAt, timeZone)}
              </div>
              <div className="mt-1 truncate text-[11px] text-muted-foreground">{trade.account}</div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-right font-semibold ${trade.netPnl < 0 ? "text-loss" : "text-profit"}`}
              >
                {number(trade.netPnl)}
                <small className="block text-[10px] font-normal text-muted-foreground">
                  {trade.currency}
                </small>
              </span>
              <ChevronRight size={15} className="text-muted-foreground" />
            </div>
          </button>
        ))}
        {!visible.length && (
          <p className="p-4 text-xs text-muted-foreground">Aucun trade enregistré.</p>
        )}
      </div>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent container={container} className="grid-cols-1 max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {selected?.symbol.replace("USDT", " / USDT")} ·{" "}
              {selected ? stateLabel(selected.status) : "Trade"}
            </DialogTitle>
            <DialogDescription>
              {selected?.account} · {selected?.direction === "long" ? "Long" : "Short"}
            </DialogDescription>
          </DialogHeader>
          {failure ? (
            <div role="alert" className="text-sm text-loss">
              {failure}
              <button className="ml-3 text-brand" onClick={() => setRetry((v) => v + 1)}>
                Réessayer
              </button>
            </div>
          ) : !detail ? (
            <p role="status" className="text-sm text-muted-foreground">
              Chargement…
            </p>
          ) : (
            <>
              <TradePositionVisuals
                trade={{ ...detail.trade, avgExit: detail.trade.avgExit ?? undefined }}
                currency={detail.trade.currency}
              />
              <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                <div>
                  <dt className="text-muted-foreground">Ouverture</dt>
                  <dd className="mt-1">{timestamp(detail.trade.openedAt, timeZone)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Clôture</dt>
                  <dd className="mt-1">
                    {detail.trade.closedAt
                      ? timestamp(detail.trade.closedAt, timeZone)
                      : "En cours"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Durée</dt>
                  <dd className="mt-1">
                    {detail.trade.durationMs == null
                      ? "En cours"
                      : `${number(detail.trade.durationMs / 60000, 1)} min`}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Exécutions</dt>
                  <dd className="mt-1">{detail.executions.length}</dd>
                </div>
              </dl>
              <details className="min-w-0 rounded-lg border p-3 text-xs" open>
                <summary className="cursor-pointer font-medium">
                  Achats et ventes · {detail.executions.length}
                </summary>
                <div className="mt-3 max-h-64 overflow-auto">
                  <table className="w-full whitespace-nowrap text-left">
                    <thead className="text-muted-foreground">
                      <tr>
                        {["Date", "Sens", "Prix", "Quantité", "Frais", "Graphique"].map((label) => (
                          <th className="px-2 py-2 font-normal" key={label}>
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detail.executions.map((fill) => (
                        <tr className="border-t" key={fill.id}>
                          <td className="px-2 py-2">{timestamp(fill.executedAt, timeZone)}</td>
                          <td
                            className={`px-2 py-2 ${fill.side === "buy" ? "text-profit" : "text-loss"}`}
                          >
                            {fill.side === "buy" ? "Achat" : "Vente"}
                          </td>
                          <td className="px-2 py-2">{priceNumber(fill.price)}</td>
                          <td className="px-2 py-2">{number(fill.quantity, 6)}</td>
                          <td className="px-2 py-2">{priceNumber(fill.fee)}</td>
                          <td className="px-2 py-2">
                            <button
                              className="rounded-md border p-2 text-brand"
                              aria-label={`Voir ${fill.side === "buy" ? "l’achat" : "la vente"} du ${timestamp(fill.executedAt, timeZone)} sur le graphique`}
                              onClick={() => {
                                if (selected) onShowTrade(selected, fill.id);
                                setSelected(null);
                              }}
                            >
                              <ChartNoAxesCombined size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
              {detail.trade.notes && (
                <details className="rounded-lg border p-3 text-xs">
                  <summary className="cursor-pointer">Notes</summary>
                  <p className="mt-2 whitespace-pre-wrap break-words">{detail.trade.notes}</p>
                </details>
              )}
            </>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {selected && (
              <button
                className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm text-white"
                onClick={() => {
                  onShowTrade(selected);
                  setSelected(null);
                }}
              >
                <ChartNoAxesCombined size={16} />
                Voir sur le graphique
              </button>
            )}
            {selected && (
              <a
                className="inline-flex items-center gap-2 px-3 py-2 text-sm text-brand"
                href={tradePath(selected.key)}
              >
                Fiche complète
                <ArrowUpRight size={15} />
              </a>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
