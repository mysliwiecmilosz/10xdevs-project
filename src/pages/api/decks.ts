import type { APIRoute } from "astro";
import { z, ZodError } from "zod";

import { DEFAULT_USER_ID } from "../../db/supabase.client.ts";
import type { DeckDto, ListDecksResponseDto } from "../../types.ts";

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

const listDecksQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 1))
    .pipe(z.number().int().min(1)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 50))
    .pipe(z.number().int().min(1).max(100)),
  search: z.string().optional(),
});

const createDeckSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
});

export const GET: APIRoute = async (context) => {
  try {
    const userId = DEFAULT_USER_ID;
    if (!userId || userId.trim() === "###" || !isUuid(userId)) {
      return json(500, {
        error: {
          code: "default_user_not_configured",
          message:
            "DEFAULT_USER_ID is not configured. Set DEFAULT_USER_ID to an existing public.profiles.id UUID.",
        },
      });
    }

    const parsed = listDecksQuerySchema.parse(
      Object.fromEntries(new URL(context.request.url).searchParams.entries()),
    );
    const page = parsed.page;
    const limit = parsed.limit;
    const search = parsed.search?.trim();
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = context.locals.supabase
      .from("decks")
      .select("id,name,description,created_at", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (search) {
      // Search in name/description (simple ilike match).
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      return json(500, { error: { code: "decks_list_failed", message: "Failed to list decks." } });
    }

    const response: ListDecksResponseDto = {
      data: (data ?? []) as DeckDto[],
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
    const userId = DEFAULT_USER_ID;
    if (!userId || userId.trim() === "###" || !isUuid(userId)) {
      return json(500, {
        error: {
          code: "default_user_not_configured",
          message:
            "DEFAULT_USER_ID is not configured. Set DEFAULT_USER_ID to an existing public.profiles.id UUID.",
        },
      });
    }

    let rawBody: unknown;
    try {
      rawBody = await context.request.json();
    } catch {
      return json(400, { error: { code: "invalid_json", message: "Request body must be valid JSON." } });
    }

    const parsed = createDeckSchema.parse(rawBody);
    const description = parsed.description?.trim() ? parsed.description.trim() : null;

    const { data, error } = await context.locals.supabase
      .from("decks")
      .insert({
        user_id: userId,
        name: parsed.name,
        description,
      })
      .select("id,name,description,created_at")
      .single();

    if (error || !data) {
      return json(500, { error: { code: "deck_create_failed", message: "Failed to create deck." } });
    }

    return json(201, { data: data as DeckDto });
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

