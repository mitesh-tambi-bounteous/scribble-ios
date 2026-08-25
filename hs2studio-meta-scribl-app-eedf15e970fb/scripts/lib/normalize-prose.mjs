// normalize-prose.mjs -- shared prose normalizer for the brain doc site.
//
// The brain's prose-lint / brand rules (see CLAUDE.md) forbid em-dash
// characters, emoji, and unicode arrows in committed docs. Input artifacts and
// ingested knowledge are verbatim source and routinely contain those, so any
// page DERIVED from them and committed must be normalized to the ASCII house
// style. This one function is the single normalization point, imported by both
// context-ingest.mjs (the Context Information pages) and docs-sync.mjs (which
// renders every source tree into the doc site).
//
// Deterministic and idempotent: running it on already-normalized text returns
// the same text, so re-rendering yields a stable diff.
//
// This source is pure ASCII: every non-ASCII character is written as a
// backslash-u escape, never the literal glyph, so the file passes the grep.
//
// Power-of-10 in spirit: a single small pure function, a fixed bounded table of
// replacements, no loops over unbounded input beyond the string scan itself.

// Fixed, ordered replacement table. Each entry maps a forbidden or non-ASCII
// typographic character (by code point) to its ASCII house equivalent.
const REPLACEMENTS = [
  // Em-dash -> spaced ASCII hyphens. Surrounding horizontal whitespace is
  // consumed so a pre-spaced source ("X \u2014 Y") still yields single-spaced
  // "X -- Y" (never "X  --  Y"). [ \t] classes, NOT \s: \s matches newlines,
  // and an em-dash at a line boundary must not eat the line break.
  [new RegExp('[ \t]*[\u2014][ \t]*', 'g'), ' -- '],
  // Collapse an already-ASCII spaced double hyphen to single spaces, so text
  // doubled by the pre-fix em-dash rule heals on the next render. Requires
  // horizontal whitespace on BOTH sides, so `--flag`, `-- .` at line start,
  // and table rules `| --- |` are untouched.
  [new RegExp('[ \t]+--[ \t]+', 'g'), ' -- '],
  [new RegExp('[\u2013]', 'g'), '-'], // en-dash (ranges) -> ASCII hyphen
  [new RegExp('[\u2192]', 'g'), '->'], // rightwards arrow
  [new RegExp('[\u2190]', 'g'), '<-'], // leftwards arrow
  [new RegExp('[\u2194]', 'g'), '<->'], // left-right arrow
  [new RegExp('[\u21d2]', 'g'), '=>'], // rightwards double arrow
  [new RegExp('[\u21d0]', 'g'), '<='], // leftwards double arrow
  [new RegExp('[\u2018\u2019]', 'g'), "'"], // curly single quotes -> apostrophe
  [new RegExp('[\u201c\u201d]', 'g'), '"'], // curly double quotes -> straight quote
  [new RegExp('[\u2026]', 'g'), '...'], // horizontal ellipsis
  [new RegExp('[\u2022]', 'g'), '-'], // bullet -> hyphen (safe inside prose)
  [new RegExp('[\u00a0]', 'g'), ' '], // non-breaking space -> plain space
];

// Remove emoji / pictographic characters plus the zero-width joiner, the
// variation selector, and the combining enclosing keycap, so no orphaned
// combining marks remain. Unicode property escape plus explicit code points.
const EMOJI = new RegExp('[\\p{Extended_Pictographic}\u200d\ufe0f\u20e3]', 'gu');

// Normalize a block of text to the ASCII house style. Returns a string. A
// non-string input is coerced to empty string so callers never crash on a
// missing field.
export function normalizeProse(text) {
  if (typeof text !== 'string' || text.length === 0) {
    return '';
  }
  let out = text;
  for (let i = 0; i < REPLACEMENTS.length; i += 1) {
    const [pattern, replacement] = REPLACEMENTS[i];
    out = out.replace(pattern, replacement);
  }
  out = out.replace(EMOJI, '');
  return out;
}

export default normalizeProse;
