import type { APIRoute } from "astro";
import { z, ZodError } from "zod";

import type { CardDto, CardQualityStatus } from "../../../types.ts";

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

const cardUpdateSchema = z
  .object({
    question: z.string().trim().min(1).max(2000).optional(),
    answer: z.string().trim().min(1).max(10_000).optional(),
    context: z.string().trim().max(10_000).nullable().optional(),
    difficulty: z.number().int().min(1).max(5).nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(50)).max(20).nullable().optional(),
    deck_id: z.string().uuid().nullable().optional(),
    quality_status: z.enum(["draft", "ok", "good"] satisfies CardQualityStatus[]).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field must be provided.",
  });

export const PATCH: APIRoute = async (context) => {
  try {
    const userId = context.locals.user?.id;
    if (!userId || !isUuid(userId)) {
      return json(401, { error: { code: "unauthorized", message: "User is not authenticated." } });
    }

    const cardId = context.params.card_id;
    if (!cardId || !isUuid(cardId)) {
      return json(400, { error: { code: "validation_error", message: "Invalid card_id." } });
    }

    let rawBody: unknown;
    try {
      rawBody = await context.request.json();
    } catch {
      return json(400, { error: { code: "invalid_json", message: "Request body must be valid JSON." } });
    }

    const parsed = cardUpdateSchema.parse(rawBody);

    const { data, error } = await context.locals.supabase
      .from("cards")
      .update(parsed)
      .eq("id", cardId)
      .eq("user_id", userId)
      .select(
        "id, question, answer, context, difficulty, tags, quality_status, deck_id, source_id, created_at, updated_at"
      )
      .maybeSingle();

    if (error) {
      return json(500, { error: { code: "card_update_failed", message: "Failed to update card." } });
    }
    if (!data) {
      return json(404, { error: { code: "card_not_found", message: "Card not found." } });
    }

    return json(200, { data: data as unknown as CardDto });
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

export const DELETE: APIRoute = async (context) => {
  try {
    const userId = context.locals.user?.id;
    if (!userId || !isUuid(userId)) {
      return json(401, { error: { code: "unauthorized", message: "User is not authenticated." } });
    }

    const cardId = context.params.card_id;
    if (!cardId || !isUuid(cardId)) {
      return json(400, { error: { code: "validation_error", message: "Invalid card_id." } });
    }

    const { error } = await context.locals.supabase.from("cards").delete().eq("id", cardId).eq("user_id", userId);

    if (error) {
      return json(500, { error: { code: "card_delete_failed", message: "Failed to delete card." } });
    }

    return json(200, { ok: true });
  } catch {
    return json(500, { error: { code: "internal_error", message: "Internal server error." } });
  }
};
