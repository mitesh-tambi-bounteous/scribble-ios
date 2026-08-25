import { expect, test } from "@playwright/test";

import { drawStrokes } from "./canvas";
import { seedSession, signUpViaApi, uniqueEmail } from "./helpers";

/**
 * Voice -> text on app/write.tsx (S-013): recording a voice note and
 * stopping it sends the captured audio to the real backend /transcribe
 * endpoint, which (with STT_PROVIDER=stub, set on the api webServer in
 * playwright.config.ts) always returns the fixed transcript
 * "A quick doodle of my morning coffee and the sunrise." regardless of the
 * audio content. Headless Chromium's fake media device therefore makes this
 * assertion fully deterministic: the stub ignores what's actually recorded.
 *
 * The typed-caption-wins rule (voice only fills an EMPTY caption) is a
 * client behavior already covered by unit tests; this spec proves the real
 * network round trip end-to-end.
 */
test.use({
  permissions: ["microphone"],
  launchOptions: {
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--ignore-gpu-blocklist",
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
});

const STUB_TRANSCRIPT = "A quick doodle of my morning coffee and the sunrise.";

test("recording a voice note fills the empty caption with the stub transcript", async ({
  page,
}) => {
  const user = await signUpViaApi(uniqueEmail("voice"), "Voice Vera");
  await seedSession(page, user);

  await page.goto("/");
  await expect(page.getByTestId("today-date")).toBeVisible();

  await page.getByTestId("today-open-canvas").click();
  await expect(page).toHaveURL(/\/draw/);
  await expect(page.getByText("Loading today's prompt...")).toHaveCount(0);
  await drawStrokes(page);
  await page.getByText("Done", { exact: true }).click();

  await expect(page).toHaveURL(/\/write/);
  const captionInput = page.getByTestId("write-caption-input");
  await expect(captionInput).toHaveValue("");

  // Start recording, wait briefly to capture some fake audio, then stop.
  await page.getByTestId("write-mic-button").click();
  await page.waitForTimeout(500);
  await page.getByTestId("write-mic-button").click();

  // Transcription round-trips to the real /transcribe endpoint; the stub
  // provider returns a fixed transcript that fills the (empty) caption.
  await expect(captionInput).toHaveValue(STUB_TRANSCRIPT, { timeout: 20_000 });
});

test("a typed caption is not overwritten by the voice transcript", async ({ page }) => {
  const user = await signUpViaApi(uniqueEmail("voice-typed"), "Voice Tyra");
  await seedSession(page, user);

  await page.goto("/");
  await page.getByTestId("today-open-canvas").click();
  await expect(page).toHaveURL(/\/draw/);
  await drawStrokes(page);
  await page.getByText("Done", { exact: true }).click();

  await expect(page).toHaveURL(/\/write/);
  const captionInput = page.getByTestId("write-caption-input");
  await captionInput.fill("my own words");

  await page.getByTestId("write-mic-button").click();
  await page.waitForTimeout(500);
  await page.getByTestId("write-mic-button").click();

  // Give transcription time to resolve, then assert it did NOT clobber the
  // typed caption.
  await page.waitForTimeout(3_000);
  await expect(captionInput).toHaveValue("my own words");
});
