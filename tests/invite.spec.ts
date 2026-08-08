import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "screening room 1962";

function uniqueEmail(role: string): string {
  return `filmates-${role}-${Date.now()}-${Math.round(Math.random() * 1e6)}@example.test`;
}

async function signUp(page: Page, name: string, email: string): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "I need an account" }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
}

test("a member invites a friend into a group", async ({ browser }) => {
  const owner = await browser.newPage();
  await signUp(owner, "Owner Person", uniqueEmail("owner"));
  await expect(owner.getByText("No groups yet. Create the first.")).toBeVisible();

  await owner.getByLabel("Name").fill("Sunday Screening");
  await owner.getByLabel("Member limit").fill("4");
  await owner.getByRole("button", { name: "Create group" }).click();

  await expect(owner.getByRole("heading", { name: "Sunday Screening" })).toBeVisible();
  await expect(owner.getByText("Members 1 / 4")).toBeVisible();

  await owner.getByRole("button", { name: "Copy invite link" }).click();
  const inviteLink = await owner.locator(".invite-link").textContent();
  expect(inviteLink).toContain("/join/");

  const friend = await browser.newPage();
  await signUp(friend, "Friend Person", uniqueEmail("friend"));
  await friend.goto(inviteLink ?? "");
  await expect(friend.getByText("Join Sunday Screening")).toBeVisible();
  await friend.getByRole("button", { name: "Join group" }).click();

  await expect(friend.getByRole("heading", { name: "Sunday Screening" })).toBeVisible();
  await expect(friend.getByText("Members 2 / 4")).toBeVisible();
  await expect(owner.getByText("Members 2 / 4")).toBeVisible();

  await owner.close();
  await friend.close();
});
