/**
 * Pure helpers shared by challenge-create.ts and challenge-list.ts (and
 * later challenge-detail/rating handlers). No I/O here - `now` is always
 * passed in so callers (and tests) stay deterministic.
 */
import type { APIGatewayProxyResultV2 } from "aws-lambda";
import type { ChallengeEntry, ChallengeState, LeaderboardRow } from "@scribl/shared/domain";

export function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

/**
 * Challenges are open-ended (no expiry) — reveal is PER-VIEWER submit-to-
 * unlock, mirroring AC2: a caller sees the reveal (entries/leaderboard) iff
 * they have submitted their own entry.
 */
export function viewerState(iSubmitted: boolean): ChallengeState {
  return iSubmitted ? "revealed" : "open";
}

/**
 * Ranks entries for the leaderboard view: highest averageStars first; ties
 * broken by higher ratingCount, then by earlier createdAt. Ranks are
 * 1-based and dense (index + 1). Sorts a copy; never mutates the input.
 */
export function buildLeaderboard(entries: readonly ChallengeEntry[]): LeaderboardRow[] {
  const sorted = [...entries].sort((a, b) => {
    if (a.averageStars !== b.averageStars) {
      return b.averageStars - a.averageStars;
    }
    if (a.ratingCount !== b.ratingCount) {
      return b.ratingCount - a.ratingCount;
    }
    return Date.parse(a.createdAt) - Date.parse(b.createdAt);
  });

  return sorted.map((entry, index) => ({
    entryId: entry.id,
    userId: entry.userId,
    authorName: entry.authorName,
    averageStars: entry.averageStars,
    ratingCount: entry.ratingCount,
    rank: index + 1,
  }));
}
