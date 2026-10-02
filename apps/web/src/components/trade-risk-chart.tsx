"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { RoundTrip } from "@luxalgo/journal-core";
import { executionChart, type ChartExecution } from "@/lib/execution-chart";
import { riskTimeline, type BotRisk } from "@/lib/bot-risk";
import { number, priceNumber, timestamp } from "@/lib/journal-format";
import type { MarketHistory } from "@/lib/market-data";
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
  }, [trade.key, trade.closedAt, lastExecution, riskRefresh, resolution, attempt]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="text-sm">
          Unité de temps{" "}
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
          disabled={loading}
          onClick={() => setAttempt((value) => value + 1)}
          className="rounded-md border px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50"
        >
          Recharger le graphique
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Bougies clôturées du marché Binance Spot · Exécutions du bot démo/testnet : leurs prix
        peuvent différer du marché. Zoom avec la barre sous le graphique · Sur mobile, faites
        glisser le graphique horizontalement.
      </p>
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
        <p className="text-xs text-muted-foreground">
          {history.bars.length} bougies · {history.resolution} · Fuseau : {timeZone}
          {history.truncated ? " · Historique incomplet" : ""}
        </p>
      )}
      {risk ? (
        <p className="rounded-md border p-3 text-xs text-muted-foreground">
          SL {number(risk.stopLossPct, 2)} % · TP {number(risk.takeProfitPct, 2)} % : repères
          calculés sur le prix moyen en position à partir des paramètres actuels du bot. Ils ne
          constituent pas un historique d’ordres stop placés ni une preuve du motif de vente. Après
          une vente complète, les lignes s’arrêtent.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Paramètres SL/TP indisponibles : aucun niveau n’est inventé.
        </p>
      )}
      {risk && !levels.length && (
        <p className="text-xs text-muted-foreground">
          Historique d’exécutions incomplet : les niveaux ne peuvent pas être reconstruits.
        </p>
      )}
      {levels.length > 0 && (
        <details className="rounded-lg border p-3" open={levels.length <= 10}>
          <summary className="cursor-pointer text-sm font-medium">
            SL et TP pour chaque entrée et sortie · {levels.length} exécutions
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
