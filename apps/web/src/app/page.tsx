import { DashboardShell } from "@/components/dashboard-shell";
import {
  EquityChart,
  Metric,
  Panel,
  PnlValue,
  Status,
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
  const realized = view.projectedTrades.reduce((total, trade) => total + trade.netPnl, 0);
  const open = view.rows.filter((trade) => trade.status === "open");
  const recent = [...view.rows]
    .sort((a, b) => (b.closedAt ?? b.openedAt).localeCompare(a.closedAt ?? a.openedAt))
    .slice(0, 6);
  const accountMap = new Map(view.accounts.map((account) => [account.id, account]));
  return (
    <DashboardShell>
      <div className="dashboard-grid">
        <div className="dashboard-equity">
          {" "}
          <Panel title="Évolution du résultat clôturé">
            <p className="mb-4 text-xs text-muted-foreground">
              Cumul des trades entièrement clôturés. Les résultats des positions en cours figurent
              dans les cartes des bots.
            </p>
            {view.currencyScope.monetary ? (
              <EquityChart points={view.overview.equity} currency={currency} detailed />
            ) : (
              <p className="py-6 text-sm text-muted-foreground">
                Les comptes utilisent plusieurs devises. Le bilan par compte permet de consulter
                leurs résultats séparément.
              </p>
            )}
          </Panel>
        </div>
        <Panel title="Réussite par bot">
          <div className="space-y-5">
            {view.accounts
              .filter((a) => !a.archivedAt)
              .map((account, index) => {
                const closed = view.rows.filter(
                  (t) => t.accountId === account.id && t.status !== "open",
                );
                const wins = closed.filter((t) => t.netPnl > 0).length;
                const rate = closed.length ? (wins / closed.length) * 100 : 0;
                return (
                  <div key={account.id}>
                    <div className="mb-2 flex justify-between gap-3 text-xs">
                      <span className="font-medium">{account.name}</span>
                      <span className="tnum text-muted-foreground">
                        {closed.length ? `${number(rate, 0)} %` : "—"}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${rate}%`,
                          backgroundColor: ["#638bea", "#eeac56", "#3abda0"][index % 3],
                        }}
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      {wins} gagnant{wins > 1 ? "s" : ""} / {closed.length} clôturé
                      {closed.length > 1 ? "s" : ""}
                    </p>
                  </div>
                );
              })}
            {!view.accounts.some((a) => !a.archivedAt) && (
              <p className="text-sm text-muted-foreground">Aucun bot actif.</p>
            )}
          </div>
          <div className="mt-6 flex items-center gap-4 border-t pt-4">
            <div
              className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full"
              style={{
                background: `conic-gradient(#3abda0 ${(m.winRate ?? 0) * 360}deg, #edf1f8 0deg)`,
              }}
              aria-hidden="true"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-card text-sm font-semibold">
                {m.winRate == null ? "—" : `${number(m.winRate * 100, 0)} %`}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium">Réussite globale</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {m.winRate == null
                  ? "Aucun trade clôturé"
                  : `${number(m.winRate * 100, 1)} % · ${m.closedTrades} clôtures`}
              </p>
            </div>
          </div>
        </Panel>
        <section
          aria-label="Résumé du journal"
          className="dashboard-metrics grid grid-cols-2 gap-3 xl:grid-cols-4"
        >
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
            label="Total déjà réalisé"
            value={
              view.currencyScope.monetary ? <PnlValue value={realized} currency={currency} /> : "—"
            }
            hint={`Clôtures + sorties partielles · frais inclus : ${view.currencyScope.monetary ? `${number(fees)} ${currency}` : "devises distinctes"}`}
          />
        </section>
        <section aria-labelledby="bots-title" className="dashboard-bots space-y-3">
          <div>
            <h2 id="bots-title" className="text-lg font-semibold">
              Bots et positions
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Le résultat réalisé inclut les sorties partielles et les frais. Il ne valorise pas la
              quantité restante au prix actuel.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {view.accounts
              .filter((account) => !account.archivedAt)
              .map((account) => {
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
                    <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                      <span className="text-muted-foreground">
                        {accountClosed.length} clôture{accountClosed.length === 1 ? "" : "s"} ·
                        résultat net
                      </span>
                      <PnlValue value={accountPnl} currency={account.currency} />
                    </div>
                    {positions.length ? (
                      positions.map((trade) => {
                        const remaining =
                          trade.quantity > 0
                            ? Math.max(
                                0,
                                Math.min(100, (trade.openQuantity / trade.quantity) * 100),
                              )
                            : 0;
                        return (
                          <div key={trade.key} className="mt-4 space-y-3">
                            <a
                              href={tradePath(trade.key)}
                              className="inline-block text-sm font-medium text-brand hover:underline"
                            >
                              {trade.direction === "long" ? "Long" : "Short"} ·{" "}
                              {timestamp(trade.openedAt, view.timeZone)}
                            </a>
                            <div className="flex items-center justify-between gap-2">
                              <Status trade={trade} />
                              <span className="text-xs text-muted-foreground">
                                {number(remaining, 1)} % de la quantité conservée
                              </span>
                            </div>
                            <div
                              role="meter"
                              aria-label={`Quantité restante ${trade.symbol}`}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={remaining}
                              aria-valuetext={`${number(remaining, 1)} % de la quantité entrée`}
                              className="h-1.5 overflow-hidden rounded-full bg-secondary"
                            >
                              <div
                                className="h-full rounded-full bg-brand"
                                style={{ width: `${remaining}%` }}
                              />
                            </div>
                            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                              <div>
                                <dt className="text-xs text-muted-foreground">
                                  Prix moyen d’entrée
                                </dt>
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
                        );
                      })
                    ) : (
                      <p className="mt-4 text-sm text-muted-foreground">
                        Aucune quantité encore en position dans le journal.
                      </p>
                    )}
                    <p className="mt-5 border-t pt-3 text-xs text-muted-foreground">
                      Réception des données : {timestamp(account.lastSyncAt, view.timeZone)} ·{" "}
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
        <div className="dashboard-recent">
          <Panel title="Trades récents">
            {recent.length ? (
              <ul className="divide-y">
                {recent.map((trade) => (
                  <li key={trade.key} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <a
                        href={tradePath(trade.key)}
                        className="font-medium text-brand hover:underline"
                      >
                        {trade.symbol.replace("USDT", " / USDT")}
                      </a>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {trade.status === "open" ? "Ouvert" : "Clôturé"} ·{" "}
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
                <p className="text-sm font-medium">Aucun trade enregistré pour le moment.</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Les premiers trades apparaîtront ici dès leur réception.
                </p>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </DashboardShell>
  );
}
