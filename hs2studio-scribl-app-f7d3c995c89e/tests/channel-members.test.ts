/**
 * channel-members — AC4 (channel isolation) + AC2 (submit-to-unlock) on the
 * GET /channels/{id}/members roster read.
 *
 * The member roster (who's in the channel + who's drawn today) is peer
 * content just like channel-responses, so it must be gated identically:
 * AC4 membership check first, then AC2 submission check, both server-side.
 *
 * Fixtures are built in-test against the mock backend's write overlay
 * (submitHandler grants membership + records a submission as a side
 * effect) — no seed data is relied on.
 */
import { handler as channelMembersHandler } from "@/backend/lambda/handlers/channel-members";
import { handler as submitHandler } from "@/backend/lambda/handlers/submit";
import {
  resetMockSubmissions,
  resetMockMemberships,
  resetMockResponses,
  resetMockUsers,
  createUser,
  updateUser,
} from "@/backend/lambda/data/dynamodb-client";
import { promptIdForDate } from "@/backend/seeds/seed-data";

type EventArg = Parameters<typeof channelMembersHandler>[0];
type ResultV2 = Awaited<ReturnType<typeof channelMembersHandler>>;
type StructuredResult = Exclude<ResultV2, string>;

function asStructured(result: ResultV2): StructuredResult {
  if (typeof result === "string") {
    throw new Error(
      "expected a structured result ({ statusCode, body }), got string: " + result,
    );
  }
  return result;
}

function makeEvent(opts: {
  userId?: string;
  pathParameters?: Record<string, string>;
  queryStringParameters?: Record<string, string>;
  body?: unknown;
}): EventArg {
  return {
    headers: opts.userId ? { "x-user-id": opts.userId } : {},
    pathParameters: opts.pathParameters,
    queryStringParameters: opts.queryStringParameters,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  } as unknown as EventArg;
}

function parseBody(body: string | undefined): any {
  return JSON.parse(body as string);
}

/** Submits USER to CHANNEL for prompt P, granting membership as a side effect. */
async function submit(user: string, channel: string, promptId: string) {
  const result = asStructured(
    await submitHandler(
      makeEvent({ userId: user, body: { promptId, channelIds: [channel], text: "my art" } }),
    ),
  );
  expect(result.statusCode).toBe(200);
}

describe("channel-members (AC4 then AC2) — server-side gates on the roster read", () => {
  const CHANNEL_1 = "channel-alpha";
  const CHANNEL_2 = "channel-beta";

  const today = new Date().toISOString().slice(0, 10);
  const P1 = promptIdForDate(today);

  beforeEach(() => {
    resetMockSubmissions();
    resetMockMemberships();
    resetMockResponses();
  });

  it("non-member -> 403 not_a_member: alice is not a member of channel-beta", async () => {
    const ALICE = "user-alice";
    await submit(ALICE, CHANNEL_1, P1); // member of channel-1 only

    const result = asStructured(
      await channelMembersHandler(
        makeEvent({
          userId: ALICE,
          pathParameters: { id: CHANNEL_2 },
          queryStringParameters: { promptId: P1 },
        }),
      ),
    );

    expect(result.statusCode).toBe(403);
    expect(parseBody(result.body).error).toBe("not_a_member");
  });

  it("member without submission -> 403 not_submitted: demo is joined to channel-beta but has no submission for P1", async () => {
    // Give demo membership via a submission to channel-beta for a DIFFERENT
    // prompt, then read against P1 with no submission recorded for P1.
    const DEMO = "user-demo-noSub";
    const OTHER_PROMPT = "prompt-2999-01-01";
    await submit(DEMO, CHANNEL_2, OTHER_PROMPT);

    const result = asStructured(
      await channelMembersHandler(
        makeEvent({
          userId: DEMO,
          pathParameters: { id: CHANNEL_2 },
          queryStringParameters: { promptId: P1 },
        }),
      ),
    );

    expect(result.statusCode).toBe(403);
    expect(parseBody(result.body).error).toBe("not_submitted");
  });

  it("member with submission -> 200 with the roster: bob is a channel-beta member with a submission for P1", async () => {
    const BOB = "user-bob";
    await submit(BOB, CHANNEL_2, P1);

    const result = asStructured(
      await channelMembersHandler(
        makeEvent({
          userId: BOB,
          pathParameters: { id: CHANNEL_2 },
          queryStringParameters: { promptId: P1 },
        }),
      ),
    );

    expect(result.statusCode).toBe(200);
    const body = parseBody(result.body);
    expect(Array.isArray(body.members)).toBe(true);
  });

  it("spoofed membership still denied: a client-supplied member=true claim with no server-side record is still 403", async () => {
    const USER = "user-spoofer-members";

    // Submit to channel-1 only so this user has a submission, but never
    // joins channel-beta.
    await submit(USER, CHANNEL_1, P1);

    const result = asStructured(
      await channelMembersHandler(
        makeEvent({
          userId: USER,
          pathParameters: { id: CHANNEL_2 },
          queryStringParameters: { promptId: P1, member: "true" },
          body: { member: true },
        }),
      ),
    );

    expect(result.statusCode).toBe(403);
    expect(parseBody(result.body).error).toBe("not_a_member");
  });
});

