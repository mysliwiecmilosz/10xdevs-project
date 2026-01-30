import { z } from "zod";

// Shared schema for POST /api/ai/generate
export const generateCardsCommandSchema = z.object({
  content: z.string().min(50).max(100_000),
  deck_id: z.string().uuid().optional(),
});

export type GenerateCardsCommandInput = z.infer<typeof generateCardsCommandSchema>;

