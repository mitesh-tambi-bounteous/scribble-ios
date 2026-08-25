import { isValidEmail } from "@scribl/shared/index";

/** Result of parsing a free-form multi-email input string. */
export interface ParsedEmails {
  valid: string[];
  invalid: string[];
}

/**
 * Splits a free-form string into individual email candidates (split on
 * commas, semicolons, and any whitespace/newline), trims, drops empties,
 * dedupes case-insensitively (keeping the first-seen original casing), and
 * partitions each token via isValidEmail. Deterministic, first-seen order.
 */
export function parseEmails(input: string): ParsedEmails {
  const tokens = input
    .split(/[\s,;]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const token of tokens) {
    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(token);
  }

  const valid: string[] = [];
  const invalid: string[] = [];
  for (const token of deduped) {
    if (isValidEmail(token)) {
      valid.push(token);
    } else {
      invalid.push(token);
    }
  }

  return { valid, invalid };
}
