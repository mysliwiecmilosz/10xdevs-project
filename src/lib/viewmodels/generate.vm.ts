export type GenerateRequestStatus = "idle" | "loading" | "success" | "error";

export interface GenerateApiErrorVm {
  status?: number;
  code?: string;
  message: string;
  debugDetails?: unknown;
}

export interface GenerateValidationVm {
  content?: { code: "too_short" | "too_long"; message: string } | null;
}

export interface GenerateLimitsVm {
  remainingGenerations?: number;
  isGenerationBlocked: boolean;
  reason?: "limit_reached" | "unknown";
}

export interface DeckOptionVm {
  value: string | null;
  label: string;
  description?: string;
}

export interface GenerateFormVm {
  content: string;
  contentCount: number;
  deckId: string | null;
  touched: { content: boolean };
  validation: GenerateValidationVm;
}

export interface GenerateRequestStateVm {
  status: GenerateRequestStatus;
  lastResponse?: { sourceId: string; remainingGenerations: number };
}
