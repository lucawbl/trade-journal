import type { riskTimeline } from "./bot-risk";

/** Position intervals clipped to loaded candles; closed positions never extend into live time. */
export function riskZones(
  bars: { time: number }[],
  step: number,
  levels: ReturnType<typeof riskTimeline>,
  key: "stopLoss" | "takeProfit",
) {
  if (!bars.length) return [];
  const first = bars[0]!.time,
    last = bars[bars.length - 1]!.time + step;
  return levels.flatMap(
    (event, index): [{ xAxis: number; yAxis: number }, { xAxis: number; yAxis: number }][] => {
      if (event.position <= 1e-10) return [];
      const end = Math.min(levels[index + 1]?.time ?? last, last);
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
          { xAxis: left, yAxis: event.basis },
          { xAxis: right, yAxis: event[key] },
        ],
      ];
    },
  );
}
