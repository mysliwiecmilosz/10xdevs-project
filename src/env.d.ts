/// <reference types="astro/client" />

import type { SupabaseClient } from './db/supabase.client.ts';

declare global {
  namespace App {
    interface Locals {
      supabase: SupabaseClient;
      supabaseAdmin?: SupabaseClient;
      user?: {
        id: string;
        email?: string | null;
      };
    }
  }
}

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  readonly SUPABASE_URL: string;
  readonly SUPABASE_KEY: string;
  readonly SUPABASE_SERVICE_ROLE_KEY: string;
  readonly OPENROUTER_API_KEY: string;
  readonly OPENROUTER_DEFAULT_MODEL: string;
  readonly OPENROUTER_HTTP_REFERER: string;
  readonly OPENROUTER_X_TITLE: string;
  readonly OPENROUTER_TIMEOUT_MS: string;
  readonly DEFAULT_USER_ID: string;
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
