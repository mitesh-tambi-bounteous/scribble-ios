/**
 * challenge-data-postgres - proves the Postgres implementations of the eight
 * Family Challenges data functions (postgres-client.ts) issue the right SQL
 * shapes and map rows to the Challenge/ChallengeEntry domain types.
 *
 * The sql executor is injected via `__setSqlForTests` so no real network /
 * @neondatabase/serverless connection is ever made (same harness shape as
 * tests/postgres-client.test.ts).
 */

type SqlCall = { text: string; values: unknown[] };

function makeFakeSql(opts: {
  createChallengeRow?: unknown;
  challengeRow?: unknown;
  challengesForChannel?: unknown[];
  countRows?: Array<{ n: number }>;
  entryRows?: unknown[];
  ratingAggRows?: unknown[];
  raterRows?: unknown[];
}) {
  const calls: SqlCall[] = [];

  const fn = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join(" ");
    calls.push({ text, values });

    if (text.includes("INSERT INTO challenges")) {
      return Promise.resolve(opts.createChallengeRow ? [opts.createChallengeRow] : []);
    }
    if (text.includes("FROM challenges") && text.includes("WHERE channel_id")) {
      return Promise.resolve(opts.challengesForChannel ?? []);
    }
    if (text.includes("FROM challenges")) {
      return Promise.resolve(opts.challengeRow ? [opts.challengeRow] : []);
    }
    if (text.includes("count(*)::int AS n") && text.includes("channel_members")) {
      return Promise.resolve(opts.countRows ?? [{ n: 0 }]);
    }
    if (text.includes("avg(stars)::float")) {
      return Promise.resolve(opts.ratingAggRows ?? []);
    }
    if (text.includes("SELECT entry_id, stars")) {
      return Promise.resolve(opts.raterRows ?? []);
    }
    if (text.includes("FROM challenge_entries")) {
      return Promise.resolve(opts.entryRows ?? []);
    }
    return Promise.resolve([]);
  }) as unknown as {
    (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]>;
    transaction: (statements: unknown[]) => Promise<unknown>;
  };

  fn.transaction = jest.fn(async (statements: unknown[]) => {
    await Promise.all(statements as Promise<unknown>[]);
    return statements;
  });

  return { fn, calls };
}

