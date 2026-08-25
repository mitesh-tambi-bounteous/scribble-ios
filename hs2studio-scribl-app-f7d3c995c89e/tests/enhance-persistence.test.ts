/**
 * T4 — persistence for the async enhancement trigger: putSubmission writes
 * enhancement_status='pending' on each response row it creates,
 * listChannelResponses maps the two new columns, and setEnhancementResult
 * issues the expected UPDATE. Uses the injected fake sql executor
 * (__setSqlForTests) — no real network / DB connection.
 */

type SqlCall = { text: string; values: unknown[] };

function makeFakeSql(opts: { channelResponseRows?: unknown[] } = {}) {
  const calls: SqlCall[] = [];

  const fn = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join(" ");
    calls.push({ text, values });

    if (text.includes("FROM reactions")) {
      return Promise.resolve([]);
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

describe("postgres-client — T4 enhancement persistence", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, ENHANCE_ENABLED: "1" };
  });

  afterEach(() => {
    jest.resetModules();
    process.env = ORIGINAL_ENV;
  });

  it("putSubmission writes enhancement_status='pending' when an image is present and ENHANCE_ENABLED is set, and returns per-channel response ids", async () => {
    const { fn, calls } = makeFakeSql();
    const pg = require("@/backend/lambda/data/postgres-client");
    pg.__setSqlForTests(fn);

    const responseIds = await pg.putSubmission({
      id: "submission-1",
      userId: "user-x",
      promptId: "prompt-1",
      channelIds: ["channel-1", "channel-2"],
      createdAt: "2026-07-09T00:00:00.000Z",
      imageRef: "data:image/png;base64,AAA",
    });

    expect(responseIds).toEqual(["submission-1-channel-1", "submission-1-channel-2"]);

    const insertCalls = calls.filter((c) => c.text.includes("INSERT INTO responses"));
    expect(insertCalls).toHaveLength(2);
    for (const call of insertCalls) {
      expect(call.text).toContain("enhancement_status");
      expect(call.values).toContain("pending");
    }
  });

  it("putSubmission leaves enhancement_status null for a text-only submission", async () => {
    const { fn, calls } = makeFakeSql();
    const pg = require("@/backend/lambda/data/postgres-client");
    pg.__setSqlForTests(fn);

    await pg.putSubmission({
      id: "submission-2",
      userId: "user-x",
      promptId: "prompt-1",
      channelIds: ["channel-1"],
      createdAt: "2026-07-09T00:00:00.000Z",
      text: "just words",
    });

    const insertCall = calls.find((c) => c.text.includes("INSERT INTO responses"));
    expect(insertCall).toBeDefined();
    expect(insertCall?.values).not.toContain("pending");
  });

  it("BF-6: putSubmission leaves enhancement_status null when an image is present but ENHANCE_ENABLED is unset (no forever-pending spinner)", async () => {
    delete process.env.ENHANCE_ENABLED;
    const { fn, calls } = makeFakeSql();
    const pg = require("@/backend/lambda/data/postgres-client");
    pg.__setSqlForTests(fn);

    await pg.putSubmission({
      id: "submission-3",
      userId: "user-x",
      promptId: "prompt-1",
      channelIds: ["channel-1"],
      createdAt: "2026-07-09T00:00:00.000Z",
      imageRef: "data:image/png;base64,AAA",
    });

    const insertCall = calls.find((c) => c.text.includes("INSERT INTO responses"));
    expect(insertCall).toBeDefined();
    expect(insertCall?.values).not.toContain("pending");
  });

  it("listChannelResponses maps enhanced_image_ref and enhancement_status onto the domain response", async () => {
    const { fn } = makeFakeSql({
      channelResponseRows: [
        {
          id: "response-1",
          prompt_id: "prompt-1",
          channel_id: "channel-1",
          user_id: "user-alice",
          author_name: "Alice",
          image_ref: "orig-ref",
          body: null,
          created_at: "2026-07-01T09:00:00.000Z",
          enhanced_image_ref: "enhanced-ref",
          enhancement_status: "ready",
        },
      ],
    });
    const pg = require("@/backend/lambda/data/postgres-client");
    pg.__setSqlForTests(fn);

    const responses = await pg.listChannelResponses("channel-1", "prompt-1");

    expect(responses).toHaveLength(1);
    expect(responses[0]).toMatchObject({
      id: "response-1",
      enhancedImageRef: "enhanced-ref",
      enhancementStatus: "ready",
    });
  });

  it("listChannelResponses maps missing enhancement columns to undefined", async () => {
    const { fn } = makeFakeSql({
      channelResponseRows: [
        {
          id: "response-1",
          prompt_id: "prompt-1",
          channel_id: "channel-1",
          user_id: "user-alice",
          author_name: "Alice",
          image_ref: null,
          body: "hi",
          created_at: "2026-07-01T09:00:00.000Z",
          enhanced_image_ref: null,
          enhancement_status: null,
        },
      ],
    });
    const pg = require("@/backend/lambda/data/postgres-client");
    pg.__setSqlForTests(fn);

    const responses = await pg.listChannelResponses("channel-1", "prompt-1");

    expect(responses[0]?.enhancedImageRef).toBeUndefined();
    expect(responses[0]?.enhancementStatus).toBeUndefined();
  });

  it("setEnhancementResult issues a single UPDATE with the correct id/ref/status", async () => {
    const { fn, calls } = makeFakeSql();
    const pg = require("@/backend/lambda/data/postgres-client");
    pg.__setSqlForTests(fn);

    await pg.setEnhancementResult("response-1", "data:image/png;base64,BBB", "ready");

    const updateCalls = calls.filter((c) => c.text.includes("UPDATE responses"));
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]?.values).toEqual(["data:image/png;base64,BBB", "ready", "response-1"]);
  });

  it("setEnhancementResult('failed') passes a null ref", async () => {
    const { fn, calls } = makeFakeSql();
    const pg = require("@/backend/lambda/data/postgres-client");
    pg.__setSqlForTests(fn);

    await pg.setEnhancementResult("response-1", null, "failed");

    const updateCalls = calls.filter((c) => c.text.includes("UPDATE responses"));
    expect(updateCalls[0]?.values).toEqual([null, "failed", "response-1"]);
  });
});
