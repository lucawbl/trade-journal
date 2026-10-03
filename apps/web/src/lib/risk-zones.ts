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
    if (!entry || entry.position <= 1e-10) return [];
    const entryIndex = bars.findIndex(
      (bar) => bar.time <= entry.time && bar.time + step > entry.time,
    );
    // Never invent a new entry when the actual entry candle is outside the loaded period.
    if (entryIndex < 0 && bars.some((bar) => bar.open != null)) return [];
    const anchor = entryIndex >= 0 ? (bars[entryIndex]?.open ?? entry.basis) : entry.basis;
    const closure = group.find((event) => event.position <= 1e-10);
    const end = Math.min(closure?.time ?? last, last);
    if (end <= first || entry.time >= last) return [];
    const left = Math.max(0, entryIndex);
    const right = Math.max(
      left,
      bars.findLastIndex((bar) => bar.time < end),
    );
    return [
      [
        { xAxis: left, yAxis: anchor },
        { xAxis: right, yAxis: (anchor * entry[key]) / entry.basis },
      ] as [{ xAxis: number; yAxis: number }, { xAxis: number; yAxis: number }],
    ];
  });
}
