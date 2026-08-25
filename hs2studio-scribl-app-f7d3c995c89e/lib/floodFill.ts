/**
 * Pure scanline flood fill for the paint-bucket tool.
 *
 * The Scribl canvas is a vector Skia surface (stroke paths), but a paint bucket
 * is inherently raster. At fill time the canvas is snapshotted to a pixel buffer
 * (`SkImage.readPixels`) and passed here; the result is a full-canvas RGBA "mask"
 * that is transparent everywhere except the flooded region, which is composited
 * back as an <Image> op. Keeping this Skia-free makes it unit-testable in Node.
 *
 * COLOR TOLERANCE (see the default used by the canvas, `FILL_TOLERANCE = 32`):
 * region membership = every channel of a pixel within `tolerance` of the seed
 * pixel's color (max per-channel absolute difference, 0-255). The paper is a CSS
 * view *behind* the Skia canvas, so the surface background is fully transparent
 * (0,0,0,0); true background pixels are near zero and get captured, while
 * anti-aliased stroke fringe pixels carry alpha >= ~33 (plus shifted RGB) and
 * exceed 32 — so the flood stops at the fringe without leaking through 1px gaps
 * or leaving a visible halo.
 */

export type Rgba = readonly [number, number, number, number];

export interface FloodFillResult {
  /** Full-canvas RGBA buffer: transparent except the flooded region. */
  mask: Uint8Array;
  /** Pixels flooded. 0 => no-op; the caller should not create a fill op. */
  filledCount: number;
}

/** Parse "#RRGGBB" (leading # optional, case-insensitive) to opaque RGBA. */
export function hexToRgba(hex: string): Rgba {
  const h = hex.startsWith("#") ? hex.slice(1) : hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return [r, g, b, 255];
}

/** True when every channel of `a` is within `tolerance` of `b`. */
function within(buf: Uint8Array, i: number, target: Rgba, tolerance: number): boolean {
  return (
    Math.abs(buf[i] - target[0]) <= tolerance &&
    Math.abs(buf[i + 1] - target[1]) <= tolerance &&
    Math.abs(buf[i + 2] - target[2]) <= tolerance &&
    Math.abs(buf[i + 3] - target[3]) <= tolerance
  );
}

/**
 * 4-connected scanline flood fill from (startX, startY). Reads the contiguous
 * region matching the seed color (within `tolerance`) from `src` and paints it
 * into a fresh transparent `mask` with `fill`. Uses an explicit stack (no
 * recursion) and visits each pixel at most once, so the work is bounded by
 * width*height.
 */
export function floodFill(
  src: Uint8Array,
  width: number,
  height: number,
  startX: number,
  startY: number,
  fill: Rgba,
  tolerance: number,
): FloodFillResult {
  const mask = new Uint8Array(width * height * 4);
  if (startX < 0 || startX >= width || startY < 0 || startY >= height) {
    return { mask, filledCount: 0 };
  }

  const seedIndex = (startY * width + startX) * 4;
  const seed: Rgba = [
    src[seedIndex],
    src[seedIndex + 1],
    src[seedIndex + 2],
    src[seedIndex + 3],
  ];
  // Nothing to do if the region is already the fill color.
  if (within(new Uint8Array(fill), 0, seed, tolerance)) {
    return { mask, filledCount: 0 };
  }

  const visited = new Uint8Array(width * height);
  const stack: number[] = [];
  // Mark visited at push time so each pixel is enqueued at most once: the stack
  // is bounded by width*height, not 4x the region (a full-background flood on a
  // large canvas would otherwise balloon the stack to ~4x the pixel count).
  function push(x: number, y: number): void {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const p = y * width + x;
    if (visited[p]) return;
    visited[p] = 1;
    stack.push(x, y);
  }

  push(startX, startY);
  let filledCount = 0;

  while (stack.length > 0) {
    const y = stack.pop() as number;
    const x = stack.pop() as number;

    const i = (y * width + x) * 4;
    if (!within(src, i, seed, tolerance)) continue;

    mask[i] = fill[0];
    mask[i + 1] = fill[1];
    mask[i + 2] = fill[2];
    mask[i + 3] = fill[3];
    filledCount += 1;

    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  return { mask, filledCount };
}
