import type { riskTimeline } from "./bot-risk";

/** Position intervals clipped to loaded candles; closed positions never extend into live time. */
export function riskZones(
  bars: { time: number; open?: number }[],
  step: number,
  levels: ReturnType<typeof riskTimeline>,
  key: "stopLoss" | "takeProfit",
) {
  if (!bars.length) return [];
  const first = bars[0]!.time,
    last = bars[bars.length - 1]!.time + step;
  const groups = new Map<string, typeof levels>();
  for (const event of levels) {
    const key = event.tradeKey ?? "single";
    const group = groups.get(key) ?? [];
    group.push(event);
    groups.set(key, group);
  }
  return [...groups.values()].flatMap((group) => {
    const entry = group[0];
    if (!entry) return [];
    const entryBar = bars.find((bar) => bar.time <= entry.time && bar.time + step > entry.time);
    // An older still-open trade uses the first visible candle as an explicit visual anchor.
    const anchor = entryBar?.open ?? (entry.time < first ? bars[0]?.open : undefined);
    return group.flatMap(
      (event, index): [{ xAxis: number; yAxis: number }, { xAxis: number; yAxis: number }][] => {
        if (event.position <= 1e-10) return [];
        const end = Math.min(group[index + 1]?.time ?? last, last);
        const start = Math.max(event.time, first);
        if (end <= start) return [];
        const left = Math.max(
          0,
          bars.findIndex((bar) => bar.time + step > start),
        );
        let right = bars.findLastIndex((bar) => bar.time < end);
        right = Math.max(left, right);
        return [
          [
            { xAxis: left, yAxis: anchor ?? event.basis },
            {
              xAxis: right,
              yAxis:
                anchor != null && event.basis > 0
                  ? (anchor * event[key]) / event.basis
                  : event[key],
            },
          ],
        ];
      },
    );
  });
}
