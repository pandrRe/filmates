import { expect, test } from "@playwright/test";
import { signUp, uniqueEmail } from "./account";

test("a member posts a film into a group", async ({ page }) => {
  await signUp(page, "Poster Person", uniqueEmail("poster"));

  await page.getByLabel("Name").fill("Film Club");
  await page.getByLabel("Member limit").fill("4");
  await page.getByRole("button", { name: "Create group" }).click();
  await expect(page.getByRole("heading", { name: "Film Club" })).toBeVisible();
  await expect(page.getByText("No films yet. Add the first.")).toBeVisible();

  await page.getByRole("link", { name: "Add film" }).click();
  await page.getByLabel("Title").fill("heat");
  const result = page.getByRole("button", { name: "Heat 1995" });
  await expect(result).toBeVisible();
  await result.click();

  await expect(page.getByRole("heading", { name: "Film Club" })).toBeVisible();
  await expect(page.getByText("1995 · 170 min · Mann")).toBeVisible();

  await page.getByRole("link", { name: "Add film" }).click();
  await page.getByLabel("Title").fill("heat");
  await page.getByRole("button", { name: "Heat 1995" }).click();
  await expect(page.getByText("Heat is already in this group")).toBeVisible();
});
