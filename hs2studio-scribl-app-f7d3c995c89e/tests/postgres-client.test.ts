/**
 * postgres-client — proves AC2 (submit-to-unlock) / AC4 (channel isolation)
 * hold on the real Postgres data-access path, not just the mock path.
 *
 * The sql executor is injected via `__setSqlForTests` so no real network /
 * @neondatabase/serverless connection is ever made. We assert both:
 *   (a) the data functions' row -> result mapping (unit level), and
 *   (b) the channel-responses handler running in SCRIBL_DATA_MODE=postgres
 *       enforces the same 403/200 gate sequence as the mock-mode suites.
 */

type SqlCall = { text: string; values: unknown[] };

/** Builds a fake tagged-template sql executor that records every call. */
function makeFakeSql(opts: {
  membership?: boolean;
  submissionRow?: { id: string; user_id: string; prompt_id: string; created_at: string } | null;
  submissionChannelIds?: string[];
  channelResponseRows?: unknown[];
  updateUserRow?:
    | {
        id: string;
        email: string;
        display_name: string;
        avatar_color: string | null;
        created_at: string;
      }
    | null;
  memberRows?: unknown[];
  reactionRows?: unknown[];
  userByEmailRow?: unknown | null;
  userRows?: unknown[];
  createUserRow?: unknown | null;
}) {
  const calls: SqlCall[] = [];

  const fn = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join(" ");
    calls.push({ text, values });

    if (text.includes("UPDATE users")) {
      return Promise.resolve(opts.updateUserRow ? [opts.updateUserRow] : []);
    }
    if (text.includes("INSERT INTO users")) {
      return Promise.resolve(opts.createUserRow ? [opts.createUserRow] : []);
    }
    if (text.includes("FROM users") && text.includes("WHERE email")) {
      return Promise.resolve(opts.userByEmailRow ? [opts.userByEmailRow] : []);
    }
    if (text.includes("FROM users") && text.includes("ORDER BY created_at")) {
      return Promise.resolve(opts.userRows ?? []);
    }
    if (text.includes("FROM channel_members cm") && text.includes("JOIN users")) {
      // listChannelMembers
      return Promise.resolve(opts.memberRows ?? []);
    }
    if (text.includes("FROM channel_members") && text.includes("LIMIT 1")) {
      // getMembership
      return Promise.resolve(opts.membership ? [{ x: 1 }] : []);
    }
    if (text.includes("SELECT DISTINCT channel_id")) {
      // getSubmission's channelIds lookup
      return Promise.resolve(
        (opts.submissionChannelIds ?? []).map((channel_id) => ({ channel_id })),
      );
    }
    if (text.includes("FROM submissions")) {
      // getSubmission's row lookup
      return Promise.resolve(opts.submissionRow ? [opts.submissionRow] : []);
    }
    if (text.includes("FROM reactions")) {
      return Promise.resolve(opts.reactionRows ?? []);
    }
    if (text.includes("FROM responses")) {
      return Promise.resolve(opts.channelResponseRows ?? []);
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

describe("postgres-client — AC2/AC4 row->result mapping (unit level)", () => {
  afterEach(() => {
    jest.resetModules();
  });

  it("getSubmission returns undefined when no submission row exists (AC2 EXISTS signal, absent case)", async () => {
    const { fn } = makeFakeSql({ submissionRow: null });
    const pg = require("@/backend/lambda/data/postgres-client");
    pg.__setSqlForTests(fn);

    const result = await pg.getSubmission("user-x", "prompt-1");
    expect(result).toBeUndefined();
  });

  it("getSubmission returns the mapped submission when a row exists (AC2 EXISTS signal, present case)", async () => {
    const { fn } = makeFakeSql({
      submissionRow: {
        id: "submission-1",
        user_id: "user-x",
        prompt_id: "prompt-1",
        created_at: "2026-07-01T00:00:00.000Z",
      },
      submissionChannelIds: ["channel-1", "channel-2"],
    });
    const pg = require("@/backend/lambda/data/postgres-client");
    pg.__setSqlForTests(fn);

    const result = await pg.getSubmission("user-x", "prompt-1");
    expect(result).toEqual({
      id: "submission-1",
      userId: "user-x",
      promptId: "prompt-1",
      channelIds: ["channel-1", "channel-2"],
      createdAt: "2026-07-01T00:00:00.000Z",
    });
  });

  it("getMembership returns true when a channel_members row exists", async () => {
    const { fn } = makeFakeSql({ membership: true });
    const pg = require("@/backend/lambda/data/postgres-client");
    pg.__setSqlForTests(fn);

    await expect(pg.getMembership("channel-1", "user-x")).resolves.toBe(true);
  });

  it("getMembership returns false when no channel_members row exists (AC4 membership signal, absent case)", async () => {
    const { fn } = makeFakeSql({ membership: false });
    const pg = require("@/backend/lambda/data/postgres-client");
    pg.__setSqlForTests(fn);

    await expect(pg.getMembership("channel-1", "user-x")).resolves.toBe(false);
  });

  it("putSubmission writes submission + membership + response rows inside a single transaction", async () => {
    const { fn, calls } = makeFakeSql({});
    const pg = require("@/backend/lambda/data/postgres-client");
    pg.__setSqlForTests(fn);

    await pg.putSubmission({
      id: "submission-9",
      userId: "user-x",
      promptId: "prompt-1",
      channelIds: ["channel-1", "channel-2"],
      createdAt: "2026-07-01T00:00:00.000Z",
      text: "my art",
    });

    expect(fn.transaction).toHaveBeenCalledTimes(1);
    // 1 submission insert + 2 membership upserts + 2 response inserts = 5 statements
    const [statements] = (fn.transaction as jest.Mock).mock.calls[0];
    expect(statements).toHaveLength(5);

    expect(calls.some((c) => c.text.includes("INSERT INTO submissions"))).toBe(true);
    expect(
      calls.filter((c) => c.text.includes("INSERT INTO channel_members")).length,
    ).toBe(2);
    expect(calls.filter((c) => c.text.includes("INSERT INTO responses")).length).toBe(2);
  });

  it("putSubmission writes image_ref into the responses insert (WS2 defect 2)", async () => {
    const { fn, calls } = makeFakeSql({});
    const pg = require("@/backend/lambda/data/postgres-client");
    pg.__setSqlForTests(fn);

    await pg.putSubmission({
      id: "submission-9",
      userId: "user-x",
      promptId: "prompt-1",
      channelIds: ["channel-1"],
      createdAt: "2026-07-01T00:00:00.000Z",
      imageRef: "data:image/png;base64,ABC123",
    });

    const responseInsert = calls.find((c) => c.text.includes("INSERT INTO responses"));
    expect(responseInsert).toBeDefined();
    expect(responseInsert?.values).toContain("data:image/png;base64,ABC123");
  });

  it("putSubmission writes body (the caption text) into the responses insert (regression guard)", async () => {
    const { fn, calls } = makeFakeSql({});
    const pg = require("@/backend/lambda/data/postgres-client");
    pg.__setSqlForTests(fn);

    await pg.putSubmission({
      id: "submission-9",
      userId: "user-x",
      promptId: "prompt-1",
      channelIds: ["channel-1"],
      createdAt: "2026-07-01T00:00:00.000Z",
      text: "a wobbly dog",
    });

    const responseInsert = calls.find((c) => c.text.includes("INSERT INTO responses"));
    expect(responseInsert).toBeDefined();
    // Column list must include `body`, values must carry the passed caption.
    expect(responseInsert?.text).toContain("body");
    expect(responseInsert?.values).toContain("a wobbly dog");
  });

  it("putSubmission uses per-channel response ids so a second-channel submit doesn't collide (defect 1)", async () => {
    const pg = require("@/backend/lambda/data/postgres-client");

    // Submit prompt P to channel A.
    const a = makeFakeSql({});
    pg.__setSqlForTests(a.fn);
    const idsA = await pg.putSubmission({
      id: "submission-P",
      userId: "user-x",
      promptId: "prompt-P",
      channelIds: ["channel-a"],
      createdAt: "2026-07-01T00:00:00.000Z",
      text: "art",
    });
    expect(idsA).toEqual(["submission-P-channel-a"]);
    const insertA = a.calls.find((c) => c.text.includes("INSERT INTO responses"));
    expect(insertA?.values).toContain("submission-P-channel-a");

    // Submit the SAME prompt P to a NEW channel B — must yield a distinct id
    // (the old `${id}-${index}` scheme returned `submission-P-0` for both and
    // ON CONFLICT (id) DO NOTHING silently dropped the second).
    const b = makeFakeSql({});
    pg.__setSqlForTests(b.fn);
    const idsB = await pg.putSubmission({
      id: "submission-P",
      userId: "user-x",
      promptId: "prompt-P",
      channelIds: ["channel-b"],
      createdAt: "2026-07-01T00:00:00.000Z",
      text: "art",
    });
    expect(idsB).toEqual(["submission-P-channel-b"]);
    expect(idsB[0]).not.toBe(idsA[0]);
    const insertB = b.calls.find((c) => c.text.includes("INSERT INTO responses"));
    expect(insertB?.values).toContain("submission-P-channel-b");

    // Re-submit to channel A -> same id as the first A submit (ON CONFLICT (id)
    // DO NOTHING now correctly dedupes per channel, not across channels).
    const a2 = makeFakeSql({});
    pg.__setSqlForTests(a2.fn);
    const idsA2 = await pg.putSubmission({
      id: "submission-P",
      userId: "user-x",
      promptId: "prompt-P",
      channelIds: ["channel-a"],
      createdAt: "2026-07-01T00:00:00.000Z",
      text: "art",
    });
    expect(idsA2).toEqual(["submission-P-channel-a"]);
    const insertA2 = a2.calls.find((c) => c.text.includes("INSERT INTO responses"));
    // Bare ON CONFLICT DO NOTHING (not `ON CONFLICT (id)`) so a resubmit also
    // dedupes against the responses_user_channel_prompt_key composite unique
    // index, not just the `id` primary key (defect: pre-existing rows under
    // the old `${id}-${index}` scheme don't collide on id).
    expect(insertA2?.text).toContain("ON CONFLICT DO NOTHING");
    expect(insertA2?.text).not.toContain("ON CONFLICT (id) DO NOTHING");
  });

  it("responses INSERT uses a bare ON CONFLICT DO NOTHING (dedupes on id AND the composite unique index)", async () => {
    const { fn, calls } = makeFakeSql({});
    const pg = require("@/backend/lambda/data/postgres-client");
    pg.__setSqlForTests(fn);

    await pg.putSubmission({
      id: "submission-9",
      userId: "user-x",
      promptId: "prompt-1",
      channelIds: ["channel-1"],
      createdAt: "2026-07-01T00:00:00.000Z",
      text: "art",
    });

    const responseInsert = calls.find((c) => c.text.includes("INSERT INTO responses"));
    expect(responseInsert?.text).toContain("ON CONFLICT DO NOTHING");
    expect(responseInsert?.text).not.toContain("ON CONFLICT (id)");
  });

  it("schema.sql declares the responses_user_channel_prompt_key composite unique index (dedupe guarantee across id schemes), partial to exclude archive channels (task #6)", () => {
    const fs = require("fs");
    const path = require("path");
    const schemaPath = path.join(__dirname, "..", "backend", "db", "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8") as string;

    expect(schema).toContain(
      "CREATE UNIQUE INDEX responses_user_channel_prompt_key",
    );
    expect(schema).toContain("ON responses (user_id, channel_id, prompt_id)");
    // Partial: archive channels are exempt from the dedupe (unlimited draws).
    expect(schema).toContain("WHERE channel_id NOT LIKE '%-archive'");
  });

  it("listChannelMembers LEFT JOIN: member with a response row is hydrated; member without is not", async () => {
    const { fn } = makeFakeSql({
      memberRows: [
        {
          user_id: "user-alice",
          email: "alice@example.com",
          display_name: "Alice",
          avatar_color: "#111111",
          has_drawn_today: true,
          resp_id: "submission-P-channel-1",
          resp_prompt_id: "prompt-1",
          resp_channel_id: "channel-1",
          resp_author_name: "Alice",
          resp_image_ref: null,
          resp_body: "A sleepy cat.",
          resp_created_at: "2026-07-01T09:00:00.000Z",
          resp_enhanced_image_ref: null,
          resp_enhancement_status: null,
        },
        {
          user_id: "user-bob",
          email: "bob@example.com",
          display_name: "Bob",
          avatar_color: null,
          has_drawn_today: false,
          resp_id: null,
        },
      ],
    });
    const pg = require("@/backend/lambda/data/postgres-client");
    pg.__setSqlForTests(fn);

    const result = await pg.listChannelMembers("channel-1", "prompt-1");
    expect(result).toHaveLength(2);

    const alice = result.find((m: { userId: string }) => m.userId === "user-alice");
    expect(alice.hasDrawnToday).toBe(true);
    expect(alice.avatarColor).toBe("#111111");
    expect(alice.response).toBeDefined();
    expect(alice.response.channelId).toBe("channel-1");
    expect(alice.response.authorAvatarColor).toBe("#111111");

    const bob = result.find((m: { userId: string }) => m.userId === "user-bob");
    expect(bob.hasDrawnToday).toBe(false);
    expect(bob.response).toBeUndefined();
    expect(bob.avatarColor).toBeUndefined();
  });

  it("putSubmission rejects a submission with no channelIds without touching the sql executor", async () => {
    const { fn } = makeFakeSql({});
    const pg = require("@/backend/lambda/data/postgres-client");
    pg.__setSqlForTests(fn);

    await expect(
      pg.putSubmission({
        id: "submission-9",
        userId: "user-x",
        promptId: "prompt-1",
        channelIds: [],
        createdAt: "2026-07-01T00:00:00.000Z",
      }),
    ).rejects.toThrow(/at least one channelId/);
    expect(fn.transaction).not.toHaveBeenCalled();
  });

  it("putReaction inserts into reactions with ON CONFLICT on (response_id, user_id, emoji)", async () => {
    const { fn, calls } = makeFakeSql({});
    const pg = require("@/backend/lambda/data/postgres-client");
    pg.__setSqlForTests(fn);

    await pg.putReaction("response-1", "user-x", "🎨");

    const insert = calls.find((c) => c.text.includes("INSERT INTO reactions"));
    expect(insert).toBeDefined();
    expect(insert?.text).toContain("ON CONFLICT");
    expect(insert?.text).toContain("response_id, user_id, emoji");
    expect(insert?.values).toContain("response-1");
    expect(insert?.values).toContain("user-x");
    expect(insert?.values).toContain("🎨");
  });

  it("never requires the real @neondatabase/serverless package when the sql executor is injected", () => {
    expect(() => require.resolve("@neondatabase/serverless")).toThrow();
  });

  it("updateUser issues an UPDATE with the provided fields and returns the mapped User", async () => {
    const { fn, calls } = makeFakeSql({
      updateUserRow: {
        id: "user-x",
        email: "new@example.com",
        display_name: "New Name",
        avatar_color: "#abc123",
        created_at: "2026-07-01T00:00:00.000Z",
      },
    });
    const pg = require("@/backend/lambda/data/postgres-client");
    pg.__setSqlForTests(fn);

    const result = await pg.updateUser("user-x", {
      displayName: "New Name",
      email: "new@example.com",
      avatarColor: "#abc123",
    });

    expect(result).toEqual({
      id: "user-x",
      email: "new@example.com",
      displayName: "New Name",
      avatarColor: "#abc123",
      createdAt: "2026-07-01T00:00:00.000Z",
    });

    const update = calls.find((c) => c.text.includes("UPDATE users"));
    expect(update).toBeDefined();
    expect(update?.text).toContain("RETURNING");
  });

  it("getUserByEmail selects avatar_color so it survives login (BF-1)", async () => {
    const { fn, calls } = makeFakeSql({
      userByEmailRow: {
        id: "user-x",
        email: "rob@example.com",
        display_name: "Rob",
        avatar_color: "#654321",
        created_at: "2026-07-01T00:00:00.000Z",
      },
    });
    const pg = require("@/backend/lambda/data/postgres-client");
    pg.__setSqlForTests(fn);

    const result = await pg.getUserByEmail("rob@example.com");
    expect(result?.avatarColor).toBe("#654321");

    const select = calls.find((c) => c.text.includes("FROM users") && c.text.includes("WHERE email"));
    expect(select?.text).toContain("avatar_color");
  });

  it("listUsers selects avatar_color for every row (BF-1)", async () => {
    const { fn, calls } = makeFakeSql({
      userRows: [
        {
          id: "user-x",
          email: "rob@example.com",
          display_name: "Rob",
          avatar_color: "#654321",
          created_at: "2026-07-01T00:00:00.000Z",
        },
      ],
    });
    const pg = require("@/backend/lambda/data/postgres-client");
    pg.__setSqlForTests(fn);

    const result = await pg.listUsers();
    expect(result[0]?.avatarColor).toBe("#654321");

    const select = calls.find(
      (c) => c.text.includes("FROM users") && c.text.includes("ORDER BY created_at"),
    );
    expect(select?.text).toContain("avatar_color");
  });

  it("createUser returns avatar_color from the RETURNING clause (BF-1)", async () => {
    const { fn, calls } = makeFakeSql({
      createUserRow: {
        id: "user-x",
        email: "rob@example.com",
        display_name: "Rob",
        avatar_color: null,
        created_at: "2026-07-01T00:00:00.000Z",
      },
    });
    const pg = require("@/backend/lambda/data/postgres-client");
    pg.__setSqlForTests(fn);

    const result = await pg.createUser("rob@example.com", "Rob");
    expect(result.avatarColor).toBeUndefined();

    const insert = calls.find((c) => c.text.includes("INSERT INTO users"));
    expect(insert?.text).toContain("avatar_color");
  });

  it("updateUser throws for an unknown id (no rows returned)", async () => {
    const { fn } = makeFakeSql({ updateUserRow: null });
    const pg = require("@/backend/lambda/data/postgres-client");
    pg.__setSqlForTests(fn);

    await expect(pg.updateUser("no-such-user", { displayName: "X" })).rejects.toThrow();
  });

  it("listChannelMembers selects and returns email per member", async () => {
    const { fn } = makeFakeSql({
      memberRows: [
        {
          user_id: "user-x",
          email: "user-x@example.com",
          display_name: "User X",
          has_drawn_today: true,
        },
      ],
    });
    const pg = require("@/backend/lambda/data/postgres-client");
    pg.__setSqlForTests(fn);

    const result = await pg.listChannelMembers("channel-1", "prompt-1");
    expect(result).toEqual([
      {
        userId: "user-x",
        email: "user-x@example.com",
        displayName: "User X",
        hasDrawnToday: true,
      },
    ]);
  });
});

describe("postgres-client + channel-responses handler — AC2/AC4 gate on the real Postgres code path", () => {
  const ORIGINAL_DATA_MODE = process.env.SCRIBL_DATA_MODE;

  function makeEvent(opts: {
    userId?: string;
    pathParameters?: Record<string, string>;
    queryStringParameters?: Record<string, string>;
  }) {
    return {
      headers: opts.userId ? { "x-user-id": opts.userId } : {},
      pathParameters: opts.pathParameters,
      queryStringParameters: opts.queryStringParameters,
    } as never;
  }

  beforeEach(() => {
    jest.resetModules();
    process.env.SCRIBL_DATA_MODE = "postgres";
  });

  afterEach(() => {
    if (ORIGINAL_DATA_MODE === undefined) {
      delete process.env.SCRIBL_DATA_MODE;
    } else {
      process.env.SCRIBL_DATA_MODE = ORIGINAL_DATA_MODE;
    }
    jest.resetModules();
  });

  it("AC4: no membership row -> 403 not_a_member, before AC2 is even checked", async () => {
    const { fn } = makeFakeSql({ membership: false, submissionRow: null });
    const pg = require("@/backend/lambda/data/postgres-client");
    pg.__setSqlForTests(fn);
    const { handler } = require("@/backend/lambda/handlers/channel-responses");

    const result = await handler(
      makeEvent({
        userId: "user-x",
        pathParameters: { id: "channel-1" },
        queryStringParameters: { promptId: "prompt-1" },
      }),
    );

    expect(result.statusCode).toBe(403);
    expect(JSON.parse(result.body as string).error).toBe("not_a_member");
  });

  it("AC2: membership present but no submission row -> 403 not_submitted", async () => {
    const { fn } = makeFakeSql({ membership: true, submissionRow: null });
    const pg = require("@/backend/lambda/data/postgres-client");
    pg.__setSqlForTests(fn);
    const { handler } = require("@/backend/lambda/handlers/channel-responses");

    const result = await handler(
      makeEvent({
        userId: "user-x",
        pathParameters: { id: "channel-1" },
        queryStringParameters: { promptId: "prompt-1" },
      }),
    );

    expect(result.statusCode).toBe(403);
    expect(JSON.parse(result.body as string).error).toBe("not_submitted");
  });

  it("both membership and submission present -> 200 with the channel's responses", async () => {
    const { fn } = makeFakeSql({
      membership: true,
      submissionRow: {
        id: "submission-1",
        user_id: "user-x",
        prompt_id: "prompt-1",
        created_at: "2026-07-01T00:00:00.000Z",
      },
      submissionChannelIds: ["channel-1"],
      channelResponseRows: [
        {
          id: "response-1",
          prompt_id: "prompt-1",
          channel_id: "channel-1",
          user_id: "user-alice",
          author_name: "Alice",
          image_ref: null,
          body: "A very sleepy cat.",
          created_at: "2026-07-01T09:00:00.000Z",
        },
      ],
    });
    const pg = require("@/backend/lambda/data/postgres-client");
    pg.__setSqlForTests(fn);
    const { handler } = require("@/backend/lambda/handlers/channel-responses");

    const result = await handler(
      makeEvent({
        userId: "user-x",
        pathParameters: { id: "channel-1" },
        queryStringParameters: { promptId: "prompt-1" },
      }),
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body as string);
    expect(body.responses).toHaveLength(1);
    expect(body.responses[0].text).toBe("A very sleepy cat.");
  });
});
