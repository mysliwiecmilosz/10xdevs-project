import { expect, test } from "@playwright/test";
import { AuthLoginPage } from "./pages/AuthLoginPage";

test.describe("auth/login", () => {
  test("renders login form", async ({ page }) => {
    const login = new AuthLoginPage(page);
    await login.goto();

    await expect(login.heading).toBeVisible();
    await expect(login.emailInput).toBeVisible();
    await expect(login.passwordInput).toBeVisible();
    await expect(login.submitButton).toBeVisible();
    await expect(login.demoButton).toBeVisible();
  });
});

