import { http, HttpResponse } from "msw";
import type { ListDecksResponseDto } from "@/types";

export const handlers = [
  http.get("/api/decks", () => {
    const response: ListDecksResponseDto = {
      data: [],
      meta: { total: 0, page: 1, limit: 20 },
    };

    return HttpResponse.json(response, { status: 200 });
  }),
];
