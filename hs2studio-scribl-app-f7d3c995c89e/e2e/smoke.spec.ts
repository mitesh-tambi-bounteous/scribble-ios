import { expect, test, type ConsoleMessage, type Request } from "@playwright/test";

import {
  SAMPLE_IMAGE_REF,
  TODAY_PROMPT_ID,
  seedSession,
  signUpViaApi,
  submitViaApi,
  uniqueEmail,
} from "./helpers";

/**
 * Cold-start regression guard. This is the spec that MUST go red when the API
 * is unreachable - the exact defect the two-webServer config exists to catch.
 *
 * A signed-in user opens Today (`/`) cold. Today loads the daily prompt through
 * the real data client (EXPO_PUBLIC_API_MODE=http), so if the API is down the
 * web app's fetch fails: a `requestfailed` fires, the screen paints its error
 * state, and this test fails. On a healthy boot it renders real prompt content
 * with a silent console and no failed requests.
 *
 * We fail the test if ANY of console.error / pageerror / requestfailed fires
 * during the load. `requestfailed` ignores aborted requests (in-flight fetches
 * cancelled by navigation are normal), but a real connection refusal - what a
 * dead API produces - is net::ERR_CONNECTION_REFUSED and is NOT aborted.
 */
test("cold Today load has no failed requests, no error banner, no console errors", async ({
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
    // In-flight requests cancelled by a navigation report as aborted; that is
    // normal and not a server-reachability signal.
    if (failure.includes("ERR_ABORTED")) return;
    failedRequests.push(`${req.method()} ${req.url()} -> ${failure}`);
  });

  // Seed a signed-in session so `/` renders Today (which fetches the prompt)
  // rather than redirecting an anonymous visitor to /sign-up (no API call).
  const user = await signUpViaApi(uniqueEmail("smoke-cold"), "Cold Start");
  await submitViaApi(user.id, TODAY_PROMPT_ID, SAMPLE_IMAGE_REF);
  await seedSession(page, user);

  await page.goto("/");

  // Today rendered its real prompt content (date badge + open-canvas CTA),
  // which only appears once the prompt loaded successfully from the API.
  await expect(page.getByTestId("today-date")).toBeVisible();
  await expect(page.getByTestId("today-open-canvas")).toBeVisible();

  // No raw browser fetch-failure text and no error/retry banner leaked in.
  await expect(page.getByText("Failed to fetch")).toHaveCount(0);
  await expect(page.getByText("Network request failed")).toHaveCount(0);
  await expect(page.getByText("Can't reach the server", { exact: false })).toHaveCount(0);
  await expect(page.getByText("Could not load", { exact: false })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);

  // The regression guard: any failed request / console error / uncaught error
  // during the cold load fails the spec.
  expect(failedRequests, `failed request(s): ${failedRequests.join(" | ")}`).toEqual([]);
  expect(consoleErrors, `console error(s): ${consoleErrors.join(" | ")}`).toEqual([]);
  expect(pageErrors, `uncaught page error(s): ${pageErrors.join(" | ")}`).toEqual([]);
});
