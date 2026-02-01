export type OpenRouterChatMessage =
  | { role: "system" | "user" | "assistant"; content: string; name?: string }
  | { role: "tool"; content: string; tool_call_id: string; name?: string };

export type OpenRouterModelParams = {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  seed?: number;
  stop?: string | string[];
};

export type SendChatCompletionInput = {
  userId?: string;
  model?: string;
  messages: OpenRouterChatMessage[];
  params?: OpenRouterModelParams;
  response_format?: unknown;
};

export type SendChatCompletionResult = {
  id: string;
  model: string;
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cost?: number;
  };
  requestId?: string;
};

export type OpenRouterJsonSchemaResponseFormat = {
  type: "json_schema";
  json_schema: {
    name: string;
    strict: true;
    schema: Record<string, unknown>;
  };
};

export type OpenRouterStructuredSchema<T> = {
  response_format: OpenRouterJsonSchemaResponseFormat;
  /**
   * Runtime validation and parsing hook.
   * Keep it deterministic and side-effect free.
   */
  parse: (value: unknown) => T;
};

export type OpenRouterServiceConfig = {
  apiKey: string;
  baseUrl?: string; // default: https://openrouter.ai/api/v1
  appReferer?: string; // HTTP-Referer
  appTitle?: string; // X-Title
  defaultModel: string;
  requestTimeoutMs: number;
  maxRetries: number;
  /**
   * Cost/safety control: allow only explicitly approved models.
   * If provided, any model outside the list will be rejected.
   */
  allowedModels?: readonly string[];
  /**
   * Input guardrails (characters, not tokens).
   */
  maxMessages?: number; // default: 50
  maxMessageChars?: number; // default: 20_000
};

export type OpenRouterLogger = {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
};

export type OpenRouterUsageTracker = {
  track: (event: {
    userId?: string;
    model?: string;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    cost?: number;
    requestId?: string;
  }) => Promise<void> | void;
};

export type OpenRouterServiceDeps = {
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  logger?: OpenRouterLogger;
  usageTracker?: OpenRouterUsageTracker;
};

type OpenRouterErrorCode =
  | "openrouter_config_error"
  | "openrouter_input_validation_error"
  | "openrouter_auth_error"
  | "openrouter_rate_limit"
  | "openrouter_upstream_error"
  | "openrouter_timeout"
  | "openrouter_unsupported_feature"
  | "openrouter_response_parse_error"
  | "openrouter_schema_validation_error";

class OpenRouterError extends Error {
  readonly code: OpenRouterErrorCode;
  readonly status: number;
  readonly meta?: Record<string, unknown>;

  constructor(params: {
    code: OpenRouterErrorCode;
    status: number;
    message: string;
    meta?: Record<string, unknown>;
    cause?: unknown;
  }) {
    super(params.message);
    this.code = params.code;
    this.status = params.status;
    this.meta = params.meta;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    (this as any).cause = params.cause;
  }
}

export class OpenRouterConfigError extends OpenRouterError {
  constructor(message: string, meta?: Record<string, unknown>, cause?: unknown) {
    super({ code: "openrouter_config_error", status: 500, message, meta, cause });
  }
}

export class OpenRouterInputValidationError extends OpenRouterError {
  constructor(message: string, meta?: Record<string, unknown>, cause?: unknown) {
    super({ code: "openrouter_input_validation_error", status: 400, message, meta, cause });
  }
}

export class OpenRouterAuthError extends OpenRouterError {
  constructor(status: 401 | 403, message: string, meta?: Record<string, unknown>, cause?: unknown) {
    super({ code: "openrouter_auth_error", status, message, meta, cause });
  }
}

export class OpenRouterRateLimitError extends OpenRouterError {
  constructor(message: string, meta?: Record<string, unknown>, cause?: unknown) {
    super({ code: "openrouter_rate_limit", status: 429, message, meta, cause });
  }
}

export class OpenRouterUpstreamError extends OpenRouterError {
  constructor(status: number, message: string, meta?: Record<string, unknown>, cause?: unknown) {
    super({ code: "openrouter_upstream_error", status, message, meta, cause });
  }
}

export class OpenRouterTimeoutError extends OpenRouterError {
  constructor(message: string, meta?: Record<string, unknown>, cause?: unknown) {
    super({ code: "openrouter_timeout", status: 408, message, meta, cause });
  }
}

export class OpenRouterUnsupportedFeatureError extends OpenRouterError {
  constructor(message: string, meta?: Record<string, unknown>, cause?: unknown) {
    super({ code: "openrouter_unsupported_feature", status: 502, message, meta, cause });
  }
}

