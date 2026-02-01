import type { APIRoute } from "astro";

import { logAuthKpiEvent, signInDemo, toHttpError } from "../../../lib/services/auth.service.ts";

export const prerender = false;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async (context) => {
  try {
    const { userId } = await signInDemo({ supabase: context.locals.supabase });

    if (context.locals.supabaseAdmin) {
      await logAuthKpiEvent({
        supabaseAdmin: context.locals.supabaseAdmin,
        userId,
        event_type: "login",
        metadata: { method: "demo" },
      });
    }

    return json(201, { ok: true, role: "demo" });
  } catch (err) {
    const http = toHttpError(err);
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error("[/api/auth/demo] unhandled error", err);
    }
    return json(http.status, { error: { code: http.code, message: http.message } });
  }
};
