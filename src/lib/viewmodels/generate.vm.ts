export type GenerateRequestStatus = "idle" | "loading" | "success" | "error";

export type GenerateApiErrorVm = {
  status?: number;
  code?: string;
  message: string;
  debugDetails?: unknown;
};

export type GenerateValidationVm = {
  content?: { code: "too_short" | "too_long"; message: string } | null;
};

export type GenerateLimitsVm = {
  remainingGenerations?: number;
  isGenerationBlocked: boolean;
  reason?: "limit_reached" | "unknown";
};

export type DeckOptionVm = {
  value: string | null;
  label: string;
  description?: string;
};

export type GenerateFormVm = {
  content: string;
  contentCount: number;
  deckId: string | null;
  touched: { content: boolean };
  validation: GenerateValidationVm;
};

export type GenerateRequestStateVm = {
  status: GenerateRequestStatus;
  lastResponse?: { sourceId: string; remainingGenerations: number };
};
