/**
 * Task 7: mockDataClient challenge methods (src/data/mock.ts).
 *
 * Exercises the in-memory frontend mock adapter directly, honoring the same
 * blindness / reveal / rating rules as the live backend (mirrored, never
 * re-derived as a UI-only gate): entries stay empty for a caller until THAT
 * caller submits (per-viewer submit-to-unlock / AC2, no global deadline), a
 * caller cannot rate their own entry, and re-rating updates in place rather
 * than duplicating.
 */
import type { ChallengeToolset } from "@scribl/shared/index";

const VALID_TOOLSET: ChallengeToolset = { brushes: ["basic"], colors: ["#000000"] };

describe("mockDataClient challenges (Task 7)", () => {
  let mockDataClient: (typeof import("@/src/data/mock"))["mockDataClient"];
  let setActiveUser: (typeof import("@/src/data/active-user"))["setActiveUser"];

  beforeEach(() => {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ({ mockDataClient } = require("@/src/data/mock"));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ({ setActiveUser } = require("@/src/data/active-user"));
    setActiveUser(null);
  });

  async function makeMember(email: string, displayName: string): Promise<string> {
    const user = await mockDataClient.signUp(email, displayName);
    return user.id;
  }

  /**
   * Creates a group channel (owned by aliceId) and invites bobEmail as a
   * member, so channelMembers[channel.id] has 2 participants (the shape the
   * removed always-present Public wall used to provide for free).
   */
  async function makeSharedChannel(aliceId: string, bobEmail: string): Promise<string> {
    setActiveUser(aliceId);
    const wall = await mockDataClient.createWall({ name: "Shared", kind: "group", isPublic: false });
    await mockDataClient.inviteMember(wall.id, bobEmail);
    return wall.id;
  }

  it("keeps entries blind (empty) for a caller who hasn't submitted", async () => {
    const aliceId = await makeMember("alice@example.com", "Alice");
    const bobId = await makeMember("bob@example.com", "Bob");

    const channelId = await makeSharedChannel(aliceId, "bob@example.com");
    setActiveUser(aliceId);
    const challenge = await mockDataClient.createChallenge(channelId, {
      word: "lighthouse",
      drawSeconds: 60,
      toolset: VALID_TOOLSET,
    });

    const bobDetail = await mockDataClient.getChallengeDetail(challenge.id);
    expect(bobDetail.state).toBe("open");
    expect(bobDetail.entries).toEqual([]);
    expect(bobDetail.leaderboard).toEqual([]);
    expect(bobDetail.iSubmitted).toBe(false);
    void bobId;
  });

  it("reveals for a caller the moment THAT caller submits, independent of other members", async () => {
    const aliceId = await makeMember("alice2@example.com", "Alice");
    const bobId = await makeMember("bob2@example.com", "Bob");
    const channelId = await makeSharedChannel(aliceId, "bob2@example.com");

    setActiveUser(aliceId);
    const challenge = await mockDataClient.createChallenge(channelId, {
      word: "lighthouse",
      drawSeconds: 60,
      toolset: VALID_TOOLSET,
    });
    await mockDataClient.submitChallengeEntry(challenge.id, "alice.png");

    let detail = await mockDataClient.getChallengeDetail(challenge.id);
    expect(detail.state).toBe("revealed");
    expect(detail.entries).toHaveLength(1);

    setActiveUser(bobId);
    detail = await mockDataClient.getChallengeDetail(challenge.id);
    expect(detail.state).toBe("open");
    expect(detail.entries).toEqual([]);

    await mockDataClient.submitChallengeEntry(challenge.id, "bob.png");
    detail = await mockDataClient.getChallengeDetail(challenge.id);
    expect(detail.state).toBe("revealed");
    expect(detail.entries).toHaveLength(2);
  });

  it("rejects rating one's own entry once revealed", async () => {
    const aliceId = await makeMember("alice3@example.com", "Alice");
    const bobId = await makeMember("bob3@example.com", "Bob");
    const channelId = await makeSharedChannel(aliceId, "bob3@example.com");

    setActiveUser(aliceId);
    const challenge = await mockDataClient.createChallenge(channelId, {
      word: "lighthouse",
      drawSeconds: 60,
      toolset: VALID_TOOLSET,
    });
    const aliceEntry = await mockDataClient.submitChallengeEntry(challenge.id, "alice.png");

    setActiveUser(bobId);
    await mockDataClient.submitChallengeEntry(challenge.id, "bob.png");

    setActiveUser(aliceId);
    await expect(
      mockDataClient.rateChallengeEntry(challenge.id, aliceEntry.id, 5),
    ).rejects.toThrow(/own entry/);
  });

  it("updates a rating in place when the same rater re-rates the same entry", async () => {
    const aliceId = await makeMember("alice4@example.com", "Alice");
    const bobId = await makeMember("bob4@example.com", "Bob");
    const channelId = await makeSharedChannel(aliceId, "bob4@example.com");

    setActiveUser(aliceId);
    const challenge = await mockDataClient.createChallenge(channelId, {
      word: "lighthouse",
      drawSeconds: 60,
      toolset: VALID_TOOLSET,
    });
    const aliceEntry = await mockDataClient.submitChallengeEntry(challenge.id, "alice.png");

    setActiveUser(bobId);
    await mockDataClient.submitChallengeEntry(challenge.id, "bob.png");

    await mockDataClient.rateChallengeEntry(challenge.id, aliceEntry.id, 3);
    const updated = await mockDataClient.rateChallengeEntry(challenge.id, aliceEntry.id, 5);

    expect(updated.ratingCount).toBe(1);
    expect(updated.averageStars).toBe(5);
  });
});
