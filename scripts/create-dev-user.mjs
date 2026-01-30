import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

function getSupabaseStatus() {
  const raw = execSync("npx supabase status --output json", {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
  return JSON.parse(raw);
}

function pick(obj, key) {
  if (!obj || typeof obj !== "object") return undefined;
  return obj[key];
}

const status = getSupabaseStatus();
const apiUrl = pick(status, "API_URL");
const anonKey = pick(status, "ANON_KEY");
const serviceRoleKey = pick(status, "SERVICE_ROLE_KEY");

if (!apiUrl || !anonKey || !serviceRoleKey) {
  console.error("Missing API_URL / ANON_KEY / SERVICE_ROLE_KEY from `supabase status`.");
  process.exit(1);
}

const supabaseAnon = createClient(apiUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const supabaseService = createClient(apiUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const email = `dev+${Date.now()}@example.com`;
const password = "dev-password-123!";

// Create an auth user via public sign-up (works in local dev).
const { data, error } = await supabaseAnon.auth.signUp({ email, password });

if (error) {
  console.error(JSON.stringify(error));
  process.exit(2);
}

const userId = data.user?.id;
if (!userId) {
  console.error("Failed to create user (missing id).");
  process.exit(3);
}

// Ensure a matching profile exists (FKs from other tables depend on it).
const { error: profileErr } = await supabaseService.from("profiles").upsert(
  {
    id: userId,
    email,
    account_role: "demo",
  },
  { onConflict: "id" },
);

if (profileErr) {
  console.error(JSON.stringify(profileErr));
  process.exit(4);
}

// Print only the user id (so it can be copied into DEFAULT_USER_ID).
process.stdout.write(userId);

