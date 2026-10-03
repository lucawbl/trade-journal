import { describe, expect, it } from "vitest";
import { number, timestamp } from "../src/lib/journal-format";

describe("consistent formatting across server and browser", () => {
  it("normalizes locale grouping and decimal separators", () => {
    expect(number(2650.5513, 4)).toBe("2'650,5513");
    expect(number(-1234.5)).toBe("-1'234,50");
    expect(number(null)).toBe("—");
    expect(number(Infinity)).toBe("—");
    expect(number(-0)).toBe("0,00");
  });
  it("uses fixed punctuation and the requested timezone, including midnight", () => {
    expect(timestamp("2026-10-01T17:07:00Z", "UTC")).toBe("01.10.2026 · 17:07");
    expect(timestamp("2026-10-01T00:00:00Z", "UTC")).toBe("01.10.2026 · 00:00");
    expect(timestamp("2026-10-01T00:00:00Z", "America/New_York")).toBe("30.09.2026 · 20:00");
    expect(timestamp("invalid", "UTC")).toBe("—");
  });
});

it("keeps PEPE prices distinct and nonzero", async () => {
  const { priceNumber } = await import("../src/lib/journal-format");
  expect(priceNumber(0.0000045)).toBe("0,0000045000");
  expect(priceNumber(0.00000431)).not.toBe(priceNumber(0.0000045));
});
