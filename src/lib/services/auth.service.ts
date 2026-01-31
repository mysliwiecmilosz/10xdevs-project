import type { SupabaseClient } from "../../db/supabase.client.ts";
import type { Json } from "../../db/database.types.ts";

class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function mapSupabaseAuthError(err: unknown): HttpError {
  const status = Number((err as any)?.status ?? 400);
  const message = String((err as any)?.message ?? "Authentication failed.");

  if (status === 429) {
    return new HttpError(429, "rate_limited", "Too many attempts. Please try again later.");
  }

  // Supabase auth commonly returns this string for wrong email/password.
  if (/invalid login credentials/i.test(message)) {
    return new HttpError(401, "invalid_credentials", "Invalid email or password.");
  }

  // When email confirmation is enabled.
  if (/email not confirmed/i.test(message)) {
    return new HttpError(401, "email_not_confirmed", "Email not confirmed.");
  }
  if (/user already registered|already registered|user already exists/i.test(message)) {
    return new HttpError(409, "user_already_exists", "User already exists.");
  }
  if (/weak password|password should be at least|password is too weak/i.test(message)) {
    return new HttpError(422, "weak_password", "Password is too weak.");
  }
  if (/anonymous sign-ins are disabled/i.test(message)) {
    return new HttpError(422, "demo_disabled", "Anonymous sign-ins are disabled.");
  }

  return new HttpError(status >= 400 && status < 600 ? status : 400, "auth_error", message);
}

export function toHttpError(err: unknown): HttpError {
  if (err instanceof HttpError) return err;
  return new HttpError(500, "internal_error", "Internal server error.");
}

export async function signInWithPassword(params: {
  supabase: SupabaseClient;
  email: string;
  password: string;
}): Promise<{ userId: string }> {
  const { supabase, email, password } = params;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw mapSupabaseAuthError(error);
  if (!data.user?.id) throw new HttpError(500, "auth_missing_user", "Login succeeded but user is missing.");

  return { userId: data.user.id };
}

export async function signInDemo(params: { supabase: SupabaseClient }): Promise<{ userId: string }> {
  const { supabase } = params;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw mapSupabaseAuthError(error);
  if (!data.user?.id) throw new HttpError(500, "auth_missing_user", "Demo session created but user is missing.");
  return { userId: data.user.id };
}

export async function signUpWithPassword(params: {
  supabase: SupabaseClient;
  email: string;
  password: string;
  emailRedirectTo?: string;
}): Promise<{ userId: string; requiresEmailConfirmation: boolean }> {
  const { supabase, email, password, emailRedirectTo } = params;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: emailRedirectTo ? { emailRedirectTo } : undefined,
  });

  if (error) throw mapSupabaseAuthError(error);
  if (!data.user?.id) throw new HttpError(500, "auth_missing_user", "Signup succeeded but user is missing.");

  return { userId: data.user.id, requiresEmailConfirmation: !data.session };
}

export async function logAuthKpiEvent(params: {
  supabaseAdmin: SupabaseClient;
  userId: string;
  event_type: string;
  metadata: Json;
}): Promise<void> {
  const { supabaseAdmin, userId, event_type, metadata } = params;
  const { error } = await supabaseAdmin.from("kpi_events").insert({
    user_id: userId,
    event_type,
    metadata,
  });

  // KPI must never block the main flow.
  if (error && import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.error("[kpi_events] auth insert failed", error);
  }
}

