"use client";
import { useEffect, useRef, useState } from "react";
import * as echarts from "echarts/core";
import { CandlestickChart, ScatterChart } from "echarts/charts";
import {
  MarkAreaComponent,
  DataZoomComponent,
  MarkLineComponent,
  GraphicComponent,
} from "echarts/components";
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
import { chartMarkers } from "@/lib/chart-markers";
import { riskZones } from "@/lib/risk-zones";
import {
  candleBounds,
  scaledCandleBounds,
  tradeWindow,
  zoomIndices,
} from "@/lib/terminal-viewport";
import { drawingPath } from "@/lib/terminal-tools";
import type { riskTimeline } from "@/lib/bot-risk";
echarts.use([
  MarkAreaComponent,
  CandlestickChart,
  ScatterChart,
  DataZoomComponent,
  MarkLineComponent,
  GraphicComponent,
]);
const marketPrice = (value: number) => (value >= 100 ? number(value, 2) : priceNumber(value));
const DEFAULT_VISIBLE_CANDLES = 96;
type ZoomWindow = {
  startIndex: number;
  endIndex: number;
  visible: number;
  followLatest: boolean;
};
const indexPercent = (index: number, total: number) =>
  total <= 1 ? 0 : (Math.max(0, Math.min(total - 1, index)) / (total - 1)) * 100;
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
  alerts = [],
  timeZone,
  height,
  fullPeriod = false,
  focus,
  executionId,
  scaleReset = 0,
  replayMode = false,
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
  alerts?: { id: string; price: number }[];
  timeZone: string;
  height: string;
  fullPeriod?: boolean;
  focus?: { key: string; from: number; to: number };
  executionId?: string;
  scaleReset?: number;
  replayMode?: boolean;
  onReady: (chart: TerminalChart) => void;
  onDraw: (drawing: Drawing) => void;
  onMeasure: (text: string) => void;
}) {
  const instance = useRef<TerminalChart | null>(null);
  const bars = history.bars;
  const zoomWindow = useRef<ZoomWindow | null>(null);
  const previousBarCount = useRef(bars.length);
  const initialWindow = focus
    ? tradeWindow(bars, focus.from, focus.to)
    : {
        start: fullPeriod ? 0 : Math.max(0, bars.length - DEFAULT_VISIBLE_CANDLES),
        end: bars.length - 1,
      };
  const [viewport, setViewport] = useState(initialWindow);
  const [priceScale, setPriceScale] = useState(1);
  const axisDrag = useRef<{ y: number; scale: number } | null>(null);
  useEffect(() => {
    setPriceScale(1);
  }, [scaleReset]);
  const zoomStorageKey = `market-chart-zoom-v2:${history.symbol}:${history.resolution}:${replayMode ? "replay" : (focus?.key ?? "live")}`;
  const hoverAxis = useRef(0);
  const dragging = useRef(false);
  const comparing = useRef(false);
  const [selection, setSelection] = useState<[number, number][]>([]);
  const comparison =
    selection.length === 2
      ? {
          from: selection[0]![1],
          to: selection[1]![1],
          change: (selection[1]![1] / selection[0]![1] - 1) * 100,
          candles: Math.abs(
            Math.round((selection[1]![0] - selection[0]![0]) / RESOLUTIONS[history.resolution]),
          ),
        }
      : null;
  const layout = indicatorLayout(indicators);
  const latest = useRef({ tool, bars, onDraw, onMeasure, onReady });
  latest.current = { tool, bars, onDraw, onMeasure, onReady };
  const first = useRef<[number, number] | null>(null);
  useEffect(() => {
    first.current = null;
    comparing.current = false;
    setSelection([]);
    const chart = instance.current;
    if (!chart || chart.isDisposed()) return;
    chart.dispatchAction({ type: "hideTip" });
    chart.dispatchAction({ type: "updateAxisPointer", currTrigger: "leave" });
    chart.setOption({
      dataZoom: [
        {
          disabled: false,
          zoomOnMouseWheel: false,
          moveOnMouseMove: tool === "cursor",
        },
      ],
      series: [{ id: "cursor-points", data: [], markLine: { data: [] } }],
    });
  }, [tool]);
  const ready = (chart: TerminalChart) => {
    instance.current = chart;
    latest.current.onReady(chart);

    const applyZoom = (startIndex: number, endIndex: number) => {
      const total = latest.current.bars.length;
      if (!total) return;
      const start = Math.max(0, Math.min(total - 1, startIndex));
      const end = Math.max(start, Math.min(total - 1, endIndex));
      chart.dispatchAction({
        type: "dataZoom",
        startValue: start,
        endValue: end,
      });
    };
    const saveZoom = () => {
      const total = latest.current.bars.length;
      const option = chart.getOption().dataZoom as
        { start?: number; end?: number; startValue?: number; endValue?: number }[] | undefined;
      const zoom = option?.[0];
      if (!total || !zoom) return;
      const startPct = Number(zoom.start ?? 0);
      const endPct = Number(zoom.end ?? 100);
      const rawStart = Number(zoom.startValue);
      const rawEnd = Number(zoom.endValue);
      const startIndex = Number.isFinite(rawStart)
        ? Math.max(0, Math.min(total - 1, Math.round(rawStart)))
        : Math.max(0, Math.min(total - 1, Math.round((startPct / 100) * Math.max(0, total - 1))));
      const endIndex = Number.isFinite(rawEnd)
        ? Math.max(startIndex, Math.min(total - 1, Math.round(rawEnd)))
        : Math.max(
            startIndex,
            Math.min(total - 1, Math.round((endPct / 100) * Math.max(0, total - 1))),
          );
      const state: ZoomWindow = {
        startIndex,
        endIndex,
        visible: Math.max(1, endIndex - startIndex + 1),
        followLatest: replayMode || endIndex >= total - 2,
      };
      zoomWindow.current = state;
      setViewport((old) =>
        old.start === startIndex && old.end === endIndex
          ? old
          : { start: startIndex, end: endIndex },
      );
      const currentBars = latest.current.bars;
      try {
        localStorage.setItem(
          zoomStorageKey,
          JSON.stringify({
            visible: state.visible,
            followLatest: state.followLatest,
            startTime: currentBars[startIndex]?.time ?? null,
            endTime: currentBars[endIndex]?.time ?? null,
          }),
        );
      } catch {}
    };
    const restoreZoom = () => {
      const currentBars = latest.current.bars;
      const total = currentBars.length;
      if (!total) return;
      if (focus) {
        const selected = tradeWindow(currentBars, focus.from, focus.to);
        applyZoom(selected.start, selected.end);
        return;
      }
      if (fullPeriod) {
        zoomWindow.current = {
          startIndex: 0,
          endIndex: total - 1,
          visible: total,
          followLatest: true,
        };
        applyZoom(0, total - 1);
        return;
      }
      let visible = Math.min(DEFAULT_VISIBLE_CANDLES, total);
      let startIndex = Math.max(0, total - visible);
      let endIndex = total - 1;
      let followLatest = true;
      try {
        const saved = JSON.parse(localStorage.getItem(zoomStorageKey) ?? "null") as {
          visible?: number;
          followLatest?: boolean;
          startTime?: number | null;
          endTime?: number | null;
        } | null;
        if (saved && Number.isFinite(saved.visible) && Number(saved.visible) > 1) {
          visible = Math.max(2, Math.min(total, Math.round(Number(saved.visible))));
          if (!replayMode && saved.followLatest === false) {
            const savedStart = currentBars.findIndex((bar) => bar.time === saved.startTime);
            const savedEnd = currentBars.findIndex((bar) => bar.time === saved.endTime);
            if (savedStart >= 0 && savedEnd >= savedStart) {
              startIndex = savedStart;
              endIndex = savedEnd;
              visible = endIndex - startIndex + 1;
              followLatest = false;
            } else {
              startIndex = Math.max(0, total - visible);
              endIndex = total - 1;
            }
          } else {
            startIndex = Math.max(0, total - visible);
            endIndex = total - 1;
          }
        }
      } catch {}
      zoomWindow.current = { startIndex, endIndex, visible, followLatest };
      applyZoom(startIndex, endIndex);
    };
    const wheelZoom = (event: WheelEvent) => {
      if (latest.current.tool !== "cursor") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const rect = chart.getDom().getBoundingClientRect();
      const index = (
        chart.convertFromPixel({ gridIndex: 0 }, [
          event.clientX - rect.left,
          event.clientY - rect.top,
        ]) as number[]
      )[0];
      const state = zoomWindow.current;
      if (!state || !Number.isFinite(index)) return;
      const anchor = Math.max(
        0,
        Math.min(1, (index! - state.startIndex) / Math.max(1, state.endIndex - state.startIndex)),
      );
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1);
      const next = zoomIndices(
        state.startIndex,
        state.endIndex,
        latest.current.bars.length,
        Math.exp(Math.max(-80, Math.min(80, delta)) * 0.003),
        anchor,
      );
      applyZoom(next.start, next.end);
    };
    chart.getDom().addEventListener("wheel", wheelZoom, { capture: true, passive: false });
    chart.on("dataZoom", saveZoom);
    requestAnimationFrame(restoreZoom);

    const sample = (x: number, y: number, inside = true) => {
      if (inside && !chart.containPixel({ gridIndex: 0 }, [x, y])) return null;
      const values = chart.convertFromPixel({ gridIndex: 0 }, [x, y]) as number[];
      if (!Number.isFinite(values[0])) return null;
      const index = Math.max(0, Math.min(latest.current.bars.length - 1, Math.round(values[0]!)));
      const bar = latest.current.bars[index];
      return bar ? { index, bar, y: values[1]! } : null;
    };
    const clearGuides = () => {
      chart.dispatchAction({ type: "hideTip" });
      chart.dispatchAction({ type: "updateAxisPointer", currTrigger: "leave" });
      chart.setOption({ series: [{ id: "cursor-points", data: [], markLine: { data: [] } }] });
    };
    const measure = (points: [number, number][]) => {
      setSelection(points);
      chart.dispatchAction({ type: "hideTip" });
      chart.dispatchAction({ type: "updateAxisPointer", currTrigger: "leave" });
      const data = points
        .map((p) => [latest.current.bars.findIndex((b) => b.time === p[0]), p[1]])
        .filter((p) => p[0]! >= 0);
      chart.setOption({
        series: [
          {
            id: "cursor-points",
            data,
            markLine: {
              silent: true,
              symbol: "none",
              label: { show: false },
              lineStyle: { color: "#8fa8ca", type: "dashed" },
              data: data.map((p) => ({ xAxis: p[0] })),
            },
          },
        ],
      });
    };
    const follow = (x: number, y: number) => {
      if (latest.current.tool !== "cursor" || comparing.current || dragging.current) return;
      const point = sample(x, y);
      if (!point) return;
      const pixel = chart.convertToPixel({ gridIndex: 0 }, [
        point.index,
        point.bar.close,
      ]) as number[];
      chart.setOption({
        series: [
          { id: "cursor-points", data: [[point.index, point.bar.close]], markLine: { data: [] } },
        ],
      });
      chart.dispatchAction({ type: "showTip", x: pixel[0], y: pixel[1] });
    };
    const hover = (event: MouseEvent) => {
      if (comparing.current) return;
      const rect = chart.getDom().getBoundingClientRect();
      const x = event.clientX - rect.left,
        y = event.clientY - rect.top;
      if (latest.current.tool === "measure" && first.current) {
        const point = sample(x, y);
        if (point) measure([first.current, [point.bar.time, point.bar.close]]);
        return;
      }
      if (latest.current.tool !== "cursor") return;
      hoverAxis.current =
        [0, 1, 2, 3, 4].find((gridIndex) => chart.containPixel({ gridIndex }, [x, y])) ?? 0;
      if (hoverAxis.current === 0) follow(x, y);
      else if (!dragging.current) chart.dispatchAction({ type: "showTip", x, y });
    };
    const down = () => {
      dragging.current = true;
      chart.dispatchAction({ type: "hideTip" });
    };
    const up = () => {
      dragging.current = false;
    };
    let pinch: { distance: number; start: number; end: number; anchor: number } | null = null;
    const touches = (event: TouchEvent) => {
      const tool = latest.current.tool;
      const rect = chart.getDom().getBoundingClientRect();
      if (tool === "cursor") {
        if (event.touches.length === 1) {
          const touch = event.touches[0]!;
          event.preventDefault();
          event.stopImmediatePropagation();
          dragging.current = false;
          chart.setOption({ dataZoom: [{ disabled: true }] });
          follow(touch.clientX - rect.left, touch.clientY - rect.top);
        } else if (event.touches.length >= 2) {
          event.preventDefault();
          event.stopImmediatePropagation();
          clearGuides();
          const a = event.touches[0]!,
            b = event.touches[1]!;
          const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
          const state = zoomWindow.current;
          if (!state || distance < 1) return;
          if (!pinch || event.type === "touchstart") {
            const point = sample(
              (a.clientX + b.clientX) / 2 - rect.left,
              (a.clientY + b.clientY) / 2 - rect.top,
              false,
            );
            pinch = {
              distance,
              start: state.startIndex,
              end: state.endIndex,
              anchor: point
                ? Math.max(
                    0,
                    Math.min(
                      1,
                      (point.index - state.startIndex) /
                        Math.max(1, state.endIndex - state.startIndex),
                    ),
                  )
                : 0.5,
            };
          } else {
            const next = zoomIndices(
              pinch.start,
              pinch.end,
              latest.current.bars.length,
              pinch.distance / distance,
              pinch.anchor,
            );
            applyZoom(next.start, next.end);
          }
          chart.setOption({ dataZoom: [{ disabled: true }] });
        }
        return;
      }
      if (tool !== "measure" || event.touches.length !== 2) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      comparing.current = true;
      dragging.current = false;
      first.current = null;
      const points = Array.from(event.touches)
        .map((t) => sample(t.clientX - rect.left, t.clientY - rect.top, false))
        .filter((p) => p != null)
        .sort((a, b) => a.index - b.index);
      if (points.length !== 2) return;
      chart.setOption({ dataZoom: [{ disabled: true }] });
      measure(points.map((p) => [p.bar.time, p.bar.close]));
    };
    const endTouches = (event: TouchEvent) => {
      if (event.touches.length === 2) return;
      pinch = null;
      if (comparing.current) {
        setSelection([]);
        first.current = null;
      }
      comparing.current = false;
      clearGuides();
      chart.setOption({ dataZoom: [{ disabled: false }] });
    };
    const click = (event: { offsetX: number; offsetY: number }) => {
      const state = latest.current;
      if (state.tool === "cursor") {
        follow(event.offsetX, event.offsetY);
        return;
      }
      if (comparing.current) return;
      const point = sample(event.offsetX, event.offsetY);
      if (!point || !Number.isFinite(point.y)) return;
      if (state.tool === "measure") {
        const value: [number, number] = [point.bar.time, point.bar.close];
        if (!first.current) {
          first.current = value;
          measure([value]);
        } else {
          measure([first.current, value]);
          first.current = null;
        }
        state.onMeasure("");
        return;
      }
      if (point.y <= 0) return;
      const value: [number, number] = [point.bar.time, point.y];
      if (state.tool === "horizontal" || state.tool === "vertical")
        state.onDraw({ id: crypto.randomUUID(), kind: state.tool, points: [value] });
      else if (!first.current) {
        first.current = value;
        state.onMeasure("Choisis le second point.");
      } else {
        state.onDraw({ id: crypto.randomUUID(), kind: state.tool, points: [first.current, value] });
        first.current = null;
        state.onMeasure("");
      }
    };
    const dom = chart.getDom();
    dom.addEventListener("touchstart", touches, { capture: true, passive: false });
    dom.addEventListener("touchmove", touches, { capture: true, passive: false });
    dom.addEventListener("touchend", endTouches, true);
    dom.addEventListener("touchcancel", endTouches, true);
    dom.addEventListener("pointerdown", down, true);
    dom.addEventListener("mousemove", hover, true);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
    chart.getZr().on("click", click);
    return () => {
      dom.removeEventListener("touchstart", touches, true);
      dom.removeEventListener("touchmove", touches, true);
      dom.removeEventListener("touchend", endTouches, true);
      dom.removeEventListener("touchcancel", endTouches, true);
      dom.removeEventListener("mousemove", hover, true);
      dom.removeEventListener("pointerdown", down, true);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
      chart.getZr().off("click", click);
      chart.off("dataZoom", saveZoom);
      chart.getDom().removeEventListener("wheel", wheelZoom, true);
    };
  };

  useEffect(() => {
    const chart = instance.current;
    const previous = previousBarCount.current;
    previousBarCount.current = bars.length;
    const state = zoomWindow.current;
    if (!chart || chart.isDisposed() || !state || bars.length === previous || !bars.length) return;
    const frame = requestAnimationFrame(() => {
      if (chart.isDisposed()) return;
      let startIndex = state.startIndex;
      let endIndex = state.endIndex;
      if (fullPeriod && state.visible === previous) {
        startIndex = 0;
        endIndex = bars.length - 1;
      } else if (state.followLatest) {
        endIndex = bars.length - 1;
        startIndex = Math.max(0, endIndex - state.visible + 1);
      } else {
        startIndex = Math.max(0, Math.min(bars.length - 1, startIndex));
        endIndex = Math.max(startIndex, Math.min(bars.length - 1, endIndex));
      }
      zoomWindow.current = {
        startIndex,
        endIndex,
        visible: Math.max(1, endIndex - startIndex + 1),
        followLatest: state.followLatest,
      };
      chart.dispatchAction({
        type: "dataZoom",
        startValue: startIndex,
        endValue: endIndex,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [bars.length, fullPeriod]);

  const baseBounds = candleBounds(bars, viewport.start, viewport.end);
  const priceBounds = scaledCandleBounds(baseBounds, priceScale);
  const scaleAxis = (scale: number) => {
    const value = Math.min(8, Math.max(0.25, scale));
    setPriceScale(value);
    const bounds = scaledCandleBounds(baseBounds, value);
    // Update immediately while EChart defers React redraws during pointer dragging.
    instance.current?.setOption({ yAxis: [{ min: bounds?.min, max: bounds?.max }] });
  };
  const displayEvents = executionId ? events.filter((event) => event.id === executionId) : events;
  const times = bars.map((b) => timestamp(new Date(b.time).toISOString(), timeZone));
  const findIndex = (time: number) =>
    bars.findIndex(
      (b) =>
        b.time ===
        Math.floor(time / RESOLUTIONS[history.resolution]) * RESOLUTIONS[history.resolution],
    );
  const marks = (kind: "entry" | "exit") =>
    chartMarkers(bars, RESOLUTIONS[history.resolution], displayEvents, kind);
  const markerSize = displayEvents.length > 40 ? 4 : 6;
  const chartPrice = (value: number) =>
    marketPrice(value).replace(/([,.]\d*?[1-9])0+$|[,.]0+$/, "$1");
  const risk = (key: "stopLoss" | "takeProfit") =>
    bars.map((b) => {
      const active = levels.findLast((e) => e.time < b.time + RESOLUTIONS[history.resolution]);
      return active && (active.position > 1e-10 || active.time >= b.time) ? active[key] : null;
    });
  const drawingData: ([number, number] | null)[] = drawings.flatMap((d) => [
    ...drawingPath(d, bars, history.resolution),
    null,
  ]);
  const selectionData = selection.map((p) => [findIndex(p[0]), p[1]]).filter((p) => p[0]! >= 0);
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
        cell("Cours", chartPrice(bar.close)) +
        cell("Variation de la bougie", `${number((bar.close / bar.open - 1) * 100, 2)} %`);
    const fills = displayEvents.filter(
      (e) =>
        Math.floor(e.time / RESOLUTIONS[history.resolution]) * RESOLUTIONS[history.resolution] ===
        bar.time,
    );
    const count = (kind: "entry" | "exit") => fills.filter((e) => e.kind === kind).length;
    const tradeRow =
      hoverAxis.current === 0 && fills.length
        ? `<div style="margin-top:8px;padding-top:6px;border-top:1px solid #343c4c;color:#a6b4c8;font-size:11px">${count("entry")} entrée(s) · ${count("exit")} sortie(s)</div>`
        : "";
    return `<div style="width:185px;max-width:100%;font-variant-numeric:tabular-nums"><div style="font-weight:600;margin-bottom:2px">${paneNames[hoverAxis.current] ?? "Cours"}</div><div style="color:#8f9bad;font-size:11px;margin-bottom:8px">${times[index]}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 12px">${content}</div>${tradeRow}</div>`;
  };
  const label = { color: "#858b99", fontSize: 11, hideOverlap: true };
  const axes = [0, 1, 2, 3, 4].map((gridIndex) => ({
    type: "category" as const,
    gridIndex,
    show: gridIndex === 0 || layout.panes[gridIndex - 1]?.enabled,
    axisPointer: {
      show: gridIndex === 0 || !!layout.panes[gridIndex - 1]?.enabled,
      label: {
        show: tool === "cursor" && gridIndex === layout.lastAxis,
        backgroundColor: "#293241",
        fontSize: 10,
      },
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
      triggerOn: "none",
      confine: true,
      backgroundColor: "#161b24",
      borderColor: "#343c4c",
      textStyle: { color: "#d1d5db", fontSize: 12 },
      axisPointer: {
        type: "cross",
        snap: false,
        lineStyle: { color: "#8793a8", width: 1, type: "dashed" },
        crossStyle: { color: "#8793a8", width: 1, type: "dashed" },
        label: {
          show: true,
          backgroundColor: "#293241",
          color: "#e6edf7",
          fontSize: 10,
          padding: [3, 5],
        },
      },
      extraCssText:
        "max-width:235px;white-space:normal;pointer-events:none;box-shadow:0 4px 20px #0008;",
      formatter: (params) => {
        if (dragging.current) return "";
        const list = Array.isArray(params) ? params : [params];
        const index = list.find(
          (p) => p.seriesId !== "cursor-points" && typeof p.dataIndex === "number",
        )?.dataIndex;
        return typeof index === "number" ? tooltipHtml(index) : "";
      },
      position: (_point, _params, _dom, _rect, size) => [
        Math.max(8, size.viewSize[0] - size.contentSize[0] - 98),
        8,
      ],
    },
    axisPointer: { triggerOn: "none", link: [{ xAxisIndex: "all" }] },
    xAxis: axes,
    yAxis: [
      {
        type: log ? "log" : "value",
        scale: true,
        min: priceBounds?.min,
        max: priceBounds?.max,
        position: "right",
        splitNumber: 4,
        axisLabel: { ...label, formatter: chartPrice },
        axisPointer: {
          snap: false,
          label: {
            show: tool === "cursor",
            formatter: (params: { value: unknown }) => chartPrice(Number(params.value)),
          },
        },
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
        axisPointer: { show: false, label: { show: false } },
      },
    ],
    dataZoom: [
      {
        type: "inside",
        xAxisIndex: [0, 1, 2, 3, 4],
        rangeMode: ["value", "value"],
        startValue: fullPeriod
          ? 0
          : Math.max(0, bars.length - Math.min(DEFAULT_VISIBLE_CANDLES, bars.length)),
        endValue: Math.max(0, bars.length - 1),
        filterMode: "filter",
        zoomOnMouseWheel: false,
        moveOnMouseMove: tool === "cursor",
        moveOnMouseWheel: false,
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
        id: "cursor-points",
        name: "Sélection du cours",
        type: "scatter",
        data: tool === "measure" ? selectionData : [],
        markLine: {
          silent: true,
          symbol: "none",
          label: { show: false },
          lineStyle: { color: "#8fa8ca", type: "dashed" },
          data: tool === "measure" ? selectionData.map((p) => ({ xAxis: p[0] })) : [],
        },
        symbolSize: 8,
        silent: true,
        itemStyle: { color: "#fff", borderColor: "#1197e2", borderWidth: 2 },
        z: 20,
      },
      {
        id: "price-alerts",
        type: "line",
        data: [],
        silent: true,
        markLine: {
          silent: true,
          symbol: "none",
          lineStyle: { color: "#e4b55b", width: 1, type: "dashed" },
          label: {
            show: true,
            position: "insideEndTop",
            formatter: "Alerte",
            color: "#e4b55b",
            fontSize: 10,
          },
          data: alerts.map((a) => ({ yAxis: a.price })),
        },
      },
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
        lineStyle: { color: "#2962ff", width: 1.5 },
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
        symbolOffset: [0, 6],
        symbolSize: markerSize,
        itemStyle: { color: "#38bdf8", opacity: 0.7 },
        z: 8,
      },
      {
        id: "exits",
        name: "Ventes / sorties",
        type: "scatter",
        data: marks("exit"),
        symbol: "diamond",
        symbolOffset: [0, -6],
        symbolSize: markerSize,
        itemStyle: { color: "#fbbf24", opacity: 0.7 },
        z: 8,
      },
      {
        id: "sl",
        name: "SL de référence",
        type: "line",
        data: [],
        markArea: {
          silent: true,
          label: {
            show: levels.filter((event) => event.kind === "entry").length <= 5,
            position: "insideTopRight",
            color: "#f23645",
            fontSize: 11,
            formatter: (params: unknown) => {
              const value = (params as { data?: { name?: string } }).data;
              return value?.name ?? "SL";
            },
          },
          itemStyle: { color: "#f2364512", borderColor: "#f2364535", borderWidth: 1 },
          data: riskZones(
            bars,
            RESOLUTIONS[history.resolution],
            levels,
            "stopLoss",
            executionId,
          ).map(([start, end]) => [
            { ...start, name: "SL visuel · " + priceNumber(end.yAxis) },
            end,
          ]),
        },
        step: "end",
        showSymbol: false,
        lineStyle: { color: "#f23645", type: "dashed" },
      },
      {
        id: "tp",
        name: "TP de référence",
        type: "line",
        data: [],
        markArea: {
          silent: true,
          label: {
            show: levels.filter((event) => event.kind === "entry").length <= 5,
            position: "insideTopRight",
            color: "#089981",
            fontSize: 11,
            formatter: (params: unknown) => {
              const value = (params as { data?: { name?: string } }).data;
              return value?.name ?? "TP";
            },
          },
          itemStyle: { color: "#08998112", borderColor: "#08998135", borderWidth: 1 },
          data: riskZones(
            bars,
            RESOLUTIONS[history.resolution],
            levels,
            "takeProfit",
            executionId,
          ).map(([start, end]) => [
            { ...start, name: "TP visuel · " + priceNumber(end.yAxis) },
            end,
          ]),
        },
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
          formatter: chartPrice(price),
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
        showSymbol: false,
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
      style={{
        position: "relative",
        height,
        minHeight: 0,
        cursor: tool === "cursor" ? "crosshair" : tool === "measure" ? "crosshair" : "copy",
      }}
    >
      {comparison && (
        <div
          role="status"
          data-price-comparison
          className="pointer-events-none absolute left-1/2 top-2 z-20 -translate-x-1/2 rounded-lg border bg-background/95 px-4 py-2 text-center shadow-lg"
        >
          <strong className={comparison.change < 0 ? "text-loss" : "text-profit"}>
            {comparison.change >= 0 ? "+" : ""}
            {number(comparison.change, 2)} %
          </strong>
          <div className="text-xs text-muted-foreground">
            {chartPrice(comparison.from)} → {chartPrice(comparison.to)}
            <span className="block">{comparison.candles} bougies</span>
          </div>
        </div>
      )}
      <EChart option={option} height="100%" preserveZoom onReady={ready} />
      <div
        data-price-axis-drag
        title="Glisse vers le haut pour agrandir les bougies. Double-clic : échelle automatique."
        style={{
          position: "absolute",
          right: 0,
          top: "6%",
          height: `${layout.mainHeight}%`,
          width: 85,
          cursor: "ns-resize",
          touchAction: "none",
        }}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          axisDrag.current = { y: event.clientY, scale: priceScale };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!axisDrag.current) return;
          event.preventDefault();
          scaleAxis(axisDrag.current.scale * Math.exp((axisDrag.current.y - event.clientY) / 150));
        }}
        onPointerUp={(event) => {
          axisDrag.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          axisDrag.current = null;
        }}
        onDoubleClick={() => scaleAxis(1)}
      />
    </div>
  );
}
