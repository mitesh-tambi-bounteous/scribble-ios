/**
 * Pure helpers for GET /me/stats (WS4a). Deliberately dependency-free so they
 * can be unit tested without a database: callers pass in the distinct set of
 * submission dates (YYYY-MM-DD, derived from either submission createdAt or
 * the joined prompt date) and "today"; these functions only do date math.
 *
 * Bounded loops throughout (NASA power-of-10 in spirit): weekly completion is
 * always exactly 7 iterations; streak derivation is bounded by the number of
 * distinct dates supplied.
 */
import type { IsoDate, MilestoneBadge } from "@scribl/shared/domain";

export interface WeeklyCompletionEntry {
  date: IsoDate;
  done: boolean;
}

export interface StreakSummary {
  currentStreak: number;
  bestStreak: number;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_LENGTH = 7;

function toUtcMs(date: IsoDate): number {
  return new Date(`${date}T00:00:00.000Z`).getTime();
}

function addDays(date: IsoDate, deltaDays: number): IsoDate {
  const ms = toUtcMs(date) + deltaDays * ONE_DAY_MS;
  const iso = new Date(ms).toISOString();
  return iso.slice(0, 10);
}

function daysBetween(a: IsoDate, b: IsoDate): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / ONE_DAY_MS);
}

/**
 * Builds exactly 7 entries (oldest first, ending today) marking which
 * calendar days have a recorded submission. Bounded loop: always 7.
 */
export function computeWeeklyCompletion(
  submissionDates: readonly IsoDate[],
  today: IsoDate,
): WeeklyCompletionEntry[] {
  const dateSet = new Set(submissionDates);
  const entries: WeeklyCompletionEntry[] = [];
  for (let offset = WEEK_LENGTH - 1; offset >= 0; offset -= 1) {
    const date = addDays(today, -offset);
    entries.push({ date, done: dateSet.has(date) });
  }
  return entries;
}

/**
 * Derives current + best streak from a set of distinct submission dates.
 * currentStreak counts consecutive days ending today or yesterday (a gap
 * today doesn't reset the streak until tomorrow); bestStreak is the longest
 * run of consecutive calendar days anywhere in the history.
 *
 * Bounded loop: at most `submissionDates.length` iterations.
 */
export function computeStreaks(
  submissionDates: readonly IsoDate[],
  today: IsoDate,
): StreakSummary {
  const sorted = Array.from(new Set(submissionDates)).sort();
  if (sorted.length === 0) {
    return { currentStreak: 0, bestStreak: 0 };
  }

  let bestStreak = 1;
  let runLength = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (prev === undefined || curr === undefined) {
      continue;
    }
    if (daysBetween(prev, curr) === 1) {
      runLength += 1;
    } else {
      runLength = 1;
    }
    if (runLength > bestStreak) {
      bestStreak = runLength;
    }
  }

  const lastDate = sorted[sorted.length - 1];
  if (lastDate === undefined) {
    return { currentStreak: 0, bestStreak };
  }

  const gapFromToday = daysBetween(lastDate, today);
  if (gapFromToday > 1) {
    // Most recent submission is older than yesterday: no active streak.
    return { currentStreak: 0, bestStreak };
  }

  let currentStreak = 1;
  let cursor = lastDate;
  for (let i = sorted.length - 2; i >= 0; i -= 1) {
    const candidate = sorted[i];
    if (candidate === undefined) {
      break;
    }
    if (daysBetween(candidate, cursor) === 1) {
      currentStreak += 1;
      cursor = candidate;
    } else {
      break;
    }
  }

  return { currentStreak, bestStreak };
}

const MILESTONE_DAYS = [7, 30, 100] as const;

/**
 * Derives the 7/30/100-day milestone badges (spec 4.5) from bestStreak, the
 * longest consecutive-day run ever recorded. Bounded loop: always 3.
 */
export function computeBadges(bestStreak: number): MilestoneBadge[] {
  const badges: MilestoneBadge[] = [];
  for (let i = 0; i < MILESTONE_DAYS.length; i += 1) {
    const day = MILESTONE_DAYS[i];
    if (day === undefined) {
      continue;
    }
    badges.push({ day, earned: bestStreak >= day });
  }
  return badges;
}
