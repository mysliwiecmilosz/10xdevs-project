import type { SupabaseClient } from "../../db/supabase.client.ts";
import type { Json } from "../../db/database.types.ts";
import type { AccountRole, CardQualityStatus, GenerateCardsResponseDto, GeneratedCardDto } from "../../types.ts";
import crypto from "node:crypto";
import { z } from "zod";
import { getDailyGenerationLimit } from "../config/limits.ts";
import { createOpenRouterServiceFromEnv } from "./openrouter.from-env.ts";
import {
  OpenRouterAuthError,
  OpenRouterConfigError,
  OpenRouterRateLimitError,
  OpenRouterResponseParseError,
  OpenRouterSchemaValidationError,
  OpenRouterTimeoutError,
  OpenRouterUnsupportedFeatureError,
  OpenRouterUpstreamError,
  type OpenRouterJsonSchemaResponseFormat,
  type OpenRouterStructuredSchema,
} from "./openrouter.service.ts";

class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function utcDateKey(date = new Date()): string {
  // YYYY-MM-DD (UTC)
  return date.toISOString().slice(0, 10);
}

function makeSourceTitle(content: string): string {
  const trimmed = content.trim().replace(/\s+/g, " ");
  const hash = crypto.createHash("md5").update(trimmed).digest("hex").slice(0, 8);
  const base = trimmed.length <= 80 ? trimmed : `${trimmed.slice(0, 77)}...`;
  return `${base} #${hash}`;
}

const aiCardSchema = z.object({
  front: z.string().min(1).max(2000),
  back: z.string().min(1).max(10_000),
  // NOTE: Some providers (e.g. Azure via OpenRouter) require JSON-schema `required`
  // to list *all* keys in `properties`. We therefore make these always present,
  // but allow null to keep them logically optional.
  context: z.string().max(10_000).nullable(),
  difficulty: z.number().int().min(1).max(5).nullable(),
  tags: z.array(z.string().min(1).max(50)).max(20).nullable(),
});

const aiResponseSchema = z.object({
  cards: z.array(aiCardSchema).min(1).max(100),
});

const generateCardsResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "generate_cards_v1",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        cards: {
          type: "array",
          minItems: 1,
          maxItems: 100,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              front: { type: "string", minLength: 1, maxLength: 2000 },
              back: { type: "string", minLength: 1, maxLength: 10000 },
              context: { anyOf: [{ type: "string", maxLength: 10000 }, { type: "null" }] },
              difficulty: { anyOf: [{ type: "integer", minimum: 1, maximum: 5 }, { type: "null" }] },
              tags: {
                anyOf: [
                  {
                    type: "array",
                    maxItems: 20,
                    items: { type: "string", minLength: 1, maxLength: 50 },
                  },
                  { type: "null" },
                ],
              },
            },
            // Required must include all keys in properties for some providers.
            required: ["front", "back", "context", "difficulty", "tags"],
          },
        },
      },
      required: ["cards"],
    },
  },
} as const satisfies OpenRouterJsonSchemaResponseFormat;

const generateCardsStructuredSchema: OpenRouterStructuredSchema<z.infer<typeof aiResponseSchema>> = {
  response_format: generateCardsResponseFormat,
  parse: (value) => aiResponseSchema.parse(value),
};

