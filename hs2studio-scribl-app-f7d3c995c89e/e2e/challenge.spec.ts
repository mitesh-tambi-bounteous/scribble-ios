import { expect, test } from "@playwright/test";

import { drawStrokes } from "./canvas";
import { queryPg, queryPgInt, seedSession, signUpViaApi, uniqueEmail } from "./helpers";

/**
 * End-to-end proof of the blind draw-off loop under the ADR 0013 model —
 * open-ended challenges, a PER-DRAWING timer, a creator-chosen toolset, and
 * PER-VIEWER submit-to-unlock reveal — through the REAL UI, the REAL local
 * API (:8787), and REAL Postgres:
 *
 *  1. Seed a 2-member family (group channel) for users A and B via SQL.
 *  2. A creates a challenge through the REAL create screen: word, the 1-min
 *     per-drawing timer preset, a restricted toolset (basic brush only,
 *     2 colors), and a drawn shared background. The row is proven in
 *     Postgres (draw_seconds/toolset/background_ref; no deadline column
 *     exists anymore).
 *  3. As A (not yet submitted) the challenge screen is the DRAW view: a
 *     countdown timer (drawpad-timer) and a canvas constrained to the
 *     creator's toolset (2 swatches, only the Pen brush). No entries,
 *     ratings, or leaderboard leak (per-viewer blindness).
 *  4. A draws and submits -> A's view reveals IMMEDIATELY (per-viewer:
 *     "revealed" is A's own unlock; nobody waits for others).
 *  5. Meanwhile B (second browser context) still gets the DRAW view — B has
 *     not submitted, so A's entry stays hidden from B.
 *  6. B submits; B's reload reveals. A reloads, taps B's grid tile to open
 *     the FULL-SCREEN entry viewer, and rates B's entry from inside it
 *     (the grid itself is display-only; rating lives in the viewer).
 *  7. The rating is proven persisted in Postgres, and A's own entry's
 *     rating control (in A's own viewer) is disabled (cannot rate own).
 *
 * Any console error or uncaught page error on A's page fails the test.
 */
