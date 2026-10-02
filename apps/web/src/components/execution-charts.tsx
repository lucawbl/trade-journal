"use client";

import { useState } from "react";
import type { RoundTrip } from "@luxalgo/journal-core";
import { executionChart, type ChartExecution } from "@/lib/execution-chart";
import { number, timestamp } from "@/lib/journal-format";

export function ExecutionCharts({
  trade,
  fills,
  currency,
  timeZone,
}: {
  trade: RoundTrip;
  fills: ChartExecution[];
  currency: string;
  timeZone: string;
}) {
  const { events, complete } = executionChart(trade, fills);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = events.find((event) => event.id === selectedId) ?? events.at(-1);
  if (!events.length)
    return (
      <p className="text-sm text-muted-foreground">
        Aucune exécution disponible pour tracer ce trade.
      </p>
    );
  const first = events[0]!.time,
    last = events.at(-1)!.time;
  const span = Math.max(last - first, 60_000);
  const start = first - span * 0.08,
    end = last + span * 0.08;
  const x = (time: number) => 90 + ((time - start) / (end - start)) * 690;
  const prices = [
    ...events.map((event) => event.price),
    trade.avgEntry,
    ...(trade.avgExit == null ? [] : [trade.avgExit]),
  ];
  const low = Math.min(...prices),
    high = Math.max(...prices);
  const padding = Math.max(high - low, Math.abs(high) * 0.002, 0.00001) * 0.25;
  const priceY = (price: number) =>
    230 - ((price - low + padding) / (high - low + padding * 2)) * 190;
  const maxPosition = Math.max(...events.map((event) => event.position), 1e-10);
  const quantityY = (quantity: number) => 230 - (quantity / maxPosition) * 190;
  const label = (event: (typeof events)[number]) =>
    `${event.kind === "entry" ? "Entrée" : "Sortie"} · ${timestamp(event.executedAt, timeZone)} · ${number(event.quantity, 4)} unités à ${number(event.price, 5)} ${currency}`;
  const marks = (y: (event: (typeof events)[number]) => number, mode: "price" | "quantity") =>
    events.map((event, index) => {
      const cx = x(event.time),
        cy = y(event);
      const chosen = event.id === selected?.id;
      const colour = event.kind === "entry" ? "var(--brand)" : "var(--series-2)";
      return (
        <g
          key={event.id}
          role="button"
          tabIndex={0}
          aria-label={label(event)}
          aria-pressed={chosen}
          onClick={() => setSelectedId(event.id)}
          onFocus={() => setSelectedId(event.id)}
          onKeyDown={(key) => {
            if (key.key === "Enter" || key.key === " ") {
              key.preventDefault();
              setSelectedId(event.id);
            }
          }}
          className="cursor-pointer outline-none"
        >
          <circle
            cx={cx}
            cy={cy}
            r="18"
            fill="transparent"
            stroke={chosen ? colour : "transparent"}
            strokeWidth="1"
          />
          {event.kind === "entry" ? (
            <circle
              cx={cx}
              cy={cy}
              r="7"
              fill={colour}
              stroke="var(--background)"
              strokeWidth="2"
            />
          ) : (
            <polygon
              points={`${cx},${cy - 9} ${cx + 9},${cy} ${cx},${cy + 9} ${cx - 9},${cy}`}
              fill={colour}
              stroke="var(--background)"
              strokeWidth="2"
            />
          )}
          <title>{label(event)}</title>
          {(events.length <= 6 || chosen) && (
            <text
              x={cx}
              y={cy < 65 ? cy + 32 : cy - 24}
              textAnchor={index === 0 ? "start" : "end"}
              fill={colour}
              fontSize="12"
              fontWeight="600"
              stroke="var(--card)"
              strokeWidth="3"
              paintOrder="stroke"
            >
              {mode === "price"
                ? `${event.kind === "entry" ? "Entrée" : "Sortie"} ${number(event.price, 5)}`
                : `${number(event.position, 4)} unités`}
            </text>
          )}
        </g>
      );
    });
  const timeAxis = (
    <>
      <text x={x(first)} y="265" fill="var(--muted-foreground)" fontSize="11">
        {timestamp(events[0]!.executedAt, timeZone)}
      </text>
      <text x={x(last)} y="265" textAnchor="end" fill="var(--muted-foreground)" fontSize="11">
        {timestamp(events.at(-1)!.executedAt ?? null, timeZone)}
      </text>
    </>
  );
  let step = `M ${x(first).toFixed(2)} 230`;
  for (const event of events)
    step += ` H ${x(event.time).toFixed(2)} V ${quantityY(event.position).toFixed(2)}`;
  step += ` H ${x(end).toFixed(2)}`;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 text-xs">
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-brand" />
          Entrée {trade.direction === "long" ? "(achat)" : "(vente)"}
        </span>
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="h-2.5 w-2.5 rotate-45 bg-[var(--series-2)]" />
          Sortie {trade.direction === "long" ? "(vente)" : "(achat)"}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Entrée moyenne</p>
          <p className="tnum mt-1 text-sm">
            {number(trade.avgEntry, 5)} {currency}
          </p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Sortie moyenne</p>
          <p className="tnum mt-1 text-sm">
            {trade.avgExit == null ? "Aucune sortie" : `${number(trade.avgExit, 5)} ${currency}`}
          </p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Écart de prix dans le sens du trade</p>
          <p className="tnum mt-1 text-sm">
            {trade.avgExit == null || trade.avgEntry === 0
              ? "—"
              : `${number(((trade.avgExit - trade.avgEntry) / Math.abs(trade.avgEntry)) * (trade.direction === "long" ? 1 : -1) * 100, 2)} %`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Écart brut des prix moyens, avant frais
          </p>
        </div>
      </div>
      <figure>
        <h3 className="mb-2 text-sm font-medium">Prix des entrées et sorties</h3>
        <div className="overflow-x-auto">
          <svg
            viewBox="0 0 820 285"
            className="min-w-[540px] w-full"
            role="group"
            aria-label={`Prix d’exécution de ${trade.symbol} : ${events.filter((e) => e.kind === "entry").length} entrées et ${events.filter((e) => e.kind === "exit").length} sorties`}
          >
            {[0, 0.5, 1].map((ratio) => {
              const price = low - padding + ratio * (high - low + 2 * padding);
              return (
                <g key={ratio}>
                  <line
                    x1="90"
                    x2="780"
                    y1={priceY(price)}
                    y2={priceY(price)}
                    stroke="var(--gridline)"
                  />
                  <text
                    x="80"
                    y={priceY(price) + 4}
                    textAnchor="end"
                    fontSize="11"
                    fill="var(--muted-foreground)"
                  >
                    {number(price, 5)}
                  </text>
                </g>
              );
            })}
            <text x="90" y="20" fill="var(--muted-foreground)" fontSize="11">
              Prix · {currency}
            </text>
            <line
              x1="90"
              x2="780"
              y1={priceY(trade.avgEntry)}
              y2={priceY(trade.avgEntry)}
              stroke="var(--brand)"
              strokeDasharray="5 5"
              opacity="0.5"
            />
            {trade.avgExit != null && (
              <line
                x1="90"
                x2="780"
                y1={priceY(trade.avgExit)}
                y2={priceY(trade.avgExit)}
                stroke="var(--series-2)"
                strokeDasharray="5 5"
                opacity="0.5"
              />
            )}
            {marks((event) => priceY(event.price), "price")}
            {timeAxis}
          </svg>
        </div>
        <figcaption className="mt-2 text-xs text-muted-foreground">
          Cliquez sur un point pour afficher ses détails. Les lignes pointillées indiquent les prix
          moyens d’entrée et de sortie. Les points ne représentent pas le cours du marché entre les
          ordres · {timeZone}.
        </figcaption>
      </figure>
      {complete ? (
        <figure>
          <h3 className="mb-2 text-sm font-medium">Quantité en position après chaque exécution</h3>
          <div className="overflow-x-auto">
            <svg
              viewBox="0 0 820 285"
              className="min-w-[540px] w-full"
              role="group"
              aria-label={`Quantité restante : ${number(trade.openQuantity, 4)} unités`}
            >
              {[0, 0.5, 1].map((ratio) => (
                <g key={ratio}>
                  <line
                    x1="90"
                    x2="780"
                    y1={quantityY(maxPosition * ratio)}
                    y2={quantityY(maxPosition * ratio)}
                    stroke="var(--gridline)"
                  />
                  <text
                    x="80"
                    y={quantityY(maxPosition * ratio) + 4}
                    textAnchor="end"
                    fontSize="11"
                    fill="var(--muted-foreground)"
                  >
                    {number(maxPosition * ratio, 4)}
                  </text>
                </g>
              ))}
              <text x="90" y="20" fill="var(--muted-foreground)" fontSize="11">
                Quantité · unités
              </text>
              <path d={step} fill="none" stroke="var(--brand)" strokeWidth="2" />
              {marks((event) => quantityY(event.position), "quantity")}
              {timeAxis}
            </svg>
          </div>
          <figcaption className="mt-2 text-xs text-muted-foreground">
            Les entrées augmentent la quantité, les sorties la réduisent. Restant :{" "}
            {number(trade.openQuantity, 4)} unités
            {trade.status === "open" ? " · position encore ouverte" : " · position clôturée"}.
          </figcaption>
        </figure>
      ) : (
        <p role="status" className="text-sm text-muted-foreground">
          Historique incomplet : la courbe de quantité ne peut pas être reconstituée avec certitude.
        </p>
      )}
      {selected && (
        <div aria-live="polite" className="rounded-lg border border-brand/30 bg-brand/5 p-4">
          <p className="font-medium text-sm">
            {selected.kind === "entry" ? "Entrée sélectionnée" : "Sortie sélectionnée"}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Date · {timeZone}</dt>
              <dd className="mt-1">{timestamp(selected.executedAt, timeZone)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Prix</dt>
              <dd className="tnum mt-1">
                {number(selected.price, 5)} {currency}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Quantité exécutée</dt>
              <dd className="tnum mt-1">{number(selected.quantity, 4)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Position après l’ordre</dt>
              <dd className="tnum mt-1">
                {complete ? number(selected.position, 4) : "Historique incomplet"}
              </dd>
            </div>
          </dl>
        </div>
      )}
      <div className="flex flex-wrap gap-2" aria-label="Choisir une exécution">
        {events.map((event, index) => (
          <button
            key={event.id}
            type="button"
            aria-pressed={selected?.id === event.id}
            onClick={() => setSelectedId(event.id)}
            className={`rounded-md border px-3 py-2 text-xs ${selected?.id === event.id ? "border-brand bg-brand/10" : "hover:bg-secondary"}`}
          >
            {event.kind === "entry" ? "Entrée" : "Sortie"} {index + 1} · {number(event.price, 5)}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground sm:hidden">
        Faites défiler les graphiques horizontalement. Les valeurs détaillées sont dans le tableau
        des exécutions ci-dessous.
      </p>
    </div>
  );
}
