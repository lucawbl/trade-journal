import type { JournalView } from "@/server/journal-view";
import { tradePath } from "@/lib/trade-links";
import { priceNumber } from "@/lib/journal-format";
import { PnlValue, Status, number, timestamp } from "./journal-view";

export function HistoryTrades({ view }: { view: JournalView }) {
  const accounts = new Map(view.accounts.map((account) => [account.id, account]));
  if (!view.rows.length)
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Aucun trade pour cette sélection.
      </p>
    );
  return (
    <div className="grid min-w-0 gap-3 lg:grid-cols-2">
      {view.rows.map((trade) => {
        const remainingPct =
          trade.quantity > 0
            ? Math.min(100, Math.max(0, (trade.openQuantity / trade.quantity) * 100))
            : 0;
        return (
          <details key={trade.key} className="min-w-0 rounded-xl border bg-card open:shadow-sm">
            <summary className="cursor-pointer rounded-xl p-4 focus-visible:outline-2 focus-visible:outline-brand">
              <span className="ml-1 inline-flex max-w-[calc(100%-20px)] flex-wrap items-center gap-x-3 gap-y-2 align-middle">
                <strong>{trade.symbol.replace("USDT", " / USDT")}</strong>
                <Status trade={trade} />
                <span className="font-semibold">
                  <PnlValue
                    value={trade.netPnl}
                    currency={accounts.get(trade.accountId)?.currency ?? ""}
                  />
                </span>
              </span>
              <span className="mt-2 block text-xs text-muted-foreground">
                {trade.direction === "long" ? "Long" : "Short"} ·{" "}
                {timestamp(trade.closedAt ?? trade.openedAt, view.timeZone)}
              </span>
              {trade.status === "open" && (
                <span
                  className="mt-3 block"
                  aria-label={`${number(remainingPct, 1)} % de la quantité entrée reste en position`}
                >
                  <span className="mb-1.5 flex justify-between gap-3 text-[11px] text-muted-foreground">
                    <span>Restant</span>
                    <span>{number(remainingPct, 1)} %</span>
                  </span>
                  <span
                    className="block h-1.5 overflow-hidden rounded-full bg-secondary"
                    aria-hidden="true"
                  >
                    <span
                      className="block h-full rounded-full bg-brand"
                      style={{ width: `${remainingPct}%` }}
                    />
                  </span>
                </span>
              )}
            </summary>
            <div className="border-t p-4">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">Compte</dt>
                  <dd className="mt-1 break-words">
                    {accounts.get(trade.accountId)?.name ?? trade.accountId}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Entrée moyenne</dt>
                  <dd className="tnum mt-1 break-all">{priceNumber(trade.avgEntry)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Sortie moyenne</dt>
                  <dd className="tnum mt-1 break-all">{priceNumber(trade.avgExit)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Quantité restante</dt>
                  <dd className="tnum mt-1 break-all">{number(trade.openQuantity, 6)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Frais enregistrés</dt>
                  <dd className="tnum mt-1">
                    {number(trade.fees)} {accounts.get(trade.accountId)?.currency}
                  </dd>
                </div>
              </dl>
              <a
                className="mt-4 inline-block text-sm font-medium text-brand hover:underline"
                href={tradePath(trade.key)}
              >
                Graphique →
              </a>
            </div>
          </details>
        );
      })}
    </div>
  );
}
