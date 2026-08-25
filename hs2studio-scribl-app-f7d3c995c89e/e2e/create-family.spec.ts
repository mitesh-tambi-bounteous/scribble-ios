import { expect, test } from "@playwright/test";

import { queryPgInt, readSessionUser, signUpThroughUi, uniqueEmail } from "./helpers";

/**
 * Create-wall (group) flow: open the create screen from home's "Create new"
 * card, submit a name (Group is the default wall type), succeed back to /home
 * with no error, and prove the channel really landed in Postgres owned by the
 * caller.
 */
test("creating a family wall succeeds and persists the channel in Postgres", async ({ page }) => {
  const email = uniqueEmail("family");
  const wallName = `E2E Family ${Date.now()}`;

  // Sign up via UI -> /splash, then bottom nav to home.
  await page.goto("/");
  await signUpThroughUi(page, email, "Family Fran");
  await page.getByTestId("nav-home").click();
  await expect(page).toHaveURL(/\/home/);

  const user = await readSessionUser(page);
  expect(user).not.toBeNull();

  // Open create-wall from home's "Create new" card and submit a name (the
  // Group kind is preselected).
  await page.getByTestId("wall-card-create-new").click();
  await expect(page).toHaveURL(/\/create-wall/);
  await page.getByTestId("create-wall-name").fill(wallName);
  await page.getByTestId("create-wall-submit").click();

  // Success: back on home, no error surfaced.
  await expect(page).toHaveURL(/\/home/);
  await expect(page.getByTestId("create-wall-error")).toHaveCount(0);

  // Real-data assertion: the channel exists in Postgres, owned by this user.
  const channelCount = queryPgInt(
    `SELECT count(*) FROM channels WHERE name = '${wallName}' AND created_by = '${user!.id}' AND kind = 'group'`,
  );
  expect(channelCount).toBe(1);
});
