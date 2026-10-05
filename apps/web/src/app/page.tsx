import { dailyStats, readFilters } from "@luxalgo/journal-core";
import { Download } from "lucide-react";
import { DashboardAccounts } from "@/components/dashboard-accounts";
import { DashboardCalendar } from "@/components/dashboard-calendar";
import { DashboardReport } from "@/components/dashboard-report";
import { DashboardShell } from "@/components/dashboard-shell";
import { DashboardTabs } from "@/components/dashboard-tabs";
import { HistoryAnalysis, HistorySummary } from "@/components/history-analysis";
import { HistoryTrades } from "@/components/history-trades";
import { EquityChart, Panel, PnlValue, number, timestamp } from "@/components/journal-view";
import {
  JournalVisualColumns,
  JournalVisualDonut,
  JournalVisualMetric,
} from "@/components/journal-visual-charts";
import { priceNumber } from "@/lib/journal-format";
import { tradePath } from "@/lib/trade-links";
import { readJournalView, requireJournalSession } from "@/server/journal-view";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireJournalSession();
  const params = await searchParams;
  if (params.view === "bilan" || params.view === "accounts" || params.view === "calendar")
    return (
      <DashboardShell>
        <DashboardTabs active={params.view} />
        {params.view === "bilan" && <DashboardReport params={params} />}
        {params.view === "accounts" && <DashboardAccounts />}
        {params.view === "calendar" && <DashboardCalendar params={params} />}
      </DashboardShell>
    );
  const value = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : "");
  const historyFilters = readFilters({ get: value });
  const view = readJournalView();
  const historyView = readJournalView(historyFilters);
  const exportQuery = new URLSearchParams({ ...historyFilters, format: "csv" }).toString();
  const metrics = view.overview.metrics;
  const currency = view.currencyScope.currency ?? "";
  const monetary = view.currencyScope.monetary;
  const fees = view.projectedTrades.reduce((total, trade) => total + trade.fees, 0);
  const realized = view.projectedTrades.reduce((total, trade) => total + trade.netPnl, 0);
  const open = view.rows.filter((trade) => trade.status === "open");
  const activeAccounts = view.accounts.filter((account) => !account.archivedAt);
  return (
    <DashboardShell>
      <DashboardTabs active="overview" />
      <div className="dashboard-grid">
        <div className="dashboard-equity">
          <Panel title="P&L cumulé · clôtures">
            {monetary ? (
              <EquityChart points={view.overview.equity} currency={currency} detailed />
            ) : (
              <a href="/?view=accounts" className="block py-8 text-sm text-brand">
                Résultats par compte →
              </a>
            )}
          </Panel>
        </div>
        <Panel title="Réussite par bot">
          <div className="space-y-5">
            {activeAccounts.map((account, index) => {
              const closed = view.rows.filter(
                (trade) => trade.accountId === account.id && trade.status !== "open",
              );
              const wins = closed.filter((trade) => trade.status === "win").length;
              const rate = closed.length ? (wins / closed.length) * 100 : 0;
              const pair = view.rows.find((trade) => trade.accountId === account.id)?.symbol;
              return (
                <div key={account.id}>
                  <div className="mb-2 flex justify-between gap-3 text-xs">
                    <span className="min-w-0 truncate font-medium" title={account.name}>
                      {pair?.replace("USDT", "") || account.name}
                    </span>
                    <span className="tnum shrink-0">
                      {closed.length ? `${number(rate, 0)} %` : "—"}
                    </span>
                  </div>
                  <div
                    role="img"
                    aria-label={`${account.name} : ${wins} gagnants sur ${closed.length} clôtures`}
                    className="h-2 overflow-hidden rounded-full bg-secondary"
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${rate}%`,
                        backgroundColor: ["#638bea", "#eeac56", "#3abda0"][index % 3],
                      }}
                    />
                  </div>
                  <p className="mt-1 text-right text-[10px] text-muted-foreground">
                    {wins}/{closed.length}
                  </p>
                </div>
              );
            })}
            {!activeAccounts.length && (
              <p className="text-sm text-muted-foreground">Aucun bot actif.</p>
            )}
          </div>
        </Panel>
        <section
          aria-label="Résumé du journal"
          className="dashboard-metrics grid grid-cols-2 gap-3 xl:grid-cols-4"
        >
          <JournalVisualMetric
            label="P&L clôturé"
            value={monetary ? <PnlValue value={metrics.netPnl} currency={currency} /> : "—"}
          />
          <JournalVisualMetric
            label="Réussite"
            value={metrics.winRate === null ? "—" : `${number(metrics.winRate * 100, 1)} %`}
          />
          <JournalVisualMetric label="Positions ouvertes" value={open.length} />
          <JournalVisualMetric
            label="Réalisé · partielles incluses"
            value={monetary ? <PnlValue value={realized} currency={currency} /> : "—"}
          />
        </section>
        <section
          id="historique"
          aria-labelledby="historique-title"
          className="col-span-full space-y-4 scroll-mt-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="historique-title" className="text-xl font-semibold">
                Historique des trades
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Toutes les positions enregistrées par les bots, directement dans le Dashboard.
              </p>
            </div>
            <a
              href={`/api/export?${exportQuery}`}
              className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-secondary"
              aria-label="Exporter les trades de cette sélection en CSV"
            >
              <Download className="h-4 w-4" aria-hidden="true" /> CSV
            </a>
          </div>
          <HistorySummary view={historyView} />
          <HistoryAnalysis view={historyView} />
          <Panel
            title={`${historyView.rows.length} trade${historyView.rows.length === 1 ? "" : "s"}`}
          >
            <HistoryTrades view={historyView} />
          </Panel>
        </section>
        <Panel title="14 derniers jours de clôture">
          <JournalVisualColumns
            items={dailyStats(monetary ? view.projectedTrades : view.trades, view.timeZone)
              .slice(-14)
              .map((day) => ({
                label: day.date,
                value: monetary ? day.netPnl : day.trades,
                trades: day.trades,
                href: `/?from=${day.date}&to=${day.date}&status=closed#historique`,
              }))}
            currency={monetary ? currency : ""}
            monetary={monetary}
          />
        </Panel>
        <Panel title="Répartition des positions">
          <JournalVisualDonut
            segments={[
              { label: "Gagnantes", value: metrics.wins, color: "var(--profit)" },
              { label: "Perdantes", value: metrics.losses, color: "var(--loss)" },
              { label: "Équilibre", value: metrics.breakevens, color: "var(--baseline)" },
              { label: "Ouvertes", value: open.length, color: "var(--brand)" },
            ]}
            value={String(metrics.totalTrades)}
            label="positions"
          />
        </Panel>
        <section aria-labelledby="bots-title" className="dashboard-bots col-span-full space-y-3">
          <h2 id="bots-title" className="text-lg font-semibold">
            Bots
          </h2>
          <div className="grid min-w-0 gap-3 md:grid-cols-3">
            {activeAccounts.map((account) => {
              const positions = open.filter((trade) => trade.accountId === account.id);
              const accountClosed = view.rows.filter(
                (trade) => trade.accountId === account.id && trade.status !== "open",
              );
              const accountPnl = accountClosed.reduce((total, trade) => total + trade.netPnl, 0);
              const pair =
                positions[0]?.symbol ??
                view.rows.find((trade) => trade.accountId === account.id)?.symbol;
              return (
                <article key={account.id} className="min-w-0 rounded-xl border bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold" title={account.name}>
                      {pair?.replace("USDT", "") || account.name}
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {positions.length} ouverte{positions.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-b pb-3 text-xs">
                    <span className="text-muted-foreground">{accountClosed.length} clôtures</span>
                    <strong>
                      <PnlValue value={accountPnl} currency={account.currency} />
                    </strong>
                  </div>
                  {positions.map((trade) => {
                    const remaining =
                      trade.quantity > 0
                        ? Math.max(0, Math.min(100, (trade.openQuantity / trade.quantity) * 100))
                        : 0;
                    return (
                      <div key={trade.key} className="mt-4">
                        <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                          <a
                            href={tradePath(trade.key)}
                            className="font-medium text-brand hover:underline"
                          >
                            {trade.direction === "long" ? "Long" : "Short"} →
                          </a>
                          <span className="tnum text-muted-foreground">
                            {number(remaining, 0)} % restant
                          </span>
                        </div>
                        <div
                          role="meter"
                          aria-label={`Quantité restante ${trade.symbol}`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={remaining}
                          aria-valuetext={`${number(remaining, 1)} % de la quantité entrée`}
                          className="h-2 overflow-hidden rounded-full bg-secondary"
                        >
                          <div
                            className="h-full rounded-full bg-brand"
                            style={{ width: `${remaining}%` }}
                          />
                        </div>
                        <details className="mt-3 text-xs">
                          <summary className="cursor-pointer text-muted-foreground">
                            Position
                          </summary>
                          <dl className="mt-3 grid grid-cols-2 gap-3">
                            <div>
                              <dt className="text-muted-foreground">Entrée</dt>
                              <dd className="tnum mt-1">{priceNumber(trade.avgEntry)}</dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground">Quantité restante</dt>
                              <dd className="tnum mt-1">{number(trade.openQuantity, 6)}</dd>
                            </div>
                            <div className="col-span-2 flex flex-wrap justify-between gap-2">
                              <dt className="text-muted-foreground">Réalisé</dt>
                              <dd>
                                <PnlValue value={trade.netPnl} currency={account.currency} />
                              </dd>
                            </div>
                          </dl>
                        </details>
                      </div>
                    );
                  })}
                  <details className="mt-4 text-xs text-muted-foreground">
                    <summary className="cursor-pointer">Compte</summary>
                    <p className="mt-3">{account.name}</p>
                    <dl className="mt-2 space-y-2">
                      <div className="flex flex-wrap justify-between gap-2">
                        <dt>
                          {account.equity !== null ? "Equity broker" : "Capital initial · journal"}
                        </dt>
                        <dd className="tnum">
                          {number(account.equity ?? account.initialBalance)} {account.currency}
                        </dd>
                      </div>
                      <div className="break-words">
                        {timestamp(account.lastSyncAt, view.timeZone)} · {view.timeZone}
                      </div>
                    </dl>
                  </details>
                </article>
              );
            })}
            {!activeAccounts.length && (
              <p className="text-sm text-muted-foreground">Aucun compte actif.</p>
            )}
          </div>
        </section>
        <details className="dashboard-metrics rounded-lg border px-4 py-3 text-xs text-muted-foreground">
          <summary className="cursor-pointer">Frais et calculs</summary>
          <p className="mt-3">
            Réalisé : résultats enregistrés, sorties partielles incluses. P&L clôturé : positions
            entièrement clôturées. Frais enregistrés :{" "}
            {monetary ? `${number(fees)} ${currency}` : "devises distinctes"}.
          </p>
        </details>
      </div>
    </DashboardShell>
  );
}
