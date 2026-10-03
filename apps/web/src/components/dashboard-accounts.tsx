import { Panel, PnlValue, number, timestamp } from "@/components/journal-view";
import { readJournalView } from "@/server/journal-view";

export function DashboardAccounts() {
  const view = readJournalView();
  return (
    <>
      <div className="grid gap-5 lg:grid-cols-2">
        {view.accounts.map((account) => {
          const rows = view.rows.filter((trade) => trade.accountId === account.id);
          const closed = rows.filter((trade) => trade.status !== "open");
          const netPnl = closed.reduce((sum, trade) => sum + trade.netPnl, 0);
          const syncDate = account.lastSyncAt ? Date.parse(account.lastSyncAt) : NaN;
          const recent = Number.isFinite(syncDate) && Date.now() - syncDate <= 5 * 60 * 1000;
          return (
            <Panel key={account.id} title={account.name}>
              <div className="mb-5 flex flex-wrap justify-between gap-2 text-xs">
                <span className="text-muted-foreground">
                  {account.broker || "Compte manuel"} · {account.currency}
                </span>
                <span
                  className={`rounded-full border px-2 py-1 ${recent ? "text-profit" : "text-muted-foreground"}`}
                >
                  {account.archivedAt
                    ? "Archivé"
                    : recent
                      ? "Réception récente"
                      : account.lastSyncAt
                        ? "Réception ancienne"
                        : "Réception non datée"}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-5 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Capital initial du journal</dt>
                  <dd className="tnum mt-1">
                    {number(account.initialBalance)} {account.currency}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">P&L net clôturé</dt>
                  <dd className="mt-1">
                    <PnlValue value={netPnl} currency={account.currency} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Trades clôturés</dt>
                  <dd className="mt-1">{closed.length}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Positions ouvertes du journal</dt>
                  <dd className="mt-1">{rows.length - closed.length}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Capital reconstitué</dt>
                  <dd className="tnum mt-1">
                    {number(account.initialBalance + netPnl)} {account.currency}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Equity transmise par le broker</dt>
                  <dd className="tnum mt-1">
                    {account.equity === null
                      ? "Non transmise"
                      : `${number(account.equity)} ${account.currency}`}
                  </dd>
                </div>
              </dl>
              <p className="mt-5 border-t pt-4 text-xs text-muted-foreground">
                Dernière réception réussie : {timestamp(account.lastSyncAt, view.timeZone)} ·{" "}
                {view.timeZone}
              </p>
              <a
                href={`/trades?accounts=${encodeURIComponent(account.id)}`}
                className="mt-3 inline-block text-sm text-brand hover:underline"
              >
                Voir les trades de ce compte →
              </a>
            </Panel>
          );
        })}
      </div>
      {!view.accounts.length && (
        <Panel title="Aucun compte">
          <p className="text-sm text-muted-foreground">
            Le compte DOGE sera créé à la première réception du bot.
          </p>
        </Panel>
      )}
      <Panel title="Comment lire ces données">
        <p className="text-sm text-muted-foreground">
          Le capital reconstitué additionne le capital initial du journal et les résultats des
          trades entièrement clôturés. Les sorties partielles, positions non réalisées, dépôts et
          retraits ne sont pas inclus. Ce montant peut donc différer de l’equity Bybit. La réception
          des exécutions du bot fonctionne indépendamment d’une connexion directe du journal au
          broker.
        </p>
      </Panel>
    </>
  );
}
