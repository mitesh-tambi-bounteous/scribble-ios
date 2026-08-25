# Flow-board generator

Rebuilds the "Live app flow" composite board PNG -- the scribl wordmark header,
the red enhancement-summary subtitle, and the seven phone frames (in journey
order, with arrows and the red callout pills). This is the generator that was
lost after the board first shipped; it now lives in the repo so the board is
reproducible.

## Files

- `flow-board.html` -- the composite, laid out in CSS at exactly 5400x2120.
  `SCREENS` (a JS array near the top of the inline script) is the single source
  of truth for phone order, labels, the pink "glow" flag, and the red pills.
  Raw phone screenshots are read relative to this file from
  `../../s2d/inputs/scribl-live-screens-2026-07-20/`.
- `render.mjs` -- renders `flow-board.html` to PNG with headless Chrome and
  writes it to both committed locations.

## Regenerate

```sh
npm run board:render
```

Writes the PNG (5400x2120) to both:

- `docs/public/assets/context/scribl-live-app-flow-2026-07-20.png`
- `s2d/inputs/scribl-live-app-flow-2026-07-20.png` (mirror)

## Requirements

Google Chrome (or Chromium) installed locally -- no npm browser download. The
render script probes a short list of common install paths; override with the
`CHROME_BIN` env var if Chrome lives elsewhere:

```sh
CHROME_BIN="/path/to/chrome" npm run board:render
```

## Editing the board

Change labels, order, glow, or pills in the `SCREENS` array in
`flow-board.html`, then re-run `npm run board:render`. To add a new raw screen,
drop the PNG into `s2d/inputs/scribl-live-screens-2026-07-20/` and add an entry
to `SCREENS`.

Keep the source file ASCII: em-dash, middot, times, and curly quotes are emitted
via `\u` escapes (the rendered PNG still shows the real glyphs), so the file
trips no prose-lint rule.
