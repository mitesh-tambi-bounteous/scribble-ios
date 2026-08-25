const { hairlineWidth } = require("nativewind/theme");

/**
 * Public utility class names added by the dark-first token system (see
 * src/theme/tokens.ts + global.css .theme-*). Screen builders should use
 * these — they resolve to the raw --var() custom properties, not hsl():
 *
 *   bg-background        --bg (app background)
 *   text-foreground      --text (primary text)
 *   text-muted           --muted (secondary text)
 *   bg-surface           --surface (low-emphasis fill, e.g. chips)
 *   bg-surface2          --surface2 (raised fill, e.g. bottom nav pill)
 *   bg-paper              --paper (card/canvas paper background)
 *   bg-accent / text-accent  --accent (brand accent color)
 *   bg-btn                --btn-fill (primary button fill)
 *   text-btn-foreground   --btn-text (primary button label)
 *   border-line           --border (hairlines/dividers/outlines)
 *   rounded-btn           --rbtn (pill/button radius)
 *   rounded-card          --rcard (card radius)
 *   font-display          "Fredoka" (headings)
 *   font-sans             "Manrope" (body)
 *
 * NOTE: `background`/`foreground`/`muted`/`accent` are now the RAW-var
 * tokens above (they replace the old shadcn hsl(var(--x)) values — no
 * screen referenced them yet, so this is a safe swap). `border`/`input`/
 * `ring` and `scribl.*`/`primary`/`secondary`/`card`/`popover`/
 * `destructive` are unchanged/preserved; use `border-line` for the new
 * hairline color.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        scribl: {
          ink: "#1A1A1A",
          paper: "#FAFAF7",
          accent: "#FF5A5F",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // --- dark-first token system (raw hex/rgba, NOT hsl-wrapped) ---
        background: "var(--bg)",
        foreground: "var(--text)",
        muted: "var(--muted)",
        surface: "var(--surface)",
        surface2: "var(--surface2)",
        paper: "var(--paper)",
        accent: "var(--accent)",
        btn: "var(--btn-fill)",
        "btn-foreground": "var(--btn-text)",
        line: "var(--border)",
      },
      fontFamily: {
        display: ["Fredoka"],
        sans: ["Manrope"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        btn: "var(--rbtn)",
        card: "var(--rcard)",
      },
      borderWidth: {
        hairline: hairlineWidth(),
      },
    },
  },
  future: {
    hoverOnlyWhenSupported: true,
  },
  plugins: [require("tailwindcss-animate")],
};
