import { equityCurve } from "@luxalgo/journal-core";
import { Panel, PnlValue, number, timestamp } from "@/components/journal-view";
import {
  JournalVisualBars,
  JournalVisualCurve,
  JournalVisualDonut,
} from "@/components/journal-visual-charts";
import { readJournalView } from "@/server/journal-view";

export function DashboardAccounts() {
  const view = readJournalView();
  return (
    <>
      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        {view.accounts.map((account) => {
          const rows = view.rows.filter((trade) => trade.accountId === account.id);
          const closed = rows.filter((trade) => trade.status !== "open");
          const netPnl = closed.reduce((sum, trade) => sum + trade.netPnl, 0);
          const wins = closed.filter((trade) => trade.status === "win").length;
          const losses = closed.filter((trade) => trade.status === "loss").length;
          const open = rows.length - closed.length;
          const syncDate = account.lastSyncAt ? Date.parse(account.lastSyncAt) : NaN;
          const recent = Number.isFinite(syncDate) && Date.now() - syncDate <= 5 * 60 * 1000;
          const capitalItems = [
            { label: "Capital initial · journal", value: account.initialBalance },
            { label: "Capital reconstitué · journal", value: account.initialBalance + netPnl },
            ...(account.equity === null
              ? []
              : [{ label: "Equity · broker", value: account.equity }]),
          ];
          return (
            <Panel key={account.id} title={account.name}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">
                  {account.broker || "Manuel"} · {account.currency}
                </span>
                <span
                  className={`flex items-center gap-1.5 ${recent ? "text-profit" : "text-muted-foreground"}`}
                  title={timestamp(account.lastSyncAt, view.timeZone)}
                >
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
                  {account.archivedAt
                    ? "Archivé"
                    : recent
                      ? "À jour"
                      : account.lastSyncAt
                        ? "Dernière réception"
                        : "Non synchronisé"}
                </span>
              </div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">P&L clôturé</span>
                <strong className="text-xl">
                  <PnlValue value={netPnl} currency={account.currency} />
                </strong>
              </div>
              <JournalVisualCurve
                points={equityCurve(view.trades.filter((trade) => trade.accountId === account.id))}
                currency={account.currency}
              />
              <div className="my-5 border-y py-4">
                <JournalVisualDonut
                  segments={[
                    { label: "Gagnants", value: wins, color: "var(--profit)" },
                    { label: "Perdants", value: losses, color: "var(--loss)" },
                    {
                      label: "Équilibre",
                      value: closed.length - wins - losses,
                      color: "var(--baseline)",
                    },
                  ]}
                  value={closed.length ? `${number((wins / closed.length) * 100, 0)} %` : "—"}
                  label="réussite"
                />
                <div className="mt-4">
                  <div className="mb-2 flex justify-between gap-3 text-xs">
                    <span>
                      <strong>{closed.length}</strong> clôturés
                    </span>
                    <span className="text-brand">
                      <strong>{open}</strong> ouverts
                    </span>
                  </div>
                  <div
                    role="img"
                    aria-label={`${closed.length} positions clôturées, ${open} ouvertes`}
                    className="flex h-2 overflow-hidden rounded-full bg-secondary"
                  >
                    <span
                      className="bg-muted-foreground/50"
                      style={{ width: `${rows.length ? (closed.length / rows.length) * 100 : 0}%` }}
                    />
                    <span
                      className="bg-brand"
                      style={{ width: `${rows.length ? (open / rows.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
              <JournalVisualBars items={capitalItems} currency={account.currency} signed={false} />
              <details className="mt-4 border-t pt-3 text-xs text-muted-foreground">
                <summary className="cursor-pointer">Détails du capital</summary>
                <p className="mt-3">
                  Capital du journal = capital initial + P&L des positions entièrement clôturées.
                  Sorties partielles, positions non réalisées, dépôts et retraits exclus.
                </p>
                <p className="mt-2">
                  Equity broker :{" "}
                  {account.equity === null
                    ? "non transmise"
                    : `${number(account.equity)} ${account.currency}`}
                </p>
                <p className="mt-2">
                  {timestamp(account.lastSyncAt, view.timeZone)} · {view.timeZone}
                </p>
              </details>
              <a
                href={`/trades?accounts=${encodeURIComponent(account.id)}`}
                className="mt-4 inline-block text-xs text-brand hover:underline"
              >
                Trades →
              </a>
            </Panel>
          );
        })}
      </div>
      {!view.accounts.length && (
        <Panel title="Comptes">
          <p className="py-8 text-center text-sm text-muted-foreground">Aucun compte reçu.</p>
        </Panel>
      )}
    </>
  );
}
