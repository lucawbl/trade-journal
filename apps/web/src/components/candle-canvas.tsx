"use client";
import * as echarts from "echarts/core";
import { CandlestickChart, ScatterChart } from "echarts/charts";
import { DataZoomComponent, LegendComponent } from "echarts/components";
import type { EChartsOption } from "echarts";
import { EChart } from "./charts/echart";
import type { MarketHistory } from "@/lib/market-data";
import { RESOLUTIONS } from "@/lib/market-data";
import { number, priceNumber, timestamp } from "@/lib/journal-format";
import type { riskTimeline } from "@/lib/bot-risk";
import type { executionChart } from "@/lib/execution-chart";

echarts.use([CandlestickChart, ScatterChart, DataZoomComponent, LegendComponent]);
type Events = ReturnType<typeof executionChart>["events"];
export function CandleCanvas({
  history,
  events,
  levels,
  timeZone,
}: {
  history: MarketHistory;
  events: Events;
  levels: ReturnType<typeof riskTimeline>;
  timeZone: string;
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
    legend: { top: 0, textStyle: { color: "#a1a1aa" } },
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
      { type: "inside", start: 0, end: 100 },
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
        step: "end",
        showSymbol: false,
        connectNulls: false,
        lineStyle: { color: "#34d399", type: "dashed", width: 2 },
        itemStyle: { color: "#34d399" },
      },
    ],
  };
  return (
    <div className="overflow-x-auto">
      <div
        className="min-w-[640px]"
        role="img"
        aria-label={`Graphique en bougies ${history.symbol}, achats et ventes, stop-loss et take-profit de référence. Les valeurs sont détaillées dans le tableau ci-dessous.`}
      >
        <EChart option={option} height={440} />
      </div>
    </div>
  );
}
