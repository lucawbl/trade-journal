import { describe, expect, it } from "vitest";
import { buildRoundTrips } from "@luxalgo/journal-core";
import { riskTimeline, chartResolution } from "../src/lib/bot-risk";
const risk = { stopLossPct: 0.8, takeProfitPct: 1.2, fetchedAt: "2026-10-02T12:00:00Z" };
const fills = [
  {
    id: "a",
    accountId: "test",
    symbol: "BTCUSDT",
    side: "buy" as const,
    quantity: 2,
    price: 100,
    fee: 0,
    executedAt: "2026-10-01T10:00:00Z",
  },
  {
    id: "b",
    accountId: "test",
    symbol: "BTCUSDT",
    side: "sell" as const,
    quantity: 1,
    price: 110,
    fee: 0,
    executedAt: "2026-10-01T11:00:00Z",
  },
  {
    id: "c",
    accountId: "test",
    symbol: "BTCUSDT",
    side: "buy" as const,
    quantity: 1,
    price: 120,
    fee: 0,
    executedAt: "2026-10-01T12:00:00Z",
  },
];
describe("bot reference levels", () => {
  it("uses the remaining position cost after a partial sale and subsequent scale-in", () => {
    const trade = buildRoundTrips(fills)[0]!;
    const rows = riskTimeline(trade, fills, risk);
    expect(rows.map((row) => row.basis)).toEqual([100, 100, 110]);
    expect(rows[0]!.stopLoss).toBeCloseTo(99.2);
    expect(rows[0]!.takeProfit).toBeCloseTo(101.2);
    expect(rows[2]!.stopLoss).toBeCloseTo(109.12);
  });
  it("reverses SL and TP directions for short positions", () => {
    const short = fills.map((fill) => ({
      ...fill,
      side: fill.side === "buy" ? ("sell" as const) : ("buy" as const),
    }));
    const rows = riskTimeline(buildRoundTrips(short)[0]!, short, risk);
    expect(rows[0]!.stopLoss).toBeCloseTo(100.8);
    expect(rows[0]!.takeProfit).toBeCloseTo(98.8);
  });
  it("does not invent levels when parameters or history are missing", () => {
    const trade = buildRoundTrips(fills)[0]!;
    expect(riskTimeline(trade, fills, null)).toEqual([]);
    expect(riskTimeline(trade, fills.slice(1), risk)).toEqual([]);
  });
  it("chooses coarser candles for long histories", () => {
    expect(chartResolution(0, 60_000)).toBe("1m");
    expect(chartResolution(0, 48 * 3_600_000)).toBe("15m");
    expect(chartResolution(0, 90 * 24 * 3_600_000)).toBe("1d");
  });
});
