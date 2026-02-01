import type { APIRoute } from "astro";

import { toHttpError } from "../../../lib/services/auth.service.ts";

export const prerender = false;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async (context) => {
  try {
    const { error } = await context.locals.supabase.auth.signOut();
    if (error) {
      throw error;
    }

    return context.redirect("/auth/login", 303);
  } catch (err) {
    const http = toHttpError(err);
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error("[/api/auth/logout] unhandled error", err);
    }
    return json(http.status, { error: { code: http.code, message: http.message } });
  }
};
