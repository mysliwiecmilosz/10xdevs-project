import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient as SupabaseJsClient } from '@supabase/supabase-js';

import type { Database } from '../db/database.types.ts';

// Server-side client (used in middleware -> context.locals.supabase for API routes).
// Prefer service role to bypass RLS for backend-only operations (limits, KPI, etc.).
const supabaseUrl =
  import.meta.env.SUPABASE_URL ??
  process.env.SUPABASE_URL ??
  import.meta.env.PUBLIC_SUPABASE_URL ??
  process.env.PUBLIC_SUPABASE_URL;
const supabaseKey =
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  import.meta.env.SUPABASE_KEY ??
  process.env.SUPABASE_KEY ??
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY ??
  process.env.PUBLIC_SUPABASE_ANON_KEY;

export const supabaseClient = createClient<Database>(supabaseUrl, supabaseKey);

// Project rule: use SupabaseClient type from this module, not from '@supabase/supabase-js'.
export type SupabaseClient = SupabaseJsClient<Database>;

// Temporary default user for early-stage API development (auth will be added later).
// NOTE: Must be a valid UUID of an existing user/profile in the DB to satisfy FK constraints.
export const DEFAULT_USER_ID = import.meta.env.DEFAULT_USER_ID ?? process.env.DEFAULT_USER_ID;
