import { z } from "zod";
import type { OpenRouterJsonSchemaResponseFormat, OpenRouterStructuredSchema } from "../services/openrouter.service.ts";

export const chatReplyV1Zod = z.object({
  answer: z.string(),
  followUps: z.array(z.string()),
  safety: z.object({
    flagged: z.boolean(),
    reason: z.string(),
  }),
});

export type ChatReplyV1 = z.infer<typeof chatReplyV1Zod>;

export const chatReplyV1ResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "chat_reply_v1",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        answer: { type: "string", description: "Odpowiedź asystenta dla użytkownika." },
        followUps: {
          type: "array",
          description: "Proponowane kolejne pytania użytkownika.",
          items: { type: "string" },
        },
        safety: {
          type: "object",
          additionalProperties: false,
          properties: {
            flagged: { type: "boolean", description: "Czy odpowiedź dotyczyła treści ryzykownych." },
            reason: { type: "string", description: "Powód flagi (jeśli flagged=true)." },
          },
          required: ["flagged", "reason"],
        },
      },
      required: ["answer", "followUps", "safety"],
    },
  },
} as const satisfies OpenRouterJsonSchemaResponseFormat;

export const chatReplyV1StructuredSchema: OpenRouterStructuredSchema<ChatReplyV1> = {
  response_format: chatReplyV1ResponseFormat,
  parse: (value) => chatReplyV1Zod.parse(value),
};
