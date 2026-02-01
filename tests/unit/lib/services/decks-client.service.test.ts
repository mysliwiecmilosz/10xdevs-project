import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { getDecks } from "@/lib/services/decks-client.service";

describe("decks-client.service", () => {
  it("returns decks list", async () => {
    server.use(
      http.get("/api/decks", () => {
        return HttpResponse.json(
          {
            data: [
              {
                id: "deck-1",
                name: "My deck",
                description: null,
                created_at: "2026-01-31T00:00:00.000Z",
              },
            ],
            meta: { total: 1, page: 1, limit: 20 },
          },
          { status: 200 }
        );
      })
    );

    const res = await getDecks({ page: 1, limit: 20 });

    expect(res).toMatchInlineSnapshot(`
      {
        "data": [
          {
            "created_at": "2026-01-31T00:00:00.000Z",
            "description": null,
            "id": "deck-1",
            "name": "My deck",
          },
        ],
        "meta": {
          "limit": 20,
          "page": 1,
          "total": 1,
        },
      }
    `);
  });

  it("throws parsed error payload on failure", async () => {
    server.use(
      http.get("/api/decks", () => {
        return HttpResponse.json({ error: { status: 500, code: "internal", message: "Boom" } }, { status: 500 });
      })
    );

    await expect(getDecks()).rejects.toMatchObject({ status: 500, code: "internal", message: "Boom" });
  });
});
