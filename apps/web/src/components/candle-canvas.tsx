"use client";
import * as echarts from "echarts/core";
import { CandlestickChart, ScatterChart } from "echarts/charts";
import { MarkAreaComponent, DataZoomComponent, LegendComponent } from "echarts/components";
import type { EChartsOption } from "echarts";
import { EChart } from "./charts/echart";
import type { MarketHistory } from "@/lib/market-data";
import { RESOLUTIONS } from "@/lib/market-data";
import { number, priceNumber, timestamp } from "@/lib/journal-format";
import { riskZones } from "@/lib/risk-zones";
import type { riskTimeline } from "@/lib/bot-risk";
import type { executionChart } from "@/lib/execution-chart";

echarts.use([
  MarkAreaComponent,
  CandlestickChart,
  ScatterChart,
  DataZoomComponent,
  LegendComponent,
]);
type Events = ReturnType<typeof executionChart>["events"];
export function CandleCanvas({
  history,
  events,
  levels,
  timeZone,
  livePrice,
  large = false,
}: {
  history: MarketHistory;
  events: Events;
  levels: ReturnType<typeof riskTimeline>;
  timeZone: string;
  livePrice?: number;
  large?: boolean;
}) {
  const bars = history.bars;
  const step = RESOLUTIONS[history.resolution];
  const times = bars.map((bar) => timestamp(new Date(bar.time).toISOString(), timeZone));
  const indices = new Map(bars.map((bar, index) => [bar.time, index]));
  const executions = (kind: "entry" | "exit") =>
    events
      .filter((event) => event.kind === kind)
      .flatMap((event) => {
        const index = indices.get(Math.floor(event.time / step) * step);
        return index == null
          ? []
          : [
              {
                value: [index, event.price],
                name: `${kind === "entry" ? "Entrée" : "Sortie"} · ${timestamp(event.executedAt, timeZone)} · ${number(event.quantity, 8)} unités`,
              },
            ];
      });
  const level = (key: "stopLoss" | "takeProfit") =>
    bars.map((bar) => {
      const active = levels.findLast((event) => event.time < bar.time + step);
      return active && (active.position > 1e-10 || active.time >= bar.time) ? active[key] : null;
    });
  const option: EChartsOption = {
    backgroundColor: "transparent",
    animation: false,
    color: ["#34d399", "#60a5fa", "#fb923c", "#f87171", "#34d399"],
    legend: {
      type: "scroll",
      top: 0,
      textStyle: { color: "#a1a1aa" },
      data: [
        "Bougies Binance Spot",
        ...(events.length ? ["Entrées", "Sorties"] : []),
        ...(levels.length ? ["SL de référence", "TP de référence"] : []),
      ],
    },
    grid: { left: 18, right: 115, top: 45, bottom: 70 },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross" },
      valueFormatter: (value) => (typeof value === "number" ? priceNumber(value) : String(value)),
    },
    xAxis: {
      type: "category",
      data: times,
      axisLabel: { color: "#a1a1aa", hideOverlap: true },
      axisLine: { lineStyle: { color: "#3f3f46" } },
    },
    yAxis: {
      type: "value",
      scale: true,
      position: "right",
      axisLabel: { color: "#a1a1aa", formatter: priceNumber },
      splitLine: { lineStyle: { color: "#27272a" } },
    },
    dataZoom: [
      { type: "inside", start: livePrice != null ? 60 : 0, end: 100 },
      {
        type: "slider",
        bottom: 8,
        height: 22,
        borderColor: "#3f3f46",
        textStyle: { color: "#a1a1aa" },
      },
    ],
    series: [
      {
        name: "Bougies Binance Spot",
        type: "candlestick",
        data: bars.map((bar) => [bar.open, bar.close, bar.low, bar.high]),
        itemStyle: {
          color: "#34d399",
          color0: "#f87171",
          borderColor: "#34d399",
          borderColor0: "#f87171",
        },
      },
      {
        name: "Entrées",
        type: "scatter",
        data: executions("entry"),
        symbol: "triangle",
        symbolSize: 11,
        itemStyle: { color: "#60a5fa" },
        z: 5,
      },
      {
        name: "Sorties",
        type: "scatter",
        data: executions("exit"),
        symbol: "diamond",
        symbolSize: 11,
        itemStyle: { color: "#fb923c" },
        z: 5,
      },
      {
        name: "SL de référence",
        type: "line",
        data: level("stopLoss"),
        markArea: {
          silent: true,
          label: { show: false },
          itemStyle: { color: "#f2364522", borderColor: "#f2364566", borderWidth: 1 },
          data: riskZones(bars, step, levels, "stopLoss"),
        },
        step: "end",
        showSymbol: false,
        connectNulls: false,
        lineStyle: { color: "#f87171", type: "dashed", width: 2 },
        itemStyle: { color: "#f87171" },
      },
      {
        name: "TP de référence",
        type: "line",
        data: level("takeProfit"),
        markArea: {
          silent: true,
          label: { show: false },
          itemStyle: { color: "#08998122", borderColor: "#08998166", borderWidth: 1 },
          data: riskZones(bars, step, levels, "takeProfit"),
        },
        step: "end",
        showSymbol: false,
        connectNulls: false,
        lineStyle: { color: "#34d399", type: "dashed", width: 2 },
        itemStyle: { color: "#34d399" },
      },
      ...(livePrice != null
        ? [
            {
              name: "Cours actuel",
              type: "line" as const,
              data: bars.map(() => livePrice),
              showSymbol: false,
              silent: true,
              lineStyle: { color: "#38bdf8", type: "dashed" as const, width: 1 },
              itemStyle: { color: "#38bdf8" },
              endLabel: {
                show: true,
                color: "#38bdf8",
                backgroundColor: "#0f172a",
                padding: [3, 5],
                distance: -8,
                align: "right" as const,
                verticalAlign: "bottom" as const,
                formatter: () => priceNumber(livePrice),
              },
            },
          ]
        : []),
    ],
  };
  return (
    <div className="overflow-x-auto">
      <div
        className={large ? "min-w-0" : "min-w-[640px]"}
        role="img"
        aria-label={`Graphique en bougies ${history.symbol}${livePrice != null ? ` en direct, cours ${priceNumber(livePrice)} USDT` : ""}${events.length ? ", achats et ventes" : ""}${levels.length ? ", stop-loss et take-profit de référence" : ""}.`}
      >
        <EChart
          option={option}
          height={large ? "clamp(420px, calc(100dvh - 240px), 1200px)" : 440}
          preserveZoom
        />
      </div>
    </div>
  );
}
