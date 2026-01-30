import type { APIRoute } from "astro";
import { z, ZodError } from "zod";

import { DEFAULT_USER_ID } from "../../../db/supabase.client.ts";

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

function utcDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

const resetUsageSchema = z
  .object({
    // If true: delete all rows for DEFAULT_USER_ID. Otherwise only for `date`.
    all: z.boolean().optional(),
    // YYYY-MM-DD (UTC). If omitted and all=false, defaults to today.
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .optional();

// DEV-ONLY helper endpoint to reset daily generation usage.
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

    let rawBody: unknown = undefined;
    if (context.request.headers.get("content-type")?.includes("application/json")) {
      try {
        rawBody = await context.request.json();
      } catch {
        return json(400, { error: { code: "invalid_json", message: "Request body must be valid JSON." } });
      }
    }

    const parsed = resetUsageSchema.parse(rawBody);
    const resetAll = parsed?.all === true;
    const date = parsed?.date ?? utcDateKey();

    const query = context.locals.supabase.from("user_usage_stats").delete().eq("user_id", userId);
    const { error } = resetAll ? await query : await query.eq("date", date);

    if (error) {
      return json(500, { error: { code: "reset_failed", message: "Failed to reset usage stats." } });
    }

    return json(200, { ok: true, user_id: userId, reset: resetAll ? "all" : "date", date: resetAll ? null : date });
  } catch (err) {
    if (err instanceof ZodError) {
      return json(400, {
        error: { code: "validation_error", message: "Invalid request body.", details: err.flatten() },
      });
    }
    return json(500, { error: { code: "internal_error", message: "Internal server error." } });
  }
};

