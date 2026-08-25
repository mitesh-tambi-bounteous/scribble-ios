import { expect, test } from "@playwright/test";

import { clearSession, signUpThroughUi, uniqueEmail } from "./helpers";

/**
 * Logout + re-login-by-email, plus the unknown-email error path. Exercises the
 * real /auth/login lookup (POC stubbed auth: match by email, no password).
 * Sign-up and login both land on /splash (the brand landing screen); home is
 * one nav-home tap away.
 */
test("logout then log back in by email restores the session and reaches home", async ({ page }) => {
  const email = uniqueEmail("relogin");
  const displayName = "Relogin Rae";

  // Sign up through the UI -> lands on /splash.
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-up/);
  await signUpThroughUi(page, email, displayName);
  await page.getByTestId("nav-home").click();
  await expect(page).toHaveURL(/\/home/);

  // Log out (no logout UI exists; clear the persisted session and reload).
  await clearSession(page);
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-up/);

  // Re-login by email + username via the Log in tab (login validation
  // requires both, matching handleLogin's server-side lookup). Lands on
  // /splash; home is reachable via the bottom nav.
  await page.getByTestId("auth-mode-login").click();
  await page.getByTestId("auth-email").fill(email);
  await page.getByTestId("auth-display-name").fill(displayName);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL(/\/splash/);
  await page.getByTestId("nav-home").click();
  await expect(page).toHaveURL(/\/home/);
  await expect(page.getByTestId("home-drawings-count")).toBeVisible();
});

test("logging in with an unknown email surfaces the user_not_found error", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-up/);

  await page.getByTestId("auth-mode-login").click();
  await page.getByTestId("auth-email").fill(uniqueEmail("nobody"));
  await page.getByTestId("auth-display-name").fill("Nobody Nome");
  await page.getByTestId("auth-submit").click();

  await expect(page.getByTestId("auth-error")).toBeVisible();
  // Still on the auth screen; no session established.
  await expect(page).toHaveURL(/\/sign-up/);
});
