// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RESOLUTIONS, type Resolution } from "../src/lib/market-data";
import type { LiveSnapshot } from "../src/lib/live-market";
import type { TerminalTrade } from "../src/lib/terminal-types";
const state = vi.hoisted(() => ({
  snapshots: new Map<string, LiveSnapshot>(),
  fetch: vi.fn(),
  hook: vi.fn(),
}));
vi.mock("next/dynamic", async () => {
  const { createElement } = await import("react");
  return {
    default:
      () =>
      (props: {
        history: LiveSnapshot;
        focus?: { key: string };
        events: unknown[];
        levels: unknown[];
      }) =>
        createElement("div", {
          "data-canvas": "true",
          "data-resolution": props.history.resolution,
          "data-count": props.history.bars.length,
          "data-focus": props.focus?.key,
          "data-events": props.events.length,
        }),
  };
});
vi.mock("../src/hooks/use-live-market", () => ({
  useLiveMarket: (symbol: string, resolution: Resolution, enabled: boolean) => {
    state.hook(symbol, resolution, enabled);
    return {
      snapshot: state.snapshots.get(resolution),
      status: "Direct",
      error: "",
      receivedAt: 0,
    };
  },
}));
vi.mock("../src/components/ui/dialog", async () => {
  const { createElement } = await import("react");
  return {
    Dialog: ({ open, children }: { open: boolean; children: unknown }) => (open ? children : null),
    DialogContent: ({ children }: { children: unknown }) =>
      createElement("div", {}, children as never),
    DialogHeader: "div",
    DialogTitle: "h2",
    DialogDescription: "p",
  };
});
vi.mock("../src/components/market-trade-history", async () => {
  const { createElement } = await import("react");
  return {
    MarketTradeHistory: ({
      trades,
      onShowTrade,
    }: {
      trades: TerminalTrade[];
      onShowTrade: (trade: TerminalTrade) => void;
    }) => createElement("button", { onClick: () => onShowTrade(trades[0]!) }, "Trade test"),
  };
});
const { MarketTerminal } = await import("../src/components/market-terminal");
let root: Root, host: HTMLDivElement;
const trade: TerminalTrade = {
  key: "t",
  symbol: "BTCUSDT",
  account: "Test",
  direction: "long",
  status: "win",
  openedAt: "2026-10-01T10:00:00Z",
  closedAt: "2026-10-01T11:00:00Z",
  currency: "USDT",
  avgEntry: 100,
  openQuantity: 0,
  netPnl: 1,
  events: [
    {
      id: "entry",
      time: 0,
      price: 100,
      quantity: 1,
      position: 1,
      kind: "entry",
      executedAt: "2026-10-01T10:00:00Z",
    },
  ],
  levels: [],
};
function snapshot(resolution: Resolution, count = 100): LiveSnapshot {
  return {
    symbol: "BTCUSDT",
    provider: "Binance",
    quoteCurrency: "USDT",
    resolution,
    bars: Array.from({ length: count }, (_, i) => ({
      time: i * RESOLUTIONS[resolution],
      open: 100,
      high: 102,
      low: 99,
      close: 100 + i,
      volume: 1,
    })),
    price: 199,
    marketTime: 0,
    changePct: 0,
    fetchedAt: "2026-10-03T10:00:00Z",
    truncated: false,
    warnings: [],
  };
}
const button = (label: string) =>
  host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
const click = async (el: HTMLElement) => act(async () => el.click());
const setResolution = async (value: string) =>
  act(async () => {
    const select = host.querySelector<HTMLSelectElement>(
      'select[aria-label="Unité de temps en direct"]',
    )!;
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
beforeEach(async () => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.snapshots.clear();
  Object.keys(RESOLUTIONS).forEach((r) => state.snapshots.set(r, snapshot(r as Resolution)));
  state.hook.mockClear();
  state.fetch.mockReset().mockResolvedValue({ ok: true, json: async () => snapshot("15m", 24) });
  vi.stubGlobal("fetch", state.fetch);
  localStorage.clear();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    value: vi.fn(),
    configurable: true,
  });
  await act(async () =>
    root.render(
      createElement(MarketTerminal, {
        initialSymbol: "BTCUSDT",
        initialResolution: "1m",
        trades: [
          trade,
          {
            ...trade,
            key: "other-trade",
            events: trade.events.map((event) => ({ ...event, id: "other-entry" })),
          },
        ],
        timeZone: "UTC",
      }),
    ),
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("terminal mode regressions", () => {
  it("keeps the expanded view usable when native fullscreen is unavailable", async () => {
    await click(button("Plein écran"));
    expect(host.querySelector("[data-expanded]")?.getAttribute("data-expanded")).toBe("true");
    await click(button("Quitter le plein écran"));
    expect(host.querySelector("[data-expanded]")?.getAttribute("data-expanded")).toBe("false");
  });
  it("starts live and changes 5m, 1h and 1d without silently loading a different trade interval", async () => {
    expect(state.fetch).not.toHaveBeenCalled();
    for (const resolution of ["5m", "1h", "1d"]) {
      await setResolution(resolution);
      expect(host.querySelector("[data-canvas]")?.getAttribute("data-resolution")).toBe(resolution);
      expect(state.hook).toHaveBeenLastCalledWith("BTCUSDT", resolution, true);
    }
  });
  it("replays the displayed historical candles and advances one frame", async () => {
    await click(button("Afficher les positions du bot"));
    expect(host.querySelector("[data-canvas]")?.getAttribute("data-count")).toBe("24");
    await click(button("Replay des bougies"));
    expect(host.querySelector("[data-canvas]")?.getAttribute("data-count")).toBe("2");
    await click(button("Bougie suivante"));
    expect(host.querySelector("[data-canvas]")?.getAttribute("data-count")).toBe("3");
    await click(button("Lire le replay"));
    await act(async () => vi.advanceTimersByTimeAsync(700));
    expect(host.querySelector("[data-canvas]")?.getAttribute("data-count")).toBe("4");
    await setResolution("1h");
    expect(host.querySelector("[data-replay-progress]")).toBeNull();
    expect(host.querySelector("[data-canvas]")?.getAttribute("data-resolution")).toBe("1h");
  });
  it("focuses the requested trade and clears focus on return to live", async () => {
    await click([...host.querySelectorAll("button")].find((b) => b.textContent === "Trade test")!);
    expect(host.querySelector("[data-canvas]")?.getAttribute("data-focus")).toBe("t");
    expect(host.querySelector("[data-canvas]")?.getAttribute("data-events")).toBe("1");
    await setResolution("1h");
    expect(host.querySelector("[data-canvas]")?.getAttribute("data-focus")).toBeNull();
    expect(host.querySelector("[data-canvas]")?.getAttribute("data-events")).toBe("2");
  });
  it("ignores a late trade history response after the user changes the timeframe", async () => {
    let resolve!: (value: unknown) => void;
    state.fetch.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    await click([...host.querySelectorAll("button")].find((b) => b.textContent === "Trade test")!);
    await setResolution("1d");
    await act(async () => resolve({ ok: true, json: async () => snapshot("5m", 20) }));
    expect(host.querySelector("[data-canvas]")?.getAttribute("data-resolution")).toBe("1d");
  });
  it("creates a percent alert using the displayed reference and exposes its price", async () => {
    await click(button("Créer une alerte de prix"));
    expect(host.querySelector("[data-alert-target]")?.textContent).toContain("202,98");
    await act(async () =>
      host
        .querySelector("form")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );
    expect(host.textContent).toContain("Alerte créée");
    expect(host.textContent).toContain("202,98");
  });
});
