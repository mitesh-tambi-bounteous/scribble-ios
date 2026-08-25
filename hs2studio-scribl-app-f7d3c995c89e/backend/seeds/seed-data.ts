/**
 * Deterministic seed data for the Scribl POC — mock (in-memory) backend mode.
 *
 * This is an EMPTY slate: no demo users, no demo memberships, no demo
 * submissions/responses, and no demo channels. The only seeded content is
 * the date→prompt helpers dynamodb-client.ts needs to resolve "today's
 * prompt" deterministically.
 *
 * Determinism for AC1 ("two users on the same day get the same prompt id"):
 * the prompt id is derived from the calendar date, not randomness or request
 * identity, so any caller on the same day resolves to the same Prompt.
 *
 * AC2/AC4 fixtures (a user who hasn't submitted, a non-member of a channel)
 * are now built in-test rather than seeded here.
 */
import type { Channel, IsoDate, Prompt } from "@scribl/shared/domain";

export const SEED_CHANNELS: readonly Channel[] = [];

/** Display names for known users (mock-mode roster listings). Empty slate. */
export const SEED_USER_DISPLAY_NAMES: Readonly<Record<string, string>> = {};

/** Deterministic id for "today's" prompt, keyed off the calendar date (AC1). */
export function promptIdForDate(date: IsoDate): string {
  return `prompt-${date}`;
}

/**
 * Builds today's seeded prompt for a given ISO date. Always the same shape
 * for the same date, satisfying AC1 across any number of callers.
 */
export function buildTodayPrompt(date: IsoDate): Prompt {
  return {
    id: promptIdForDate(date),
    date,
    text: "Draw the first thing you saw this morning.",
    createdAt: `${date}T00:00:00.000Z`,
  };
}
