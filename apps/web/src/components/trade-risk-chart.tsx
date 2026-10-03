"use client";
import dynamic from "next/dynamic";
import { LiveMarketChart } from "./live-market-chart";
import { isLiveSymbol } from "@/lib/live-market";
import { useEffect, useState } from "react";
import type { RoundTrip } from "@luxalgo/journal-core";
import { executionChart, type ChartExecution } from "@/lib/execution-chart";
import { riskTimeline, type BotRisk } from "@/lib/bot-risk";
import { number, priceNumber, timestamp } from "@/lib/journal-format";
import type { MarketHistory } from "@/lib/market-data";
import { RefreshCw } from "lucide-react";
const CandleCanvas = dynamic(
  () => import("./candle-canvas").then((module) => module.CandleCanvas),
  {
    ssr: false,
    loading: () => <p className="py-8 text-sm text-muted-foreground">Préparation du graphique…</p>,
  },
);

export function TradeRiskChart({
  trade,
  fills,
  risk,
  timeZone,
}: {
  trade: RoundTrip;
  fills: ChartExecution[];
  risk: BotRisk | null;
  timeZone: string;
}) {
  const [mode, setMode] = useState<"live" | "history">(trade.closedAt ? "history" : "live");
  const [history, setHistory] = useState<MarketHistory | null>(null);
  const [error, setError] = useState("");
  const [resolution, setResolution] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const { events } = executionChart(trade, fills);
  const levels = riskTimeline(trade, fills, risk);
  const lastExecution = events.at(-1)?.executedAt;
  const riskRefresh = risk?.fetchedAt;
  useEffect(() => {
    if (mode !== "history") return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setHistory(null);
    const query = resolution ? `?resolution=${resolution}` : "";
    void fetch(`/api/trades/${encodeURIComponent(trade.key)}/chart${query}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Bougies indisponibles");
        if (!controller.signal.aborted) setHistory(body);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [trade.key, trade.closedAt, lastExecution, riskRefresh, resolution, attempt, mode]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Mode du graphique">
        <button
          type="button"
          aria-label="Afficher le cours en direct"
          aria-pressed={mode === "live"}
          onClick={() => setMode("live")}
          className={`rounded-md border px-4 py-2 text-sm ${mode === "live" ? "bg-secondary font-medium" : "hover:bg-secondary"}`}
        >
          Direct
        </button>
        <button
          type="button"
          aria-label="Afficher l’historique du trade"
          aria-pressed={mode === "history"}
          onClick={() => setMode("history")}
          className={`rounded-md border px-4 py-2 text-sm ${mode === "history" ? "bg-secondary font-medium" : "hover:bg-secondary"}`}
        >
          Position
        </button>
      </div>
      {mode === "live" && isLiveSymbol(trade.symbol) ? (
        <LiveMarketChart
          key={trade.symbol}
          initialSymbol={trade.symbol}
          locked
          timeZone={timeZone}
          events={events}
          levels={levels}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="text-sm">
              Intervalle{" "}
              <select
                value={resolution}
                onChange={(event) => setResolution(event.target.value)}
                className="ml-2 rounded-md border bg-background p-2"
              >
                <option value="">Automatique</option>
                {["1m", "5m", "15m", "1h", "1d"].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              aria-label="Recharger le graphique"
              title="Recharger le graphique"
              disabled={loading}
              onClick={() => setAttempt((value) => value + 1)}
              className="rounded-md border px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50"
            >
              <RefreshCw size={16} aria-hidden="true" />
            </button>
          </div>
          {loading ? (
            <p role="status" className="py-8 text-sm">
              Chargement des bougies…
            </p>
          ) : error ? (
            <p role="alert" className="rounded-md border border-loss/30 p-4 text-sm">
              {error}
            </p>
          ) : history?.bars.length ? (
            <CandleCanvas history={history} events={events} levels={levels} timeZone={timeZone} />
          ) : (
            <p className="py-8 text-sm text-muted-foreground">
              Aucune bougie disponible sur cette période.
            </p>
          )}
          {history && (
            <p className="text-xs text-muted-foreground" title={`Fuseau : ${timeZone}`}>
              Binance Spot · {history.bars.length} bougies · {history.resolution}
              {history.truncated ? " · Historique incomplet" : ""}
            </p>
          )}
        </>
      )}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {risk ? (
          <>
            <span className="rounded-md border border-loss/25 bg-loss/5 px-3 py-1.5 text-loss">
              SL {number(risk.stopLossPct, 2)} %
            </span>
            <span className="rounded-md border border-profit/25 bg-profit/5 px-3 py-1.5 text-profit">
              TP {number(risk.takeProfitPct, 2)} %
            </span>
            <span className="text-muted-foreground">Références · réglages actuels</span>
          </>
        ) : (
          <span className="text-muted-foreground">SL/TP indisponibles</span>
        )}
      </div>
      {risk && !levels.length && (
        <p className="text-xs text-muted-foreground">
          Exécutions incomplètes · niveaux indisponibles
        </p>
      )}
      <details className="rounded-lg border p-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer">Lire le graphique</summary>
        <div className="mt-3 space-y-2">
          <p>
            Un bloc SL/TP par achat, jusqu’à l’exécution suivante. Les rectangles suivent la bougie
            d’entrée Binance et les pourcentages actuels du bot ; ce sont des repères, pas des
            ordres confirmés. Pour une entrée hors écran, ouvrez Position.
          </p>
          <p>
            Le tableau conserve les prix exécutés et les niveaux basés sur le prix moyen du bot. Les
            exécutions démo/testnet peuvent différer du cours Binance Spot.
          </p>
          <p>Zoom avec la barre du graphique · Sur mobile, glissez horizontalement.</p>
        </div>
      </details>
      {levels.length > 0 && (
        <details className="rounded-lg border p-3">
          <summary className="cursor-pointer text-sm font-medium">
            Exécutions · {levels.length}
          </summary>
          <div className="mt-3 max-h-96 overflow-auto">
            <table className="w-full whitespace-nowrap text-left text-xs">
              <caption className="sr-only">
                Niveaux de référence calculés, paramètres actuels du bot
              </caption>
              <thead>
                <tr>
                  {[
                    "Date",
                    "Exécution",
                    "Prix exécuté",
                    "Prix moyen en position",
                    "SL de référence",
                    "TP de référence",
                  ].map((label) => (
                    <th key={label} className="p-2 font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {levels.map((event) => (
                  <tr key={event.id} className="border-t">
                    <td className="p-2">{timestamp(event.executedAt, timeZone)}</td>
                    <td className="p-2">
                      {event.kind === "entry" ? "Entrée" : "Sortie"} (
                      {(event.kind === "entry") === (trade.direction === "long")
                        ? "achat"
                        : "vente"}
                      )
                    </td>
                    <td className="tnum p-2">{priceNumber(event.price)}</td>
                    <td className="tnum p-2">{priceNumber(event.basis)}</td>
                    <td className="tnum p-2 text-loss">{priceNumber(event.stopLoss)}</td>
                    <td className="tnum p-2 text-profit">{priceNumber(event.takeProfit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
