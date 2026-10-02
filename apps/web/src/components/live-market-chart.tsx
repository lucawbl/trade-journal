"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import { useLiveMarket } from "@/hooks/use-live-market";
import { LIVE_SYMBOLS, type LiveSymbol } from "@/lib/live-market";
import type { Resolution } from "@/lib/market-data";
import { number, priceNumber } from "@/lib/journal-format";
import type { riskTimeline } from "@/lib/bot-risk";
import type { executionChart } from "@/lib/execution-chart";
const CandleCanvas = dynamic(
  () => import("./candle-canvas").then((module) => module.CandleCanvas),
  {
    ssr: false,
    loading: () => <p className="py-8 text-sm text-muted-foreground">Préparation du graphique…</p>,
  },
);
const EMPTY_EVENTS: ReturnType<typeof executionChart>["events"] = [];
const EMPTY_LEVELS: ReturnType<typeof riskTimeline> = [];
export function LiveMarketChart({
  initialSymbol = "DOGEUSDT",
  locked = false,
  timeZone,
  events = EMPTY_EVENTS,
  levels = EMPTY_LEVELS,
}: {
  initialSymbol?: LiveSymbol;
  locked?: boolean;
  timeZone: string;
  events?: ReturnType<typeof executionChart>["events"];
  levels?: ReturnType<typeof riskTimeline>;
}) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [resolution, setResolution] = useState<Resolution>("1m");
  const [enabled, setEnabled] = useState(true);
  const { snapshot, status, error, receivedAt } = useLiveMarket(symbol, resolution, enabled);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <label className="text-sm">
            Crypto{" "}
            <select
              aria-label="Crypto en direct"
              disabled={locked}
              value={symbol}
              onChange={(event) => setSymbol(event.target.value as LiveSymbol)}
              className="ml-2 rounded-md border bg-background p-2 disabled:opacity-80"
            >
              {LIVE_SYMBOLS.map((pair) => (
                <option key={pair} value={pair}>
                  {pair.replace("USDT", " / USDT")}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Bougies{" "}
            <select
              aria-label="Unité de temps en direct"
              value={resolution}
              onChange={(event) => setResolution(event.target.value as Resolution)}
              className="ml-2 rounded-md border bg-background p-2"
            >
              {["1m", "5m", "15m", "1h", "1d"].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          aria-pressed={!enabled}
          onClick={() => setEnabled((value) => !value)}
          className="rounded-md border px-3 py-2 text-sm hover:bg-secondary"
        >
          {enabled ? "Mettre en pause" : "Reprendre le direct"}
        </button>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border p-4">
        <div>
          <p className="text-xs text-muted-foreground">Cours du marché · Binance Spot</p>
          <p className="tnum mt-1 text-2xl font-semibold" data-live-price>
            {snapshot ? priceNumber(snapshot.price) : "—"}{" "}
            <span className="text-sm text-muted-foreground">USDT</span>
          </p>
          <p
            className={`tnum mt-1 text-sm ${snapshot && snapshot.changePct < 0 ? "text-loss" : "text-profit"}`}
          >
            {snapshot
              ? `${snapshot.changePct > 0 ? "+" : ""}${number(snapshot.changePct, 2)} % sur 24 h`
              : "Chargement du cours…"}
          </p>
        </div>
        <div className="text-right text-xs">
          <p
            className={status === "Flux en direct" ? "text-profit" : "text-muted-foreground"}
            data-live-status
          >
            {status}
          </p>
          <p className="mt-1 text-muted-foreground" data-live-updated>
            {receivedAt
              ? `Dernière réception : ${new Date(receivedAt).toISOString().slice(11, 19)} UTC`
              : "En attente du marché"}
          </p>
        </div>
      </div>
      {error && (
        <p role="alert" className="rounded-md border border-loss/30 p-3 text-sm">
          {error}
          {snapshot ? " Le dernier cours reçu reste affiché." : ""}
        </p>
      )}
      {snapshot ? (
        <CandleCanvas
          history={snapshot}
          events={events}
          levels={levels}
          timeZone={timeZone}
          livePrice={snapshot.price}
        />
      ) : (
        <p role="status" className="py-8 text-sm">
          {enabled ? "Connexion au marché…" : "Le graphique est en pause."}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        La dernière bougie est en formation. Flux en direct, avec actualisation de secours toutes
        les 3 secondes. Pause automatique quand l’onglet est masqué. Les prix du marché peuvent
        différer des exécutions démo/testnet.
      </p>
      {events.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Les achats et ventes compris dans les 300 dernières bougies apparaissent ici. Pour les
          exécutions plus anciennes, sélectionnez « Historique du trade ».
        </p>
      )}
    </div>
  );
}
