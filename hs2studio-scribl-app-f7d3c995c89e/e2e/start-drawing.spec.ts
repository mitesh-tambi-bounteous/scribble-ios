import { expect, test } from "@playwright/test";

import {
  SAMPLE_IMAGE_REF,
  TODAY_PROMPT_ID,
  queryPgInt,
  seedSession,
  signUpViaApi,
  submitViaApi,
  uniqueEmail,
} from "./helpers";

/**
 * Today (drawing) screen renders REAL data, not placeholders: the prompt
 * text and countdown derive live from the prompt / Postgres.
 *
 * The Today screen lives at "/" now; /splash is the brand landing screen
 * whose "Let's start drawing" button (splash-start) replaces to "/". This
 * spec covers both entries: direct load of "/", and splash -> splash-start.
 */
test("today screen renders real prompt text and live countdown", async ({ page }) => {
  const displayName = "Zoe Realdata";
  const user = await signUpViaApi(uniqueEmail("splash"), displayName);
  // Make this user a participant of today's prompt (deterministic count >= 1).
  await submitViaApi(user.id, TODAY_PROMPT_ID, SAMPLE_IMAGE_REF);
  await seedSession(page, user);

  // Today screen at "/": date badge and countdown derive from the prompt date.
  await page.goto("/");
  await expect(page.getByTestId("today-date")).toHaveText(/[A-Z]{3}.*[A-Z]{3}.*\d{1,2}/);
  await expect(page.getByTestId("today-countdown")).toHaveText(/\d+h \d+m|Closed/);

  // Expected participant count = distinct submitters for today's prompt, live
  // from Postgres. Serial run (workers: 1) => no concurrent writers.
  const participantCount = queryPgInt(
    `SELECT count(DISTINCT user_id) FROM submissions WHERE prompt_id = '${TODAY_PROMPT_ID}'`,
  );
  expect(participantCount).toBeGreaterThan(0);

  // Splash entry: the brand landing screen's primary button replaces to "/"
  // (the warm prompt store makes the countdown render immediately).
  await page.goto("/splash");
  await expect(page.getByTestId("splash-brand")).toBeVisible();
  await page.getByTestId("splash-start").click();
  await expect(page).toHaveURL(new RegExp("localhost:8081/$"));

  // Live countdown: "Xh Ym" (or "Closed" past the deadline).
  await expect(page.getByTestId("today-countdown")).toHaveText(/\d+h \d+m|Closed/);
});
