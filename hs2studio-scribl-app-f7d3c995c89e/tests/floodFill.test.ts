import { floodFill, hexToRgba, type Rgba } from "@/lib/floodFill";

/**
 * Pure flood-fill unit tests. No Skia — the algorithm operates on a plain
 * RGBA Uint8Array so it runs in Node exactly as it will on the pixel buffer
 * read back from the Skia surface. Row-major layout: index = (y*w + x) * 4.
 */

function makeGrid(width: number, height: number, fill: Rgba = [0, 0, 0, 0]): Uint8Array {
  const buf = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    buf[i * 4] = fill[0];
    buf[i * 4 + 1] = fill[1];
    buf[i * 4 + 2] = fill[2];
    buf[i * 4 + 3] = fill[3];
  }
  return buf;
}

function setPx(buf: Uint8Array, width: number, x: number, y: number, rgba: Rgba): void {
  const i = (y * width + x) * 4;
  buf[i] = rgba[0];
  buf[i + 1] = rgba[1];
  buf[i + 2] = rgba[2];
  buf[i + 3] = rgba[3];
}

function getPx(buf: Uint8Array, width: number, x: number, y: number): Rgba {
  const i = (y * width + x) * 4;
  return [buf[i], buf[i + 1], buf[i + 2], buf[i + 3]];
}

const RED: Rgba = [226, 59, 59, 255];
const BLACK: Rgba = [0, 0, 0, 255];
const TRANSPARENT: Rgba = [0, 0, 0, 0];

describe("hexToRgba", () => {
  it("parses a 6-digit hex to opaque RGBA", () => {
    expect(hexToRgba("#000000")).toEqual([0, 0, 0, 255]);
    expect(hexToRgba("#FF8A3D")).toEqual([255, 138, 61, 255]);
    expect(hexToRgba("#2FA84F")).toEqual([47, 168, 79, 255]);
  });

  it("is case-insensitive and tolerates a missing leading #", () => {
    expect(hexToRgba("2fa84f")).toEqual([47, 168, 79, 255]);
  });
});

describe("floodFill", () => {
  it("fills the whole open (transparent) background from any seed", () => {
    const w = 3;
    const h = 3;
    const src = makeGrid(w, h, TRANSPARENT);

    const { mask, filledCount } = floodFill(src, w, h, 0, 0, RED, 0);

    expect(filledCount).toBe(9);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        expect(getPx(mask, w, x, y)).toEqual([226, 59, 59, 255]);
      }
    }
  });

  it("fills only the bounded interior of a closed shape, not the border or outside", () => {
    // 7x7: opaque black box outline on the ring x|y in {1,5} (within 1..5),
    // a 3x3 transparent interior at [2..4], and a transparent exterior ring.
    const w = 7;
    const h = 7;
    const src = makeGrid(w, h, TRANSPARENT);
    for (let c = 1; c <= 5; c += 1) {
      setPx(src, w, c, 1, BLACK);
      setPx(src, w, c, 5, BLACK);
      setPx(src, w, 1, c, BLACK);
      setPx(src, w, 5, c, BLACK);
    }

    const { mask, filledCount } = floodFill(src, w, h, 3, 3, RED, 0);

    expect(filledCount).toBe(9); // the 3x3 interior only
    expect(getPx(mask, w, 3, 3)).toEqual([226, 59, 59, 255]);
    expect(getPx(mask, w, 2, 2)).toEqual([226, 59, 59, 255]);
    expect(getPx(mask, w, 4, 4)).toEqual([226, 59, 59, 255]);
    // Border pixel: not part of the fill mask (stays transparent in the mask).
    expect(getPx(mask, w, 1, 3)).toEqual([0, 0, 0, 0]);
    // Exterior background: sealed off by the box, untouched.
    expect(getPx(mask, w, 0, 0)).toEqual([0, 0, 0, 0]);
    expect(getPx(mask, w, 6, 6)).toEqual([0, 0, 0, 0]);
  });

  it("returns a no-op when the seed already matches the fill color", () => {
    const w = 3;
    const h = 3;
    const src = makeGrid(w, h, RED);

    const { filledCount } = floodFill(src, w, h, 1, 1, RED, 0);

    expect(filledCount).toBe(0);
  });

  it("bounds the region by max per-channel tolerance (fringe not crossed)", () => {
    // 3x1: seed transparent, a faint-alpha fringe pixel, then a solid pixel.
    const w = 3;
    const h = 1;
    const src = makeGrid(w, h, TRANSPARENT);
    setPx(src, w, 1, 0, [0, 0, 0, 32]); // fringe: max channel diff from seed = 32
    setPx(src, w, 2, 0, [0, 0, 0, 200]); // solid-ish edge

    const below = floodFill(src, w, h, 0, 0, RED, 31);
    expect(below.filledCount).toBe(1); // fringe (diff 32) excluded at tol 31

    const atBoundary = floodFill(src, w, h, 0, 0, RED, 32);
    expect(atBoundary.filledCount).toBe(2); // fringe included at tol 32, solid still out
  });

  it("is 4-connected (does not leak across diagonals)", () => {
    // 2x2: transparent at (0,0) and (1,1); opaque at (1,0) and (0,1).
    const w = 2;
    const h = 2;
    const src = makeGrid(w, h, TRANSPARENT);
    setPx(src, w, 1, 0, BLACK);
    setPx(src, w, 0, 1, BLACK);

    const { filledCount, mask } = floodFill(src, w, h, 0, 0, RED, 0);

    expect(filledCount).toBe(1);
    expect(getPx(mask, w, 0, 0)).toEqual([226, 59, 59, 255]);
    expect(getPx(mask, w, 1, 1)).toEqual([0, 0, 0, 0]);
  });

  it("no-ops safely on an out-of-bounds seed", () => {
    const w = 3;
    const h = 3;
    const src = makeGrid(w, h, TRANSPARENT);

    expect(floodFill(src, w, h, -1, 0, RED, 0).filledCount).toBe(0);
    expect(floodFill(src, w, h, 3, 0, RED, 0).filledCount).toBe(0);
    expect(floodFill(src, w, h, 0, 3, RED, 0).filledCount).toBe(0);
  });
});