async function checkAndIncrementDailyLimit(params: {
  supabase: SupabaseClient;
  userId: string;
  role: AccountRole;
}): Promise<{ remaining_generations: number }> {
  const { supabase, userId, role } = params;
  const limit = getDailyGenerationLimit(role);
  const date = utcDateKey();

  // Preferred path: atomic DB function (avoids race conditions and can bypass RLS safely).
  const { data: rpcRemaining, error: rpcError } = await supabase.rpc("increment_daily_generation", {
    p_user_id: userId,
    p_daily_limit: limit,
  });

  if (!rpcError && typeof rpcRemaining === "number") {
    return { remaining_generations: rpcRemaining };
  }
  if (rpcError) {
    const msg = String((rpcError as any).message ?? "");
    if (msg.includes("daily_limit_exceeded")) {
      throw new HttpError(429, "daily_limit_exceeded", "Daily generation limit exceeded.");
    }
    if (msg.includes("invalid_user_id")) {
      throw new HttpError(500, "invalid_user_id", "Invalid user id for usage tracking.");
    }
    if (msg.includes("invalid_daily_limit")) {
      throw new HttpError(500, "invalid_daily_limit", "Invalid daily limit configuration.");
    }
    // Fall back to legacy behavior only if function is missing.
    const code = String((rpcError as any).code ?? "");
    if (code && !["PGRST202", "42883"].includes(code)) {
      throw new HttpError(500, "usage_stats_write_failed", "Failed to update usage stats.");
    }
  }

  const { data: existing, error: selectError } = await supabase
    .from("user_usage_stats")
    .select("generation_count")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();

  if (selectError) {
    throw new HttpError(500, "usage_stats_read_failed", "Failed to read usage stats.");
  }

  const used = existing?.generation_count ?? 0;
  if (used >= limit) {
    throw new HttpError(429, "daily_limit_exceeded", "Daily generation limit exceeded.");
  }

  // NOTE: This is not perfectly atomic under concurrency without an RPC/DB function.
  // The composite PK (user_id, date) makes it safe to upsert one row per day.
  const { error: upsertError } = await supabase.from("user_usage_stats").upsert(
    {
      user_id: userId,
      date,
      generation_count: used + 1,
    },
    { onConflict: "user_id,date" }
  );

  if (upsertError) {
    throw new HttpError(500, "usage_stats_write_failed", "Failed to update usage stats.");
  }

  return { remaining_generations: limit - (used + 1) };
}

async function assertDeckOwnership(params: {
  supabase: SupabaseClient;
  userId: string;
  deckId: string;
}): Promise<void> {
  const { supabase, userId, deckId } = params;

  const { data, error } = await supabase
    .from("decks")
    .select("id")
    .eq("id", deckId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, "deck_lookup_failed", "Failed to validate deck.");
  }
  if (!data) {
    throw new HttpError(404, "deck_not_found", "Deck not found.");
  }
}

