// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  chart: { setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() },
  init: vi.fn(),
}));
vi.mock("echarts/core", () => ({ use: vi.fn(), init: state.init }));
vi.mock("echarts/charts", () => ({ BarChart: {}, LineChart: {} }));
vi.mock("echarts/components", () => ({
  AxisPointerComponent: {},
  GridComponent: {},
  TooltipComponent: {},
}));
vi.mock("echarts/renderers", () => ({ CanvasRenderer: {} }));
const { EChart } = await import("../src/components/charts/echart");
let container: HTMLDivElement, root: Root;
const option = (price: number) => ({
  dataZoom: [{ type: "inside" as const, start: 60, end: 100 }],
  series: [{ name: "Cours", type: "line" as const, data: [price] }],
});
const render = (price: number) =>
  root.render(createElement(EChart, { option: option(price), preserveZoom: true }));
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  }));
  state.init.mockReset().mockReturnValue(state.chart);
  state.chart.setOption.mockReset();
  state.chart.dispose.mockReset();
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("live chart interactions", () => {
  it("initializes once and updates data without reapplying the user's zoom range", async () => {
    await act(async () => {
      render(100);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });
    expect(state.chart.setOption.mock.calls[0]![0].dataZoom).toBeDefined();
    await act(async () => render(101));
    expect(state.init).toHaveBeenCalledTimes(1);
    const [update, settings] = state.chart.setOption.mock.calls.at(-1)!;
    expect(update.dataZoom).toBeUndefined();
    expect(update.series[0].data).toEqual([101]);
    expect(settings).toEqual({ notMerge: false, lazyUpdate: true });
  });
  it("keeps dragging uninterrupted and applies only the latest tick after release", async () => {
    await act(async () => render(100));
    await act(async () => vi.advanceTimersByTimeAsync(20));
    container.firstElementChild!.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    await act(async () => render(101));
    await act(async () => render(102));
    expect(state.chart.setOption).toHaveBeenCalledTimes(1);
    document.dispatchEvent(new Event("pointerup"));
    await act(async () => vi.advanceTimersByTimeAsync(200));
    expect(state.chart.setOption).toHaveBeenCalledTimes(2);
    expect(state.chart.setOption.mock.calls.at(-1)![0].series[0].data).toEqual([102]);
  });
  it("defers chart redraws during wheel zoom as well", async () => {
    await act(async () => render(100));
    await act(async () => vi.advanceTimersByTimeAsync(20));
    container.firstElementChild!.dispatchEvent(new Event("wheel", { bubbles: true }));
    await act(async () => render(103));
    expect(state.chart.setOption).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(200));
    expect(state.chart.setOption).toHaveBeenCalledTimes(2);
  });
});
