import { expect, type Page } from "@playwright/test";

/**
 * Draws two strokes on the Skia canvas by driving real Chromium pointer input
 * across the <canvas> element (down / move* / up). Shared by the draw and
 * home-stats specs so the gesture path is exercised the same way.
 */
export async function drawStrokes(page: Page): Promise<void> {
  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error("canvas has no bounding box");
  }
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  // Stroke 1: a short diagonal drag.
  await page.mouse.move(cx - 70, cy - 70);
  await page.mouse.down();
  for (let i = 1; i <= 10; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await page.mouse.move(cx - 70 + i * 12, cy - 70 + i * 11);
  }
  await page.mouse.up();

  // Stroke 2: a horizontal drag.
  await page.mouse.move(cx - 60, cy + 40);
  await page.mouse.down();
  for (let i = 1; i <= 10; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await page.mouse.move(cx - 60 + i * 12, cy + 40);
  }
  await page.mouse.up();
}

/** Center of the Skia <canvas> in page coordinates. */
async function canvasCenter(page: Page): Promise<{ cx: number; cy: number }> {
  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error("canvas has no bounding box");
  }
  return { cx: box.x + box.width / 2, cy: box.y + box.height / 2 };
}

/**
 * Draws a closed circle centered on the canvas by dragging the pointer all the
 * way around and back to the start, so the stroke seals a bounded interior for
 * the paint bucket to fill.
 */
export async function drawClosedCircle(page: Page, radius = 64): Promise<void> {
  const { cx, cy } = await canvasCenter(page);
  const segments = 96;
  const at = (i: number): { x: number; y: number } => {
    const a = (i / segments) * Math.PI * 2;
    return { x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius };
  };

  const start = at(0);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  // Overshoot past the start (segments + a few) with dense intermediate points
  // (steps) so no pointer sample is dropped and the ring is fully sealed.
  for (let i = 1; i <= segments + 6; i += 1) {
    const p = at(i);
    // eslint-disable-next-line no-await-in-loop
    await page.mouse.move(p.x, p.y, { steps: 4 });
  }
  await page.mouse.up();
}

/** Taps (clicks) the canvas at an offset from its center — the fill gesture. */
export async function fillAt(page: Page, offsetX = 0, offsetY = 0): Promise<void> {
  const { cx, cy } = await canvasCenter(page);
  await page.mouse.click(cx + offsetX, cy + offsetY);
}
