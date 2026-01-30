import type { APIRoute } from "astro";
import { DEFAULT_USER_ID } from "../../../db/supabase.client.ts";

export const prerender = false;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const GET: APIRoute = async () => {
  const raw = DEFAULT_USER_ID ?? "";
  const configured = Boolean(raw && raw.trim() !== "" && raw.trim() !== "###");

  return json(200, {
    default_user_id: configured ? raw : null,
    configured,
    hint: configured
      ? null
      : "Set DEFAULT_USER_ID in .env to an existing public.profiles.id UUID (dev-only shortcut).",
  });
};

