import type { CardDto, CardUpdateCommand, ListCardsQuery, ListCardsResponseDto } from "@/types";

interface ApiErrorPayload {
  status: number;
  code?: string;
  message?: string;
  details?: unknown;
}

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

export async function listCards(query: ListCardsQuery): Promise<ListCardsResponseDto> {
  const search = new URLSearchParams();
  if (query.page) search.set("page", String(query.page));
  if (query.limit) search.set("limit", String(query.limit));
  if (query.deck_id) search.set("deck_id", String(query.deck_id));
  if (query.source_id) search.set("source_id", String(query.source_id));
  if (query.quality_status) search.set("quality_status", query.quality_status);
  if (query.sort) search.set("sort", query.sort);
  if (query.tags && query.tags.length > 0) search.set("tags", query.tags.join(","));

  const qs = search.toString();
  const response = await fetch(qs ? `/api/cards?${qs}` : "/api/cards");

  if (response.ok) {
    const payload = (await response.json()) as ListCardsResponseDto;
    return payload;
  }

  throw await parseError(response);
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
