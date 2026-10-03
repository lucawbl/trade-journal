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
  return [...groups.values()].flatMap((group) =>
    group.flatMap((entry, index) => {
      if (entry.kind !== "entry" || entry.position <= 1e-10) return [];
      const entryIndex = bars.findIndex(
        (bar) => bar.time <= entry.time && bar.time + step > entry.time,
      );
      if (entryIndex < 0 && bars.some((bar) => bar.open != null)) return [];
      const anchor = entryIndex >= 0 ? (bars[entryIndex]?.open ?? entry.basis) : entry.basis;
      // Separate every entry signal: the next fill bounds this visual block, not an invented order closure.
      const end = Math.min(group[index + 1]?.time ?? last, last);
      if (end <= first || entry.time >= last || end <= entry.time) return [];
      const left = Math.max(0, entryIndex);
      const right = Math.min(
        bars.length - 1,
        Math.max(
          left + 1,
          bars.findLastIndex((bar) => bar.time < end),
        ),
      );
      return [
        [
          { xAxis: left, yAxis: anchor },
          { xAxis: right, yAxis: (anchor * entry[key]) / entry.basis },
        ] as [{ xAxis: number; yAxis: number }, { xAxis: number; yAxis: number }],
      ];
    }),
  );
}
