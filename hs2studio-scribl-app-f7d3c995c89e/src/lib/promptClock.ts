/**
 * Pure helpers for the prompt-close countdown and date-badge formatting
 * (WS4b-1). Used by app/splash.tsx and app/index.tsx so both screens share
 * one bounded, testable implementation. No side effects, no timers here;
 * callers own their own interval and call these on each tick.
 */

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MAX_DATE_LENGTH = 10;

/**
 * Parses an IsoDate ("YYYY-MM-DD") or IsoTimestamp defensively into the
 * local end-of-day (23:59:59.999) Date for that calendar day. Returns null
 * for malformed input rather than throwing.
 */
export function endOfPromptDay(isoDate: string): Date | null {
  if (typeof isoDate !== "string" || isoDate.length < MAX_DATE_LENGTH) {
    return null;
  }
  const datePart = isoDate.slice(0, MAX_DATE_LENGTH);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const end = new Date(year, month - 1, day, 23, 59, 59, 999);
  if (Number.isNaN(end.getTime())) {
    return null;
  }
  return end;
}

/**
 * Formats the time remaining until `closeAt` (relative to `now`) as
 * "Xh Ym". Returns "Closed" once the deadline has passed, and clamps
 * negative/garbage inputs to "Closed" rather than showing negative time.
 */
export function formatTimeLeft(closeAt: Date, now: Date): string {
  const remainingMs = closeAt.getTime() - now.getTime();
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return "Closed";
  }
  const hours = Math.floor(remainingMs / MS_PER_HOUR);
  const minutes = Math.floor((remainingMs % MS_PER_HOUR) / MS_PER_MINUTE);
  return `${hours}h ${minutes}m`;
}

/**
 * Convenience wrapper: given a prompt's IsoDate and the current time,
 * returns the "Xh Ym" / "Closed" string directly. Falls back to "Closed"
 * for unparsable dates so screens never render garbage.
 */
export function formatPromptTimeLeft(promptDate: string, now: Date = new Date()): string {
  const closeAt = endOfPromptDay(promptDate);
  if (!closeAt) {
    return "Closed";
  }
  return formatTimeLeft(closeAt, now);
}

const WEEKDAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTH_LABELS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

/**
 * Formats an IsoDate ("YYYY-MM-DD") as "MON . APR 22" for the date badge.
 * Returns an empty string for unparsable input.
 */
export function formatPromptDateBadge(isoDate: string): string {
  const end = endOfPromptDay(isoDate);
  if (!end) {
    return "";
  }
  const weekday = WEEKDAY_LABELS[end.getDay()];
  const month = MONTH_LABELS[end.getMonth()];
  const day = end.getDate();
  return `${weekday} · ${month} ${day}`;
}

/**
 * Formats an IsoTimestamp (a response's createdAt) as "MON DD" (short month
 * + day, e.g. "APR 22") for the Share screen's date badge. Returns an empty
 * string for unparsable input rather than a fabricated placeholder date.
 */
export function formatShareDate(isoTimestamp: string): string {
  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  const month = MONTH_LABELS[parsed.getMonth()];
  return `${month} ${parsed.getDate()}`;
}

/** Pluralizes "day"/"days" for streak counts, e.g. formatDayCount(1) -> "1 day". */
export function formatDayCount(n: number): string {
  return `${n} ${n === 1 ? "day" : "days"}`;
}

/** Pluralizes "person"/"people" for the participant-count line. */
export function formatParticipantLine(participantCount: number): string {
  if (participantCount <= 0) {
    return "Be the first to draw today";
  }
  const noun = participantCount === 1 ? "person" : "people";
  return `${participantCount} ${noun} already drew today`;
}
