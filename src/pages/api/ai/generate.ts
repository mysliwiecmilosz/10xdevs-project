import type { APIRoute } from "astro";
import { ZodError } from "zod";

import { generateCardsCommandSchema } from "../../../lib/validators/ai-generate.schema.ts";
import { generateCardsPipeline, toHttpError } from "../../../lib/services/ai-generation.service.ts";
import type { AccountRole, GenerateCardsResponseDto } from "../../../types.ts";

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

    const userId = context.locals.user?.id;
    if (!userId || !isUuid(userId)) {
      return json(401, { error: { code: "unauthorized", message: "User is not authenticated." } });
    }

    const { data: profile, error: profileError } = await context.locals.supabase
      .from("profiles")
      .select("account_role")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      return json(500, { error: { code: "profile_lookup_failed", message: "Failed to load user profile." } });
    }

    const role = (profile?.account_role ?? "demo") as AccountRole;

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
