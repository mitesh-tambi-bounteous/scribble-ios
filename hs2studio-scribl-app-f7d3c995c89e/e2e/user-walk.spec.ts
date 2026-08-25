import { expect, test, type ConsoleMessage, type Request } from "@playwright/test";

import { drawStrokes } from "./canvas";
import {
  SAMPLE_IMAGE_REF,
  TODAY_PROMPT_ID,
  listWallsViaApi,
  signUpViaApi,
  submitViaApi,
  uniqueEmail,
} from "./helpers";

/**
 * The full human walk, cold, with console.error / pageerror / requestfailed
 * listeners attached for the ENTIRE journey. Any of them firing fails the run,
 * so a dead API (or a broken screen) is caught end-to-end - not just on one
 * screen.
 *
 * landing -> sign up (lands on splash) -> home -> logout -> log back in
 * (splash again) -> home shows real data -> create a family -> Today ("/")
 * -> draw on the Skia canvas -> Done -> caption preview -> choose channels
 * (submit-to-unlock fires here) -> open the wall -> open a response -> share.
 *
 * A second participant is seeded via the API (invited into the Family wall
 * created in-app, then submits via the API) so the family wall has someone
 * else's response to open. Deterministic: unique emails, workers: 1.
 */
test("a person can sign up, log back in, create a family, draw, and reach share", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(err.message));
  page.on("requestfailed", (req: Request) => {
    const failure = req.failure()?.errorText ?? "";
    if (failure.includes("ERR_ABORTED")) return;
    failedRequests.push(`${req.method()} ${req.url()} -> ${failure}`);
  });

  /** Asserts nothing bad has fired so far; `where` pins the failing step. */
  function assertClean(where: string): void {
    expect(failedRequests, `failed request(s) by ${where}: ${failedRequests.join(" | ")}`).toEqual(
      [],
    );
    expect(consoleErrors, `console error(s) by ${where}: ${consoleErrors.join(" | ")}`).toEqual([]);
    expect(pageErrors, `uncaught page error(s) by ${where}: ${pageErrors.join(" | ")}`).toEqual([]);
  }

  const email = uniqueEmail("walk");
  const displayName = "Walker Wren";
  const wallName = `Walk Family ${Date.now()}`;

  // Seed a second participant, invited (by email) into the Family wall this
  // spec creates below (step 5), so the family wall has a response to open.
  const otherEmail = uniqueEmail("walk-other");
  const other = await signUpViaApi(otherEmail, "Otto Other");

  // 1. Landing while logged out -> redirected to sign-up.
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-up/);
  await expect(page.getByTestId("auth-submit")).toBeVisible();
  assertClean("landing/sign-up");

  // 2. Sign up (email + username, no password) -> splash (the brand landing
  //    screen), then Home via the bottom nav.
  await page.getByTestId("auth-mode-signup").click();
  await page.getByTestId("auth-email").fill(email);
  await page.getByTestId("auth-display-name").fill(displayName);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL(/\/splash/);
  await expect(page.getByTestId("splash-brand")).toBeVisible();
  await page.getByTestId("nav-home").click();
  await expect(page).toHaveURL(/\/home/);
  await expect(page.getByText(`Nice work, ${displayName}.`)).toBeVisible();
  await expect(page.getByTestId("home-drawings-count")).toHaveText("0");
  assertClean("after sign-up");

  // 3. Log out via the home logout button -> back to sign-up.
  await page.getByTestId("logout-button").click();
  await expect(page).toHaveURL(/\/sign-up/);
  assertClean("after logout");

  // 4. Log back in by email + username (no password; login validation
  //    requires both) -> splash -> Home.
  await page.getByTestId("auth-mode-login").click();
  await page.getByTestId("auth-email").fill(email);
  await page.getByTestId("auth-display-name").fill(displayName);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL(/\/splash/);
  await expect(page.getByTestId("splash-brand")).toBeVisible();
  await page.getByTestId("nav-home").click();
  await expect(page).toHaveURL(/\/home/);
  // Home renders REAL data: the greeting is this account's display name.
  await expect(page.getByText(`Nice work, ${displayName}.`)).toBeVisible();
  await expect(page.getByTestId("home-drawings-count")).toHaveText("0");
  assertClean("after re-login");

  // 5. Create a group wall (with an optional invite) via home's "Create new"
  //    card -> back home, no error. Group is the preselected wall type.
  await page.getByTestId("wall-card-create-new").click();
  await expect(page).toHaveURL(/\/create-wall/);
  await expect(page.getByTestId("create-wall-screen")).toBeVisible();
  await page.getByTestId("create-wall-name").fill(wallName);
  await page.getByTestId("create-wall-invite-input").fill(otherEmail);
  await page.getByTestId("create-wall-submit").click();
  await expect(page).toHaveURL(/\/home/);
  await expect(page.getByTestId("create-wall-error")).toHaveCount(0);
  assertClean("after create-family");

  // The invite made "other" a member of the just-created Family channel; look
  // it up (by name) via the real API and have them submit into it, so the
  // wall has a second, non-owner response once Walker unlocks it.
  const otherWalls = await listWallsViaApi(other.id);
  const familyChannelId = otherWalls.find((wall) => wall.name === wallName)?.id;
  expect(familyChannelId).toBeDefined();
  await submitViaApi(other.id, TODAY_PROMPT_ID, SAMPLE_IMAGE_REF, [familyChannelId as string]);

  // 6+7. Home's pencil FAB (Draw) goes straight to "/" — the Today screen —
  //    which shows real data: prompt text, live countdown. (create-wall
  //    router.push()ed a second Home onto the stack, so two BottomNavs are
  //    mounted — target the topmost.)
  await page.getByTestId("nav-draw").last().click();
  await expect(page).toHaveURL(new RegExp("localhost:8081/$"));
  await expect(page.getByTestId("today-date")).toHaveText(/[A-Z]{3}.*\d{1,2}/);
  await expect(page.getByTestId("today-countdown")).toHaveText(/\d+h \d+m|Closed/);
  assertClean("on today");

  // 8. Draw on the Skia canvas and press Done -> caption screen.
  await page.getByTestId("today-open-canvas").click();
  await expect(page).toHaveURL(/\/draw/);
  await expect(page.getByText("Loading today's prompt...")).toHaveCount(0);
  await drawStrokes(page);
  await page.getByText("Done", { exact: true }).click();

  // 9. Caption (/write) shows the just-drawn preview.
  await expect(page).toHaveURL(/\/write/);
  await expect(page.getByTestId("write-drawing-preview")).toBeVisible();
  assertClean("on write");

  // 9b. "Choose who sees this" -> the channel picker. No submit has happened
  //     yet at this point (Done + caption both only stash the draft).
  await page.getByTestId("write-submit-button").click();
  await expect(page).toHaveURL(/\/choose-channels/);
  await expect(page.getByTestId("choose-channels-screen")).toBeVisible();
  assertClean("on choose-channels");

  // 10. Choose the Family wall and submit -> THIS is where submit-to-unlock
  //     (AC2) actually fires. The account has now drawn today, so the family
  //     wall is unlocked and shows the seeded participant's response tile.
  await page.getByTestId(`channel-option-${familyChannelId}`).click();
  await page.getByTestId("share-submit-button").click();
  await expect(page).toHaveURL(/\/family/);
  await page.goto(`/family?channelId=${familyChannelId}&promptId=${TODAY_PROMPT_ID}`);
  await expect(page.getByText("FAMILY WALL", { exact: true })).toBeVisible();
  const tile = page.getByTestId("family-member-tile").first();
  await expect(tile).toBeVisible();
  assertClean("on family wall");

  // 11. Open a response.
  await tile.click();
  await expect(page).toHaveURL(/\/response\//);
  await expect(page.getByText("RESPONSE", { exact: true })).toBeVisible();
  await expect(page.getByTestId("response-author")).toBeVisible();
  assertClean("on response");

  // 12. Share.
  await page.getByRole("button", { name: "Share" }).click();
  await expect(page).toHaveURL(/\/share/);
  await expect(page.getByText("SHARE", { exact: true })).toBeVisible();
  assertClean("on share");
});
