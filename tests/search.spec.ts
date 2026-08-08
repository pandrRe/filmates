import { expect, test, type Page } from "@playwright/test";
import { signUp, uniqueEmail } from "./account";

async function addFilm(page: Page, title: string, result: string): Promise<void> {
  await page.getByRole("link", { name: "Add film" }).click();
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: result }).click();
  await expect(page.getByRole("link", { name: "Add film" })).toBeVisible();
}

test("the group search narrows the list and orders by relevance", async ({ page }) => {
  await signUp(page, "Search Person", uniqueEmail("search"));

  await page.getByLabel("Name").fill("Search Club");
  await page.getByLabel("Member limit").fill("4");
  await page.getByRole("button", { name: "Create group" }).click();
  await expect(page.getByRole("heading", { name: "Search Club" })).toBeVisible();

  await addFilm(page, "heat", "Heat 1995");
  await addFilm(page, "la haine", "La Haine 1995");
  await addFilm(page, "alien", "Alien 1979");

  const rows = page.locator("ol.rows > li");
  const field = page.getByLabel("Search films");
  await expect(rows).toHaveCount(3);

  await field.pressSequentially("ain");
  await expect(rows).toHaveCount(1);
  await expect(rows.nth(0)).toContainText("La Haine");

  await field.fill("a");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("Alien");

  await field.fill("god");
  await expect(rows).toHaveCount(0);
  await expect(page.getByText("Nothing matches.")).toBeVisible();

  await field.fill("la haine");
  await expect(rows).toHaveCount(1);
  await expect(rows.nth(0)).toContainText("La Haine");

  await field.fill("haine la");
  await expect(rows).toHaveCount(1);
  await expect(rows.nth(0)).toContainText("La Haine");
});
