/**
 * challenge-data-mock: mock data layer for Family Challenges (Task 2).
 *
 * Exercises the in-memory mock implementation in dynamodb-client.ts directly.
 * This is the path the root jest suite runs (SCRIBL_DATA_MODE unset/"mock").
 */
import {
  createChallenge,
  getChallenge,
  listChallengesForChannel,
  putChallengeEntry,
  getChallengeEntryForUser,
  listChallengeEntries,
  countChannelMembers,
  putRating,
  putMembership,
  resetMockChallenges,
  resetMockMemberships,
} from "@/backend/lambda/data/dynamodb-client";

beforeEach(() => {
  resetMockChallenges();
  resetMockMemberships();
});

describe("createChallenge / getChallenge", () => {
  test("round-trips a challenge with a deterministic id", async () => {
    const created = await createChallenge({
      channelId: "ch1",
      creatorId: "u1",
      word: "banana",
      drawSeconds: 120,
      toolset: { brushes: ["basic"], colors: ["#000000"] },
    });

    expect(created.id).toBe("challenge-ch1-1");
    expect(created.channelId).toBe("ch1");
    expect(created.creatorId).toBe("u1");
    expect(created.word).toBe("banana");
    expect(created.drawSeconds).toBe(120);
    expect(created.toolset).toEqual({ brushes: ["basic"], colors: ["#000000"] });

    const fetched = await getChallenge(created.id);
    expect(fetched).toEqual(created);
  });

  test("increments the deterministic id per channel", async () => {
    const first = await createChallenge({
      channelId: "ch1",
      creatorId: "u1",
      word: "cat",
      drawSeconds: 120,
      toolset: { brushes: ["basic"], colors: ["#000000"] },
    });
    const second = await createChallenge({
      channelId: "ch1",
      creatorId: "u2",
      word: "dog",
      drawSeconds: 120,
      toolset: { brushes: ["basic"], colors: ["#000000"] },
    });

    expect(first.id).toBe("challenge-ch1-1");
    expect(second.id).toBe("challenge-ch1-2");
  });

  test("getChallenge returns undefined for an unknown id", async () => {
    const fetched = await getChallenge("nope");
    expect(fetched).toBeUndefined();
  });
});

describe("listChallengesForChannel", () => {
  test("lists only challenges for the requested channel", async () => {
    const a = await createChallenge({
      channelId: "ch1",
      creatorId: "u1",
      word: "cat",
      drawSeconds: 120,
      toolset: { brushes: ["basic"], colors: ["#000000"] },
    });
    await createChallenge({
      channelId: "ch2",
      creatorId: "u1",
      word: "dog",
      drawSeconds: 120,
      toolset: { brushes: ["basic"], colors: ["#000000"] },
    });

    const list = await listChallengesForChannel("ch1");
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual(a);
  });
});

describe("putChallengeEntry / getChallengeEntryForUser", () => {
  test("round-trips an entry for a user", async () => {
    const challenge = await createChallenge({
      channelId: "ch1",
      creatorId: "u1",
      word: "cat",
      drawSeconds: 120,
      toolset: { brushes: ["basic"], colors: ["#000000"] },
    });

    await putChallengeEntry({
      id: `entry-${challenge.id}-u1`,
      challengeId: challenge.id,
      userId: "u1",
      imageRef: "img.png",
    });

    const entry = await getChallengeEntryForUser(challenge.id, "u1");
    expect(entry).toBeDefined();
    expect(entry?.id).toBe(`entry-${challenge.id}-u1`);
    expect(entry?.userId).toBe("u1");
    expect(entry?.imageRef).toBe("img.png");
    expect(entry?.averageStars).toBe(0);
    expect(entry?.ratingCount).toBe(0);
  });

  test("returns undefined when no entry exists for that user", async () => {
    const challenge = await createChallenge({
      channelId: "ch1",
      creatorId: "u1",
      word: "cat",
      drawSeconds: 120,
      toolset: { brushes: ["basic"], colors: ["#000000"] },
    });

    const entry = await getChallengeEntryForUser(challenge.id, "nobody");
    expect(entry).toBeUndefined();
  });
});

describe("listChallengeEntries ratings aggregation", () => {
  test("averages ratings across raters", async () => {
    const challenge = await createChallenge({
      channelId: "ch1",
      creatorId: "u1",
      word: "cat",
      drawSeconds: 120,
      toolset: { brushes: ["basic"], colors: ["#000000"] },
    });
    const entryId = `entry-${challenge.id}-u1`;
    await putChallengeEntry({ id: entryId, challengeId: challenge.id, userId: "u1" });

    await putRating({ challengeId: challenge.id, entryId, raterId: "rater1", stars: 4 });
    await putRating({ challengeId: challenge.id, entryId, raterId: "rater2", stars: 2 });

    const entries = await listChallengeEntries(challenge.id);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.averageStars).toBe(3);
    expect(entries[0]?.ratingCount).toBe(2);
  });

  test("populates myStars from forUserId's own rating, undefined otherwise", async () => {
    const challenge = await createChallenge({
      channelId: "ch1",
      creatorId: "u1",
      word: "cat",
      drawSeconds: 120,
      toolset: { brushes: ["basic"], colors: ["#000000"] },
    });
    const entryId = `entry-${challenge.id}-u1`;
    await putChallengeEntry({ id: entryId, challengeId: challenge.id, userId: "u1" });

    await putRating({ challengeId: challenge.id, entryId, raterId: "rater1", stars: 4 });
    await putRating({ challengeId: challenge.id, entryId, raterId: "rater2", stars: 2 });

    const asRater1 = await listChallengeEntries(challenge.id, "rater1");
    expect(asRater1[0]?.myStars).toBe(4);
    expect(asRater1[0]?.averageStars).toBe(3);
    expect(asRater1[0]?.ratingCount).toBe(2);

    const asStranger = await listChallengeEntries(challenge.id, "stranger");
    expect(asStranger[0]?.myStars).toBeUndefined();

    const withoutForUserId = await listChallengeEntries(challenge.id);
    expect(withoutForUserId[0]?.myStars).toBeUndefined();
  });
});

describe("countChannelMembers", () => {
  test("reflects putMembership calls for the given channel", async () => {
    await putMembership("ch1", "u1");
    await putMembership("ch1", "u2");
    await putMembership("ch2", "u3");

    expect(await countChannelMembers("ch1")).toBe(2);
    expect(await countChannelMembers("ch2")).toBe(1);
    expect(await countChannelMembers("ch-empty")).toBe(0);
  });
});
