import { describe, expect, it } from "vitest";
import { generateCardsCommandSchema } from "@/lib/validators/ai-generate.schema";

describe("generateCardsCommandSchema", () => {
  it("accepts valid content and optional deck_id", () => {
    const content = "a".repeat(50);
    const parsed = generateCardsCommandSchema.parse({ content });

    expect(parsed).toEqual({ content });
  });

  it("accepts a valid UUID deck_id", () => {
    const content = "b".repeat(50);
    const parsed = generateCardsCommandSchema.parse({
      content,
      deck_id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    });

    expect(parsed.deck_id).toBe("3fa85f64-5717-4562-b3fc-2c963f66afa6");
  });

  it("rejects content shorter than 50 chars", () => {
    const result = generateCardsCommandSchema.safeParse({ content: "x".repeat(49) });

    expect(result.success).toBe(false);
  });

  it("rejects content longer than 100000 chars", () => {
    const result = generateCardsCommandSchema.safeParse({ content: "x".repeat(100_001) });

    expect(result.success).toBe(false);
  });

  it("rejects invalid deck_id", () => {
    const result = generateCardsCommandSchema.safeParse({
      content: "c".repeat(50),
      deck_id: "not-a-uuid",
    });

    expect(result.success).toBe(false);
  });
});
