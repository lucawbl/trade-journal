"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart } from "echarts/charts";
import { AxisPointerComponent, GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";

echarts.use([
  BarChart,
  LineChart,
  AxisPointerComponent,
  GridComponent,
  TooltipComponent,
  CanvasRenderer,
]);

/** Thin ECharts mount: init once, setOption on change, resize with the box. */
export function EChart({
  option,
  className,
  height = 280,
  preserveZoom = false,
}: {
  option: EChartsOption;
  className?: string;
  height?: number;
  preserveZoom?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const applyRef = useRef<() => void>(() => {});

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let frame = 0;
    let observer: ResizeObserver | undefined;
    // Initialize one frame later so the rest of the page paints before the canvas work.
    const start = requestAnimationFrame(() => {
      const chart = echarts.init(host);
      chartRef.current = chart;
      applyRef.current();
      let width = host.clientWidth,
        height = host.clientHeight;
      observer = new ResizeObserver(([entry]) => {
        if (!entry || (entry.contentRect.width === width && entry.contentRect.height === height))
          return;
        width = entry.contentRect.width;
        height = entry.contentRect.height;
        if (!frame)
          frame = requestAnimationFrame(() => {
            frame = 0;
            chart.resize();
          });
      });
      observer.observe(host);
    });
    return () => {
      cancelAnimationFrame(start);
      observer?.disconnect();
      cancelAnimationFrame(frame);
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      const zoom = preserveZoom
        ? (
            chartRef.current?.getOption() as
              { dataZoom?: { start?: number; end?: number }[] } | undefined
          )?.dataZoom
        : undefined;
      chartRef.current?.setOption(
        {
          ...option,
          ...(zoom?.length && Array.isArray(option.dataZoom)
            ? {
                dataZoom: option.dataZoom.map((item, index) => ({
                  ...item,
                  start: zoom[index]?.start ?? item.start,
                  end: zoom[index]?.end ?? item.end,
                })),
              }
            : {}),
          animation: option.animation ?? !motion.matches,
          animationDuration: 850,
          animationDurationUpdate: 0,
          animationEasing: "cubicInOut",
        },
        { notMerge: true },
      );
    };
    applyRef.current = apply;
    apply();
    motion.addEventListener("change", apply);
    return () => motion.removeEventListener("change", apply);
  }, [option, preserveZoom]);

  return (
    <div
      ref={hostRef}
      className={className}
      style={{ height, width: "100%", overflow: "hidden", minWidth: 0 }}
    />
  );
}
