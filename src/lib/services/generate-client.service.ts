import type { GenerateCardsCommand, GenerateCardsResponseDto } from "@/types";

interface GenerateClientError {
  status: number;
  code?: string;
  message?: string;
  details?: unknown;
}

export async function postGenerateCards(command: GenerateCardsCommand): Promise<GenerateCardsResponseDto> {
  const response = await fetch("/api/ai/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });

  if (response.ok) {
    return (await response.json()) as GenerateCardsResponseDto;
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const errorPayload = payload as { error?: GenerateClientError } | null;
  const apiError: GenerateClientError = {
    status: response.status,
    code: errorPayload?.error?.code,
    message: errorPayload?.error?.message,
    details: errorPayload?.error?.details,
  };

  throw apiError;
}
