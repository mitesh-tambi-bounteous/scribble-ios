import { expect, test } from "@playwright/test";

import { drawStrokes } from "./canvas";
import { TODAY_PROMPT_ID, queryPgInt, seedSession, signUpViaApi, uniqueEmail } from "./helpers";

/**
 * Draw -> write -> choose-channels flow against the real canvas + backend:
 * entering through Today (the real user path), opening the canvas, drawing
 * strokes, then Done ONLY exports + stashes the drawing (no submit yet, no
 * response row yet) and navigates to the caption screen. Submission (with
 * the chosen channel) happens on app/choose-channels.tsx, where a responses
 * row with a populated image_ref finally lands in Postgres.
 */
test("drawing, captioning, and choosing a channel submits and writes a response row with image_ref", async ({
  page,
}) => {
  const user = await signUpViaApi(uniqueEmail("draw"), "Draw Dana");
  await seedSession(page, user);

  // Enter via Today so the session hydrates and the prompt store warms.
  await page.goto("/");
  await expect(page.getByTestId("today-date")).toBeVisible();

  // Open the canvas from Today (in-app navigation keeps the warm session).
  await page.getByTestId("today-open-canvas").click();
  await expect(page).toHaveURL(/\/draw/);
  await expect(page.getByText("Loading today's prompt...")).toHaveCount(0);

  await drawStrokes(page);

  await page.getByText("Done", { exact: true }).click();

  // Done only exports + stashes the draft -> advances to the caption
  // (write) screen. No submit-to-unlock call has happened yet: no response
  // row exists in Postgres.
  await expect(page).toHaveURL(/\/write/);
  expect(
    queryPgInt(
      `SELECT count(*) FROM responses WHERE user_id = '${user.id}' AND prompt_id = '${TODAY_PROMPT_ID}'`,
    ),
  ).toBe(0);

  // Caption, then continue to channel selection.
  await page.getByTestId("write-caption-input").fill("A quick doodle");
  await page.getByTestId("write-submit-button").click();
  await expect(page).toHaveURL(/\/choose-channels/);
  await expect(page.getByTestId("choose-channels-screen")).toBeVisible();

  // Choose the (always-present) Personal Archive channel and submit -> THIS
  // is where submit-to-unlock (AC2) actually fires.
  const archiveChannelId = `channel-${user.id}-archive`;
  await page.getByTestId(`channel-option-${archiveChannelId}`).click();
  await page.getByTestId("share-submit-button").click();

  // Submit succeeded -> advance forward off the picker.
  await expect(page).not.toHaveURL(/\/choose-channels/);

  // Real-data assertion: a response row exists with a non-null image_ref.
  const responseCount = queryPgInt(
    `SELECT count(*) FROM responses WHERE user_id = '${user.id}' AND prompt_id = '${TODAY_PROMPT_ID}' AND channel_id = '${archiveChannelId}' AND image_ref IS NOT NULL`,
  );
  expect(responseCount).toBe(1);
});
