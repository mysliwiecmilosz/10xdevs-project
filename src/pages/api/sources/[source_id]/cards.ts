import type { APIRoute } from "astro";
import { z, ZodError } from "zod";

import type { CardDto, ListCardsResponseDto } from "../../../../types.ts";

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
});

export const GET: APIRoute = async (context) => {
  try {
    const userId = context.locals.user?.id;
    if (!userId || !isUuid(userId)) {
      return json(401, { error: { code: "unauthorized", message: "User is not authenticated." } });
    }

    const sourceId = context.params.source_id;
    if (!sourceId || !isUuid(sourceId)) {
      return json(400, { error: { code: "validation_error", message: "Invalid source_id." } });
    }

    const parsed = listCardsQuerySchema.parse(Object.fromEntries(new URL(context.request.url).searchParams.entries()));
    const page = parsed.page;
    const limit = parsed.limit;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await context.locals.supabase
      .from("cards")
      .select(
        "id, question, answer, context, difficulty, tags, quality_status, deck_id, source_id, created_at, updated_at",
        { count: "exact" }
      )
      .eq("user_id", userId)
      .eq("source_id", sourceId)
      .order("created_at", { ascending: true })
      .range(from, to);

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
