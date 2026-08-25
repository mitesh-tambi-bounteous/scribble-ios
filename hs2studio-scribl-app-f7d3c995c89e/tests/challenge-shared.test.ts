/**
 * challenge-shared — pure helper tests (viewerState, buildLeaderboard).
 *
 * Challenges are open-ended (no deadline); reveal is PER-VIEWER
 * submit-to-unlock (AC2): a caller sees the reveal iff they submitted.
 */
import { viewerState, buildLeaderboard } from "@/backend/lambda/handlers/challenge-shared";
import type { ChallengeEntry } from "@scribl/shared/domain";

function makeEntry(overrides: Partial<ChallengeEntry>): ChallengeEntry {
  return {
    id: "entry-1",
    challengeId: "challenge-1",
    userId: "user-1",
    authorName: "User One",
    createdAt: "2026-01-01T00:00:00.000Z",
    averageStars: 0,
    ratingCount: 0,
    ...overrides,
  };
}

describe("viewerState", () => {
  it("returns open when the caller has not submitted", () => {
    expect(viewerState(false)).toBe("open");
  });

  it("returns revealed when the caller has submitted", () => {
    expect(viewerState(true)).toBe("revealed");
  });
});

describe("buildLeaderboard", () => {
  it("sorts by averageStars desc", () => {
    const entries = [
      makeEntry({ id: "a", averageStars: 2, ratingCount: 5 }),
      makeEntry({ id: "b", averageStars: 4, ratingCount: 5 }),
      makeEntry({ id: "c", averageStars: 3, ratingCount: 5 }),
    ];
    const rows = buildLeaderboard(entries);
    expect(rows.map((r) => r.entryId)).toEqual(["b", "c", "a"]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("breaks ties on averageStars by ratingCount desc", () => {
    const entries = [
      makeEntry({ id: "a", averageStars: 4, ratingCount: 2, createdAt: "2026-01-01T00:00:00.000Z" }),
      makeEntry({ id: "b", averageStars: 4, ratingCount: 8, createdAt: "2026-01-01T00:00:00.000Z" }),
    ];
    const rows = buildLeaderboard(entries);
    expect(rows.map((r) => r.entryId)).toEqual(["b", "a"]);
  });

  it("breaks further ties by createdAt asc (earlier first)", () => {
    const entries = [
      makeEntry({ id: "a", averageStars: 4, ratingCount: 3, createdAt: "2026-01-02T00:00:00.000Z" }),
      makeEntry({ id: "b", averageStars: 4, ratingCount: 3, createdAt: "2026-01-01T00:00:00.000Z" }),
    ];
    const rows = buildLeaderboard(entries);
    expect(rows.map((r) => r.entryId)).toEqual(["b", "a"]);
  });

  it("assigns 1-based dense ranks in sorted order", () => {
    const entries = [
      makeEntry({ id: "a", averageStars: 1, ratingCount: 1 }),
      makeEntry({ id: "b", averageStars: 2, ratingCount: 1 }),
      makeEntry({ id: "c", averageStars: 3, ratingCount: 1 }),
    ];
    const rows = buildLeaderboard(entries);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("does not mutate the input array", () => {
    const entries = [
      makeEntry({ id: "a", averageStars: 1 }),
      makeEntry({ id: "b", averageStars: 2 }),
    ];
    const copy = [...entries];
    buildLeaderboard(entries);
    expect(entries).toEqual(copy);
  });
});
