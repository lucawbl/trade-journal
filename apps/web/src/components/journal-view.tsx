import type { ReactNode } from "react";
import { JournalRefresh } from "./journal-refresh";
import type { EquityPoint } from "@luxalgo/journal-core";
import type { JournalView } from "@/server/journal-view";
import { tradePath } from "@/lib/trade-links";

import { number, timestamp } from "@/lib/journal-format";
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
}: {
  title: string;
  active: "dashboard" | "trades" | "accounts" | "reports" | "calendar";
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <a href="#journal-content" className="sr-only focus:not-sr-only focus:block focus:p-4">
        Aller au contenu
      </a>
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-8">
          <a href="/" className="flex items-center gap-3 font-semibold">
            <span aria-hidden="true" className="rounded-lg bg-brand/15 px-3 py-2 text-brand">
              TJ
            </span>
            <span>
              Trade Journal
              <span className="block text-xs font-normal text-muted-foreground">
                Suivi de trading · Bybit Demo
              </span>
            </span>
          </a>
          <nav
            aria-label="Navigation principale"
            className="flex max-w-full flex-wrap gap-1 rounded-lg border p-1 text-sm"
          >
            {(
              [
                ["dashboard", "/", "Dashboard"],
                ["trades", "/trades", "Trades"],
                ["accounts", "/accounts", "Accounts"],
                ["reports", "/reports", "Rapports"],
                ["calendar", "/calendar", "Calendrier"],
              ] as const
            ).map(([key, href, label]) => (
              <a
                key={key}
                href={href}
                aria-current={active === key ? "page" : undefined}
                className={`rounded-md px-3 py-2 ${active === key ? "bg-secondary font-medium" : "text-muted-foreground hover:text-foreground"}`}
              >
                {label}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <div id="journal-content" className="mx-auto max-w-7xl space-y-6 px-4 py-7 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="mb-1 text-xs uppercase tracking-widest text-brand">Journal des bots</p>
            <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
          </div>
          <span className="rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs text-brand">
            Environnement démo
          </span>
        </div>
        <JournalRefresh />
        {children}
        <footer className="border-t pt-4 text-xs text-muted-foreground">
          Données du journal SQLite · Activez l’actualisation automatique pour suivre les nouvelles exécutions.
        </footer>
      </div>
    </main>
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
    <div className="card-sheen rounded-xl border bg-card p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="tnum mt-2 text-2xl font-semibold">{value}</div>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function SummaryMetrics({ view }: { view: JournalView }) {
  const m = view.overview.metrics;
  return (
    <section aria-label="Statistiques" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
    <div className="overflow-x-auto">
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
              <td className="tnum px-3">{number(trade.avgEntry, 5)}</td>
              <td className="tnum px-3">{number(trade.avgExit, 5)}</td>
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

export function EquityChart({ points, currency }: { points: EquityPoint[]; currency: string }) {
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
  const coordinates = values
    .map((value, index) => `${20 + (index / (values.length - 1)) * 560},${y(value)}`)
    .join(" ");
  return (
    <figure>
      <svg
        role="img"
        aria-label={`P&L cumulé des trades clôturés, de zéro à ${number(values.at(-1))} ${currency}`}
        viewBox="0 0 600 180"
        className="h-48 w-full"
      >
        <line x1="20" x2="580" y1={y(0)} y2={y(0)} stroke="var(--baseline)" strokeDasharray="4 4" />
        <polyline
          points={coordinates}
          fill="none"
          stroke="var(--brand)"
          strokeWidth="3"
          strokeLinejoin="round"
        />
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
