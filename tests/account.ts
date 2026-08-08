import type { Page } from "@playwright/test";

const PASSWORD = "screening room 1962";

export function uniqueEmail(role: string): string {
  return `filmates-${role}-${Date.now()}-${Math.round(Math.random() * 1e6)}@example.test`;
}

export async function signUp(page: Page, name: string, email: string): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "I need an account" }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
}
