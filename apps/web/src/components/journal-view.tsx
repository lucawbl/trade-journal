import type { ReactNode } from "react";
import { DashboardShell } from "./dashboard-shell";
import type { EquityPoint } from "@luxalgo/journal-core";
import type { JournalView } from "@/server/journal-view";
import { tradePath } from "@/lib/trade-links";

import { number, timestamp, priceNumber } from "@/lib/journal-format";
export { number, timestamp } from "@/lib/journal-format";

export function PnlValue({ value, currency }: { value: number; currency: string }) {
  return (
    <span className={`tnum ${value > 0 ? "text-profit" : value < 0 ? "text-loss" : ""}`}>
      {value > 0 ? "+" : ""}
      {number(value)} {currency}
    </span>
  );
}

export function JournalShell({
  title,
  active,
  children,
  wide = false,
}: {
  title: string;
  active: "dashboard" | "trades" | "accounts" | "reports" | "calendar" | "market";
  wide?: boolean;
  children: ReactNode;
}) {
  const paths = {
    dashboard: "/",
    trades: "/trades",
    accounts: "/accounts",
    reports: "/reports",
    calendar: "/calendar",
    market: "/market",
  };
  return (
    <DashboardShell title={title} active={paths[active]} wide={wide}>
      {children}
    </DashboardShell>
  );
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card-sheen min-w-0 rounded-xl border bg-card p-4 sm:p-5">
      <h2 className="mb-4 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function Metric({ label, value, hint }: { label: string; value: ReactNode; hint: string }) {
  return (
    <div className="card-sheen min-w-0 rounded-xl border bg-card p-4 sm:p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="tnum mt-2 break-words text-xl font-semibold sm:text-2xl">{value}</div>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function SummaryMetrics({ view }: { view: JournalView }) {
  const m = view.overview.metrics;
  return (
    <section aria-label="Statistiques" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Metric
        label="Trades"
        value={m.totalTrades}
        hint={`${m.closedTrades} clôturés · ${m.openTrades} ouverts`}
      />
      <Metric
        label="P&L net clôturé"
        value={
          view.currencyScope.monetary ? (
            <PnlValue value={m.netPnl} currency={view.currencyScope.currency ?? ""} />
          ) : (
            "—"
          )
        }
        hint={
          view.currencyScope.monetary
            ? "Après frais · trades entièrement clôturés"
            : "Sélectionnez un compte pour isoler sa devise"
        }
      />
      <Metric
        label="Taux de réussite"
        value={m.winRate === null ? "—" : `${number(m.winRate * 100, 1)} %`}
        hint={
          m.closedTrades
            ? `${m.wins} gagnants · ${m.losses} perdants`
            : "Disponible après la première clôture complète"
        }
      />
      <Metric
        label="Positions ouvertes"
        value={m.openTrades}
        hint="Positions reconstruites depuis les exécutions"
      />
    </section>
  );
}

export function TradeTable({ view, limit }: { view: JournalView; limit?: number }) {
  const rows = limit ? view.rows.slice(0, limit) : view.rows;
  const accounts = new Map(view.accounts.map((a) => [a.id, a]));
  if (!rows.length)
    return <p className="py-5 text-sm text-muted-foreground">Aucun trade pour cette sélection.</p>;
  return (
    <>
      <div className="grid gap-3 md:hidden" aria-label="Trades du journal">
        {rows.map((trade) => (
          <article key={trade.key} className="rounded-lg border bg-background p-4">
            <div className="flex items-start justify-between gap-3">
              <a className="font-semibold text-brand hover:underline" href={tradePath(trade.key)}>
                {trade.symbol} <span aria-hidden="true">→</span>
              </a>
              <Status trade={trade} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {accounts.get(trade.accountId)?.name ?? trade.accountId}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {trade.direction === "long" ? "Long" : "Short"} ·{" "}
              {timestamp(trade.openedAt, view.timeZone)}
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Entrée moyenne</dt>
                <dd className="tnum mt-1">{priceNumber(trade.avgEntry)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Sortie moyenne</dt>
                <dd className="tnum mt-1">{priceNumber(trade.avgExit)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Quantité restante</dt>
                <dd className="tnum mt-1">{number(trade.openQuantity, 6)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Résultat réalisé</dt>
                <dd className="mt-1">
                  <PnlValue
                    value={trade.netPnl}
                    currency={accounts.get(trade.accountId)?.currency ?? ""}
                  />
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full whitespace-nowrap text-left text-sm">
          <caption className="sr-only">Trades du journal, du plus récent au plus ancien</caption>
          <thead className="text-xs text-muted-foreground">
            <tr>
              {[
                "Symbole / compte",
                "Ouverture",
                "Sens",
                "Statut",
                "Qté entrée / restante",
                "Prix entrée",
                "Prix sortie",
                "P&L net enregistré",
              ].map((label) => (
                <th key={label} scope="col" className="px-3 pb-3 font-normal first:pl-0">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((trade) => (
              <tr key={trade.key} className="border-t">
                <td className="py-4 pr-3">
                  <a className="font-medium text-brand hover:underline" href={tradePath(trade.key)}>
                    {trade.symbol}
                  </a>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {accounts.get(trade.accountId)?.name ?? trade.accountId}
                  </p>
                </td>
                <td className="px-3 text-xs text-muted-foreground">
                  {timestamp(trade.openedAt, view.timeZone)}
                </td>
                <td className="px-3">{trade.direction === "long" ? "Long" : "Short"}</td>
                <td className="px-3">
                  <Status trade={trade} />
                </td>
                <td className="tnum px-3">
                  {number(trade.quantity, 4)} / {number(trade.openQuantity, 4)}
                </td>
                <td className="tnum px-3">{priceNumber(trade.avgEntry)}</td>
                <td className="tnum px-3">{priceNumber(trade.avgExit)}</td>
                <td className="px-3">
                  <PnlValue
                    value={trade.netPnl}
                    currency={accounts.get(trade.accountId)?.currency ?? ""}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function Status({
  trade,
}: {
  trade: Pick<JournalView["rows"][number], "status" | "openQuantity" | "quantity">;
}) {
  const label =
    trade.status === "open"
      ? trade.openQuantity < trade.quantity
        ? "Sortie partielle"
        : "Ouvert"
      : trade.status === "win"
        ? "Gagnant"
        : trade.status === "loss"
          ? "Perdant"
          : "Équilibre";
  return (
    <span
      className={`rounded-full border px-2 py-1 text-xs ${trade.status === "win" ? "text-profit" : trade.status === "loss" ? "text-loss" : "text-muted-foreground"}`}
    >
      {label}
    </span>
  );
}

export function EquityChart({
  points,
  currency,
  detailed = false,
}: {
  points: EquityPoint[];
  currency: string;
  detailed?: boolean;
}) {
  if (!points.length)
    return (
      <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        La courbe apparaîtra après la première clôture complète.
      </div>
    );
  const values = [0, ...points.map((point) => point.cumNetPnl)];
  const min = Math.min(...values),
    max = Math.max(...values),
    range = max - min || 1;
  const y = (value: number) => 160 - ((value - min) / range) * 140;
  const x = (index: number) =>
    (detailed ? 65 : 20) + (index / (values.length - 1)) * (detailed ? 515 : 560);
  const coordinates = values.map((value, index) => `${x(index)},${y(value)}`).join(" ");
  return (
    <figure>
      <svg
        role="img"
        aria-label={`P&L cumulé des trades clôturés, de zéro à ${number(values.at(-1))} ${currency}`}
        viewBox="0 0 600 180"
        className="h-48 w-full"
      >
        {detailed &&
          Array.from({ length: 5 }, (_, index) => {
            const value = min + (range * index) / 4;
            return (
              <g key={index}>
                <line
                  x1="65"
                  x2="580"
                  y1={y(value)}
                  y2={y(value)}
                  stroke="var(--border)"
                  strokeDasharray="3 4"
                />
                <text
                  x="57"
                  y={y(value) + 3}
                  textAnchor="end"
                  fill="var(--muted-foreground)"
                  fontSize="12"
                >
                  {number(value, Math.min(6, Math.max(0, 2 - Math.floor(Math.log10(range)))))}
                </text>
              </g>
            );
          })}
        {detailed && (
          <polygon
            points={`${x(0)},${y(0)} ${coordinates} 580,${y(0)}`}
            fill="var(--brand)"
            opacity="0.07"
          />
        )}
        <line
          x1={detailed ? "65" : "20"}
          x2="580"
          y1={y(0)}
          y2={y(0)}
          stroke="var(--baseline)"
          strokeDasharray="4 4"
        />
        <polyline
          points={coordinates}
          fill="none"
          stroke="var(--brand)"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        {detailed &&
          values.map((value, index) =>
            index % Math.max(1, Math.ceil(values.length / 20)) === 0 ||
            index === values.length - 1 ? (
              <circle
                key={index}
                cx={x(index)}
                cy={y(value)}
                r="2.5"
                fill="var(--brand)"
                stroke="var(--card)"
                strokeWidth="1"
              />
            ) : null,
          )}
      </svg>
      <figcaption className="flex justify-between text-xs text-muted-foreground">
        <span>Départ : 0 {currency}</span>
        <span>
          Dernière clôture : {number(values.at(-1))} {currency}
        </span>
      </figcaption>
    </figure>
  );
}
