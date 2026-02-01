import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { deleteCard, listCards, updateCard } from "@/lib/services/cards-client.service";

describe("cards-client.service", () => {
  it("returns list cards payload", async () => {
    server.use(
      http.get("/api/cards", () => {
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
                source_id: null,
                created_at: "2026-01-31T00:00:00.000Z",
                updated_at: "2026-01-31T00:00:00.000Z",
              },
            ],
            meta: { total: 1, page: 1, limit: 24 },
          },
          { status: 200 }
        );
      })
    );

    const res = await listCards({ page: 1, limit: 24, sort: "created_at_desc" });
    expect(res.data).toHaveLength(1);
    expect(res.meta.total).toBe(1);
    expect(res.data[0]?.id).toBe("card-1");
  });

  it("returns updated card payload", async () => {
    server.use(
      http.patch("/api/cards/:cardId", () => {
        return HttpResponse.json(
          {
            data: {
              id: "card-1",
              question: "Q?",
              answer: "A",
              context: null,
              difficulty: 3,
              tags: [],
              quality_status: "draft",
              deck_id: null,
              source_id: null,
              created_at: "2026-01-31T00:00:00.000Z",
              updated_at: "2026-01-31T00:00:00.000Z",
            },
          },
          { status: 200 }
        );
      })
    );

    const card = await updateCard("card-1", { question: "Q?" });

    expect(card.id).toBe("card-1");
    expect(card.question).toBe("Q?");
  });

  it("throws parsed error payload on update failure", async () => {
    server.use(
      http.patch("/api/cards/:cardId", () => {
        return HttpResponse.json(
          { error: { status: 500, code: "card_update_failed", message: "Boom" } },
          { status: 500 }
        );
      })
    );

    await expect(updateCard("card-1", { question: "Q?" })).rejects.toMatchObject({
      status: 500,
      code: "card_update_failed",
      message: "Boom",
    });
  });

  it("deletes card successfully", async () => {
    server.use(
      http.delete("/api/cards/:cardId", () => {
        return HttpResponse.json({ ok: true }, { status: 200 });
      })
    );

    await expect(deleteCard("card-1")).resolves.toBeUndefined();
  });

  it("throws parsed error payload on delete failure", async () => {
    server.use(
      http.delete("/api/cards/:cardId", () => {
        return HttpResponse.json(
          { error: { status: 404, code: "card_not_found", message: "Missing" } },
          { status: 404 }
        );
      })
    );

    await expect(deleteCard("card-1")).rejects.toMatchObject({
      status: 404,
      code: "card_not_found",
      message: "Missing",
    });
  });
});
