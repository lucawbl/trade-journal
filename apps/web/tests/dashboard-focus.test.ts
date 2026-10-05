import { describe, expect, it } from "vitest";
import type { RoundTrip } from "@luxalgo/journal-core";
import { dashboardFocus } from "../src/lib/dashboard-focus";

const accounts = [
  { id: "btc", name: "BTC bot", currency: "USDT" },
  { id: "pepe", name: "PEPE bot", currency: "USDT" },
];
const trade = (accountId: string, status: RoundTrip["status"], grossPnl: number, fees = 1) => ({
  accountId,
  symbol: `${accountId.toUpperCase()}USDT`,
  status,
  grossPnl,
  fees,
  netPnl: grossPnl - fees,
});

describe("dashboard improvement summaries", () => {
  it("includes partial exits in realized totals but excludes them from comparisons", () => {
    const focus = dashboardFocus(
      [trade("btc", "win", 11), trade("btc", "loss", -19), trade("pepe", "open", -999)],
      accounts,
      true,
    );
    expect(focus.realized).toBe(-1010);
    expect(focus.weakest?.id).toBe("btc");
    expect(focus.avgWin).toBe(10);
    expect(focus.avgLoss).toBe(20);
    expect(focus.fees).toBe(2);
    expect(focus.gross! - focus.fees!).toBe(-10);
    expect(focus.bots[1]?.closed).toBe(0);
    expect(focus.bots[1]?.winRate).toBeNull();
  });
  it("does not invent averages or weak bots without completed positions", () => {
    const focus = dashboardFocus([trade("btc", "open", 10)], accounts, true);
    expect(focus.weakest).toBeNull();
    expect(focus.avgWin).toBeNull();
    expect(focus.avgLoss).toBeNull();
    expect(focus.fees).toBeNull();
    expect(focus.open).toBe(1);
  });
  it("never combines money or ranks bots across unconverted currencies", () => {
    const focus = dashboardFocus(
      [trade("btc", "loss", -10), trade("pepe", "loss", -1000)],
      [accounts[0]!, { ...accounts[1]!, currency: "JPY" }],
      false,
    );
    expect(focus.weakest).toBeNull();
    expect(focus.realized).toBeNull();
    expect(focus.avgLoss).toBeNull();
    expect(focus.fees).toBeNull();
    expect(focus.bots.map((bot) => bot.winRate)).toEqual([0, 0]);
  });
  it("keeps breakevens out of average wins and losses and uses net results", () => {
    const focus = dashboardFocus(
      [trade("btc", "breakeven", 1.01), trade("btc", "loss", 0.5), trade("pepe", "win", 5)],
      accounts,
      true,
    );
    expect(focus.avgWin).toBe(4);
    expect(focus.avgLoss).toBe(0.5);
    expect(focus.weakest?.id).toBe("btc");
    expect(focus.bots[0]?.winRate).toBe(0);
  });
  it("shows no losing bot when every completed bot is profitable", () => {
    const focus = dashboardFocus([trade("btc", "win", 5)], accounts, true);
    expect(focus.weakest).toBeNull();
    expect(focus.avgLoss).toBeNull();
    expect(focus.bots).toHaveLength(1);
  });
});
