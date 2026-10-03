import { JournalSidebarFrame } from "@/components/journal-sidebar-frame";
import { MarketTerminal } from "@/components/market-terminal";
import { requireJournalSession, readJournalView } from "@/server/journal-view";
import { isLiveSymbol, LIVE_SYMBOLS } from "@/lib/live-market";
import { isResolution } from "@/lib/market-data";
import { rowToTrade } from "@/server/trades-query";
import { listExecutions } from "@/server/executions";
import { readBotRisk } from "@/server/bot-risk";
import { executionChart } from "@/lib/execution-chart";
import { riskTimeline } from "@/lib/bot-risk";
export const dynamic = "force-dynamic";
export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireJournalSession();
  const params = await searchParams;
  const view = readJournalView();
  const rows = LIVE_SYMBOLS.flatMap((symbol) => view.rows.filter((r) => r.symbol === symbol));
  const pairs = [...new Map(rows.map((row) => [`${row.accountId}|${row.symbol}`, row])).entries()];
  const risks = new Map(
    await Promise.all(
      pairs.map(async ([key, row]) => [key, await readBotRisk(row.accountId, row.symbol)] as const),
    ),
  );
  const trades = rows.map((row) => {
    const trade = rowToTrade(row);
    const fills = listExecutions(row.accountId, trade.executionIds);
    return {
      key: row.key,
      symbol: row.symbol,
      account: view.accounts.find((a) => a.id === row.accountId)?.name ?? row.accountId,
      direction: row.direction,
      status: row.status,
      openedAt: row.openedAt,
      closedAt: row.closedAt,
      currency: view.accounts.find((a) => a.id === row.accountId)?.currency ?? "USDT",
      avgEntry: row.avgEntry,
      openQuantity: row.openQuantity,
      netPnl: row.netPnl,
      events: executionChart(trade, fills).events,
      levels: riskTimeline(trade, fills, risks.get(`${row.accountId}|${row.symbol}`) ?? null),
    };
  });
  return (
    <JournalSidebarFrame active="/market" terminal>
      <MarketTerminal
        initialSymbol={isLiveSymbol(params.symbol) ? params.symbol : "DOGEUSDT"}
        initialResolution={isResolution(params.resolution) ? params.resolution : "1m"}
        timeZone={view.timeZone}
        trades={trades}
      />
    </JournalSidebarFrame>
  );
}
