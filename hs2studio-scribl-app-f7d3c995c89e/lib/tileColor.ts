/**
 * Deterministic, seed-stable tile gradients for the wall grid (S-016).
 *
 * There are no real thumbnail images yet, so each response cell is painted with
 * a lively 2-stop gradient derived purely from a stable key (the response id).
 * Same id -> same gradient on every render and platform; no randomness, so the
 * grid stays stable across reloads and matches web/native parity.
 */

/** Curated hues (0-360) that read well on the light `scribl-paper` bg. */
const HUES = [8, 28, 48, 152, 190, 214, 258, 292, 330] as const;

/**
 * FNV-1a-style bounded string hash. The loop is bounded by the input length,
 * which is a short id in practice; returns a non-negative 32-bit integer.
 */
function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Map a stable key to a soft 2-stop gradient (top-left -> bottom-right).
 * Returns a readonly tuple of two hex/hsl color strings for `LinearGradient`.
 */
export function tileColor(key: string): readonly [string, string] {
  const hash = hashString(key);
  const hue = HUES[hash % HUES.length] ?? HUES[0];
  const hue2 = (hue + 24) % 360;
  // Light, saturated-but-gentle stops so overlaid ink text stays legible.
  return [`hsl(${hue}, 78%, 72%)`, `hsl(${hue2}, 70%, 58%)`] as const;
}
