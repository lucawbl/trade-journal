import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  aiConfigured: vi.fn(),
  runAi: vi.fn(),
  getAiProvider: vi.fn(),
  getAiModel: vi.fn(),
}));
vi.mock("../src/server/ai", () => ({ aiConfigured: mocks.aiConfigured, runAi: mocks.runAi }));
vi.mock("../src/server/settings", () => ({
  getAiProvider: mocks.getAiProvider,
  getAiModel: mocks.getAiModel,
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
const { POST } = await import("../src/app/api/ai/connection/route");

const request = (body?: unknown) =>
  new Request("http://localhost/api/ai/connection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

beforeEach(() => {
  vi.stubEnv("JOURNAL_PASSWORD", "");
  mocks.aiConfigured.mockReset().mockReturnValue(true);
  mocks.runAi.mockReset().mockResolvedValue("OK");
  mocks.getAiProvider.mockReset().mockReturnValue("openai");
  mocks.getAiModel.mockReset().mockReturnValue("configured-model");
});
afterEach(() => vi.unstubAllEnvs());

describe("saved AI connection test", () => {
  it("requires the journal session before reading settings or calling a provider", async () => {
    vi.stubEnv("JOURNAL_PASSWORD", "private");
    expect((await POST(request({}))).status).toBe(401);
    expect(mocks.getAiProvider).not.toHaveBeenCalled();
    expect(mocks.aiConfigured).not.toHaveBeenCalled();
    expect(mocks.runAi).not.toHaveBeenCalled();
  });

  it("rejects an absent saved/environment key before any provider request", async () => {
    mocks.aiConfigured.mockReturnValue(false);
    const response = await POST(request({}));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("Ajoute une clé API OpenAI");
    expect(mocks.runAi).not.toHaveBeenCalled();
    expect(mocks.getAiModel).not.toHaveBeenCalled();
  });

  it.each([undefined, {}])(
    "uses only the saved model and a fixed short test prompt",
    async (body) => {
      const response = await POST(request(body));
      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toContain("no-store");
      expect(await response.json()).toEqual({
        connected: true,
        provider: "openai",
        model: "configured-model",
      });
      expect(mocks.runAi).toHaveBeenCalledExactlyOnceWith("Réponds seulement OK.", 64);
      expect(mocks.getAiModel).toHaveBeenCalledExactlyOnceWith("openai");
    },
  );

  it.each([
    { prompt: "write a long report" },
    { model: "different-model" },
    { apiKey: "client-test-key" },
    { provider: "anthropic" },
    { apply: true },
    [],
    null,
  ])("rejects client prompts, models, credentials and other request scopes", async (body) => {
    const response = await POST(request(body));
    expect(response.status).toBe(400);
    expect(mocks.runAi).not.toHaveBeenCalled();
    expect(mocks.getAiProvider).not.toHaveBeenCalled();
    expect(await response.text()).not.toContain("client-test-key");
  });

  it("rejects malformed and oversized bodies without reading or writing settings", async () => {
    for (const body of ["{", "x".repeat(1025)]) {
      expect(
        (await POST(new Request("http://localhost/api/ai/connection", { method: "POST", body })))
          .status,
      ).toBe(400);
    }
    expect(mocks.getAiProvider).not.toHaveBeenCalled();
    expect(mocks.runAi).not.toHaveBeenCalled();
  });

  it.each([
    ["AI authentication_error: private-key", 502, "clé IA a été refusée"],
    ["AI billing: private-request", 502, "crédits"],
    ["AI rate limit: private-key", 429, "limite les demandes"],
    ["AI model unavailable: private-request", 502, "modèle IA est indisponible"],
    ["AI is not configured private-key", 400, "clé IA n’est plus disponible"],
    ["raw provider private-key private-request", 502, "test IA a échoué"],
  ])(
    "returns sanitized French errors instead of provider payloads",
    async (message, status, expected) => {
      mocks.runAi.mockRejectedValue(new Error(message));
      const response = await POST(request({}));
      expect(response.status).toBe(status);
      const text = await response.text();
      expect(text).toContain(expected);
      expect(text).not.toMatch(/private-key|private-request|raw provider|connected/);
    },
  );

  it("does not report a connection when the test returns no content", async () => {
    mocks.runAi.mockResolvedValue("  ");
    const response = await POST(request({}));
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("connected");
  });
});