describe("postgres-client - Family Challenges data functions", () => {
  afterEach(() => {
    jest.resetModules();
  });

  it("createChallenge inserts a challenge row and maps it to the Challenge shape", async () => {
    const { fn, calls } = makeFakeSql({
      createChallengeRow: {
        id: "challenge-1",
        channel_id: "channel-1",
        creator_id: "user-x",
        word: "banana",
        draw_seconds: 120,
        toolset: JSON.stringify({ brushes: ["basic"], colors: ["#000000"] }),
        background_ref: null,
        created_at: "2026-07-01T00:00:00.000Z",
      },
    });
    const pg = require("@/backend/lambda/data/postgres-client");
    pg.__setSqlForTests(fn);

    const result = await pg.createChallenge({
      channelId: "channel-1",
      creatorId: "user-x",
      word: "banana",
      drawSeconds: 120,
      toolset: { brushes: ["basic"], colors: ["#000000"] },
    });

    expect(calls.some((c) => c.text.includes("INSERT INTO challenges"))).toBe(true);
    expect(result).toEqual({
      id: "challenge-1",
      channelId: "channel-1",
      creatorId: "user-x",
      word: "banana",
      drawSeconds: 120,
      toolset: { brushes: ["basic"], colors: ["#000000"] },
      backgroundRef: undefined,
      createdAt: "2026-07-01T00:00:00.000Z",
    });
  });

  it("getChallenge returns undefined when no row exists", async () => {
    const { fn } = makeFakeSql({ challengeRow: null });
    const pg = require("@/backend/lambda/data/postgres-client");
    pg.__setSqlForTests(fn);

    await expect(pg.getChallenge("challenge-missing")).resolves.toBeUndefined();
  });

  it("getChallenge maps a NULL toolset to undefined and a NULL draw_seconds to 300 (old-row back-compat)", async () => {
    const { fn } = makeFakeSql({
      challengeRow: {
        id: "challenge-old",
        channel_id: "channel-1",
        creator_id: "user-x",
        word: "banana",
        draw_seconds: null,
        toolset: null,
        background_ref: null,
        created_at: "2026-07-01T00:00:00.000Z",
      },
    });
    const pg = require("@/backend/lambda/data/postgres-client");
    pg.__setSqlForTests(fn);

    const result = await pg.getChallenge("challenge-old");
    expect(result.toolset).toBeUndefined();
    expect(result.drawSeconds).toBe(300);
    expect(result.backgroundRef).toBeUndefined();
  });

  it("listChallengesForChannel maps every row for the channel", async () => {
    const { fn } = makeFakeSql({
      challengesForChannel: [
        {
          id: "challenge-1",
          channel_id: "channel-1",
          creator_id: "user-x",
          word: "banana",
          draw_seconds: 60,
          toolset: JSON.stringify({ brushes: ["neon"], colors: ["#2FA84F"] }),
          background_ref: "data:image/png;base64,ABC",
          created_at: "2026-07-01T00:00:00.000Z",
        },
      ],
    });
    const pg = require("@/backend/lambda/data/postgres-client");
    pg.__setSqlForTests(fn);

    const result = await pg.listChallengesForChannel("channel-1");
    expect(result).toHaveLength(1);
    expect(result[0].word).toBe("banana");
    expect(result[0].drawSeconds).toBe(60);
    expect(result[0].toolset).toEqual({ brushes: ["neon"], colors: ["#2FA84F"] });
    expect(result[0].backgroundRef).toBe("data:image/png;base64,ABC");
  });

  it("putChallengeEntry issues INSERT ... ON CONFLICT (challenge_id, user_id) DO NOTHING", async () => {
    const { fn, calls } = makeFakeSql({});
    const pg = require("@/backend/lambda/data/postgres-client");
    pg.__setSqlForTests(fn);

    await pg.putChallengeEntry({
      id: "entry-1",
      challengeId: "challenge-1",
      userId: "user-x",
      imageRef: "data:image/png;base64,ABC",
    });

    const insertCall = calls.find((c) => c.text.includes("INSERT INTO challenge_entries"));
    expect(insertCall).toBeDefined();
    expect(insertCall?.text).toMatch(/ON CONFLICT \(challenge_id, user_id\) DO NOTHING/);
  });

  it("getChallengeEntryForUser returns undefined when no entry row exists", async () => {
    const { fn } = makeFakeSql({ entryRows: [] });
    const pg = require("@/backend/lambda/data/postgres-client");
    pg.__setSqlForTests(fn);

    await expect(
      pg.getChallengeEntryForUser("challenge-1", "user-x"),
    ).resolves.toBeUndefined();
  });

  it("getChallengeEntryForUser maps the row and aggregates ratings", async () => {
    const { fn } = makeFakeSql({
      entryRows: [
        {
          id: "entry-1",
          challenge_id: "challenge-1",
          user_id: "user-x",
          author_name: "Xavier",
          image_ref: null,
          created_at: "2026-07-01T00:00:00.000Z",
        },
      ],
      ratingAggRows: [{ entry_id: "entry-1", avg: "4.5", n: 2 }],
    });
    const pg = require("@/backend/lambda/data/postgres-client");
    pg.__setSqlForTests(fn);

    const result = await pg.getChallengeEntryForUser("challenge-1", "user-x");
    expect(result).toMatchObject({
      id: "entry-1",
      averageStars: 4.5,
      ratingCount: 2,
    });
    expect(typeof result?.averageStars).toBe("number");
  });

  it("listChallengeEntries runs the entries select + the ratings-aggregate select and maps averageStars/ratingCount", async () => {
    const { fn, calls } = makeFakeSql({
      entryRows: [
        {
          id: "entry-1",
          challenge_id: "challenge-1",
          user_id: "user-x",
          author_name: "Xavier",
          image_ref: null,
          created_at: "2026-07-01T00:00:00.000Z",
        },
        {
          id: "entry-2",
          challenge_id: "challenge-1",
          user_id: "user-y",
          author_name: "Yara",
          image_ref: null,
          created_at: "2026-07-01T00:01:00.000Z",
        },
      ],
      ratingAggRows: [{ entry_id: "entry-1", avg: "3.5", n: 1 }],
    });
    const pg = require("@/backend/lambda/data/postgres-client");
    pg.__setSqlForTests(fn);

    const result = await pg.listChallengeEntries("challenge-1");

    expect(calls.some((c) => c.text.includes("FROM challenge_entries"))).toBe(true);
    expect(calls.some((c) => c.text.includes("avg(stars)::float"))).toBe(true);
    expect(result).toHaveLength(2);
    const entry1 = result.find((e: { id: string }) => e.id === "entry-1");
    const entry2 = result.find((e: { id: string }) => e.id === "entry-2");
    expect(entry1).toMatchObject({ averageStars: 3.5, ratingCount: 1 });
    expect(typeof entry1?.averageStars).toBe("number");
    expect(entry2).toMatchObject({ averageStars: 0, ratingCount: 0 });
  });

  it("listChallengeEntries populates myStars from the forUserId rater when given", async () => {
    const { fn, calls } = makeFakeSql({
      entryRows: [
        {
          id: "entry-1",
          challenge_id: "challenge-1",
          user_id: "user-x",
          author_name: "Xavier",
          image_ref: null,
          created_at: "2026-07-01T00:00:00.000Z",
        },
      ],
      ratingAggRows: [{ entry_id: "entry-1", avg: "3.2", n: 1 }],
      raterRows: [{ entry_id: "entry-1", stars: 3 }],
    });
    const pg = require("@/backend/lambda/data/postgres-client");
    pg.__setSqlForTests(fn);

    const result = await pg.listChallengeEntries("challenge-1", "user-x");

    expect(calls.some((c) => c.text.includes("SELECT entry_id, stars"))).toBe(true);
    expect(result[0]).toMatchObject({ myStars: 3, averageStars: 3.2 });
    expect(typeof result[0]?.averageStars).toBe("number");
  });

  it("countChannelMembers returns the count from the channel_members aggregate", async () => {
    const { fn } = makeFakeSql({ countRows: [{ n: 4 }] });
    const pg = require("@/backend/lambda/data/postgres-client");
    pg.__setSqlForTests(fn);

    await expect(pg.countChannelMembers("channel-1")).resolves.toBe(4);
  });

  it("putRating issues INSERT ... ON CONFLICT (entry_id, rater_id) DO UPDATE SET stars = EXCLUDED.stars", async () => {
    const { fn, calls } = makeFakeSql({});
    const pg = require("@/backend/lambda/data/postgres-client");
    pg.__setSqlForTests(fn);

    await pg.putRating({
      challengeId: "challenge-1",
      entryId: "entry-1",
      raterId: "user-y",
      stars: 5,
    });

    const insertCall = calls.find((c) => c.text.includes("INSERT INTO challenge_ratings"));
    expect(insertCall).toBeDefined();
    expect(insertCall?.text).toMatch(
      /ON CONFLICT \(entry_id, rater_id\) DO UPDATE SET stars = EXCLUDED\.stars/,
    );
  });
});
