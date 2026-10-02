// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLiveMarket } from "../src/hooks/use-live-market";

class Feed {
  static OPEN = 1;
  static instances: Feed[] = [];
  readyState = 1;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  constructor() {
    Feed.instances.push(this);
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
}
let root: Root;
let state: ReturnType<typeof useLiveMarket>;
const fetcher = vi.fn();
function Probe({ enabled = true }: { enabled?: boolean }) {
  state = useLiveMarket("BTCUSDT", "1m", enabled);
  return null;
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-02T10:00:00Z"));
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("WebSocket", Feed);
  Feed.instances = [];
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  fetcher
    .mockReset()
    .mockResolvedValue({
      ok: true,
      json: async () => ({
        symbol: "BTCUSDT",
        resolution: "1m",
        price: 100,
        changePct: 0,
        marketTime: 60000,
        bars: [{ time: 60000, open: 100, high: 101, low: 99, close: 100, volume: 1 }],
      }),
    });
  vi.stubGlobal("fetch", fetcher);
  root = createRoot(document.createElement("div"));
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("live feed lifecycle", () => {
  it("updates price from the stream and falls back to polling when the stream fails", async () => {
    await act(async () => root.render(createElement(Probe)));
    expect(state.snapshot?.price).toBe(100);
    await act(async () =>
      Feed.instances[0]!.onmessage?.({
        data: JSON.stringify({ e: "24hrMiniTicker", s: "BTCUSDT", c: "120", o: "100", E: 60001 }),
      }),
    );
    expect(state.snapshot?.price).toBe(120);
    expect(state.status).toBe("Flux en direct");
    await act(async () => {
      Feed.instances[0]!.onerror?.();
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(state.snapshot?.price).toBe(120);
  });
  it("preserves the last chart on pause and cancels requests and timers", async () => {
    await act(async () => root.render(createElement(Probe)));
    await act(async () => root.render(createElement(Probe, { enabled: false })));
    await act(async () => vi.advanceTimersByTimeAsync(15000));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(state.snapshot?.price).toBe(100);
    expect(state.status).toBe("En pause");
    expect(Feed.instances[0]!.readyState).toBe(3);
  });
  it("suspends the feed while the tab is hidden and resumes on return", async () => {
    await act(async () => root.render(createElement(Probe)));
    await act(async () => {
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(15000);
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(state.status).toContain("onglet masqué");
    await act(async () => {
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(Feed.instances).toHaveLength(2);
  });
});
