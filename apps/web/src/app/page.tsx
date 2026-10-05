import { readFilters } from "@luxalgo/journal-core";
import { ArrowUpRight, Download } from "lucide-react";
import { DashboardAccounts } from "@/components/dashboard-accounts";
import { DashboardCalendar } from "@/components/dashboard-calendar";
import { DashboardReport } from "@/components/dashboard-report";
import { DashboardShell } from "@/components/dashboard-shell";
import { DashboardTabs } from "@/components/dashboard-tabs";
import { HistoryTrades } from "@/components/history-trades";
import { EquityChart, Panel, PnlValue, number } from "@/components/journal-view";
import { JournalVisualBars, JournalVisualMetric } from "@/components/journal-visual-charts";
import { dashboardFocus } from "@/lib/dashboard-focus";
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
  const historyView = Object.keys(historyFilters).length ? readJournalView(historyFilters) : view;
  const exportQuery = new URLSearchParams({ ...historyFilters, format: "csv" }).toString();
  const metrics = view.overview.metrics;
  const currency = view.currencyScope.currency ?? "";
  const monetary = view.currencyScope.monetary;
  const focus = dashboardFocus(
    monetary ? view.projectedTrades : view.trades,
    view.accounts,
    monetary,
  );
  const lossLarger = focus.avgLoss != null && focus.avgWin != null && focus.avgLoss > focus.avgWin;
  const historyHref = (accounts: string, status = "closed") =>
    `/trades?${new URLSearchParams({ accounts, status })}`;
  return (
    <DashboardShell>
      <section aria-label="L’essentiel" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="col-span-2 min-w-0 rounded-xl border bg-card p-4 sm:col-span-1">
          <p className="text-xs text-muted-foreground">Résultat réalisé</p>
          <div className="mt-2 text-2xl font-semibold">
            {focus.realized == null ? "—" : <PnlValue value={focus.realized} currency={currency} />}
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Après frais · sorties partielles incluses
          </p>
        </div>
        <JournalVisualMetric
          label="Trades gagnants"
          value={metrics.winRate == null ? "—" : `${number(metrics.winRate * 100, 1)} %`}
        />
        <JournalVisualMetric label="Positions ouvertes" value={focus.open} />
      </section>
      <div className="dashboard-grid">
        <div className="dashboard-equity">
          <Panel title="Évolution du résultat">
            {monetary ? (
              <EquityChart points={view.overview.equity} currency={currency} detailed />
            ) : (
              <a href="/?view=accounts" className="block py-8 text-sm text-brand">
                Voir les résultats par devise
              </a>
            )}
            <p className="mt-2 text-[10px] text-muted-foreground">
              {focus.closed} trades clôturés · après frais
            </p>
          </Panel>
        </div>
        <Panel title={monetary ? "Résultat par bot" : "Réussite par bot"}>
          <JournalVisualBars
            items={focus.bots.map((bot) => ({
              label: bot.label,
              value: monetary ? bot.netPnl : (bot.winRate ?? 0) * 100,
              note: bot.closed ? `${bot.closed} clôtures` : "Aucune clôture",
              href: historyHref(bot.id),
            }))}
            currency={monetary ? currency : "%"}
            signed={monetary}
          />
        </Panel>
        <section aria-labelledby="improve-title" className="col-span-full space-y-3">
          <h2 id="improve-title" className="font-semibold">
            À améliorer
          </h2>
          <div className="grid min-w-0 gap-3 lg:grid-cols-3">
            <Panel title="Bot à revoir">
              {focus.weakest ? (
                <>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-xl">{focus.weakest.label}</strong>
                    <PnlValue value={focus.weakest.netPnl} currency={currency} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Résultat clôturé le plus bas · {focus.weakest.closed} trades
                  </p>
                  <a
                    className="mt-5 inline-flex items-center gap-2 text-sm text-brand"
                    href={historyHref(focus.weakest.id, "loss")}
                  >
                    Voir ses pertes <ArrowUpRight size={15} />
                  </a>
                </>
              ) : (
                <p className="py-6 text-xs text-muted-foreground">
                  {!monetary
                    ? "Comparer séparément chaque devise."
                    : focus.closed
                      ? "Aucun bot en perte sur ses clôtures."
                      : "Les premières clôtures permettront la comparaison."}
                </p>
              )}
            </Panel>
            <Panel title="Gains / pertes moyens">
              {focus.avgWin != null || focus.avgLoss != null ? (
                <>
                  <JournalVisualBars
                    items={[
                      ...(focus.avgWin == null
                        ? []
                        : [{ label: "Gain moyen", value: focus.avgWin }]),
                      ...(focus.avgLoss == null
                        ? []
                        : [{ label: "Perte moyenne", value: -focus.avgLoss }]),
                    ]}
                    currency={currency}
                  />
                  <p className="mt-4 text-xs text-muted-foreground">
                    {lossLarger
                      ? "Une perte efface plus d’un gain moyen."
                      : "Moyennes des trades clôturés, après frais."}
                  </p>
                  <a className="mt-3 inline-flex items-center gap-2 text-sm text-brand" href="/bot">
                    {lossLarger ? "Revoir SL / TP" : "Analyser les réglages"}{" "}
                    <ArrowUpRight size={15} />
                  </a>
                </>
              ) : (
                <p className="py-6 text-xs text-muted-foreground">
                  {monetary
                    ? "Pas encore de gain ou de perte clôturée."
                    : "Devises différentes : moyennes non regroupées."}
                </p>
              )}
            </Panel>
            <Panel title="Impact des frais">
              {focus.fees != null && focus.gross != null ? (
                <>
                  <JournalVisualBars
                    items={[
                      { label: "Avant frais", value: focus.gross },
                      { label: "Frais", value: -focus.fees },
                      { label: "Après frais", value: metrics.netPnl },
                    ]}
                    currency={currency}
                  />
                  <a
                    className="mt-5 inline-flex items-center gap-2 text-sm text-brand"
                    href="/trades?status=closed"
                  >
                    Vérifier les exécutions <ArrowUpRight size={15} />
                  </a>
                </>
              ) : (
                <p className="py-6 text-xs text-muted-foreground">
                  {monetary ? "Aucune clôture à analyser." : "Frais à consulter par compte."}
                </p>
              )}
            </Panel>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Constats sur les clôtures enregistrées · pas de modification automatique des bots
          </p>
        </section>
        <details
          id="dashboard-history"
          className="col-span-full min-w-0 rounded-xl border bg-card p-4"
          open={Object.values(historyFilters).some(Boolean)}
        >
          <summary className="cursor-pointer font-semibold">
            Historique{" "}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {historyView.rows.length} trades
            </span>
          </summary>
          <div className="mt-4 space-y-4">
            <div className="flex justify-end">
              <a
                href={`/api/export?${exportQuery}`}
                className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs"
                aria-label="Exporter l’historique en CSV"
              >
                <Download size={14} /> CSV
              </a>
            </div>
            <HistoryTrades view={historyView} />
          </div>
        </details>
      </div>
    </DashboardShell>
  );
}
