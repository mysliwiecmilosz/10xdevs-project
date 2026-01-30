import type { APIRoute } from "astro";
import { ZodError } from "zod";

import { generateCardsCommandSchema } from "../../../lib/validators/ai-generate.schema.ts";
import { generateCardsPipeline, toHttpError } from "../../../lib/services/ai-generation.service.ts";
import type { AccountRole, GenerateCardsResponseDto } from "../../../types.ts";
import { DEFAULT_USER_ID } from "../../../db/supabase.client.ts";

export const prerender = false;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isUuid(value: string): boolean {
  // Simple UUID v4-ish check; good enough for env guardrails.
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export const POST: APIRoute = async (context) => {
  try {
    let rawBody: unknown;
    try {
      rawBody = await context.request.json();
    } catch {
      return json(400, { error: { code: "invalid_json", message: "Request body must be valid JSON." } });
    }

    const parsed = generateCardsCommandSchema.parse(rawBody);

    // TEMP: auth will be handled later; for now we always use DEFAULT_USER_ID.
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
    const role: AccountRole = "demo";

    const result: GenerateCardsResponseDto = await generateCardsPipeline({
      supabase: context.locals.supabase,
      userId,
      role,
      content: parsed.content,
      deckId: parsed.deck_id,
    });

    return json(201, result);
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

    // DEV: log the original error for fast debugging.
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error("[/api/ai/generate] unhandled error", err);
    }

    const http = toHttpError(err);
    // DEV: include extra details (safe for local debugging).
    if (import.meta.env.DEV) {
      const extra =
        (http as any)?.details ??
        (err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : { value: String(err) });
      return json(http.status, { error: { code: http.code, message: http.message, details: extra } });
    }

    return json(http.status, { error: { code: http.code, message: http.message } });
  }
};

