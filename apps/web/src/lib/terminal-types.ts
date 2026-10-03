import type { executionChart } from "./execution-chart";
import type { riskTimeline } from "./bot-risk";
export interface TerminalTrade {
  key: string;
  symbol: string;
  account: string;
  direction: string;
  status: string;
  openedAt: string;
  closedAt: string | null;
  currency: string;
  avgEntry: number;
  openQuantity: number;
  netPnl: number;
  events: ReturnType<typeof executionChart>["events"];
  levels: ReturnType<typeof riskTimeline>;
}
