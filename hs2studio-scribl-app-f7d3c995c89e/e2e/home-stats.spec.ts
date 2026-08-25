import { expect, test } from "@playwright/test";

import { drawStrokes } from "./canvas";
import {
  SAMPLE_IMAGE_REF,
  promptIdForOffset,
  readSessionUser,
  signUpThroughUi,
  submitViaApi,
  uniqueEmail,
} from "./helpers";

/**
 * The key scripted assertion: home stats change with real actions. A brand-new
 * account starts at 0 drawings; performing 3 submits (1 via the real UI
 * draw+Done, 2 via authenticated API calls to distinct future prompts so each
 * is a distinct submission) makes the home drawings count read exactly 3, and
 * the week strip marks today done.
 *
 * Navigation is entirely in-app (sign up -> splash -> home -> today -> draw
 * -> ... -> home) so the authenticated session stays warm the way it does for
 * a real user. Sign-up lands on /splash; home's nav-draw goes straight to "/"
 * (the Today screen).
 */
test("home drawings count increases by the number of real submits", async ({ page }) => {
  // Sign up via UI: lands on /splash with the session already active.
  await page.goto("/");
  await signUpThroughUi(page, uniqueEmail("stats"), "Stats Steve");

  // Splash -> Home via the bottom nav. Baseline: zero drawings.
  await page.getByTestId("nav-home").click();
  await expect(page).toHaveURL(/\/home/);
  await expect(page.getByTestId("home-drawings-count")).toHaveText("0");

  const user = await readSessionUser(page);
  expect(user).not.toBeNull();

  // Submit #1: real UI draw + Done. Home's Draw nav button goes straight to
  // "/" (Today), whose CTA opens the canvas.
  await page.getByTestId("nav-draw").click();
  await expect(page).toHaveURL(new RegExp("localhost:8081/$"));
  await page.getByTestId("today-open-canvas").click();
  await expect(page.getByText("Loading today's prompt...")).toHaveCount(0);
  await drawStrokes(page);
  await page.getByText("Done", { exact: true }).click();
  await expect(page).toHaveURL(/\/write/);

  // Caption, then choose a channel -> THIS is where submit-to-unlock fires.
  await page.getByTestId("write-caption-input").fill("Stats doodle");
  await page.getByTestId("write-submit-button").click();
  await expect(page).toHaveURL(/\/choose-channels/);
  await page.getByTestId(`channel-option-channel-${user!.id}-archive`).click();

  // Submits #2 and #3: authenticated API calls to distinct future prompts, as
  // the same user (x-user-id). Distinct prompts => distinct submissions.
  await submitViaApi(user!.id, promptIdForOffset(1), SAMPLE_IMAGE_REF);
  await submitViaApi(user!.id, promptIdForOffset(2), SAMPLE_IMAGE_REF);

  // Navigate back to home in-app (choose-channels -> family -> back to home).
  // Every submit routes to /family now (see app/choose-channels.tsx).
  await page.getByTestId("share-submit-button").click();
  await expect(page).toHaveURL(/\/family/);
  await page.getByRole("button", { name: "Go back" }).click();
  await expect(page).toHaveURL(/\/home/);

  // Count reflects exactly 3 submits. (Navigating back re-mounts Home on top
  // of the stacked instance; both bind the shared stats store, so scope to the
  // first match.)
  await expect(page.getByTestId("home-drawings-count").first()).toHaveText("3");

  // Today was drawn -> the week strip reports one completed day out of seven
  // (all three submissions are recorded today, so a single distinct date).
  await expect(page.getByTestId("home-week-strip").first()).toHaveText(/1 of 7/);
});
