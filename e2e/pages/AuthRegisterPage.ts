import type { Locator, Page } from "@playwright/test";

export class AuthRegisterPage {
  readonly page: Page;

  readonly heading: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: "Załóż konto" });
    this.emailInput = page.getByLabel("Email");
    this.passwordInput = page.getByLabel("Hasło", { exact: true });
    this.confirmInput = page.getByLabel("Powtórz hasło");
    this.submitButton = page.getByRole("button", { name: "Załóż konto" });
  }

  async goto() {
    await this.page.goto("/auth/register");
    await this.page.waitForLoadState("networkidle");
    await this.page.waitForTimeout(200);
  }
}