async function createSource(params: {
  supabase: SupabaseClient;
  userId: string;
  content: string;
}): Promise<{ sourceId: string }> {
  const { supabase, userId, content } = params;

  const { data, error } = await supabase
    .from("sources")
    .insert({
      user_id: userId,
      title: makeSourceTitle(content),
      content,
      character_count: content.length,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new HttpError(500, "source_create_failed", "Failed to create source.");
  }

  return { sourceId: data.id };
}

async function generateCardsWithAI(content: string): Promise<z.infer<typeof aiResponseSchema>> {
  const openrouter = createOpenRouterServiceFromEnv();

  const system = [
    "You generate flashcards for an educational app.",
    "Return only data that matches the required JSON schema.",
    "Do not include markdown fences.",
  ].join("\n");

  const user = ["Generate flashcards from the user content.", "", "User content:", content].join("\n");

  try {
    const { data } = await openrouter.sendChatCompletionStructured(
      {
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        params: {
          temperature: 0.2,
          max_tokens: 1200,
        },
      },
      generateCardsStructuredSchema
    );

    return data;
  } catch (err) {
    if (err instanceof OpenRouterConfigError) {
      throw new HttpError(500, "openrouter_not_configured", "OpenRouter is not configured.");
    }
    if (err instanceof OpenRouterAuthError) {
      throw new HttpError(err.status, "openrouter_auth_error", "AI provider authorization failed.");
    }
    if (err instanceof OpenRouterRateLimitError) {
      throw new HttpError(429, "openrouter_rate_limit", "AI provider rate limit exceeded.");
    }
    if (err instanceof OpenRouterTimeoutError) {
      throw new HttpError(408, "openrouter_timeout", "AI provider request timed out.");
    }
    if (err instanceof OpenRouterUnsupportedFeatureError) {
      throw new HttpError(502, "openrouter_unsupported_feature", "AI provider does not support this feature.");
    }
    if (err instanceof OpenRouterUpstreamError) {
      // Preserve upstream status + message (e.g. model not found, insufficient credits, etc.).
      throw new HttpError(err.status, "openrouter_upstream_error", err.message, { openrouter: err.meta });
    }
    if (err instanceof OpenRouterResponseParseError) {
      throw new HttpError(500, "openrouter_invalid_json", "AI provider returned invalid JSON.");
    }
    if (err instanceof OpenRouterSchemaValidationError) {
      throw new HttpError(500, "openrouter_schema_mismatch", "AI provider returned unexpected JSON shape.");
    }

    throw err;
  }
}

async function insertGeneratedCards(params: {
  supabase: SupabaseClient;
  userId: string;
  sourceId: string;
  deckId?: string;
  cards: z.infer<typeof aiCardSchema>[];
}): Promise<{ cards: GeneratedCardDto[] }> {
  const { supabase, userId, sourceId, deckId, cards } = params;

  const inserts = cards.map((c) => ({
    user_id: userId,
    source_id: sourceId,
    deck_id: deckId ?? null,
    question: c.front,
    answer: c.back,
    context: c.context ?? null,
    difficulty: c.difficulty ?? 3,
    tags: c.tags ?? [],
    quality_status: "draft",
  }));

  const { data, error } = await supabase
    .from("cards")
    .insert(inserts)
    .select("id, question, answer, context, difficulty, tags, quality_status");

  if (error || !data) {
    throw new HttpError(500, "cards_insert_failed", "Failed to save generated cards.");
  }

  const dto: GeneratedCardDto[] = data.map((row) => ({
    id: row.id,
    front: row.question,
    back: row.answer,
    context: row.context,
    difficulty: row.difficulty,
    tags: row.tags,
    quality_status: (row.quality_status ?? "draft") as CardQualityStatus,
  }));

  return { cards: dto };
}

async function logKpiEvent(params: {
  supabase: SupabaseClient;
  userId: string;
  event_type: string;
  metadata: Json;
}): Promise<void> {
  const { supabase, userId, event_type, metadata } = params;

  const { error } = await supabase.from("kpi_events").insert({
    user_id: userId,
    event_type,
    metadata,
  });

  // KPI must never block the main flow.
  if (error) {
    // eslint-disable-next-line no-console
    console.error("[kpi_events] insert failed", error);
  }
}

export async function generateCardsPipeline(params: {
  supabase: SupabaseClient;
  userId: string;
  role: AccountRole;
  content: string;
  deckId?: string;
}): Promise<GenerateCardsResponseDto> {
  const { supabase, userId, role, content, deckId } = params;

  if (deckId) {
    await assertDeckOwnership({ supabase, userId, deckId });
  }

  const { remaining_generations } = await checkAndIncrementDailyLimit({ supabase, userId, role });
  const { sourceId } = await createSource({ supabase, userId, content });

  try {
    const ai = await generateCardsWithAI(content);
    const { cards } = await insertGeneratedCards({
      supabase,
      userId,
      sourceId,
      deckId,
      cards: ai.cards,
    });

    await logKpiEvent({
      supabase,
      userId,
      event_type: "ai_generation",
      metadata: {
        cards_count: cards.length,
        source_id: sourceId,
        deck_id: deckId ?? null,
      } as unknown as Json,
    });

    return {
      source_id: sourceId,
      cards,
      remaining_generations,
    };
  } catch (err) {
    await logKpiEvent({
      supabase,
      userId,
      event_type: "ai_generation_failed",
      metadata: {
        source_id: sourceId,
        deck_id: deckId ?? null,
      } as unknown as Json,
    });

    throw err;
  }
}

export function toHttpError(err: unknown): HttpError {
  if (err instanceof HttpError) return err;
  return new HttpError(500, "internal_error", "Internal server error.");
}
