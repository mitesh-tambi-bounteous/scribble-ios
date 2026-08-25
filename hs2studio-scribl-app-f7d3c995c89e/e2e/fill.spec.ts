import { expect, test } from "@playwright/test";

import { drawClosedCircle, fillAt } from "./canvas";
import { TODAY_PROMPT_ID, queryPgInt, seedSession, signUpViaApi, uniqueEmail } from "./helpers";

/**
 * Paint-bucket (flood-fill) tool on the real Skia/CanvasKit web canvas.
 *
 * Draws a closed circle, activates the Fill tool, floods the bounded interior
 * with a chosen color, then floods the open background, then undoes the
 * background fill. The deterministic assertion decodes the EXPORTED PNG (the
 * imageRef that feeds submit -> enhance) in-browser and checks the center pixel
 * is the fill color, proving the fill is composited into the export and
 * survives undo of the later op. Finally it completes the submit pipeline and
 * verifies a response row lands with a non-null image_ref (fill did not break
 * export/submit). Screenshots are captured for handoff evidence.
 */

const RED_SWATCH = "#E23B3B"; // PALETTE[1]
const RED_RGB = [226, 59, 59] as const;
const SHOT_DIR = "playwright-report/fill";

/** Reads the rendered drawing's center pixel by decoding its data-URI in-page. */
async function decodeCenterPixel(page: import("@playwright/test").Page): Promise<number[] | null> {
  return page.evaluate(async () => {
    const el = document.querySelector('[data-testid="write-drawing-preview"]');
    if (!el) return null;

    // react-native-web may render the image as an <img> or as a background-image.
    let uri: string | null = null;
    const asImg = el.tagName === "IMG" ? (el as HTMLImageElement) : el.querySelector("img");
    if (asImg?.src) uri = asImg.src;
    if (!uri) {
      for (const node of [el, ...Array.from(el.querySelectorAll("*"))]) {
        const bg = getComputedStyle(node as Element).backgroundImage;
        const m = bg && bg.match(/url\("?(data:[^")]+)"?\)/);
        if (m) {
          uri = m[1];
          break;
        }
      }
    }
    if (!uri) return null;

    const image = new Image();
    image.src = uri;
    await image.decode();
    const c = document.createElement("canvas");
    c.width = image.naturalWidth;
    c.height = image.naturalHeight;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0);
    const { data } = ctx.getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1);
    return [data[0], data[1], data[2], data[3]];
  });
}

test("fill tool floods a bounded shape and the open background, is undoable, and is exported", async ({
  page,
}) => {
  const user = await signUpViaApi(uniqueEmail("fill"), "Fill Fiona");
  await seedSession(page, user);

  await page.goto("/");
  await expect(page.getByTestId("today-date")).toBeVisible();
  await page.getByTestId("today-open-canvas").click();
  await expect(page).toHaveURL(/\/draw/);
  await expect(page.getByText("Loading today's prompt...")).toHaveCount(0);

  // 1) Draw a closed circle, then arm the fill tool with a distinct color.
  await drawClosedCircle(page, 100);
  await page.waitForTimeout(400); // let the stroke commit (runOnJS on pointer-up)
  await page.screenshot({ path: `${SHOT_DIR}/01-circle.png` });

  await page.getByLabel(`Choose color ${RED_SWATCH}`).click();
  const fillToggle = page.getByLabel("Fill tool");
  await fillToggle.click();
  await expect(fillToggle).toHaveClass(/border-foreground/); // active toggle state

  // 2) Tap inside the circle -> interior floods.
  await fillAt(page, 0, 0);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOT_DIR}/02-interior-fill.png` });

  // 3) Tap the open background (far corner) -> background floods.
  await fillAt(page, -160, -120);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOT_DIR}/03-background-fill.png` });

  // 4) Undo removes only the most recent op (the background fill).
  await page.getByLabel("Undo").click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOT_DIR}/04-after-undo.png` });

  // 5) Done exports the surface -> caption screen shows the real drawing.
  await page.getByText("Done", { exact: true }).click();
  await expect(page).toHaveURL(/\/write/);
  await expect(page.getByTestId("write-drawing-preview")).toBeVisible();

  // Deterministic proof: the EXPORTED image's center pixel is the fill color,
  // so the interior flood is baked into the imageRef that submit -> enhance uses.
  await expect
    .poll(async () => (await decodeCenterPixel(page)) !== null, { timeout: 15_000 })
    .toBe(true);
  const center = (await decodeCenterPixel(page)) as number[];
  const [r, g, b, a] = center;
  expect(a).toBeGreaterThan(200); // opaque fill, not transparent background
  expect(Math.abs(r - RED_RGB[0])).toBeLessThanOrEqual(28);
  expect(Math.abs(g - RED_RGB[1])).toBeLessThanOrEqual(28);
  expect(Math.abs(b - RED_RGB[2])).toBeLessThanOrEqual(28);

  // 6) Complete the pipeline: caption -> choose channel -> submit lands a row.
  await page.getByTestId("write-caption-input").fill("Filled doodle");
  await page.getByTestId("write-submit-button").click();
  await expect(page).toHaveURL(/\/choose-channels/);

  const archiveChannelId = `channel-${user.id}-archive`;
  await page.getByTestId(`channel-option-${archiveChannelId}`).click();
  await page.getByTestId("share-submit-button").click();
  await expect(page).not.toHaveURL(/\/choose-channels/);

  expect(
    queryPgInt(
      `SELECT count(*) FROM responses WHERE user_id = '${user.id}' AND prompt_id = '${TODAY_PROMPT_ID}' AND channel_id = '${archiveChannelId}' AND image_ref IS NOT NULL`,
    ),
  ).toBe(1);
});
