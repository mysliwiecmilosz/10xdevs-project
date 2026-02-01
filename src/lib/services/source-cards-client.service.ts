import type { CardDto, ListCardsResponseDto } from "@/types";

type ApiErrorPayload = {
  status: number;
  code?: string;
  message?: string;
  details?: unknown;
};

async function parseError(response: Response): Promise<ApiErrorPayload> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const errorPayload = payload as { error?: ApiErrorPayload } | null;
  return {
    status: response.status,
    code: errorPayload?.error?.code,
    message: errorPayload?.error?.message,
    details: errorPayload?.error?.details,
  };
}

export async function getCardsBySourceId(sourceId: string): Promise<CardDto[]> {
  const response = await fetch(`/api/sources/${sourceId}/cards`);

  if (response.ok) {
    const payload = (await response.json()) as ListCardsResponseDto;
    return payload.data ?? [];
  }

  throw await parseError(response);
}
