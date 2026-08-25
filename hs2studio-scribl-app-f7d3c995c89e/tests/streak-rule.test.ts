/**
 * S-006 streak rule tests: pure `computeStreak(history, today)` from
 * src/data/mock.ts. Covers the documented consecutive-day streak derivation
 * (AC6): a completed submission advances the streak by exactly one, and a
 * gap resets it to the most recent run only.
 */

import { computeStreak } from "@/src/data/mock";

const TODAY = "2026-07-01";

describe("computeStreak (S-006, AC6)", () => {
  it("returns { current: 0, lastSubmittedDate: undefined } for empty history", () => {
    expect(computeStreak([], TODAY)).toEqual({ current: 0, lastSubmittedDate: undefined });
  });

  it("returns current: 1 for a single submission on today", () => {
    expect(computeStreak([TODAY], TODAY)).toEqual({
      current: 1,
      lastSubmittedDate: TODAY,
    });
  });

  it("counts N consecutive days ending on today", () => {
    const history = ["2026-06-27", "2026-06-28", "2026-06-29", "2026-06-30", "2026-07-01"];

    expect(computeStreak(history, TODAY)).toEqual({
      current: 5,
      lastSubmittedDate: TODAY,
    });
  });

  it("resets to the most recent run when there is a gap before today", () => {
    // Older run of consecutive days, then a gap, then nothing since —
    // only the trailing run counts, not the total of both runs.
    const history = ["2026-06-25", "2026-06-26", "2026-06-27", "2026-06-29"];

    expect(computeStreak(history, TODAY)).toEqual({
      current: 1,
      lastSubmittedDate: "2026-06-29",
    });
  });

  it("does not double-count duplicate/same-day entries", () => {
    const history = ["2026-06-30", "2026-06-30", "2026-07-01", "2026-07-01"];

    expect(computeStreak(history, TODAY)).toEqual({
      current: 2,
      lastSubmittedDate: TODAY,
    });
  });
});
