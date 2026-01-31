import { defineMiddleware } from "astro:middleware";

import { createSupabaseServerInstance, supabaseAdminClient } from "../db/supabase.client.ts";

const PUBLIC_PATHS = [
  "/",
  "/auth/login",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/update-password",
  "/auth/callback",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/logout",
  "/api/auth/demo",
];

export const onRequest = defineMiddleware(async ({ locals, cookies, url, request, redirect }, next) => {
  // Admin client is always available for backend-only operations.
  locals.supabaseAdmin = supabaseAdminClient;

  // Request-scoped client uses SSR cookies (httpOnly) to manage sessions.
  const supabase = createSupabaseServerInstance({
    cookies,
    headers: request.headers,
  });
  locals.supabase = supabase;

  // Let public paths render without enforcing auth.
  if (PUBLIC_PATHS.includes(url.pathname)) {
    return next();
  }

  // IMPORTANT: Always get user session first before any other operations.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/auth/login");
  }

  locals.user = { id: user.id, email: user.email };
  return next();
});
