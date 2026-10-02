"use client";
import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { CandlestickChart, ScatterChart } from "echarts/charts";
import { DataZoomComponent, MarkLineComponent, GraphicComponent } from "echarts/components";
import type { EChartsOption } from "echarts";
import { EChart } from "./charts/echart";
import {
  wma,
  mfi,
  aroon,
  rsi,
  ema,
  sma,
  macd,
  bollinger,
  indicatorLayout,
  type IndicatorSelection,
  type Drawing,
  type DrawingTool,
} from "@/lib/terminal-indicators";
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
  indicators: IndicatorSelection;
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
  const hoverAxis = useRef(0);
  const layout = indicatorLayout(indicators);
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
    const hover = (event: MouseEvent) => {
      const rect = chart.getDom().getBoundingClientRect();
      hoverAxis.current =
        [0, 1, 2, 3, 4].find((gridIndex) =>
          chart.containPixel({ gridIndex }, [event.clientX - rect.left, event.clientY - rect.top]),
        ) ?? 0;
    };
    chart.getDom().addEventListener("mousemove", hover, true);
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
    return () => chart.getDom().removeEventListener("mousemove", hover, true);
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
  const ar = aroon(bars),
    mf = mfi(bars),
    rs = rsi(bars),
    mc = macd(bars),
    bb = bollinger(bars);
  const paneNames = ["Cours", "MFI 14", "Aroon 14", "RSI 14", "MACD 12 / 26 / 9"];
  const tooltipHtml = (index: number) => {
    const bar = bars[index];
    if (!bar) return "";
    const cell = (name: string, value: string) =>
      `<div><span style="color:#8f9bad;font-size:11px">${name}</span><strong style="display:block;font-size:12px;font-weight:500">${value}</strong></div>`;
    const format = (value: number | null | undefined) => (value == null ? "—" : number(value, 2));
    let content = "";
    if (hoverAxis.current === 1) content = cell("Flux monétaire", format(mf[index]));
    else if (hoverAxis.current === 2)
      content = cell("Haut", format(ar.up[index])) + cell("Bas", format(ar.down[index]));
    else if (hoverAxis.current === 3) content = cell("Force relative", format(rs[index]));
    else if (hoverAxis.current === 4)
      content =
        cell("MACD", priceNumber(mc.value[index])) +
        cell("Signal", priceNumber(mc.signal[index])) +
        cell("Histogramme", priceNumber(mc.histogram[index]));
    else
      content =
        cell("Ouverture", marketPrice(bar.open)) +
        cell("Clôture", marketPrice(bar.close)) +
        cell("Plus haut", marketPrice(bar.high)) +
        cell("Plus bas", marketPrice(bar.low));
    const fills = events.filter(
      (e) =>
        Math.floor(e.time / RESOLUTIONS[history.resolution]) * RESOLUTIONS[history.resolution] ===
        bar.time,
    );
    const count = (kind: "entry" | "exit") => fills.filter((e) => e.kind === kind).length;
    const tradeRow =
      hoverAxis.current === 0 && fills.length
        ? `<div style="margin-top:8px;padding-top:6px;border-top:1px solid #343c4c;color:#a6b4c8;font-size:11px">${count("entry")} entrée(s) · ${count("exit")} sortie(s)</div>`
        : "";
    return `<div style="width:210px;max-width:100%;font-variant-numeric:tabular-nums"><div style="font-weight:600;margin-bottom:2px">${paneNames[hoverAxis.current] ?? "Cours"}</div><div style="color:#8f9bad;font-size:11px;margin-bottom:8px">${times[index]}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 12px">${content}</div>${tradeRow}</div>`;
  };
  const label = { color: "#858b99", fontSize: 11, hideOverlap: true };
  const axes = [0, 1, 2, 3, 4].map((gridIndex) => ({
    type: "category" as const,
    gridIndex,
    show: gridIndex === 0 || layout.panes[gridIndex - 1]?.enabled,
    axisPointer: {
      show: gridIndex === 0 || !!layout.panes[gridIndex - 1]?.enabled,
      label: { show: false },
    },
    data: times,
    boundaryGap: true,
    axisLabel: {
      ...label,
      show: gridIndex === layout.lastAxis,
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
      { left: 12, right: 90, top: "6%", height: `${layout.mainHeight}%` },
      ...layout.panes.map((pane) => ({
        left: 12,
        right: 90,
        top: `${pane.top}%`,
        height: `${pane.height}%`,
        show: pane.enabled,
        backgroundColor: pane.key === "aroon" ? "#0a1022" : "#06080b",
        borderWidth: 0,
      })),
    ],
    tooltip: {
      show: tool === "cursor",
      trigger: "axis",
      triggerOn: "mousemove|click|mousewheel",
      confine: true,
      backgroundColor: "#161b24",
      borderColor: "#343c4c",
      textStyle: { color: "#d1d5db", fontSize: 12 },
      axisPointer: { type: "line", axis: "x", label: { show: false } },
      extraCssText:
        "max-width:235px;white-space:normal;pointer-events:none;box-shadow:0 4px 20px #0008;",
      formatter: (params) => {
        const list = Array.isArray(params) ? params : [params];
        const index = list.find((p) => typeof p.dataIndex === "number")?.dataIndex;
        return typeof index === "number" ? tooltipHtml(index) : "";
      },
      position: (point, _params, _dom, _rect, size) => [
        point[0] > size.viewSize[0] / 2
          ? 8
          : Math.max(8, size.viewSize[0] - size.contentSize[0] - 8),
        8,
      ],
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
      ...[1, 2, 3, 4].map((gridIndex) => ({
        type: "value" as const,
        gridIndex,
        show: !!layout.panes[gridIndex - 1]?.enabled,
        axisPointer: { label: { show: false } },
        min: gridIndex === 4 ? undefined : 0,
        max: gridIndex === 4 ? undefined : 100,
        interval: gridIndex === 4 ? undefined : 50,
        position: "right" as const,
        axisLabel: gridIndex === 4 ? { ...label, formatter: marketPrice } : label,
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
        xAxisIndex: [0, 1, 2, 3, 4],
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
        id: "symbol-title",
        type: "text",
        left: 14,
        top: 10,
        style: {
          text: `${history.symbol.replace("USDT", " / USDT")} · ${history.resolution} · BINANCE SPOT`,
          fill: "#cdd2dc",
          fontSize: 13,
        },
      },
      ...layout.panes.map((pane) => ({
        id: `title-${pane.key}`,
        type: "text" as const,
        left: 14,
        top: `${pane.enabled ? pane.top - 2.5 : 0}%`,
        invisible: !pane.enabled,
        style: { text: paneNames[pane.axis], fill: "#858b99", fontSize: 12 },
      })),
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
        yAxisIndex: 5,
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
        data: indicators.mfi ? mf : [],
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
        id: "ema",
        name: "EMA 20",
        type: "line",
        data: indicators.ema ? ema(bars) : [],
        showSymbol: false,
        lineStyle: { color: "#f59e0b", width: 2 },
      },
      {
        id: "sma",
        name: "SMA 20",
        type: "line",
        data: indicators.sma ? sma(bars) : [],
        showSymbol: false,
        lineStyle: { color: "#c084fc", width: 1.5 },
      },
      ...(["upper", "middle", "lower"] as const).map((key) => ({
        id: `bollinger-${key}`,
        name: `Bollinger ${key}`,
        type: "line" as const,
        data: indicators.bollinger ? bb[key] : [],
        showSymbol: false,
        lineStyle: {
          color: "#22d3ee",
          width: 1,
          type: key === "middle" ? ("dashed" as const) : ("solid" as const),
        },
      })),
      {
        id: "rsi",
        name: "RSI 14",
        type: "line",
        xAxisIndex: 3,
        yAxisIndex: 3,
        data: indicators.rsi ? rs : [],
        showSymbol: false,
        lineStyle: { color: "#a78bfa", width: 1.5 },
        markLine: {
          silent: true,
          symbol: "none",
          label: { show: false },
          lineStyle: { color: "#66547e", type: "dashed" },
          data: indicators.rsi ? [{ yAxis: 30 }, { yAxis: 70 }] : [],
        },
      },
      {
        id: "macd",
        name: "MACD",
        type: "line",
        xAxisIndex: 4,
        yAxisIndex: 4,
        data: indicators.macd ? mc.value : [],
        showSymbol: false,
        lineStyle: { color: "#60a5fa", width: 1.5 },
      },
      {
        id: "macd-signal",
        name: "Signal MACD",
        type: "line",
        xAxisIndex: 4,
        yAxisIndex: 4,
        data: indicators.macd ? mc.signal : [],
        showSymbol: false,
        lineStyle: { color: "#fb923c", width: 1.5 },
      },
      {
        id: "macd-histogram",
        name: "Histogramme MACD",
        type: "bar",
        xAxisIndex: 4,
        yAxisIndex: 4,
        data: indicators.macd
          ? mc.histogram.map((v) => ({
              value: v,
              itemStyle: { color: v != null && v >= 0 ? "#08998188" : "#f2364588" },
            }))
          : [],
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
  // Reference lines and moving averages must not sprout highlights in every linked pane.
  if (Array.isArray(option.series))
    option.series = option.series.map((series) =>
      series.type === "line" && series.id !== "drawings"
        ? { ...series, emphasis: { disabled: true } }
        : series,
    );
  return (
    <div
      role="img"
      aria-label={`Graphique ${history.symbol}, achats, ventes et indicateurs sélectionnés`}
      style={{ cursor: tool === "cursor" ? "crosshair" : "copy" }}
    >
      <EChart
        option={option}
        height={layout.active.length >= 3 ? "clamp(740px, calc(100dvh - 190px), 1500px)" : height}
        preserveZoom
        onReady={ready}
      />
    </div>
  );
}
