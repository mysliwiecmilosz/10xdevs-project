import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "@/components/auth/LoginForm";

describe("LoginForm", () => {
  it("shows validation messages on submit", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole("button", { name: "Zaloguj się" }));

    expect(screen.getByText("Email jest wymagany.")).toBeInTheDocument();
    expect(screen.getByText("Hasło jest wymagane.")).toBeInTheDocument();
  });

  it("submits normalized email and password", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<LoginForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Email"), "  TEST@Example.com ");
    await user.type(screen.getByLabelText("Hasło"), "password123");
    await user.click(screen.getByRole("button", { name: "Zaloguj się" }));

    expect(onSubmit).toHaveBeenCalledWith({ email: "test@example.com", password: "password123" });
  });
});
