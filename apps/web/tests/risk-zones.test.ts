import { expect, it } from "vitest";
import { riskZones } from "../src/lib/risk-zones";
import type { riskTimeline } from "../src/lib/bot-risk";
const bars = [0, 60, 120, 180].map((time) => ({ time }));
const event = (time: number, position: number, basis = 100, stopLoss = 90, takeProfit = 120) =>
  ({
    time,
    position,
    basis,
    stopLoss,
    takeProfit,
    kind: position === 0 ? "exit" : "entry",
  }) as ReturnType<typeof riskTimeline>[number];
it("ends zones at full closure instead of extending into live candles", () => {
  expect(riskZones(bars, 60, [event(0, 2), event(120, 0)], "stopLoss")).toEqual([
    [
      { xAxis: 0, yAxis: 100 },
      { xAxis: 1, yAxis: 90 },
    ],
  ]);
});
it("draws a separate block for every entry within the same position", () => {
  expect(riskZones(bars, 60, [event(0, 2), event(60, 3, 110, 99, 132)], "takeProfit")).toEqual([
    [
      { xAxis: 0, yAxis: 100 },
      { xAxis: 1, yAxis: 120 },
    ],
    [
      { xAxis: 1, yAxis: 110 },
      { xAxis: 3, yAxis: 132 },
    ],
  ]);
});
it("partial exit bounds a block without drawing a new entry block", () => {
  const exit = { ...event(120, 1), kind: "exit" as const };
  expect(riskZones(bars, 60, [event(0, 2), exit], "stopLoss")).toHaveLength(1);
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
it("keeps overlapping trades independent", () => {
  const levels = [
    { ...event(0, 2), tradeKey: "a" },
    { ...event(60, 1, 200, 180, 240), tradeKey: "b" },
    { ...event(120, 0), tradeKey: "a" },
    { ...event(180, 0, 200, 180, 240), tradeKey: "b" },
  ];
  expect(riskZones(bars, 60, levels, "takeProfit")).toEqual([
    [
      { xAxis: 0, yAxis: 100 },
      { xAxis: 1, yAxis: 120 },
    ],
    [
      { xAxis: 1, yAxis: 200 },
      { xAxis: 2, yAxis: 240 },
    ],
  ]);
});
it("anchors visual zones to the crypto candle while preserving risk percentages", () => {
  const candles = bars.map((bar) => ({ ...bar, open: 50 }));
  expect(riskZones(candles, 60, [event(0, 2), event(120, 0)], "takeProfit")).toEqual([
    [
      { xAxis: 0, yAxis: 50 },
      { xAxis: 1, yAxis: 60 },
    ],
  ]);
  expect(riskZones(candles, 60, [event(0, 2)], "stopLoss")[0]?.[1].yAxis).toBe(45);
});

it("does not relocate an old trade onto the first visible candle", () => {
  expect(
    riskZones(
      bars.map((bar) => ({ ...bar, open: 50 })),
      60,
      [event(-120, 2)],
      "stopLoss",
    ),
  ).toEqual([]);
});

it("isolates one purchase block while retaining its actual next execution boundary", () => {
  const levels = [
    { ...event(0, 2), id: "a" },
    { ...event(60, 3, 110, 99, 132), id: "b" },
    { ...event(120, 0), id: "c" },
  ];
  expect(riskZones(bars, 60, levels, "takeProfit", "b")).toEqual([
    [
      { xAxis: 1, yAxis: 110 },
      { xAxis: 2, yAxis: 132 },
    ],
  ]);
  expect(riskZones(bars, 60, levels, "takeProfit", "c")).toEqual([]);
});
