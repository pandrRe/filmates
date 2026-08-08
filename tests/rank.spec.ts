import { expect, test, type Page } from "@playwright/test";
import { signUp, uniqueEmail } from "./account";

async function addFilm(page: Page, title: string, result: string): Promise<void> {
  await page.getByRole("link", { name: "Add film" }).click();
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: result }).click();
  await expect(page.getByRole("link", { name: "Add film" })).toBeVisible();
}

test("the ranked view filters and searches from the url", async ({ page }) => {
  await signUp(page, "Rank Person", uniqueEmail("rank"));

  await page.getByLabel("Name").fill("Rank Club");
  await page.getByLabel("Member limit").fill("4");
  await page.getByRole("button", { name: "Create group" }).click();
  await expect(page.getByRole("heading", { name: "Rank Club" })).toBeVisible();

  await addFilm(page, "heat", "Heat 1995");
  await addFilm(page, "la haine", "La Haine 1995");

  const rows = page.locator("ol.rows > li");
  await expect(rows.nth(0).locator(".rank")).toHaveText("1");
  await expect(rows.nth(1).locator(".rank")).toHaveText("2");

  await page.getByLabel("Search films").fill("hain");
  await expect(rows).toHaveCount(1);
  await expect(rows.nth(0)).toContainText("La Haine");
  await expect(rows.nth(0).locator(".rank")).toHaveText("2");
  await expect(page).toHaveURL(/query=hain/);

  await page.getByRole("link", { name: "Search the film database" }).click();
  await expect(page.getByLabel("Title")).toHaveValue("hain");
  await page.goBack();
  await page.getByLabel("Search films").fill("");
  await expect(rows).toHaveCount(2);

  await page.getByRole("button", { name: "Seen Heat" }).click();
  await expect(page.getByRole("button", { name: "Seen Heat" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.getByRole("button", { name: "Unseen by me" }).click();
  await expect(page).toHaveURL(/filter=unseenByMe/);
  await expect(rows).toHaveCount(1);
  await expect(rows.nth(0)).toContainText("La Haine");

  await page.getByRole("button", { name: "Seen by all" }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.nth(0)).toContainText("Heat");

  await page.reload();
  await expect(page.getByRole("button", { name: "Seen by all" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(rows).toHaveCount(1);
  await expect(rows.nth(0)).toContainText("Heat");
});
