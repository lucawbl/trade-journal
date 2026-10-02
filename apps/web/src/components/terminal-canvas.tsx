"use client";
import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { CandlestickChart, ScatterChart } from "echarts/charts";
import { DataZoomComponent, MarkLineComponent, GraphicComponent } from "echarts/components";
import type { EChartsOption } from "echarts";
import { EChart } from "./charts/echart";
import { wma, mfi, aroon, type Drawing, type DrawingTool } from "@/lib/terminal-indicators";
import type { MarketHistory } from "@/lib/market-data";
import { RESOLUTIONS } from "@/lib/market-data";
import { number, priceNumber, timestamp } from "@/lib/journal-format";
import type { executionChart } from "@/lib/execution-chart";
import type { riskTimeline } from "@/lib/bot-risk";
echarts.use([
  CandlestickChart,
  ScatterChart,
  DataZoomComponent,
  MarkLineComponent,
  GraphicComponent,
]);
const marketPrice = (value: number) => (value >= 100 ? number(value, 2) : priceNumber(value));
export type TerminalChart = echarts.ECharts;
export function TerminalCanvas({
  history,
  price,
  period,
  indicators,
  log,
  line,
  drawings,
  tool,
  events,
  levels,
  timeZone,
  height,
  onReady,
  onDraw,
  onMeasure,
}: {
  history: MarketHistory;
  price: number;
  period: number;
  indicators: { wma: boolean; mfi: boolean; aroon: boolean; volume: boolean };
  log: boolean;
  line: boolean;
  drawings: Drawing[];
  tool: DrawingTool;
  events: ReturnType<typeof executionChart>["events"];
  levels: ReturnType<typeof riskTimeline>;
  timeZone: string;
  height: string;
  onReady: (chart: TerminalChart) => void;
  onDraw: (drawing: Drawing) => void;
  onMeasure: (text: string) => void;
}) {
  const instance = useRef<TerminalChart | null>(null);
  useEffect(() => {
    const chart = instance.current;
    if (chart && !chart.isDisposed())
      chart.setOption({
        dataZoom: [{ zoomOnMouseWheel: tool === "cursor", moveOnMouseMove: tool === "cursor" }],
      });
  }, [tool]);
  const bars = history.bars;
  const latest = useRef({ tool, bars, onDraw, onMeasure, onReady });
  latest.current = { tool, bars, onDraw, onMeasure, onReady };
  const first = useRef<[number, number] | null>(null);
  const previousTool = useRef(tool);
  if (previousTool.current !== tool) {
    first.current = null;
    previousTool.current = tool;
  }
  const ready = (chart: TerminalChart) => {
    instance.current = chart;
    latest.current.onReady(chart);
    chart.getZr().on("click", (event) => {
      const state = latest.current;
      if (
        state.tool === "cursor" ||
        !chart.containPixel({ gridIndex: 0 }, [event.offsetX, event.offsetY])
      )
        return;
      const value = chart.convertFromPixel({ gridIndex: 0 }, [
        event.offsetX,
        event.offsetY,
      ]) as number[];
      if (value.length < 2 || !Number.isFinite(value[0]) || !Number.isFinite(value[1])) return;
      const index = Math.max(0, Math.min(state.bars.length - 1, Math.round(value[0]!)));
      if (!state.bars[index] || !Number.isFinite(value[1])) return;
      const point: [number, number] = [state.bars[index]!.time, value[1]!];
      if (state.tool === "horizontal")
        state.onDraw({ id: crypto.randomUUID(), kind: "horizontal", points: [point] });
      else if (!first.current) {
        first.current = point;
        state.onMeasure("Premier point posé. Cliquez sur le second point.");
      } else {
        const start = first.current;
        first.current = null;
        state.onDraw({ id: crypto.randomUUID(), kind: state.tool, points: [start, point] });
        state.onMeasure(
          state.tool === "measure"
            ? `${((point[1] / start[1] - 1) * 100).toFixed(2)} % · ${Math.abs(Math.round((point[0] - start[0]) / RESOLUTIONS[history.resolution]))} bougies`
            : "Ligne de tendance ajoutée.",
        );
      }
    });
  };
  const times = bars.map((b) => timestamp(new Date(b.time).toISOString(), timeZone));
  const findIndex = (time: number) =>
    bars.findIndex(
      (b) =>
        b.time ===
        Math.floor(time / RESOLUTIONS[history.resolution]) * RESOLUTIONS[history.resolution],
    );
  const marks = (kind: "entry" | "exit") =>
    events
      .filter((e) => e.kind === kind)
      .flatMap((e) => {
        const i = findIndex(e.time);
        return i < 0
          ? []
          : [
              {
                value: [i, e.price],
                name: `${kind === "entry" ? "Achat / entrée" : "Vente / sortie"} · ${priceNumber(e.price)}`,
              },
            ];
      });
  const risk = (key: "stopLoss" | "takeProfit") =>
    bars.map((b) => {
      const active = levels.findLast((e) => e.time < b.time + RESOLUTIONS[history.resolution]);
      return active && (active.position > 1e-10 || active.time >= b.time) ? active[key] : null;
    });
  const drawingData: ([number, number] | null)[] = [];
  drawings.forEach((d) => {
    const start = d.points[0];
    const end = d.points[1];
    if (!start) return;
    const a = findIndex(start[0]);
    const b = end ? findIndex(end[0]) : -1;
    if (d.kind === "horizontal") drawingData.push([0, start[1]], [bars.length - 1, start[1]], null);
    else if (end && a >= 0 && b >= 0) drawingData.push([a, start[1]], [b, end![1]], null);
  });
  const ar = aroon(bars);
  const label = { color: "#858b99", fontSize: 11, hideOverlap: true };
  const axes = [0, 1, 2].map((gridIndex) => ({
    type: "category" as const,
    gridIndex,
    data: times,
    boundaryGap: true,
    axisLabel: {
      ...label,
      show: gridIndex === 2,
      formatter: (v: string) =>
        history.resolution === "1d" ? v.slice(0, 5) : (v.split(" · ")[1] ?? v),
    },
    axisLine: { lineStyle: { color: "#202329" } },
    axisTick: { show: false },
    splitLine: { show: true, lineStyle: { color: "#101318" } },
  }));
  const option: EChartsOption = {
    animation: false,
    backgroundColor: "#06080b",
    grid: [
      { left: 12, right: 90, top: "6%", height: "46%" },
      { left: 12, right: 90, top: "57%", height: "18%" },
      {
        left: 12,
        right: 90,
        top: "79%",
        bottom: 27,
        show: true,
        backgroundColor: "#0a1022",
        borderWidth: 0,
      },
    ],
    tooltip: {
      trigger: "axis",
      confine: true,
      backgroundColor: "#161b24",
      borderColor: "#343c4c",
      textStyle: { color: "#d1d5db", fontSize: 12 },
      axisPointer: { type: "cross", link: [{ xAxisIndex: "all" }] },
      valueFormatter: (v) => (typeof v === "number" ? marketPrice(v) : String(v)),
    },
    axisPointer: { link: [{ xAxisIndex: "all" }] },
    xAxis: axes,
    yAxis: [
      {
        type: log ? "log" : "value",
        scale: true,
        min: (bounds) => Math.max(bounds.min * 0.99, bounds.min - (bounds.max - bounds.min) * 0.07),
        max: (bounds) => bounds.max + (bounds.max - bounds.min) * 0.07,
        position: "right",
        axisLabel: { ...label, formatter: marketPrice },
        splitLine: { lineStyle: { color: "#14171d" } },
      },
      ...[1, 2].map((gridIndex) => ({
        type: "value" as const,
        gridIndex,
        min: 0,
        max: 100,
        interval: 50,
        position: "right" as const,
        axisLabel: label,
        splitLine: { lineStyle: { color: "#14171d" } },
      })),
      {
        type: "value",
        gridIndex: 0,
        show: false,
        min: 0,
        max: Math.max(...bars.map((b) => b.volume)) * 5,
      },
    ],
    dataZoom: [
      {
        type: "inside",
        xAxisIndex: [0, 1, 2],
        start: 60,
        end: 100,
        filterMode: "none",
        zoomOnMouseWheel: tool === "cursor",
        moveOnMouseMove: tool === "cursor",
        preventDefaultMouseMove: true,
      },
    ],
    graphic: [
      {
        type: "text",
        left: 14,
        top: 10,
        style: {
          text: `${history.symbol.replace("USDT", " / USDT")} · ${history.resolution} · BINANCE SPOT`,
          fill: "#cdd2dc",
          fontSize: 13,
        },
      },
      {
        type: "text",
        left: 14,
        top: "54%",
        style: {
          text: `MFI 14${indicators.mfi ? "" : " · masqué"}`,
          fill: "#858b99",
          fontSize: 12,
        },
      },
      {
        type: "text",
        left: 14,
        top: "76%",
        style: {
          text: `Aroon 14${indicators.aroon ? "" : " · masqué"}`,
          fill: "#858b99",
          fontSize: 12,
        },
      },
    ],
    series: [
      {
        id: "candles",
        name: "OHLC",
        type: "candlestick",
        data: line ? [] : bars.map((b) => [b.open, b.close, b.low, b.high]),
        itemStyle: {
          color: "#089981",
          color0: "#f23645",
          borderColor: "#089981",
          borderColor0: "#f23645",
        },
        markLine: {
          silent: true,
          symbol: "none",
          data: [{ yAxis: price }],
          lineStyle: { color: "#089981", type: "dotted", width: 1 },
          label: {
            formatter: marketPrice(price),
            color: "#fff",
            backgroundColor: "#089981",
            padding: [4, 5],
          },
        },
      },
      {
        id: "close",
        name: "Cours",
        type: "line",
        data: line ? bars.map((b) => b.close) : [],
        showSymbol: false,
        lineStyle: { color: "#2962ff", width: 2 },
      },
      {
        id: "wma",
        name: `WMA ${period}`,
        type: "line",
        data: indicators.wma ? wma(bars, period) : [],
        showSymbol: false,
        lineStyle: { color: "#2962ff", width: 2, shadowColor: "#2962ff", shadowBlur: 7 },
      },
      {
        id: "volume",
        name: "Volume",
        type: "bar",
        yAxisIndex: 3,
        data: indicators.volume
          ? bars.map((b) => ({
              value: b.volume,
              itemStyle: { color: b.close >= b.open ? "#08998144" : "#f2364544" },
            }))
          : [],
        silent: true,
      },
      {
        id: "mfi",
        name: "MFI 14",
        type: "line",
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: indicators.mfi ? mfi(bars) : [],
        showSymbol: false,
        lineStyle: { color: "#2962ff", width: 1.5 },
      },
      {
        id: "aroon-up",
        name: "Aroon haut",
        type: "line",
        xAxisIndex: 2,
        yAxisIndex: 2,
        data: indicators.aroon ? ar.up : [],
        showSymbol: false,
        lineStyle: { color: "#e4a132", width: 1.5 },
      },
      {
        id: "aroon-down",
        name: "Aroon bas",
        type: "line",
        xAxisIndex: 2,
        yAxisIndex: 2,
        data: indicators.aroon ? ar.down : [],
        showSymbol: false,
        lineStyle: { color: "#2962ff", width: 1.5 },
      },
      {
        id: "entries",
        name: "Achats / entrées",
        type: "scatter",
        data: marks("entry"),
        symbol: "triangle",
        symbolSize: 12,
        itemStyle: { color: "#00c8ff" },
        z: 8,
      },
      {
        id: "exits",
        name: "Ventes / sorties",
        type: "scatter",
        data: marks("exit"),
        symbol: "diamond",
        symbolSize: 12,
        itemStyle: { color: "#ffab40" },
        z: 8,
      },
      {
        id: "sl",
        name: "SL de référence",
        type: "line",
        data: risk("stopLoss"),
        step: "end",
        showSymbol: false,
        lineStyle: { color: "#f23645", type: "dashed" },
      },
      {
        id: "tp",
        name: "TP de référence",
        type: "line",
        data: risk("takeProfit"),
        step: "end",
        showSymbol: false,
        lineStyle: { color: "#089981", type: "dashed" },
      },
      {
        id: "current-price",
        name: "Cours actuel",
        type: "line",
        data: bars.map(() => price),
        silent: true,
        showSymbol: false,
        lineStyle: { color: "#089981", type: "dotted", width: 1 },
        endLabel: {
          show: true,
          formatter: marketPrice(price),
          color: "#fff",
          backgroundColor: "#089981",
          padding: [3, 5],
          distance: 0,
        },
      },
      {
        id: "drawings",
        name: "Tracés",
        type: "line",
        data: drawingData,
        connectNulls: false,
        showSymbol: true,
        symbolSize: 5,
        lineStyle: { color: "#b29cff", width: 2 },
        itemStyle: { color: "#b29cff" },
        z: 9,
      },
    ],
  };
  return (
    <div
      role="img"
      aria-label={`Bougies ${history.symbol}, WMA, MFI et Aroon, achats, ventes et niveaux SL/TP`}
      style={{ cursor: tool === "cursor" ? "crosshair" : "copy" }}
    >
      <EChart option={option} height={height} preserveZoom onReady={ready} />
    </div>
  );
}
