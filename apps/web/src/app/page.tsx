import {
  EquityChart,
  JournalShell,
  Panel,
  SummaryMetrics,
  TradeTable,
  number,
  timestamp,
} from "@/components/journal-view";
import { readJournalView, requireJournalSession } from "@/server/journal-view";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireJournalSession();
  const view = readJournalView();
  const m = view.overview.metrics;
  const currency = view.currencyScope.currency ?? "";
  const openView = { ...view, rows: view.rows.filter((trade) => trade.status === "open") };
  return (
    <JournalShell title="Vue d’ensemble" active="dashboard">
      <SummaryMetrics view={view} />
      <a
        href="/market"
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 text-sm hover:bg-secondary"
      >
        <span>Marché en direct · DOGE, PEPE et BTC</span>
        <span className="font-medium text-brand">Ouvrir le grand graphique →</span>
      </a>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="Évolution du P&L clôturé">
            {view.currencyScope.monetary ? (
              <EquityChart points={view.overview.equity} currency={currency} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Les comptes utilisent plusieurs devises. Consultez les statistiques par compte dans
                Trades.
              </p>
            )}
          </Panel>
        </div>
        <Panel title="Performance des trades clôturés">
          <dl className="space-y-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Profit factor</dt>
              <dd>
                {view.currencyScope.monetary
                  ? m.profitFactorIsInfinite
                    ? "∞"
                    : number(m.profitFactor)
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Drawdown maximal</dt>
              <dd>{view.currencyScope.monetary ? `${number(m.maxDrawdown)} ${currency}` : "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Frais</dt>
              <dd>{view.currencyScope.monetary ? `${number(m.fees)} ${currency}` : "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Gain moyen par trade</dt>
              <dd>{view.currencyScope.monetary ? `${number(m.expectancy)} ${currency}` : "—"}</dd>
            </div>
          </dl>
        </Panel>
      </div>
      <Panel title="Positions ouvertes">
        <TradeTable view={openView} />
        <p className="mt-3 text-xs text-muted-foreground">
          Une sortie partielle conserve le trade ouvert tant qu’une quantité reste en position. Le
          P&L enregistré correspond aux sorties et frais déjà importés, sans valorisation au prix du
          marché.
        </p>
      </Panel>
      <Panel title="Derniers trades">
        <TradeTable view={view} limit={10} />
        <a href="/trades" className="mt-4 inline-block text-sm text-brand hover:underline">
          Voir tout l’historique →
        </a>
      </Panel>
      <Panel title="Comptes du journal">
        <div className="grid gap-4 md:grid-cols-2">
          {view.accounts.length ? (
            view.accounts.map((account) => (
              <div key={account.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <h3 className="font-medium">{account.name}</h3>
                  <span className="text-xs text-muted-foreground">{account.broker}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Capital initial : {number(account.initialBalance)} {account.currency}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Dernière réception : {timestamp(account.lastSyncAt, view.timeZone)} ·{" "}
                  {view.timeZone}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Aucun compte dans le journal.</p>
          )}
        </div>
      </Panel>
    </JournalShell>
  );
}
