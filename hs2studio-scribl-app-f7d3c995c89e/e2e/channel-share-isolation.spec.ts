import { expect, test } from "@playwright/test";

import { drawStrokes } from "./canvas";
import {
  TODAY_PROMPT_ID,
  createWallViaApi,
  queryPgInt,
  seedSession,
  signUpViaApi,
  uniqueEmail,
} from "./helpers";

/**
 * Channel isolation across the multi-channel picker (AC4): a response
 * routes ONLY to the channel(s) the user actually selected in
 * app/choose-channels.tsx, real UI + real API + real Postgres. A user's
 * Family channel and their Personal Archive channel are DIFFERENT rows in
 * the same submit call's fan-out target set; selecting only Family must not
 * also write a response into Personal Archive (or any other of the user's
 * channels). Proven at the DB layer, not the client.
 */
test("sharing to one channel via the picker does not fan out to a channel the user did not select", async ({
  page,
}) => {
  const user = await signUpViaApi(uniqueEmail("isolate"), "Isla Isolate");
  await seedSession(page, user);
  // BF-13: Family is no longer auto-provisioned at signup, so create it
  // explicitly via the real POST /walls API before exercising the picker.
  const familyChannelId = await createWallViaApi(user.id, "Family");
  const archiveChannelId = `channel-${user.id}-archive`;

  await page.goto("/");
  await expect(page.getByTestId("today-date")).toBeVisible();

  await page.getByTestId("today-open-canvas").click();
  await expect(page).toHaveURL(/\/draw/);
  await expect(page.getByText("Loading today's prompt...")).toHaveCount(0);
  await drawStrokes(page);
  await page.getByText("Done", { exact: true }).click();

  await expect(page).toHaveURL(/\/write/);
  await page.getByTestId("write-submit-button").click();
  await expect(page).toHaveURL(/\/choose-channels/);

  // Select ONLY Family, not Personal Archive or any other channel.
  await page.getByTestId(`channel-option-${familyChannelId}`).click();
  await page.getByTestId("share-submit-button").click();
  await expect(page).not.toHaveURL(/\/choose-channels/);

  // DB truth: the response landed in Family...
  expect(
    queryPgInt(
      `SELECT count(*) FROM responses WHERE user_id = '${user.id}' AND prompt_id = '${TODAY_PROMPT_ID}' AND channel_id = '${familyChannelId}'`,
    ),
  ).toBe(1);

  // ...and did NOT also land in Personal Archive, even though it's a channel
  // this user is a member of.
  expect(
    queryPgInt(
      `SELECT count(*) FROM responses WHERE user_id = '${user.id}' AND prompt_id = '${TODAY_PROMPT_ID}' AND channel_id = '${archiveChannelId}'`,
    ),
  ).toBe(0);

  // Server-side confirmation, via the API a non-member would hit: an
  // unrelated second user is NOT a member of this user's Family channel and
  // reading it is denied server-side (AC4).
  const outsider = await signUpViaApi(uniqueEmail("isolate-outsider"), "Otto Outsider");
  const readAsOutsider = await page.request.fetch(
    `http://localhost:8787/channels/${encodeURIComponent(familyChannelId)}/responses?promptId=${TODAY_PROMPT_ID}`,
    { headers: { "x-user-id": outsider.id } },
  );
  expect(readAsOutsider.status()).toBe(403);
});
