import type { AccountRole } from "../../types.ts";

export const DAILY_GENERATION_LIMITS: Record<AccountRole, number> = {
  demo: 1,
  full: 5,
};

export function getDailyGenerationLimit(role: AccountRole): number {
  // Dev ergonomics: allow quick iteration without constantly hitting the daily limit.
  // In production, keep strict business limits.
  if (import.meta.env.DEV) {
    return 50;
  }
  return DAILY_GENERATION_LIMITS[role];
}

