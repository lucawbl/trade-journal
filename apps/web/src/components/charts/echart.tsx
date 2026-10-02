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
  height?: number | string;
  preserveZoom?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const applyRef = useRef<() => void>(() => {});
  const initialized = useRef(false);
  const interacting = useRef(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let frame = 0;
    let observer: ResizeObserver | undefined;
    let resume: ReturnType<typeof setTimeout> | undefined;
    const hold = () => {
      clearTimeout(resume);
      interacting.current = true;
    };
    const release = () => {
      if (!interacting.current) return;
      clearTimeout(resume);
      resume = setTimeout(() => {
        interacting.current = false;
        applyRef.current();
      }, 200);
    };
    const wheel = () => {
      hold();
      release();
    };
    host.addEventListener("pointerdown", hold, { passive: true });
    host.addEventListener("wheel", wheel, { passive: true });
    document.addEventListener("pointerup", release);
    document.addEventListener("pointercancel", release);
    window.addEventListener("blur", release);
    // Initialize one frame later so the rest of the page paints before the canvas work.
    const start = requestAnimationFrame(() => {
      const chart = echarts.init(host);
      chartRef.current = chart;
      initialized.current = false;
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
      clearTimeout(resume);
      host.removeEventListener("pointerdown", hold);
      host.removeEventListener("wheel", wheel);
      document.removeEventListener("pointerup", release);
      document.removeEventListener("pointercancel", release);
      window.removeEventListener("blur", release);
      interacting.current = false;
      initialized.current = false;
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
      const chart = chartRef.current;
      if (!chart || (preserveZoom && interacting.current)) return;
      const updating = preserveZoom && initialized.current;
      // Never reapply a zoom range or rebuild the instance during live ticks.
      const { dataZoom: _zoom, ...updates } = option;
      chart.setOption(
        {
          ...(updating ? updates : option),
          animation: option.animation ?? !motion.matches,
          animationDuration: 850,
          animationDurationUpdate: 0,
          animationEasing: "cubicInOut",
        },
        { notMerge: !updating, lazyUpdate: updating },
      );
      initialized.current = true;
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
