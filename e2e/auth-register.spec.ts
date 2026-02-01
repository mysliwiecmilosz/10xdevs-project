import { expect, test } from "@playwright/test";
import { AuthRegisterPage } from "./pages/AuthRegisterPage";

test.describe("auth/register", () => {
  test("renders register form", async ({ page }) => {
    const register = new AuthRegisterPage(page);
    await register.goto();

    await expect(register.heading).toBeVisible();
    await expect(register.emailInput).toBeVisible();
    await expect(register.passwordInput).toBeVisible();
    await expect(register.confirmInput).toBeVisible();
    await expect(register.submitButton).toBeVisible();
  });

  test("shows validation errors on submit", async ({ page }) => {
    const register = new AuthRegisterPage(page);
    await register.goto();

    await register.submitButton.click();

    await expect(page.getByText("Email jest wymagany.")).toBeVisible();
    await expect(page.getByText("Hasło jest wymagane.")).toBeVisible();
    await expect(page.getByText("Powtórz hasło.")).toBeVisible();
  });

  test("shows password mismatch error", async ({ page }) => {
    const register = new AuthRegisterPage(page);
    await register.goto();

    await register.emailInput.fill("test@example.com");
    await register.passwordInput.fill("password1");
    await register.confirmInput.fill("password2");
    await register.confirmInput.blur();

    await expect(page.getByText("Hasła muszą być takie same.")).toBeVisible();
  });
});
