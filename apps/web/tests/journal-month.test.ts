import { describe, expect, it } from "vitest";
import { journalMonth } from "../src/lib/journal-month";
import { calendarMonthFromDays } from "@luxalgo/journal-core";

describe("journal calendar navigation", () => {
  it("crosses year boundaries in both directions", () => {
    expect(journalMonth("2026-01", "2026-10-02").previous).toBe("2025-12");
    expect(journalMonth("2026-12", "2026-10-02").next).toBe("2027-01");
  });
  it("recovers from invalid query parameters without an invalid Date", () => {
    for (const month of [undefined, "", "2026-00", "2026-13", "not-a-date", "0000-01", "9999-12"]) {
      expect(journalMonth(month, "2026-10-02").key).toBe("2026-10");
    }
  });
  it("renders all days in a leap February and includes the last day's results", () => {
    const selection = journalMonth("2028-02", "2026-10-02");
    const calendar = calendarMonthFromDays(
      [
        {
          date: "2028-02-29",
          netPnl: -5,
          grossPnl: -4,
          fees: 1,
          trades: 1,
          wins: 0,
          losses: 1,
          breakevens: 0,
          volume: 10,
        },
      ],
      selection.year,
      selection.month,
    );
    expect(calendar.weeks.flatMap((week) => week.days).filter(Boolean)).toHaveLength(29);
    expect(calendar.monthNetPnl).toBe(-5);
    expect(calendar.weeks.reduce((sum, week) => sum + week.weekNetPnl, 0)).toBe(-5);
    expect(calendar.monthTrades).toBe(1);
  });
});
