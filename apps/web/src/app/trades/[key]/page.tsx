import { TradeRiskChart } from "@/components/trade-risk-chart";
import { readBotRisk } from "@/server/bot-risk";
import { priceNumber } from "@/lib/journal-format";
import { notFound } from "next/navigation";
import { ExecutionCharts } from "@/components/execution-charts";
import {
  JournalShell,
  Panel,
  PnlValue,
  Status,
  number,
  timestamp,
} from "@/components/journal-view";
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
          ← Retour aux trades
        </a>
        <Status trade={{ ...row, status: trade.status }} />
      </div>
      <Panel title="Détail de la position">
        <dl className="grid gap-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
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
          <div>
            <dt className="text-xs text-muted-foreground">Quantité entrée / restante</dt>
            <dd className="tnum mt-1">
              {number(row.quantity, 4)} / {number(row.openQuantity, 4)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Prix moyen entrée / sortie</dt>
            <dd className="tnum mt-1">
              {priceNumber(row.avgEntry)} / {priceNumber(row.avgExit)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Frais enregistrés</dt>
            <dd className="tnum mt-1">
              {number(row.fees)} {currency}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">P&L net enregistré</dt>
            <dd className="mt-1">
              <PnlValue value={row.netPnl} currency={currency} />
            </dd>
          </div>
        </dl>
        {row.status === "open" && (
          <p className="mt-5 text-xs text-muted-foreground">
            Position encore ouverte : le résultat enregistré inclut les sorties partielles et les
            frais importés. Il ne représente pas le P&L au prix actuel.
          </p>
        )}
      </Panel>
      <Panel title="Bougies, achats/ventes et niveaux SL / TP">
        <TradeRiskChart trade={trade} fills={fills} risk={risk} timeZone={view.timeZone} />
      </Panel>
      <Panel title="Entrées et sorties">
        <ExecutionCharts trade={trade} fills={fills} currency={currency} timeZone={view.timeZone} />
      </Panel>
      <Panel title={`${fills.length} exécution${fills.length === 1 ? "" : "s"}`}>
        <div className="overflow-x-auto">
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
      </Panel>
      {row.notes && (
        <Panel title="Notes du journal">
          <p className="whitespace-pre-wrap text-sm">{row.notes}</p>
        </Panel>
      )}
    </JournalShell>
  );
}
