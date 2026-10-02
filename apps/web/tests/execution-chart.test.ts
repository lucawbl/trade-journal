import { describe, expect, it } from "vitest";
import type { RoundTrip } from "@luxalgo/journal-core";
import { executionChart, type ChartExecution } from "../src/lib/execution-chart";

const fill = (
  id: string,
  side: "buy" | "sell",
  quantity: number,
  time: string,
  price = 100,
): ChartExecution => ({ id, side, quantity, price, executedAt: time });
const first = "2026-10-01T10:00:00Z",
  second = "2026-10-01T11:00:00Z",
  third = "2026-10-01T12:00:00Z";
const trade = (extra: Partial<RoundTrip> = {}): RoundTrip => ({
  key: "test",
  accountId: "test",
  symbol: "DOGEUSDT",
  direction: "long",
  status: "open",
  openedAt: first,
  quantity: 10,
  openQuantity: 4,
  avgEntry: 100,
  avgExit: 110,
  grossPnl: 60,
  fees: 0,
  netPnl: 60,
  executionCount: 2,
  executionIds: ["entry", "exit"],
  exits: [{ executionId: "exit", quantity: 6, grossPnl: 60 }],
  ...extra,
});

describe("entry and exit chart attribution", () => {
  it("uses actual execution times and quantities for a partial long exit", () => {
    const data = executionChart(trade(), [
      fill("exit", "sell", 6, second, 110),
      fill("entry", "buy", 10, first),
    ]);
    expect(data.complete).toBe(true);
    expect(data.events.map((e) => [e.kind, e.quantity, e.position, e.price])).toEqual([
      ["entry", 10, 10, 100],
      ["exit", 6, 4, 110],
    ]);
    expect(data.events[1]!.time - data.events[0]!.time).toBe(3600000);
  });
  it("treats sells as entries and buys as exits for a short position", () => {
    const data = executionChart(trade({ direction: "short" }), [
      fill("entry", "sell", 10, first),
      fill("exit", "buy", 6, second, 90),
    ]);
    expect(data.events.map((e) => e.kind)).toEqual(["entry", "exit"]);
    expect(data.events.at(-1)!.position).toBe(4);
    expect(data.complete).toBe(true);
  });
  it("does not count the next position's quantity in an oversized exit reversal", () => {
    const data = executionChart(
      trade({
        status: "win",
        openQuantity: 0,
        exits: [{ executionId: "exit", quantity: 10, grossPnl: 100 }],
      }),
      [fill("entry", "buy", 10, first), fill("exit", "sell", 25, second, 110)],
    );
    expect(data.events[1]!.quantity).toBe(10);
    expect(data.events[1]!.position).toBe(0);
    expect(data.complete).toBe(true);
  });
  it("attributes a reversal entry before later scale-ins without inflating exposure", () => {
    const data = executionChart(
      trade({
        direction: "short",
        quantity: 20,
        openQuantity: 15,
        executionIds: ["entry", "add", "exit"],
        exits: [{ executionId: "exit", quantity: 5, grossPnl: 50 }],
      }),
      [
        fill("entry", "sell", 25, first),
        fill("add", "sell", 10, second),
        fill("exit", "buy", 5, third),
      ],
    );
    expect(data.events.map((e) => [e.quantity, e.position])).toEqual([
      [10, 10],
      [10, 20],
      [5, 15],
    ]);
    expect(data.complete).toBe(true);
  });
  it("keeps execution order for simultaneous fills and flags missing history", () => {
    const sameTime = executionChart(trade(), [
      fill("exit", "sell", 6, first),
      fill("entry", "buy", 10, first),
    ]);
    expect(sameTime.complete).toBe(true);
    expect(sameTime.events.map((e) => e.kind)).toEqual(["entry", "exit"]);
    expect(executionChart(trade(), [fill("entry", "buy", 10, first)]).complete).toBe(false);
    expect(executionChart(trade(), []).events).toEqual([]);
  });
});
