import type { APIRoute } from "astro";
import { ZodError } from "zod";

import { registerCommandSchema } from "../../../lib/validators/auth.schema.ts";
import { logAuthKpiEvent, signUpWithPassword, toHttpError } from "../../../lib/services/auth.service.ts";

export const prerender = false;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async (context) => {
  try {
    let rawBody: unknown;
    try {
      rawBody = await context.request.json();
    } catch {
      return json(400, { error: { code: "invalid_json", message: "Request body must be valid JSON." } });
    }

    const parsed = registerCommandSchema.parse(rawBody);
    const emailRedirectTo = new URL("/auth/callback", context.url).toString();

    const { userId, requiresEmailConfirmation } = await signUpWithPassword({
      supabase: context.locals.supabase,
      email: parsed.email,
      password: parsed.password,
      emailRedirectTo,
    });

    if (context.locals.supabaseAdmin) {
      await logAuthKpiEvent({
        supabaseAdmin: context.locals.supabaseAdmin,
        userId,
        event_type: "signup",
        metadata: { method: "password", requiresEmailConfirmation },
      });
    }

    return json(201, { ok: true, requiresEmailConfirmation });
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

    const http = toHttpError(err);
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error("[/api/auth/register] unhandled error", err);

      const extra =
        (http as any)?.details ??
        (err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : { value: String(err) });
      return json(http.status, { error: { code: http.code, message: http.message, details: extra } });
    }

    return json(http.status, { error: { code: http.code, message: http.message } });
  }
};
