import { describe, expect, it, afterEach, vi } from "vitest";
import { createOpenRouterServiceFromEnv } from "@/lib/services/openrouter.from-env";

describe("createOpenRouterServiceFromEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws when API key is missing or placeholder", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "###");
    vi.stubEnv("OPENROUTER_DEFAULT_MODEL", "openai/gpt-4o-mini");

    expect(() => createOpenRouterServiceFromEnv()).toThrow("OpenRouter API key is not configured.");
  });

  it("falls back to default model when placeholder is used", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.stubEnv("OPENROUTER_DEFAULT_MODEL", "###");

    const service = createOpenRouterServiceFromEnv();

    expect(service.defaultModel).toBe("openai/gpt-4o-mini");
  });

  it("falls back to timeout when value is invalid", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.stubEnv("OPENROUTER_DEFAULT_MODEL", "test-model");
    vi.stubEnv("OPENROUTER_TIMEOUT_MS", "-1");

    const service = createOpenRouterServiceFromEnv();

    expect((service as any).cfg.requestTimeoutMs).toBe(45_000);
  });

  it("uses provided timeout and optional headers when valid", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.stubEnv("OPENROUTER_DEFAULT_MODEL", "test-model");
    vi.stubEnv("OPENROUTER_TIMEOUT_MS", "9000");
    vi.stubEnv("OPENROUTER_HTTP_REFERER", "https://example.com");
    vi.stubEnv("OPENROUTER_X_TITLE", "My App");

    const service = createOpenRouterServiceFromEnv();
    const cfg = (service as any).cfg;

    expect(cfg.requestTimeoutMs).toBe(9000);
    expect(cfg.appReferer).toBe("https://example.com");
    expect(cfg.appTitle).toBe("My App");
  });
});
