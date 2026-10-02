import type { RoundTrip } from "@luxalgo/journal-core";
import type { ChartExecution } from "./execution-chart";
import { executionChart } from "./execution-chart";

export interface BotRisk {
  stopLossPct: number;
  takeProfitPct: number;
  fetchedAt: string;
}

/** Current strategy references, never historical placed-stop claims. */
export function riskTimeline(trade: RoundTrip, fills: ChartExecution[], risk: BotRisk | null) {
  const { events, complete } = executionChart(trade, fills);
  if (!risk || !complete) return [];
  let quantity = 0,
    cost = 0;
  const sign = trade.direction === "long" ? 1 : -1;
  return events.map((event) => {
    const average = quantity > 0 ? cost / quantity : event.price;
    if (event.kind === "entry") {
      quantity += event.quantity;
      cost += event.quantity * event.price;
    }
    const basis = event.kind === "entry" ? cost / quantity : average;
    const stopLoss = basis * (1 - (sign * risk.stopLossPct) / 100);
    const takeProfit = basis * (1 + (sign * risk.takeProfitPct) / 100);
    if (event.kind === "exit") {
      quantity = Math.max(0, quantity - event.quantity);
      cost = average * quantity;
    }
    return { ...event, tradeKey: trade.key, basis, stopLoss, takeProfit };
  });
}

export function chartResolution(from: number, to: number) {
  const duration = Math.max(0, to - from);
  if (duration <= 6 * 3_600_000) return "1m" as const;
  if (duration <= 24 * 3_600_000) return "5m" as const;
  if (duration <= 7 * 24 * 3_600_000) return "15m" as const;
  if (duration <= 60 * 24 * 3_600_000) return "1h" as const;
  return "1d" as const;
}
