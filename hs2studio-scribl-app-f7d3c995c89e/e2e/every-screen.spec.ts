import { expect, test, type Page } from "@playwright/test";

import {
  SAMPLE_IMAGE_REF,
  TODAY_PROMPT_ID,
  archiveChannelId,
  queryPg,
  seedSession,
  signUpViaApi,
  submitViaApi,
  uniqueEmail,
} from "./helpers";

interface RouteCase {
  readonly name: string;
  readonly url: string;
  readonly assert: (page: Page) => Promise<void>;
}

/**
 * Every-screen smoke: visit each route while authenticated and assert it
 * rendered its own content (no error boundary) and produced no uncaught
 * page error. The user has submitted today's prompt, so the membership /
 * submit-to-unlock gated screens (wall, family, response) render unlocked.
 */
test("every screen renders without an uncaught error while authenticated", async ({ page }) => {
  const user = await signUpViaApi(uniqueEmail("smoke"), "Smoke Sky");
  const channelId = archiveChannelId(user.id);
  await submitViaApi(user.id, TODAY_PROMPT_ID, SAMPLE_IMAGE_REF, [channelId]);
  await seedSession(page, user);

  // Response row id created by the submit above. Archive-channel response ids
  // carry a random suffix (see putSubmission), so read the real id back from
  // Postgres rather than reconstructing it.
  const responseId = queryPg(
    `SELECT id FROM responses WHERE user_id = '${user.id}' AND prompt_id = '${TODAY_PROMPT_ID}' AND channel_id = '${channelId}'`,
  );
  expect(responseId).not.toBe("");
  const wallQuery = `channelId=${channelId}&promptId=${TODAY_PROMPT_ID}`;

  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));

  const routes: readonly RouteCase[] = [
    {
      name: "today (/)",
      url: "/",
      assert: async (p) => expect(p.getByTestId("today-open-canvas")).toBeVisible(),
    },
    {
      name: "home",
      url: "/home",
      assert: async (p) => expect(p.getByTestId("home-drawings-count")).toBeVisible(),
    },
    {
      name: "splash",
      url: "/splash",
      assert: async (p) => expect(p.getByTestId("splash-brand")).toBeVisible(),
    },
    {
      name: "draw",
      url: "/draw",
      assert: async (p) => expect(p.getByText("tap + drag to draw")).toBeVisible(),
    },
    {
      name: "wall",
      url: `/wall?${wallQuery}`,
      assert: async (p) => expect(p.getByText("THE WALL", { exact: true })).toBeVisible(),
    },
    {
      name: "family",
      url: `/family?${wallQuery}`,
      assert: async (p) => expect(p.getByTestId("family-screen")).toBeVisible(),
    },
    {
      name: "create-wall",
      url: "/create-wall",
      assert: async (p) => expect(p.getByTestId("create-wall-screen")).toBeVisible(),
    },
    {
      name: "sign-up",
      url: "/sign-up",
      assert: async (p) => expect(p.getByTestId("auth-submit")).toBeVisible(),
    },
    {
      name: "share",
      url: "/share",
      assert: async (p) => expect(p.getByText("SHARE", { exact: true })).toBeVisible(),
    },
    {
      // The caption step requires an active draft; deep-linking to /write
      // without one triggers the R6 draft guard, which bounces to the canvas.
      name: "write (draft guard)",
      url: "/write",
      assert: async (p) => {
        await expect(p).toHaveURL(/\/draw/);
        await expect(p.getByText("tap + drag to draw")).toBeVisible();
      },
    },
    {
      name: "settings",
      url: "/settings",
      assert: async (p) => expect(p.getByTestId("settings-screen")).toBeVisible(),
    },
    {
      name: "challenge-wall",
      url: `/challenge-wall?channelId=${channelId}`,
      assert: async (p) => expect(p.getByTestId("challenge-wall-screen")).toBeVisible(),
    },
    {
      name: "create-challenge",
      url: `/create-challenge?channelId=${channelId}`,
      assert: async (p) => expect(p.getByTestId("create-challenge-screen")).toBeVisible(),
    },
    {
      name: "create-challenge-background",
      url: "/create-challenge-background",
      assert: async (p) =>
        expect(p.getByTestId("create-challenge-background-screen")).toBeVisible(),
    },
    {
      // Same R6 draft guard as /write: deep-linking without an active draft
      // bounces to the canvas.
      name: "choose-channels (draft guard)",
      url: "/choose-channels",
      assert: async (p) => {
        await expect(p).toHaveURL(/\/draw/);
        await expect(p.getByText("tap + drag to draw")).toBeVisible();
      },
    },
    {
      name: "record",
      url: "/record",
      assert: async (p) => expect(p.getByText("Record your response")).toBeVisible(),
    },
    {
      name: "tutorial",
      url: "/tutorial",
      assert: async (p) => expect(p.getByTestId("tutorial-next")).toBeVisible(),
    },
    {
      name: "response/[id]",
      url: `/response/${responseId}?${wallQuery}`,
      assert: async (p) => expect(p.getByText("RESPONSE", { exact: true })).toBeVisible(),
    },
    {
      name: "not-found",
      url: "/this-route-does-not-exist",
      assert: async (p) => expect(p.getByText("This screen doesn't exist.")).toBeVisible(),
    },
  ];

  // Bounded loop over a fixed route list.
  for (const route of routes) {
    // eslint-disable-next-line no-await-in-loop
    await page.goto(route.url);
    // eslint-disable-next-line no-await-in-loop
    await route.assert(page);
    expect(pageErrors, `uncaught page error(s) on ${route.name}: ${pageErrors.join(" | ")}`).toEqual(
      [],
    );
  }
});
