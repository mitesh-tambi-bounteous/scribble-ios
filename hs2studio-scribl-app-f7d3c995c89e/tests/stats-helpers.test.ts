/**
 * Pure unit tests for the WS4a /me/stats derivations (no DB, no network).
 */
import { computeStreaks, computeWeeklyCompletion } from "@/backend/lambda/data/stats";

describe("computeWeeklyCompletion", () => {
  it("returns exactly 7 entries, oldest first, ending today", () => {
    const entries = computeWeeklyCompletion([], "2026-07-02");
    expect(entries).toHaveLength(7);
    expect(entries[0]?.date).toBe("2026-06-26");
    expect(entries[6]?.date).toBe("2026-07-02");
  });

  it("marks done=true only for dates present in the submission set", () => {
    const entries = computeWeeklyCompletion(["2026-07-01", "2026-06-29"], "2026-07-02");
    expect(entries.find((e) => e.date === "2026-07-01")?.done).toBe(true);
    expect(entries.find((e) => e.date === "2026-06-29")?.done).toBe(true);
    expect(entries.find((e) => e.date === "2026-06-30")?.done).toBe(false);
    expect(entries.find((e) => e.date === "2026-07-02")?.done).toBe(false);
  });

  it("no submissions at all -> all 7 entries done=false", () => {
    const entries = computeWeeklyCompletion([], "2026-07-02");
    expect(entries.every((e) => e.done === false)).toBe(true);
  });
});

describe("computeStreaks", () => {
  it("no submissions -> current 0, best 0", () => {
    expect(computeStreaks([], "2026-07-02")).toEqual({ currentStreak: 0, bestStreak: 0 });
  });

  it("single submission today -> current 1, best 1", () => {
    expect(computeStreaks(["2026-07-02"], "2026-07-02")).toEqual({
      currentStreak: 1,
      bestStreak: 1,
    });
  });

  it("single submission yesterday -> current 1 (still active), best 1", () => {
    expect(computeStreaks(["2026-07-01"], "2026-07-02")).toEqual({
      currentStreak: 1,
      bestStreak: 1,
    });
  });

  it("single submission two days ago -> current 0 (streak broken), best 1", () => {
    expect(computeStreaks(["2026-06-30"], "2026-07-02")).toEqual({
      currentStreak: 0,
      bestStreak: 1,
    });
  });

  it("consecutive days ending today -> current equals run length", () => {
    const dates = ["2026-06-29", "2026-06-30", "2026-07-01", "2026-07-02"];
    expect(computeStreaks(dates, "2026-07-02")).toEqual({ currentStreak: 4, bestStreak: 4 });
  });

  it("gap in history -> currentStreak only counts the trailing run, bestStreak is the longest run", () => {
    // Two separate runs: [06-20..06-24] (5 days) and [06-30..07-02] (3 days).
    const dates = [
      "2026-06-20",
      "2026-06-21",
      "2026-06-22",
      "2026-06-23",
      "2026-06-24",
      "2026-06-30",
      "2026-07-01",
      "2026-07-02",
    ];
    expect(computeStreaks(dates, "2026-07-02")).toEqual({ currentStreak: 3, bestStreak: 5 });
  });

  it("dedupes duplicate dates before computing", () => {
    const dates = ["2026-07-02", "2026-07-02", "2026-07-01"];
    expect(computeStreaks(dates, "2026-07-02")).toEqual({ currentStreak: 2, bestStreak: 2 });
  });
});
