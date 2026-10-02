import {
  EquityChart,
  JournalShell,
  Metric,
  Panel,
  PnlValue,
  number,
  timestamp,
} from "@/components/journal-view";
import { priceNumber } from "@/lib/journal-format";
import { tradePath } from "@/lib/trade-links";
import { readJournalView, requireJournalSession } from "@/server/journal-view";
export const dynamic = "force-dynamic";
export default async function DashboardPage() {
  await requireJournalSession();
  const view = readJournalView(),
    m = view.overview.metrics;
  const currency = view.currencyScope.currency ?? "";
  const fees = view.projectedTrades.reduce((total, trade) => total + trade.fees, 0);
  const open = view.rows.filter((trade) => trade.status === "open");
  const closed = view.rows
    .filter((trade) => trade.status !== "open")
    .sort((a, b) => (b.closedAt ?? b.openedAt).localeCompare(a.closedAt ?? a.openedAt))
    .slice(0, 6);
  const accountMap = new Map(view.accounts.map((account) => [account.id, account]));
  return (
    <JournalShell title="Dashboard" active="dashboard">
      <p className="text-sm text-muted-foreground">
        Les résultats des positions clôturées et le suivi de tes bots, au même endroit.
      </p>
      <section aria-label="Résumé du journal" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric
          label="Résultat clôturé"
          value={
            view.currencyScope.monetary ? <PnlValue value={m.netPnl} currency={currency} /> : "—"
          }
          hint="Après frais · positions entièrement clôturées"
        />
        <Metric
          label="Réussite"
          value={m.winRate == null ? "—" : `${number(m.winRate * 100, 1)} %`}
          hint={`${m.closedTrades} trade${m.closedTrades === 1 ? "" : "s"} clôturé${m.closedTrades === 1 ? "" : "s"}`}
        />
        <Metric
          label="Positions en cours"
          value={open.length}
          hint="Une sortie partielle conserve la position ouverte"
        />
        <Metric
          label="Frais enregistrés"
          value={view.currencyScope.monetary ? `${number(fees)} ${currency}` : "—"}
          hint="Sur l’ensemble des exécutions importées"
        />
      </section>
      <section aria-labelledby="bots-title" className="space-y-3">
        <div>
          <h2 id="bots-title" className="text-lg font-semibold">
            Bots et positions
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Le résultat réalisé inclut les sorties partielles et les frais. Il ne valorise pas la
            quantité restante au prix actuel.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {view.accounts
            .filter((account) => !account.archivedAt)
            .map((account) => {
              const positions = open.filter((trade) => trade.accountId === account.id);
              const pair =
                positions[0]?.symbol ??
                view.rows.find((trade) => trade.accountId === account.id)?.symbol;
              return (
                <article key={account.id} className="min-w-0 rounded-xl border bg-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">
                        {pair ? pair.replace("USDT", "") : account.name}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">{account.name}</p>
                    </div>
                    <span className="shrink-0 rounded-md bg-secondary px-2 py-1 text-xs">
                      {positions.length
                        ? `${positions.length} ouverte${positions.length > 1 ? "s" : ""}`
                        : "Aucune position"}
                    </span>
                  </div>
                  <dl className="mt-4 border-b pb-4 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">
                        {account.equity != null ? "Solde reçu" : "Capital de départ"}
                      </dt>
                      <dd className="tnum font-medium">
                        {number(account.equity ?? account.initialBalance)} {account.currency}
                      </dd>
                    </div>
                  </dl>
                  {positions.length ? (
                    positions.map((trade) => (
                      <div key={trade.key} className="mt-4 space-y-3">
                        <a
                          href={tradePath(trade.key)}
                          className="inline-block text-sm font-medium text-brand hover:underline"
                        >
                          {trade.direction === "long" ? "Long" : "Short"} ·{" "}
                          {timestamp(trade.openedAt, view.timeZone)}
                        </a>
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                          <div>
                            <dt className="text-xs text-muted-foreground">Prix moyen d’entrée</dt>
                            <dd className="tnum mt-1">{priceNumber(trade.avgEntry)}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-muted-foreground">Quantité restante</dt>
                            <dd className="tnum mt-1">{number(trade.openQuantity, 6)}</dd>
                          </div>
                          <div className="col-span-2 flex items-center justify-between gap-3">
                            <dt className="text-muted-foreground">Résultat réalisé</dt>
                            <dd>
                              <PnlValue value={trade.netPnl} currency={account.currency} />
                            </dd>
                          </div>
                        </dl>
                      </div>
                    ))
                  ) : (
                    <p className="mt-4 text-sm text-muted-foreground">
                      Aucune quantité encore en position dans le journal.
                    </p>
                  )}
                  <p className="mt-5 border-t pt-3 text-xs text-muted-foreground">
                    Dernière réception : {timestamp(account.lastSyncAt, view.timeZone)} ·{" "}
                    {view.timeZone}
                  </p>
                </article>
              );
            })}
          {!view.accounts.some((account) => !account.archivedAt) && (
            <p className="text-sm text-muted-foreground">Aucun compte actif dans le journal.</p>
          )}
        </div>
      </section>
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <Panel title="Évolution du résultat clôturé">
          <p className="mb-4 text-xs text-muted-foreground">
            Cumul des trades entièrement clôturés. Les résultats des positions en cours figurent
            dans les cartes des bots.
          </p>
          {view.currencyScope.monetary ? (
            <EquityChart points={view.overview.equity} currency={currency} />
          ) : (
            <p className="py-6 text-sm text-muted-foreground">
              Les comptes utilisent plusieurs devises. Le bilan par compte permet de consulter leurs
              résultats séparément.
            </p>
          )}
        </Panel>
        <Panel title="Dernières clôtures">
          {closed.length ? (
            <ul className="divide-y">
              {closed.map((trade) => (
                <li key={trade.key} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <a
                      href={tradePath(trade.key)}
                      className="font-medium text-brand hover:underline"
                    >
                      {trade.symbol.replace("USDT", " / USDT")}
                    </a>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {timestamp(trade.closedAt ?? trade.openedAt, view.timeZone)}
                    </p>
                  </div>
                  <PnlValue
                    value={trade.netPnl}
                    currency={accountMap.get(trade.accountId)?.currency ?? ""}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-lg bg-secondary/40 p-5">
              <p className="text-sm font-medium">Aucune clôture complète pour le moment.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Les sorties partielles sont déjà visibles dans le résultat réalisé des positions en
                cours.
              </p>
            </div>
          )}
        </Panel>
      </div>
    </JournalShell>
  );
}
