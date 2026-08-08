import { expect, test, type Page } from "@playwright/test";
import { signUp, uniqueEmail } from "./account";

async function addFilm(page: Page, title: string, result: string): Promise<void> {
  await page.getByRole("link", { name: "Add film" }).click();
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: result }).click();
  await expect(page.getByRole("link", { name: "Add film" })).toBeVisible();
}

test("votes rank the list and seen marks show", async ({ page }) => {
  await signUp(page, "Voter Person", uniqueEmail("voter"));

  await page.getByLabel("Name").fill("Vote Club");
  await page.getByLabel("Member limit").fill("4");
  await page.getByRole("button", { name: "Create group" }).click();
  await expect(page.getByRole("heading", { name: "Vote Club" })).toBeVisible();

  await addFilm(page, "heat", "Heat 1995");
  await addFilm(page, "la haine", "La Haine 1995");

  const rows = page.locator("ol.rows > li");
  await expect(rows.nth(0)).toContainText("Heat");
  await expect(rows.nth(1)).toContainText("La Haine");

  await page.getByRole("button", { name: "Vote up La Haine" }).click();
  await expect(rows.nth(0)).toContainText("La Haine");
  await expect(page.getByRole("button", { name: "Vote up La Haine" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(rows.nth(0).locator(".score")).toHaveText("1");

  await page.getByRole("button", { name: "Vote up La Haine" }).click();
  await expect(rows.nth(0).locator(".score")).toHaveText("0");
  await expect(rows.nth(0)).toContainText("Heat");

  await page.getByRole("button", { name: "Vote down La Haine" }).click();
  await expect(rows.nth(1).locator(".score")).toHaveText("-1");

  await page.getByRole("button", { name: "Open Heat" }).click();
  const seenHeat = page.getByRole("button", { name: "Seen Heat" });
  await expect(seenHeat).toBeVisible();
  await expect(page.locator(".dot-seen")).toHaveCount(0);

  await seenHeat.click();
  await expect(seenHeat).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".dot-seen")).toHaveCount(1);

  await seenHeat.click();
  await expect(seenHeat).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".dot-seen")).toHaveCount(0);

  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.locator(".sheet")).toHaveCount(0);
});
