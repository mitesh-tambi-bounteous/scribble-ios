import type { ChallengeDetail } from "@scribl/shared/domain";

test("ChallengeDetail composes summary + entries", () => {
  const d: ChallengeDetail = {
    challenge: { id: "c1", channelId: "ch1", creatorId: "u1", word: "cat", drawSeconds: 120, createdAt: "2026-07-02T00:00:00.000Z" },
    state: "open", participantCount: 3, submittedCount: 1, iSubmitted: true,
    entries: [], leaderboard: [],
  };
  expect(d.state).toBe("open");
});
