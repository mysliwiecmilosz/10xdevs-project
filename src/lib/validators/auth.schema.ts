import { z } from "zod";

export const loginCommandSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
});

export type LoginCommand = z.infer<typeof loginCommandSchema>;

export const registerCommandSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
});

export type RegisterCommand = z.infer<typeof registerCommandSchema>;
