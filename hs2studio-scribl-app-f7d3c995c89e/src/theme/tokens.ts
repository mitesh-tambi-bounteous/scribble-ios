/**
 * Scribl theme tokens — single source of truth for the three runtime themes
 * (ink / studio / notepad). `THEME_VARS` feeds NativeWind's `vars()` (native)
 * and the `.theme-*` classes in global.css (web) with the SAME values, so
 * Skia paint colors, NativeWind utilities, and web CSS never drift.
 *
 * `SCRIBL_COLORS` is kept for legacy call sites that predate the token
 * system (e.g. Skia paint defaults outside a themed screen).
 */
export const SCRIBL_COLORS = {
  ink: "#1A1A1A",
  paper: "#FAFAF7",
  accent: "#FF5A5F",
} as const;

export type ThemeName = "ink" | "studio" | "notepad" | "scribble";

/**
 * CSS custom properties per theme. Keys match the `--*` names referenced by
 * tailwind.config.js and global.css. Values are copied verbatim from the
 * design spec — do not "clean up" the rgba/hex mix, it's intentional.
 */
export const THEME_VARS: Record<ThemeName, Record<string, string>> = {
  ink: {
    "--bg": "#0A0A0A",
    "--text": "#ffffff",
    "--muted": "#8b8b8b",
    "--surface": "rgba(255,255,255,.05)",
    "--surface2": "rgba(255,255,255,.09)",
    "--border": "rgba(255,255,255,.13)",
    "--btn-fill": "#ffffff",
    "--btn-text": "#0A0A0A",
    "--accent": "#FF3D9A",
    "--paper": "#141414",
    "--rbtn": "999px",
    "--rcard": "22px",
  },
  studio: {
    "--bg": "#16130F",
    "--text": "#F5EFE6",
    "--muted": "#9d9284",
    "--surface": "rgba(255,246,232,.055)",
    "--surface2": "rgba(255,246,232,.09)",
    "--border": "rgba(255,246,232,.15)",
    "--btn-fill": "#FFB347",
    "--btn-text": "#1a1206",
    "--accent": "#FF7A45",
    "--paper": "#211C16",
    "--rbtn": "16px",
    "--rcard": "20px",
  },
  notepad: {
    "--bg": "#FBF0A6",
    "--text": "#243049",
    "--muted": "#8a7c48",
    "--surface": "rgba(36,48,73,.05)",
    "--surface2": "rgba(36,48,73,.09)",
    "--border": "rgba(36,48,73,.18)",
    "--btn-fill": "#243049",
    "--btn-text": "#FBF0A6",
    "--accent": "#D1495B",
    "--paper": "#FFFBDD",
    "--rbtn": "12px",
    "--rcard": "16px",
  },
  scribble: {
    "--bg": "#ffffff",
    "--text": "#2E1A5E",
    "--muted": "#8b86a8",
    "--surface": "rgba(46,26,94,.045)",
    "--surface2": "rgba(46,26,94,.08)",
    "--border": "rgba(46,26,94,.16)",
    "--btn-fill": "#E6197E",
    "--btn-text": "#ffffff",
    "--accent": "#E6197E",
    "--paper": "#ffffff",
    "--rbtn": "999px",
    "--rcard": "22px",
  },
};

/** Brand gradient stops, constant across all three themes. */
export const BRAND_GRADIENT: string[] = ["#FF9F45", "#FF3D9A", "#6C7BFF", "#2FD3C6"];
