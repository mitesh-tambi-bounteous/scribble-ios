/**
 * WS4b-1 promptClock tests (src/lib/promptClock.ts). Pure helpers only, no
 * timers/network. Covers same-day countdown, closed state, plural handling,
 * and date-badge formatting.
 */

import {
  endOfPromptDay,
  formatParticipantLine,
  formatPromptDateBadge,
  formatPromptTimeLeft,
  formatTimeLeft,
} from "@/src/lib/promptClock";

describe("endOfPromptDay", () => {
  it("returns local end-of-day for a valid YYYY-MM-DD", () => {
    const end = endOfPromptDay("2026-04-22");
    expect(end).not.toBeNull();
    expect(end?.getFullYear()).toBe(2026);
    expect(end?.getMonth()).toBe(3);
    expect(end?.getDate()).toBe(22);
    expect(end?.getHours()).toBe(23);
    expect(end?.getMinutes()).toBe(59);
  });

  it("accepts an ISO timestamp by using its date portion", () => {
    const end = endOfPromptDay("2026-04-22T15:58:08.000Z");
    expect(end?.getDate()).toBe(22);
  });

  it("returns null for malformed input", () => {
    expect(endOfPromptDay("not-a-date")).toBeNull();
    expect(endOfPromptDay("")).toBeNull();
  });
});

describe("formatTimeLeft", () => {
  it("formats hours and minutes remaining on the same day", () => {
    const closeAt = new Date(2026, 3, 22, 23, 59, 59, 999);
    const now = new Date(2026, 3, 22, 14, 45, 0, 0);
    expect(formatTimeLeft(closeAt, now)).toBe("9h 14m");
  });

  it("returns Closed once the deadline has passed", () => {
    const closeAt = new Date(2026, 3, 22, 10, 0, 0, 0);
    const now = new Date(2026, 3, 22, 10, 0, 1, 0);
    expect(formatTimeLeft(closeAt, now)).toBe("Closed");
  });

  it("returns Closed exactly at the deadline", () => {
    const closeAt = new Date(2026, 3, 22, 10, 0, 0, 0);
    expect(formatTimeLeft(closeAt, closeAt)).toBe("Closed");
  });
});

describe("formatPromptTimeLeft", () => {
  it("returns Closed for an unparsable prompt date", () => {
    expect(formatPromptTimeLeft("garbage", new Date())).toBe("Closed");
  });

  it("computes remaining time from a prompt date string", () => {
    const now = new Date(2026, 3, 22, 23, 0, 0, 0);
    expect(formatPromptTimeLeft("2026-04-22", now)).toBe("0h 59m");
  });
});

describe("formatPromptDateBadge", () => {
  it("formats a known date as WEEKDAY . MON DD", () => {
    expect(formatPromptDateBadge("2026-04-22")).toBe("WED · APR 22");
  });

  it("returns empty string for malformed input", () => {
    expect(formatPromptDateBadge("nope")).toBe("");
  });
});

describe("formatParticipantLine", () => {
  it("shows honest zero-state copy", () => {
    expect(formatParticipantLine(0)).toBe("Be the first to draw today");
  });

  it("singularizes for exactly one participant", () => {
    expect(formatParticipantLine(1)).toBe("1 person already drew today");
  });

  it("pluralizes for more than one participant", () => {
    expect(formatParticipantLine(12)).toBe("12 people already drew today");
  });
});
