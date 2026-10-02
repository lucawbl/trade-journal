import { expect, it } from "vitest";
import { riskZones } from "../src/lib/risk-zones";
import type { riskTimeline } from "../src/lib/bot-risk";
const bars = [0, 60, 120, 180].map((time) => ({ time }));
const event = (time: number, position: number, basis = 100, stopLoss = 90, takeProfit = 120) =>
  ({ time, position, basis, stopLoss, takeProfit }) as ReturnType<typeof riskTimeline>[number];
it("ends zones at full closure instead of extending into live candles", () => {
  expect(riskZones(bars, 60, [event(0, 2), event(120, 0)], "stopLoss")).toEqual([
    [
      { xAxis: 0, yAxis: 100 },
      { xAxis: 1, yAxis: 90 },
    ],
  ]);
});
it("keeps partial positions shaded and updates the average entry basis", () => {
  expect(riskZones(bars, 60, [event(0, 2), event(60, 1, 110, 99, 132)], "takeProfit")).toEqual([
    [
      { xAxis: 0, yAxis: 100 },
      { xAxis: 0, yAxis: 120 },
    ],
    [
      { xAxis: 1, yAxis: 110 },
      { xAxis: 3, yAxis: 132 },
    ],
  ]);
});
it("clips historical intervals and handles short targets below entry", () => {
  expect(riskZones(bars, 60, [event(-120, 2, 100, 110, 80)], "takeProfit")).toEqual([
    [
      { xAxis: 0, yAxis: 100 },
      { xAxis: 3, yAxis: 80 },
    ],
  ]);
  expect(riskZones(bars, 60, [event(-120, 2), event(-60, 0)], "stopLoss")).toEqual([]);
  expect(riskZones(bars, 60, [], "takeProfit")).toEqual([]);
});
