import type { APIRoute } from "astro";
import { z, ZodError } from "zod";

import type { CardDto, CardQualityStatus, ListCardsResponseDto } from "../../types.ts";

export const prerender = false;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

const listCardsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 1))
    .pipe(z.number().int().min(1)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 200))
    .pipe(z.number().int().min(1).max(500)),
  deck_id: z.string().uuid().optional(),
  source_id: z.string().uuid().optional(),
  quality_status: z.enum(["draft", "ok", "good"] satisfies CardQualityStatus[]).optional(),
  tags: z.string().optional(),
  sort: z.enum(["created_at_desc", "created_at_asc"]).optional(),
});

const createCardSchema = z.object({
  question: z.string().trim().min(1).max(2000),
  answer: z.string().trim().min(1).max(10_000),
  context: z.string().trim().max(10_000).nullable().optional(),
  difficulty: z.number().int().min(1).max(5).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).nullable().optional(),
  deck_id: z.string().uuid().nullable().optional(),
});

const createCardsSchema = z.union([createCardSchema, z.array(createCardSchema).min(1).max(100)]);

async function assertDeckOwnership(params: {
  userId: string;
  deckIds: string[];
  context: Parameters<APIRoute>[0];
}): Promise<Response | null> {
  const { userId, deckIds, context } = params;
  if (deckIds.length === 0) return null;

  const { data, error } = await context.locals.supabase
    .from("decks")
    .select("id")
    .eq("user_id", userId)
    .in("id", deckIds);

  if (error) {
    return json(500, { error: { code: "deck_lookup_failed", message: "Failed to validate deck ownership." } });
  }

  const found = new Set((data ?? []).map((row) => row.id));
  const missing = deckIds.find((id) => !found.has(id));
  if (missing) {
    return json(404, { error: { code: "deck_not_found", message: "Deck not found." } });
  }

  return null;
}

export const GET: APIRoute = async (context) => {
  try {
    const userId = context.locals.user?.id;
    if (!userId || !isUuid(userId)) {
      return json(401, { error: { code: "unauthorized", message: "User is not authenticated." } });
    }

    const parsed = listCardsQuerySchema.parse(Object.fromEntries(new URL(context.request.url).searchParams.entries()));
    const page = parsed.page;
    const limit = parsed.limit;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const tags = parsed.tags
      ? parsed.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      : null;

    let query = context.locals.supabase
      .from("cards")
      .select(
        "id, question, answer, context, difficulty, tags, quality_status, deck_id, source_id, created_at, updated_at",
        { count: "exact" }
      )
      .eq("user_id", userId)
      .range(from, to);

    if (parsed.deck_id) {
      query = query.eq("deck_id", parsed.deck_id);
    }
    if (parsed.source_id) {
      query = query.eq("source_id", parsed.source_id);
    }
    if (parsed.quality_status) {
      query = query.eq("quality_status", parsed.quality_status);
    }
    if (tags && tags.length > 0) {
      query = query.contains("tags", tags);
    }

    const ascending = parsed.sort === "created_at_asc";
    const { data, error, count } = await query.order("created_at", { ascending });

    if (error) {
      return json(500, { error: { code: "cards_list_failed", message: "Failed to list cards." } });
    }

    const response: ListCardsResponseDto = {
      data: (data ?? []) as unknown as CardDto[],
      meta: {
        total: count ?? 0,
        page,
        limit,
      },
    };

    return json(200, response);
  } catch (err) {
    if (err instanceof ZodError) {
      return json(400, {
        error: {
          code: "validation_error",
          message: "Invalid query parameters.",
          details: err.flatten(),
        },
      });
    }
    return json(500, { error: { code: "internal_error", message: "Internal server error." } });
  }
};

export const POST: APIRoute = async (context) => {
  try {
    const userId = context.locals.user?.id;
    if (!userId || !isUuid(userId)) {
      return json(401, { error: { code: "unauthorized", message: "User is not authenticated." } });
    }

    let rawBody: unknown;
    try {
      rawBody = await context.request.json();
    } catch {
      return json(400, { error: { code: "invalid_json", message: "Request body must be valid JSON." } });
    }

    const parsed = createCardsSchema.parse(rawBody);
    const payload = Array.isArray(parsed) ? parsed : [parsed];
    const deckIds = Array.from(
      new Set(payload.map((card) => card.deck_id).filter((deckId): deckId is string => Boolean(deckId)))
    );

    const deckError = await assertDeckOwnership({ userId, deckIds, context });
    if (deckError) return deckError;

    const inserts = payload.map((card) => ({
      user_id: userId,
      question: card.question,
      answer: card.answer,
      context: card.context ?? null,
      deck_id: card.deck_id ?? null,
      tags: card.tags ?? [],
      difficulty: card.difficulty ?? 3,
      quality_status: "draft",
      is_manual_override: true,
    }));

    const { data, error } = await context.locals.supabase
      .from("cards")
      .insert(inserts)
      .select(
        "id, question, answer, context, difficulty, tags, quality_status, deck_id, source_id, created_at, updated_at"
      );

    if (error || !data) {
      return json(500, { error: { code: "card_create_failed", message: "Failed to create card." } });
    }

    return json(201, { data: payload.length === 1 ? (data[0] as CardDto) : (data as CardDto[]) });
  } catch (err) {
    if (err instanceof ZodError) {
      return json(400, {
        error: {
          code: "validation_error",
          message: "Invalid request body.",
          details: err.flatten(),
        },
      });
    }
    return json(500, { error: { code: "internal_error", message: "Internal server error." } });
  }
};
