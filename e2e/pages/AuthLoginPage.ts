import type { Locator, Page } from "@playwright/test";

export class AuthLoginPage {
  readonly page: Page;

  readonly heading: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly demoButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: "Zaloguj się" });
    this.emailInput = page.getByLabel("Email");
    this.passwordInput = page.getByLabel("Hasło");
    this.submitButton = page.getByRole("button", { name: "Zaloguj się" });
    this.demoButton = page.getByRole("button", { name: "Kontynuuj jako demo" });
  }

  async goto() {
    await this.page.goto("/auth/login");
    await this.page.waitForLoadState("networkidle");
    await this.page.waitForTimeout(200);
  }
}
