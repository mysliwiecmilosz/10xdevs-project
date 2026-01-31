import type { AstroCookies } from "astro";
import { createServerClient, type CookieOptionsWithName } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient as SupabaseJsClient } from "@supabase/supabase-js";

import type { Database } from "../db/database.types.ts";

const supabaseUrl = import.meta.env.SUPABASE_URL ?? import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_KEY ?? import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("SUPABASE_URL is not configured.");
}
if (!supabaseAnonKey) {
  throw new Error("SUPABASE_KEY (anon) is not configured.");
}

export const cookieOptions: CookieOptionsWithName = {
  path: "/",
  secure: import.meta.env.PROD,
  httpOnly: true,
  sameSite: "lax",
};

function parseCookieHeader(cookieHeader: string): { name: string; value: string }[] {
  return cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .filter(Boolean)
    .map((cookie) => {
      const [name, ...rest] = cookie.split("=");
      return { name, value: rest.join("=") };
    });
}

export function createSupabaseServerInstance(context: { headers: Headers; cookies: AstroCookies }) {
  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookieOptions,
    cookies: {
      // Project rule: use ONLY getAll + setAll.
      getAll() {
        return parseCookieHeader(context.headers.get("Cookie") ?? "");
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          context.cookies.set(name, value, options);
        });
      },
    },
  });
}

// Admin client (service role) for backend-only operations. This client bypasses RLS.
// NOTE: Never expose it to the browser.
export const supabaseAdminClient = createClient<Database>(supabaseUrl, supabaseServiceRoleKey ?? supabaseAnonKey);

// Backwards-compatible export used by existing API routes and middleware.
export const supabaseClient = supabaseAdminClient;

// Project rule: use SupabaseClient type from this module, not from '@supabase/supabase-js'.
export type SupabaseClient = SupabaseJsClient<Database>;

// Temporary default user for early-stage API development (auth will be added later).
// NOTE: Must be a valid UUID of an existing user/profile in the DB to satisfy FK constraints.
export const DEFAULT_USER_ID = import.meta.env.DEFAULT_USER_ID;
