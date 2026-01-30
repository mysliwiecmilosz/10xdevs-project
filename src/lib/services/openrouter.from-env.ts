import { OpenRouterService, type OpenRouterServiceDeps } from "../openrouter.service.ts";

function isPlaceholder(value: string | undefined): boolean {
  if (!value) return true;
  const trimmed = value.trim();
  return trimmed === "" || trimmed === "###";
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (isPlaceholder(value)) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

/**
 * Factory to build `OpenRouterService` from `import.meta.env`.
 * Keeps env parsing centralized and testable.
 */
export function createOpenRouterServiceFromEnv(deps: OpenRouterServiceDeps = {}): OpenRouterService {
  // Treat placeholders as missing to avoid confusing 401s and generic failures in dev.
  const apiKey = isPlaceholder(import.meta.env.OPENROUTER_API_KEY) ? "" : import.meta.env.OPENROUTER_API_KEY;

  const defaultModel = isPlaceholder(import.meta.env.OPENROUTER_DEFAULT_MODEL)
    ? "openai/gpt-4o-mini"
    : import.meta.env.OPENROUTER_DEFAULT_MODEL;

  const requestTimeoutMs = parsePositiveInt(import.meta.env.OPENROUTER_TIMEOUT_MS, 45_000);

  const appReferer = isPlaceholder(import.meta.env.OPENROUTER_HTTP_REFERER)
    ? undefined
    : import.meta.env.OPENROUTER_HTTP_REFERER;

  const appTitle = isPlaceholder(import.meta.env.OPENROUTER_X_TITLE) ? undefined : import.meta.env.OPENROUTER_X_TITLE;

  return new OpenRouterService(
    {
      apiKey,
      defaultModel,
      requestTimeoutMs,
      maxRetries: 2,
      appReferer,
      appTitle,
    },
    deps,
  );
}

