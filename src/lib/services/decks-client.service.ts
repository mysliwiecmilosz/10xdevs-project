import type {
  DeckCreateCommand,
  DeckDto,
  ListDecksQuery,
  ListDecksResponseDto,
} from "@/types";

type ApiErrorPayload = {
  status: number;
  code?: string;
  message?: string;
  details?: unknown;
};

function toQueryString(query?: ListDecksQuery): string {
  if (!query) {
    return "";
  }

  const params = new URLSearchParams();
  if (typeof query.page === "number") params.set("page", String(query.page));
  if (typeof query.limit === "number") params.set("limit", String(query.limit));
  if (query.search) params.set("search", query.search);

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
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

export async function getDecks(
  query?: ListDecksQuery,
): Promise<ListDecksResponseDto> {
  const response = await fetch(`/api/decks${toQueryString(query)}`);

  if (response.ok) {
    return (await response.json()) as ListDecksResponseDto;
  }

  throw await parseError(response);
}

export async function createDeck(
  command: DeckCreateCommand,
): Promise<DeckDto> {
  const response = await fetch("/api/decks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });

  if (response.ok) {
    const payload = (await response.json()) as { data?: DeckDto } | DeckDto;
    const deck = "data" in payload ? payload.data : payload;
    if (!deck?.id) {
      throw { status: 500 };
    }
    return deck;
  }

  throw await parseError(response);
}
