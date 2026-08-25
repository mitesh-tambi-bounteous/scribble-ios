/**
 * Canonical drawing-tool vocabulary shared by the canvas, the create-challenge
 * screen, and the backend's challenge-create validation.
 *
 * This is the single source of truth: `lib/palette.ts` and
 * `components/canvas/SkiaCanvas.tsx` re-export from here so all existing
 * import sites keep working. Palette order is load-bearing (index 0 is the
 * default draw/avatar color; e2e tests key off index 1, "#E23B3B") — append
 * only, never reorder.
 */

/** The four brush styles available on the drawing canvas. */
export const BRUSH_STYLE_IDS = ["basic", "fork", "dotted", "neon"] as const;

export type BrushStyle = (typeof BRUSH_STYLE_IDS)[number];

/** Shared drawing/avatar color palette — the app's color vocabulary. */
export const PALETTE = [
  // Original 8 — order is load-bearing: index 0 is the default draw/avatar color
  // and e2e tests key off index 1 (#E23B3B). Do not reorder; append only.
  "#000000",
  "#E23B3B",
  "#FF8A3D",
  "#F5C518",
  "#2FA84F",
  "#2F6BE2",
  "#7A4A28",
  "#D9CBB8",
  // Extended 8 — doubles the vocabulary; all chosen to stay visible on white paper.
  "#8E44AD",
  "#E84393",
  "#00B5AD",
  "#8BC34A",
  "#34B3F1",
  "#3F51B5",
  "#7F8C8D",
  "#CBD5E1",
] as const;
