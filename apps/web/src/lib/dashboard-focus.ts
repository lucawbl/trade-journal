import type { RoundTrip } from "@luxalgo/journal-core";

type Trade = Pick<RoundTrip, "accountId" | "symbol" | "status" | "netPnl" | "grossPnl" | "fees">;
type Account = { id: string; name: string; currency: string };

/** Closed positions drive comparisons; partial exits only enter the realized total. */
export function dashboardFocus(trades: Trade[], accounts: Account[], monetary: boolean) {
  const closed = trades.filter((trade) => trade.status !== "open");
  const wins = closed.filter((trade) => trade.status === "win");
  const losses = closed.filter((trade) => trade.status === "loss");
  const bots = accounts.flatMap((account) => {
    const positions = trades.filter((trade) => trade.accountId === account.id);
    if (!positions.length) return [];
    const finished = positions.filter((trade) => trade.status !== "open");
    return [
      {
        ...account,
        label: positions[0]!.symbol.replace(/USDT$/, ""),
        closed: finished.length,
        open: positions.length - finished.length,
        netPnl: finished.reduce((sum, trade) => sum + trade.netPnl, 0),
        winRate: finished.length
          ? finished.filter((trade) => trade.status === "win").length / finished.length
          : null,
      },
    ];
  });
  const weakest = monetary
    ? ([...bots]
        .filter((bot) => bot.closed > 0 && bot.netPnl < 0)
        .sort((a, b) => a.netPnl - b.netPnl)[0] ?? null)
    : null;
  return {
    bots,
    weakest,
    closed: closed.length,
    open: trades.length - closed.length,
    realized: monetary ? trades.reduce((sum, trade) => sum + trade.netPnl, 0) : null,
    avgWin:
      monetary && wins.length
        ? wins.reduce((sum, trade) => sum + trade.netPnl, 0) / wins.length
        : null,
    avgLoss:
      monetary && losses.length
        ? -losses.reduce((sum, trade) => sum + trade.netPnl, 0) / losses.length
        : null,
    fees: monetary && closed.length ? closed.reduce((sum, trade) => sum + trade.fees, 0) : null,
    gross:
      monetary && closed.length ? closed.reduce((sum, trade) => sum + trade.grossPnl, 0) : null,
  };
}
