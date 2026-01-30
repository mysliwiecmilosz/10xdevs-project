import type { CardDto, CardUpdateCommand } from "@/types";

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

export async function updateCard(cardId: string, command: CardUpdateCommand): Promise<CardDto> {
  const response = await fetch(`/api/cards/${cardId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });

  if (response.ok) {
    const payload = (await response.json()) as { data?: CardDto } | CardDto;
    const card = "data" in payload ? payload.data : payload;
    if (!card?.id) throw { status: 500 };
    return card;
  }

  throw await parseError(response);
}

export async function deleteCard(cardId: string): Promise<void> {
  const response = await fetch(`/api/cards/${cardId}`, { method: "DELETE" });

  if (response.ok) {
    return;
  }

  throw await parseError(response);
}

