import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { getCardsBySourceId } from "@/lib/services/source-cards-client.service";

describe("source-cards-client.service", () => {
  it("returns cards list for source id", async () => {
    server.use(
      http.get("/api/sources/:sourceId/cards", () => {
        return HttpResponse.json(
          {
            data: [
              {
                id: "card-1",
                question: "Q?",
                answer: "A",
                context: null,
                difficulty: 3,
                tags: [],
                quality_status: "draft",
                deck_id: null,
                source_id: "source-1",
                created_at: "2026-01-31T00:00:00.000Z",
                updated_at: "2026-01-31T00:00:00.000Z",
              },
            ],
            meta: { total: 1, page: 1, limit: 200 },
          },
          { status: 200 }
        );
      })
    );

    const cards = await getCardsBySourceId("source-1");

    expect(cards).toHaveLength(1);
    expect(cards[0]?.id).toBe("card-1");
  });

  it("throws parsed error payload on failure", async () => {
    server.use(
      http.get("/api/sources/:sourceId/cards", () => {
        return HttpResponse.json({ error: { status: 403, code: "forbidden", message: "No access" } }, { status: 403 });
      })
    );

    await expect(getCardsBySourceId("source-1")).rejects.toMatchObject({
      status: 403,
      code: "forbidden",
      message: "No access",
    });
  });
});