export class OpenRouterResponseParseError extends OpenRouterError {
  constructor(message: string, meta?: Record<string, unknown>, cause?: unknown) {
    super({ code: "openrouter_response_parse_error", status: 500, message, meta, cause });
  }
}

export class OpenRouterSchemaValidationError extends OpenRouterError {
  constructor(message: string, meta?: Record<string, unknown>, cause?: unknown) {
    super({ code: "openrouter_schema_validation_error", status: 500, message, meta, cause });
  }
}

type OpenRouterNonStreamingResponse = {
  id?: string;
  model?: string;
  choices?: {
    message?: { content?: string };
    finish_reason?: string;
  }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cost?: number;
  };
  error?: unknown;
};

function safeTrimTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getErrorMessage(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (!isObject(value)) return undefined;
  const msg = value["message"];
  return typeof msg === "string" ? msg : undefined;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitteredBackoffMs(attempt: number): number {
  // attempt: 1..N
  const base = 250;
  const capped = Math.min(4_000, base * 2 ** (attempt - 1));
  const jitter = Math.floor(Math.random() * 200);
  return capped + jitter;
}

function maskUserId(userId?: string): string | undefined {
  if (!userId) return undefined;
  if (userId.length <= 6) return "***";
  return `${userId.slice(0, 3)}***${userId.slice(-2)}`;
}

export class OpenRouterService {
  public readonly defaultModel: string;
  public readonly baseUrl: string;

  private readonly cfg: OpenRouterServiceConfig;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly logger?: OpenRouterLogger;
  private readonly usageTracker?: OpenRouterUsageTracker;
  private readonly endpointUrl: string;

  constructor(cfg: OpenRouterServiceConfig, deps: OpenRouterServiceDeps = {}) {
    if (!cfg.apiKey || !cfg.apiKey.trim()) {
      throw new OpenRouterConfigError("OpenRouter API key is not configured.");
    }
    if (!cfg.defaultModel || !cfg.defaultModel.trim()) {
      throw new OpenRouterConfigError("OpenRouter default model is not configured.");
    }
    if (!Number.isFinite(cfg.requestTimeoutMs) || cfg.requestTimeoutMs <= 0) {
      throw new OpenRouterConfigError("OpenRouter requestTimeoutMs must be a positive number.");
    }
    if (!Number.isFinite(cfg.maxRetries) || cfg.maxRetries < 0) {
      throw new OpenRouterConfigError("OpenRouter maxRetries must be >= 0.");
    }

    this.cfg = cfg;
    this.defaultModel = cfg.defaultModel;
    this.baseUrl = safeTrimTrailingSlash(cfg.baseUrl ?? "https://openrouter.ai/api/v1");
    this.fetchImpl = deps.fetchImpl ?? globalThis.fetch;
    this.now = deps.now ?? (() => Date.now());
    this.sleep = deps.sleep ?? defaultSleep;
    this.logger = deps.logger;
    this.usageTracker = deps.usageTracker;
    this.endpointUrl = `${this.baseUrl}/chat/completions`;
  }

  public async sendChatCompletion(input: SendChatCompletionInput): Promise<SendChatCompletionResult> {
    this.assertInputSafe(input);

    const model = this.pickModel(input.model);
    const body = this.buildBody({
      userId: input.userId,
      model,
      messages: input.messages,
      params: input.params,
      response_format: input.response_format,
    });

    const json = await this.requestWithRetry({
      body,
      userId: input.userId,
      model,
      expectStructured: false,
    });

    return await this.parseNonStreamingResponse({
      json,
      userId: input.userId,
      fallbackModel: model,
    });
  }

  public async sendChatCompletionStructured<T>(
    input: Omit<SendChatCompletionInput, "response_format">,
    schema: OpenRouterStructuredSchema<T>
  ): Promise<{ raw: SendChatCompletionResult; data: T }> {
    this.assertInputSafe(input);

    const model = this.pickModel(input.model);
    const body = this.buildBody({
      userId: input.userId,
      model,
      messages: input.messages,
      params: input.params,
      response_format: schema.response_format,
    });

    const json = await this.requestWithRetry({
      body,
      userId: input.userId,
      model,
      expectStructured: true,
    });

    const raw = await this.parseNonStreamingResponse({
      json,
      userId: input.userId,
      fallbackModel: model,
    });

    const data = this.parseStructuredContent(schema, raw.content);
    return { raw, data };
  }

  private buildHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.cfg.apiKey}`,
      "Content-Type": "application/json",
    };

    // Optional attribution headers (not secrets).
    if (this.cfg.appReferer) headers["HTTP-Referer"] = this.cfg.appReferer;
    if (this.cfg.appTitle) headers["X-Title"] = this.cfg.appTitle;

    return headers;
  }

  private assertInputSafe(input: Pick<SendChatCompletionInput, "messages" | "userId" | "model">): void {
    if (!Array.isArray(input.messages) || input.messages.length === 0) {
      throw new OpenRouterInputValidationError("messages is required.");
    }

    const maxMessages = this.cfg.maxMessages ?? 50;
    if (input.messages.length > maxMessages) {
      throw new OpenRouterInputValidationError("Too many messages.", {
        maxMessages,
        got: input.messages.length,
      });
    }

    const maxMessageChars = this.cfg.maxMessageChars ?? 20_000;
    for (const msg of input.messages) {
      if (!msg || typeof (msg as any).role !== "string" || typeof (msg as any).content !== "string") {
        throw new OpenRouterInputValidationError("Invalid message shape.");
      }
      if (msg.content.length > maxMessageChars) {
        throw new OpenRouterInputValidationError("Message content is too long.", {
          maxMessageChars,
          got: msg.content.length,
        });
      }
    }

    if (this.cfg.allowedModels && input.model && !this.cfg.allowedModels.includes(input.model)) {
      throw new OpenRouterInputValidationError("Model is not allowed.", {
        model: input.model,
      });
    }
  }

  private pickModel(model?: string): string {
    const picked = (model ?? this.cfg.defaultModel).trim();
    if (!picked) {
      throw new OpenRouterInputValidationError("Model is required.");
    }
    if (this.cfg.allowedModels && !this.cfg.allowedModels.includes(picked)) {
      throw new OpenRouterInputValidationError("Model is not allowed.", { model: picked });
    }
    return picked;
  }

  private buildBody(params: {
    userId?: string;
    model: string;
    messages: OpenRouterChatMessage[];
    params?: OpenRouterModelParams;
    response_format?: unknown;
  }): Record<string, unknown> {
    const { userId, model, messages, response_format } = params;
    const mp = params.params ?? {};

    // OpenRouter (OpenAI-compatible) expects model params at top-level.
    return {
      model,
      messages,
      response_format,
      user: userId,
      ...mp,
    };
  }

  private async withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ms);
    try {
      return await fn(controller.signal);
    } finally {
      clearTimeout(timeout);
    }
  }

  private shouldRetry(status: number): boolean {
    if (status === 429) return true;
    if (status >= 500 && status <= 599) return true;
    return false;
  }

  private async requestWithRetry(params: {
    body: Record<string, unknown>;
    userId?: string;
    model: string;
    expectStructured: boolean;
  }): Promise<OpenRouterNonStreamingResponse> {
    const { body, userId, model, expectStructured } = params;
    const startedAt = this.now();

    const maxRetries = this.cfg.maxRetries;
    let lastErr: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const attemptNo = attempt + 1;
      try {
        const res = await this.withTimeout(
          (signal) =>
            this.fetchImpl(this.endpointUrl, {
              method: "POST",
              headers: this.buildHeaders(),
              body: JSON.stringify(body),
              signal,
            }),
          this.cfg.requestTimeoutMs
        );

        const requestId = res.headers.get("x-request-id") ?? res.headers.get("x-openrouter-request-id") ?? undefined;

        if (!res.ok) {
          const status = res.status;
          const errPayload = await this.safeReadJson(res);
          const mapped = this.toDomainError({
            status,
            payload: errPayload,
            requestId,
            model,
            expectStructured,
          });

          if (attempt < maxRetries && this.shouldRetry(status)) {
            this.logger?.warn("OpenRouter request failed (will retry).", {
              status,
              code: mapped.code,
              model,
              attempt: attemptNo,
              maxRetries,
              requestId,
              userId: maskUserId(userId),
            });
            const delay = jitteredBackoffMs(attemptNo);
            await this.sleep(delay);
            continue;
          }

          throw mapped;
        }

        const json = (await res.json()) as OpenRouterNonStreamingResponse;
        // attach requestId for downstream usage tracking / logs (without mutating returned content)
        if (requestId && isObject(json)) {
          (json as any).__requestId = requestId;
        }

        this.logger?.info("OpenRouter request succeeded.", {
          model,
          attempt: attemptNo,
          requestId,
          ms: this.now() - startedAt,
          userId: maskUserId(userId),
        });

        return json;
      } catch (err) {
        lastErr = err;
        if (err instanceof OpenRouterError) {
          // already mapped (do not retry here - mapping above handles retry-worthy HTTP codes)
          throw err;
        }

        if (this.isAbortError(err)) {
          throw new OpenRouterTimeoutError("OpenRouter request timed out.", { model }, err);
        }

        // Network/transport failure: retry best-effort (same policy as 5xx)
        if (attempt < maxRetries) {
          this.logger?.warn("OpenRouter transport error (will retry).", {
            model,
            attempt: attemptNo,
            maxRetries,
            userId: maskUserId(userId),
          });
          const delay = jitteredBackoffMs(attemptNo);
          await this.sleep(delay);
          continue;
        }

        throw new OpenRouterUpstreamError(503, "OpenRouter request failed (transport error).", { model }, err);
      }
    }

    throw new OpenRouterUpstreamError(503, "OpenRouter request failed after retries.", { model }, lastErr);
  }

  private async safeReadJson(res: Response): Promise<unknown> {
    try {
      return await res.json();
    } catch {
      return undefined;
    }
  }

  private isAbortError(err: unknown): boolean {
    if (!err) return false;
    if (err instanceof DOMException && err.name === "AbortError") return true;
    if (isObject(err) && typeof err["name"] === "string" && err["name"] === "AbortError") return true;
    return false;
  }

  private async parseNonStreamingResponse(params: {
    json: OpenRouterNonStreamingResponse;
    userId?: string;
    fallbackModel: string;
  }): Promise<SendChatCompletionResult> {
    const { json, userId, fallbackModel } = params;

    const requestId =
      isObject(json) && typeof (json as any).__requestId === "string"
        ? ((json as any).__requestId as string)
        : undefined;

    const id = typeof json.id === "string" && json.id.trim() ? json.id : "unknown";
    const model = typeof json.model === "string" && json.model.trim() ? json.model : fallbackModel;
    const content = json.choices?.[0]?.message?.content;

    if (!content || typeof content !== "string") {
      throw new OpenRouterResponseParseError("OpenRouter returned empty response.", {
        id,
        model,
        requestId,
      });
    }

    const usageRaw = json.usage;
    const usage =
      usageRaw &&
      typeof usageRaw.prompt_tokens === "number" &&
      typeof usageRaw.completion_tokens === "number" &&
      typeof usageRaw.total_tokens === "number"
        ? {
            prompt_tokens: usageRaw.prompt_tokens,
            completion_tokens: usageRaw.completion_tokens,
            total_tokens: usageRaw.total_tokens,
            cost: typeof usageRaw.cost === "number" ? usageRaw.cost : undefined,
          }
        : undefined;

    if (usage) {
      // Must never block the main flow.
      try {
        await this.usageTracker?.track({
          userId,
          model,
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
          cost: usage.cost,
          requestId,
        });
      } catch {
        this.logger?.warn("OpenRouter usageTracker.track failed.", { model, requestId });
      }
    }

    return { id, model, content, usage, requestId };
  }

  private parseStructuredContent<T>(schema: OpenRouterStructuredSchema<T>, content: string): T {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      throw new OpenRouterResponseParseError("OpenRouter structured output is not valid JSON.", undefined, err);
    }

    try {
      return schema.parse(parsed);
    } catch (err) {
      throw new OpenRouterSchemaValidationError("OpenRouter structured output does not match schema.", undefined, err);
    }
  }

  private toDomainError(params: {
    status: number;
    payload: unknown;
    requestId?: string;
    model: string;
    expectStructured: boolean;
  }): OpenRouterError {
    const { status, payload, requestId, model, expectStructured } = params;

    // Best-effort extraction of OpenRouter error message
    let message =
      (isObject(payload) && getErrorMessage(payload["error"])) ||
      (isObject(payload) && getErrorMessage(payload)) ||
      undefined;

    if (!message && isObject(payload) && isObject(payload["error"])) {
      message = getErrorMessage(payload["error"]);
    }

    const meta: Record<string, unknown> = {
      status,
      model,
      requestId,
      // Helps debugging provider-specific failures (dev tooling can surface this).
      payload,
    };

    if (status === 401 || status === 403) {
      return new OpenRouterAuthError(status, "OpenRouter authorization failed.", meta);
    }
    if (status === 429) {
      return new OpenRouterRateLimitError("OpenRouter rate limit exceeded.", meta);
    }

    // Some providers/models may reject structured outputs. Keep mapping conservative.
    if (expectStructured && status >= 400 && status <= 499) {
      const lower = (message ?? "").toLowerCase();
      if (lower.includes("response_format") || lower.includes("json_schema") || lower.includes("structured")) {
        return new OpenRouterUnsupportedFeatureError(
          "Model/provider does not support structured outputs for this request.",
          meta
        );
      }
    }

    if (status >= 400 && status <= 499) {
      return new OpenRouterUpstreamError(status, message ?? "OpenRouter request failed.", meta);
    }

    return new OpenRouterUpstreamError(status, "OpenRouter upstream error.", meta);
  }
}