describe("channel-members — per-channel response hydration + avatarColor (W1a)", () => {
  const CHANNEL_1 = "channel-alpha";
  const CHANNEL_2 = "channel-beta";
  const OTHER_PROMPT = "prompt-2999-01-01";

  const today = new Date().toISOString().slice(0, 10);
  const P1 = promptIdForDate(today);

  beforeEach(() => {
    resetMockSubmissions();
    resetMockMemberships();
    resetMockResponses();
    resetMockUsers();
  });

  function memberFor(members: any[], userId: string) {
    const m = members.find((x) => x.userId === userId);
    if (!m) {
      throw new Error(`member ${userId} not found in roster`);
    }
    return m;
  }

  it("member who submitted TO THIS CHANNEL gets response populated + hasDrawnToday true", async () => {
    const ALICE = "user-alice";
    await submit(ALICE, CHANNEL_2, P1); // response in channel-beta for P1

    const result = asStructured(
      await channelMembersHandler(
        makeEvent({
          userId: ALICE,
          pathParameters: { id: CHANNEL_2 },
          queryStringParameters: { promptId: P1 },
        }),
      ),
    );

    expect(result.statusCode).toBe(200);
    const alice = memberFor(parseBody(result.body).members, ALICE);
    expect(alice.hasDrawnToday).toBe(true);
    expect(alice.response).toBeDefined();
    expect(alice.response.channelId).toBe(CHANNEL_2);
    expect(alice.response.promptId).toBe(P1);
    expect(alice.response.authorId).toBe(ALICE);
  });

  it("member who submitted only to a DIFFERENT channel gets response undefined + hasDrawnToday FALSE", async () => {
    const ALICE = "user-alice";
    const BOB = "user-bob";

    // Alice: the caller — a channel-beta member with a P1 submission there.
    await submit(ALICE, CHANNEL_2, P1);
    // Bob: joins channel-beta via a DIFFERENT prompt, and submits P1 only to
    // channel-alpha. He has no P1 response in channel-beta.
    await submit(BOB, CHANNEL_2, OTHER_PROMPT);
    await submit(BOB, CHANNEL_1, P1);

    const result = asStructured(
      await channelMembersHandler(
        makeEvent({
          userId: ALICE,
          pathParameters: { id: CHANNEL_2 },
          queryStringParameters: { promptId: P1 },
        }),
      ),
    );

    expect(result.statusCode).toBe(200);
    const bob = memberFor(parseBody(result.body).members, BOB);
    expect(bob.hasDrawnToday).toBe(false);
    expect(bob.response).toBeUndefined();
  });

  it("avatarColor present when set on the user", async () => {
    // createUser derives id from the email prefix, so this user's id is
    // "user-cat" — matching the id submit() posts under.
    await createUser("cat@example.com", "Cat");
    await updateUser("user-cat", { avatarColor: "#00FF88" });
    await submit("user-cat", CHANNEL_2, P1);

    const result = asStructured(
      await channelMembersHandler(
        makeEvent({
          userId: "user-cat",
          pathParameters: { id: CHANNEL_2 },
          queryStringParameters: { promptId: P1 },
        }),
      ),
    );

    expect(result.statusCode).toBe(200);
    const cat = memberFor(parseBody(result.body).members, "user-cat");
    expect(cat.avatarColor).toBe("#00FF88");
    expect(cat.response.authorAvatarColor).toBe("#00FF88");
  });
});
