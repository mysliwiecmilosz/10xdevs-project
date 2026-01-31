import { describe, expect, it } from "vitest";
import { loginCommandSchema, registerCommandSchema } from "@/lib/validators/auth.schema";

describe("auth schemas", () => {
  it("normalizes email and validates password length for login", () => {
    const parsed = loginCommandSchema.parse({
      email: "  TEST@Example.com ",
      password: "password123",
    });

    expect(parsed).toEqual({ email: "test@example.com", password: "password123" });
  });

  it("normalizes email and validates password length for register", () => {
    const parsed = registerCommandSchema.parse({
      email: "  USER@Example.com ",
      password: "password123",
    });

    expect(parsed).toEqual({ email: "user@example.com", password: "password123" });
  });

  it("rejects invalid email", () => {
    const login = loginCommandSchema.safeParse({ email: "not-an-email", password: "password123" });
    const register = registerCommandSchema.safeParse({ email: "nope", password: "password123" });

    expect(login.success).toBe(false);
    expect(register.success).toBe(false);
  });

  it("rejects short password", () => {
    const login = loginCommandSchema.safeParse({ email: "user@example.com", password: "short" });
    const register = registerCommandSchema.safeParse({ email: "user@example.com", password: "short" });

    expect(login.success).toBe(false);
    expect(register.success).toBe(false);
  });
});
