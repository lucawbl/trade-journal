import type { MarketBar } from "./market-data";
import type { executionChart } from "./execution-chart";

/** One small marker per candle and side; all executions remain in the journal. */
export function chartMarkers(
  bars: MarketBar[],
  step: number,
  events: ReturnType<typeof executionChart>["events"],
  kind: "entry" | "exit",
) {
  const counts = new Map<number, number>();
  for (const event of events) {
    if (event.kind !== kind) continue;
    const time = Math.floor(event.time / step) * step;
    counts.set(time, (counts.get(time) ?? 0) + 1);
  }
  return bars.flatMap((bar, index) => {
    const count = counts.get(bar.time);
    return count
      ? [
          {
            value: [index, kind === "entry" ? bar.low : bar.high],
            name: `${count} ${kind === "entry" ? "entrée(s)" : "sortie(s)"}`,
          },
        ]
      : [];
  });
}
