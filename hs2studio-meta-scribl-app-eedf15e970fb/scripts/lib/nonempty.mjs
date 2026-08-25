// nonempty.mjs -- deterministic empty-body guard for context-ingest.
//
// Background: context-ingest extracts .docx/.pdf/.xlsx artifacts into markdown
// pages. If a parser dependency is missing (or an artifact extracts to nothing),
// the extraction can silently yield an empty body, which then overwrites the
// committed source-of-truth page with a stub. That is a data-loss regression.
//
// This guard makes that condition LOUD: callers run each extracted body through
// assertNonEmptyExtraction, which throws when the body is empty or near-empty.
// context-ingest collects those throws and exits non-zero, so a truncating run
// can never silently succeed again. No LLM involved -- pure length assertion.
//
// Power-of-10 in spirit: one small pure function, a single fixed threshold, no
// loops, an asserted invariant on its inputs.

// Minimum count of non-whitespace characters an extracted body must contain to
// be considered real content. A stub / empty extraction falls below this; any
// genuine document or spreadsheet render is far above it.
export const MIN_EXTRACT_CHARS = 16;

// Throw an Error when `text` is empty or near-empty (fewer than
// MIN_EXTRACT_CHARS non-whitespace characters). `kind` and `rel` are used only
// to build a clear message. Returns nothing on success.
export function assertNonEmptyExtraction(kind, rel, text) {
  const label = `${String(kind)} ${String(rel)}`;
  if (typeof text !== 'string') {
    throw new Error(`empty extraction (${label}): body is not a string`);
  }
  const meaningful = text.replace(/\s+/g, '').length;
  if (meaningful < MIN_EXTRACT_CHARS) {
    throw new Error(
      `empty extraction (${label}): only ${meaningful} non-whitespace char(s), ` +
        `need at least ${MIN_EXTRACT_CHARS} -- refusing to write a truncated page`
    );
  }
}

export default assertNonEmptyExtraction;