test("per-viewer reveal: creator toolset constrains the canvas, submit unlocks entries, rating persists", async ({
  page,
  browser,
}) => {
  // --- Fail on any console error / uncaught page error. ---
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(err.message));

  // --- Step 1: two users + a 2-member group channel (family). ---
  const userA = await signUpViaApi(uniqueEmail("chal-a"), "Ada Artist");
  const userB = await signUpViaApi(uniqueEmail("chal-b"), "Bo Brush");

  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const channelId = `channel-family-${stamp}`;
  const channelName = `E2E Challenge Family ${stamp}`;

  queryPg(
    `INSERT INTO channels (id, name, kind, is_public, created_by) ` +
      `VALUES ('${channelId}', '${channelName}', 'group', false, '${userA.id}'); ` +
      `INSERT INTO channel_members (channel_id, user_id) ` +
      `VALUES ('${channelId}', '${userA.id}'), ('${channelId}', '${userB.id}');`,
  );
  expect(
    queryPgInt(`SELECT count(*) FROM channel_members WHERE channel_id = '${channelId}'`),
  ).toBe(2);

  // --- Step 2: A creates the challenge through the REAL create screen:
  //     word + 1-minute per-drawing timer + restricted toolset (basic brush,
  //     colors #000000 and #E23B3B) + a drawn shared background. ---
  await seedSession(page, userA);
  await page.goto(`/create-challenge?channelId=${channelId}`);
  await expect(page.getByTestId("create-challenge-screen")).toBeVisible();

  await page.getByTestId("challenge-word-input").fill("lighthouse");
  await page.getByTestId("challenge-duration-60").click();
  // Restrict the toolset: clear everything, then pick 1 brush + 2 colors.
  await page.getByTestId("tools-select-none").click();
  await page.getByTestId("tool-brush-basic").click();
  await page.getByTestId("tool-color-0").click();
  await page.getByTestId("tool-color-1").click();
  // Draw the optional shared background on its own dedicated screen, then
  // return to the create-challenge flow.
  await page.getByTestId("create-background-button").click();
  await expect(page.getByTestId("create-challenge-background-screen")).toBeVisible();
  await drawStrokes(page);
  await page.getByText("Save background", { exact: true }).click();
  await expect(page.getByTestId("create-challenge-screen")).toBeVisible();
  await expect(page.getByTestId("background-preview")).toBeVisible();
  await page.getByTestId("create-challenge-submit").click();

  await expect(page).toHaveURL(/\/challenge\//);
  const challengeId = decodeURIComponent(
    new URL(page.url()).pathname.split("/").pop() ?? "",
  );
  expect(challengeId).not.toBe("");

  // Real-data assertion: the row matches the new schema — a per-drawing
  // timer + toolset, no deadline column (dropped by ADR 0013).
  expect(
    queryPgInt(`SELECT draw_seconds FROM challenges WHERE id = '${challengeId}'`),
  ).toBe(60);
  const toolsetJson = queryPg(`SELECT toolset FROM challenges WHERE id = '${challengeId}'`);
  expect(JSON.parse(toolsetJson)).toEqual({
    brushes: ["basic"],
    colors: ["#000000", "#E23B3B"],
  });
  expect(
    queryPg(`SELECT left(background_ref, 14) FROM challenges WHERE id = '${challengeId}'`),
  ).toBe("data:image/png");
  expect(
    queryPgInt(
      `SELECT count(*) FROM information_schema.columns ` +
        `WHERE table_name = 'challenges' AND column_name = 'deadline_at'`,
    ),
  ).toBe(0);

  const entryAId = `entry-${challengeId}-${userA.id}`;
  const entryBId = `entry-${challengeId}-${userB.id}`;

  // --- Step 3: as A (not yet submitted) — the draw view, with the
  //     per-drawing countdown and the creator-constrained toolset. ---
  await expect(page.getByTestId("drawpad-timer")).toBeVisible();
  await expect(page.getByTestId("drawpad-timer")).toHaveText(/^(1:00|0:5\d)$/);
  // Toolset constraint on the participant canvas: exactly the 2 chosen
  // swatches, and only the Pen (basic) brush style. Scoped to the challenge
  // screen: the create-challenge screen stays mounted beneath it in the
  // router stack, and ITS tool picker now exposes the same "<X> brush"
  // accessibility labels (StyleGlyph icons), which an unscoped query counts.
  const challengeScreen = page.getByTestId("challenge-screen");
  await expect(challengeScreen.getByLabel(/^Choose color /)).toHaveCount(2);
  await expect(challengeScreen.getByLabel("Choose color #000000")).toBeVisible();
  await expect(challengeScreen.getByLabel("Choose color #E23B3B")).toBeVisible();
  await expect(challengeScreen.getByLabel("Pen brush")).toBeVisible();
  await expect(challengeScreen.getByLabel("Fork brush")).toHaveCount(0);
  await expect(challengeScreen.getByLabel("Dotted brush")).toHaveCount(0);
  await expect(challengeScreen.getByLabel("Neon brush")).toHaveCount(0);
  // Per-viewer blindness: nothing revealed before A submits.
  await expect(page.getByTestId(`challenge-entry-tile-${entryAId}`)).toHaveCount(0);
  await expect(page.getByTestId(`challenge-entry-tile-${entryBId}`)).toHaveCount(0);
  await expect(page.getByTestId("challenge-winner")).toHaveCount(0);

  // --- Step 4: A draws and submits -> A's own reveal is immediate, even
  //     though B has not submitted (per-viewer reveal; no waiting view). ---
  await drawStrokes(page);
  await page.getByTestId("challenge-done").click();
  await expect(page.getByTestId(`challenge-entry-tile-${entryAId}`)).toBeVisible();
  await expect(page.getByText("Ada Artist", { exact: true })).toBeVisible();
  // The (provisional) leaderboard is already visible to A.
  await expect(page.getByTestId("challenge-winner")).toBeVisible();
  // B's entry does not exist yet.
  await expect(page.getByTestId(`challenge-entry-tile-${entryBId}`)).toHaveCount(0);

  // --- Step 5: B (second browser context) has NOT submitted -> B still gets
  //     the draw view; A's entry stays hidden from B. B's FIRST navigation of
  //     the session is a deep link straight to this nested /challenge/<id>
  //     route (no top-level page visited first) — proving the canvas mounts
  //     and loads CanvasKit correctly from a nested route on a cold session. ---
  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await seedSession(pageB, userB);
  await pageB.goto(`/challenge/${challengeId}`);
  await expect(pageB.getByTestId("drawpad-timer")).toBeVisible();
  await expect(pageB.getByTestId(`challenge-entry-tile-${entryAId}`)).toHaveCount(0);
  await expect(pageB.getByTestId("challenge-winner")).toHaveCount(0);

  // --- Step 6: B draws (through the REAL canvas, deep-linked into the
  //     nested route) and submits -> B's own reveal is immediate. ---
  await drawStrokes(pageB);
  await pageB.getByTestId("challenge-done").click();
  await expect(pageB.getByTestId(`challenge-entry-tile-${entryAId}`)).toBeVisible();
  await expect(pageB.getByTestId(`challenge-entry-tile-${entryBId}`)).toBeVisible();
  await contextB.close();

  // A reloads, taps B's grid tile, and lands on the FULL-SCREEN entry
  // viewer: the drawing itself is visible (not just a thumbnail) and the
  // star control lives here. A rates B's entry 4 stars from inside it.
  await page.reload();
  await expect(page.getByText("Bo Brush", { exact: true })).toBeVisible();
  await page.getByTestId(`challenge-entry-tile-${entryBId}`).click();
  await expect(page.getByTestId("challenge-entry-screen")).toBeVisible();
  await expect(page.getByTestId("entry-drawing-image")).toBeVisible();
  // B's entry is ratable in the viewer (not A's own — no aria-disabled).
  await expect(
    page.getByTestId(`rate-entry-${entryBId}`).getByLabel("Rate 3 stars"),
  ).not.toHaveAttribute("aria-disabled", "true");
  await page.getByTestId(`rate-entry-${entryBId}`).getByLabel("Rate 4 stars").click();

  // --- Step 7: prove the rating persisted, and A cannot rate its own entry. ---
  await expect
    .poll(() =>
      queryPgInt(
        `SELECT count(*) FROM challenge_ratings ` +
          `WHERE entry_id = '${entryBId}' AND rater_id = '${userA.id}'`,
      ),
    )
    .toBe(1);
  expect(
    queryPgInt(
      `SELECT stars FROM challenge_ratings WHERE entry_id = '${entryBId}' AND rater_id = '${userA.id}'`,
    ),
  ).toBe(4);

  // Back on the grid, tiles are display-only (read-only stars readout, no
  // rate control), then A's OWN entry viewer shows a disabled control
  // (cannot_rate_own — same ownership rule the server enforces).
  await page.goBack();
  await expect(page.getByTestId(`stars-entry-${entryBId}`)).toBeVisible();
  await expect(page.getByTestId(`rate-entry-${entryBId}`)).toHaveCount(0);
  await page.getByTestId(`challenge-entry-tile-${entryAId}`).click();
  await expect(page.getByTestId("entry-drawing-image")).toBeVisible();
  await expect(
    page.getByTestId(`rate-entry-${entryAId}`).getByLabel("Rate 3 stars"),
  ).toHaveAttribute("aria-disabled", "true");

  // --- No console error / uncaught page error anywhere in the flow. ---
  expect(pageErrors, `uncaught page error(s): ${pageErrors.join(" | ")}`).toEqual([]);
  expect(consoleErrors, `console error(s): ${consoleErrors.join(" | ")}`).toEqual([]);
});
