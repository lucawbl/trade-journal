import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const read = vi.hoisted(() => vi.fn());
vi.mock("../src/server/live-market", () => ({ readLiveMarket: read }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
const { GET } = await import("../src/app/api/market/live/route");
beforeEach(() => {
  vi.stubEnv("JOURNAL_PASSWORD", "");
  read.mockReset().mockResolvedValue({ price: 1 });
});
afterEach(() => vi.unstubAllEnvs());
describe("live prices route", () => {
  it("requires the journal session and validates the symbol and timeframe", async () => {
    vi.stubEnv("JOURNAL_PASSWORD", "private");
    expect((await GET(new Request("http://localhost/api/market/live"))).status).toBe(401);
    vi.stubEnv("JOURNAL_PASSWORD", "");
    expect((await GET(new Request("http://localhost/api/market/live?symbol=OTHER"))).status).toBe(
      400,
    );
    expect((await GET(new Request("http://localhost/api/market/live?resolution=bad"))).status).toBe(
      400,
    );
    expect(read).not.toHaveBeenCalled();
  });
  it("serves uncached live data for the selected coin", async () => {
    const response = await GET(
      new Request("http://localhost/api/market/live?symbol=PEPEUSDT&resolution=5m"),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(read).toHaveBeenCalledWith("PEPEUSDT", "5m", expect.any(AbortSignal));
  });
});
