/**
 * Scribl POC — per-call token logging seam (ADR 0009).
 *
 * One home for cost visibility: input, output, cache-read, cache-write
 * tokens per call. The POC default logger is a no-op-friendly console
 * record; swap for a metrics sink later without touching adapters.
 */

import type { TokenLogEntry, TokenLogger } from "./types";

/** Default logger: structured console record. Never throws. */
export const consoleTokenLogger: TokenLogger = (entry: TokenLogEntry) => {
  try {
    // eslint-disable-next-line no-console
    console.log("[claude-provider-adapter] token-usage", JSON.stringify(entry));
  } catch {
    // Logging must never break the call path.
  }
};

/** No-op logger, useful for tests. */
export const noopTokenLogger: TokenLogger = () => {};
