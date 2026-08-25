import { expect, test } from "@playwright/test";

import { queryPgInt, signUpThroughUi, uniqueEmail } from "./helpers";

/**
 * Signup flow: login-first boot redirects an anonymous visitor to /sign-up,
 * account creation lands on /splash (the brand landing screen), the bottom
 * nav reaches /home, and the account is really persisted in Postgres.
 */
test("visiting / while logged out redirects to sign-up, then creating an account lands on splash", async ({
  page,
}) => {
  const email = uniqueEmail("signup");
  const displayName = "Signup Sam";

  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-up/);

  await signUpThroughUi(page, email, displayName);

  // Splash -> Home via the bottom nav; the fresh account has zero drawings.
  await page.getByTestId("nav-home").click();
  await expect(page).toHaveURL(/\/home/);
  await expect(page.getByTestId("home-drawings-count")).toBeVisible();
  await expect(page.getByTestId("home-drawings-count")).toHaveText("0");

  // Real-data assertion: the user row exists in Postgres.
  const userCount = queryPgInt(`SELECT count(*) FROM users WHERE email = '${email}'`);
  expect(userCount).toBe(1);
});
