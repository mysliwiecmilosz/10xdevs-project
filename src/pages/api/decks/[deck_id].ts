import type { APIRoute } from "astro";
import { z, ZodError } from "zod";

import type { DeckDto } from "../../../types.ts";

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

const updateDeckSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
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

    const deckId = context.params.deck_id;
    if (!deckId || !isUuid(deckId)) {
      return json(400, { error: { code: "validation_error", message: "Invalid deck_id." } });
    }

    let rawBody: unknown;
    try {
      rawBody = await context.request.json();
    } catch {
      return json(400, { error: { code: "invalid_json", message: "Request body must be valid JSON." } });
    }

    const parsed = updateDeckSchema.parse(rawBody);
    const description = parsed.description?.trim() ? parsed.description.trim() : (parsed.description ?? null);

    const { data, error } = await context.locals.supabase
      .from("decks")
      .update({
        ...parsed,
        description,
      })
      .eq("id", deckId)
      .eq("user_id", userId)
      .select("id,name,description,created_at")
      .maybeSingle();

    if (error) {
      return json(500, { error: { code: "deck_update_failed", message: "Failed to update deck." } });
    }
    if (!data) {
      return json(404, { error: { code: "deck_not_found", message: "Deck not found." } });
    }

    return json(200, { data: data as DeckDto });
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

    const deckId = context.params.deck_id;
    if (!deckId || !isUuid(deckId)) {
      return json(400, { error: { code: "validation_error", message: "Invalid deck_id." } });
    }

    const { data, error } = await context.locals.supabase
      .from("decks")
      .delete()
      .eq("id", deckId)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();

    if (error) {
      return json(500, { error: { code: "deck_delete_failed", message: "Failed to delete deck." } });
    }
    if (!data) {
      return json(404, { error: { code: "deck_not_found", message: "Deck not found." } });
    }

    return json(200, { ok: true });
  } catch {
    return json(500, { error: { code: "internal_error", message: "Internal server error." } });
  }
};
