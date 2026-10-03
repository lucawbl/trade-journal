import { TradeRiskChart } from "@/components/trade-risk-chart";
import { readBotRisk } from "@/server/bot-risk";
import { priceNumber } from "@/lib/journal-format";
import { notFound } from "next/navigation";
import { ExecutionCharts } from "@/components/execution-charts";
import { TradePositionVisuals } from "@/components/trade-position-visuals";
import { JournalShell, Panel, Status, number, timestamp } from "@/components/journal-view";
import { readJournalView, requireJournalSession } from "@/server/journal-view";
import { getTradeByKey, rowToTrade } from "@/server/trades-query";
import { listExecutions } from "@/server/executions";
import { tradeKeyFromSegment } from "@/lib/trade-links";

export const dynamic = "force-dynamic";

export default async function TradePage({ params }: { params: Promise<{ key: string }> }) {
  await requireJournalSession();
  const { key } = await params;
  const row = getTradeByKey(tradeKeyFromSegment(key));
  if (!row) notFound();
  const view = readJournalView({ accounts: row.accountId });
  const trade = rowToTrade(row);
  const fills = listExecutions(row.accountId, trade.executionIds);
  const account = view.accounts.find((a) => a.id === row.accountId);
  const currency = account?.currency ?? "";
  const risk = await readBotRisk(row.accountId, row.symbol);
  return (
    <JournalShell title={row.symbol} active="trades">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <a
          href={`/trades?accounts=${encodeURIComponent(row.accountId)}`}
          className="text-sm text-brand hover:underline"
        >
          ← Historique
        </a>
        <Status trade={{ ...row, status: trade.status }} />
      </div>
      <TradePositionVisuals trade={trade} currency={currency} />
      <Panel title="Marché · SL / TP">
        <TradeRiskChart trade={trade} fills={fills} risk={risk} timeZone={view.timeZone} />
      </Panel>
      <Panel title="Exécutions">
        <ExecutionCharts trade={trade} fills={fills} currency={currency} timeZone={view.timeZone} />
      </Panel>
      <details className="card-sheen min-w-0 rounded-xl border bg-card p-4 sm:p-5">
        <summary className="cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-brand">
          Détails de la position
        </summary>
        <dl className="mt-5 grid gap-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Compte</dt>
            <dd className="mt-1">{account?.name ?? row.accountId}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Sens</dt>
            <dd className="mt-1">{row.direction === "long" ? "Long" : "Short"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Ouverture</dt>
            <dd className="mt-1">{timestamp(row.openedAt, view.timeZone)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Clôture</dt>
            <dd className="mt-1">{timestamp(row.closedAt, view.timeZone)}</dd>
          </div>
        </dl>
      </details>
      <details className="card-sheen min-w-0 rounded-xl border bg-card p-4 sm:p-5">
        <summary className="cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-brand">
          Journal · {fills.length} exécution{fills.length === 1 ? "" : "s"}
        </summary>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full whitespace-nowrap text-left text-sm">
            <caption className="sr-only">Exécutions composant ce trade</caption>
            <thead>
              <tr>
                {["Date", "Ordre", "Quantité", "Prix", "Frais"].map((label) => (
                  <th
                    scope="col"
                    key={label}
                    className="pb-3 pr-4 text-xs font-normal text-muted-foreground"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fills.map((fill) => (
                <tr key={fill.id} className="border-t">
                  <td className="py-3 pr-4">{timestamp(fill.executedAt, view.timeZone)}</td>
                  <td className="pr-4">{fill.side === "buy" ? "Achat" : "Vente"}</td>
                  <td className="tnum pr-4">{number(fill.quantity, 4)}</td>
                  <td className="tnum pr-4">{priceNumber(fill.price)}</td>
                  <td className="tnum pr-4">
                    {number(fill.fee, 5)} {currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      {row.notes && (
        <details className="card-sheen min-w-0 rounded-xl border bg-card p-4 sm:p-5">
          <summary className="cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-brand">
            Notes
          </summary>
          <p className="mt-4 whitespace-pre-wrap text-sm">{row.notes}</p>
        </details>
      )}
    </JournalShell>
  );
}
