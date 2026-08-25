import { expect, test } from "@playwright/test";

import { SAMPLE_IMAGE_REF, TODAY_PROMPT_ID, queryPg, queryPgInt, seedSession, signUpViaApi, submitViaApi, uniqueEmail } from "./helpers";

/**
 * Reacting to others (AC5) via the real UI + API + Postgres:
 *
 *  1. Two users share a channel (seeded membership, like challenge.spec).
 *     Both submit today's prompt to that channel (submit-to-unlock, AC2,
 *     already satisfied for both).
 *  2. B opens A's response and reacts with an emoji chip -> the reaction
 *     persists as a real row in Postgres, keyed by (response, rater).
 *  3. B opens their OWN response and taps a chip: the same UI path does NOT
 *     create a self-reaction row server-side (403 `cannot_react_own`) —
 *     reacting is for OTHERS' work, not your own.
 *
 * app/response/[id].tsx renders the three reaction chips with per-chip
 * testIDs (`reaction-heart`, `reaction-smile`, `reaction-star`), so this
 * spec addresses them directly.
 */

test("a user can react to a peer's response, and the reaction persists in Postgres", async ({
  page,
}) => {
  const userA = await signUpViaApi(uniqueEmail("react-a"), "Reina Author");
  const userB = await signUpViaApi(uniqueEmail("react-b"), "Bax Reactor");

  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const channelId = `channel-react-${stamp}`;
  const channelName = `E2E React Family ${stamp}`;

  queryPg(
    `INSERT INTO channels (id, name, kind, is_public, created_by) ` +
      `VALUES ('${channelId}', '${channelName}', 'group', false, '${userA.id}'); ` +
      `INSERT INTO channel_members (channel_id, user_id) ` +
      `VALUES ('${channelId}', '${userA.id}'), ('${channelId}', '${userB.id}');`,
  );
  expect(
    queryPgInt(`SELECT count(*) FROM channel_members WHERE channel_id = '${channelId}'`),
  ).toBe(2);

  // Both submit to unlock the channel wall for this prompt.
  await submitViaApi(userA.id, TODAY_PROMPT_ID, SAMPLE_IMAGE_REF, [channelId]);
  await submitViaApi(userB.id, TODAY_PROMPT_ID, SAMPLE_IMAGE_REF, [channelId]);

  const responseAId = queryPg(
    `SELECT id FROM responses WHERE user_id = '${userA.id}' AND prompt_id = '${TODAY_PROMPT_ID}' AND channel_id = '${channelId}'`,
  );
  const responseBId = queryPg(
    `SELECT id FROM responses WHERE user_id = '${userB.id}' AND prompt_id = '${TODAY_PROMPT_ID}' AND channel_id = '${channelId}'`,
  );
  expect(responseAId).not.toBe("");
  expect(responseBId).not.toBe("");

  // B (already submitted, so unlocked) opens A's response and taps the
  // heart chip (first of the three reaction chips).
  await seedSession(page, userB);
  await page.goto(`/response/${responseAId}?channelId=${channelId}&promptId=${TODAY_PROMPT_ID}`);
  await expect(page.getByTestId("response-author")).toHaveText("Reina Author");

  await expect(page.getByTestId("reaction-heart")).toBeVisible();
  await expect(page.getByTestId("reaction-smile")).toBeVisible();
  await expect(page.getByTestId("reaction-star")).toBeVisible();
  await page.getByTestId("reaction-heart").click(); // -> addReaction("❤️")

  await expect
    .poll(() =>
      queryPgInt(
        `SELECT count(*) FROM reactions WHERE response_id = '${responseAId}' AND user_id = '${userB.id}' AND emoji = '❤️'`,
      ),
    )
    .toBe(1);

  // Now B opens their OWN response. Reacting to your own tile is not part
  // of the product's intended flow: the reaction is rejected server-side
  // (403 cannot_react_own) and no row is written.
  await page.goto(`/response/${responseBId}?channelId=${channelId}&promptId=${TODAY_PROMPT_ID}`);
  await expect(page.getByTestId("response-author")).toHaveText("Bax Reactor");

  const beforeSelfReactCount = queryPgInt(
    `SELECT count(*) FROM reactions WHERE response_id = '${responseBId}' AND user_id = '${userB.id}'`,
  );

  // Deterministic negative: click the star chip and wait for the reaction
  // POST itself to come back 403 (cannot_react_own) — no arbitrary sleep.
  const [selfReactResponse] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes("/reactions") && res.request().method() === "POST",
    ),
    page.getByTestId("reaction-star").click(), // -> addReaction("🎉")
  ]);
  expect(selfReactResponse.status()).toBe(403);

  const afterSelfReactCount = queryPgInt(
    `SELECT count(*) FROM reactions WHERE response_id = '${responseBId}' AND user_id = '${userB.id}'`,
  );

  // A self-reaction row must never be created: reacting is for OTHERS' work.
  expect(afterSelfReactCount, "self-reactions must be rejected server-side").toBe(
    beforeSelfReactCount,
  );
});
