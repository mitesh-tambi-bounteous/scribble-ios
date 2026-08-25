/**
 * signup-channels — auto-provision exactly the Personal Archive channel on
 * signup (BF-13). There is no Public wall anymore (removed): new users get
 * ONLY their Personal Archive. Family/Friends/Co-Workers are no longer
 * auto-provisioned; they remain user-creatable via POST /walls.
 *
 * Deterministic id scheme (auth-signup.ts): channel-{userId}-archive. This
 * makes the channel picker non-empty right after signup and keeps signup
 * idempotent on email (re-signup must not error or duplicate
 * membership/channel rows).
 */
import { handler as signupHandler } from "@/backend/lambda/handlers/auth-signup";
import { handler as wallsListHandler } from "@/backend/lambda/handlers/walls-list";
import { handler as memberAddHandler } from "@/backend/lambda/handlers/member-add";
import { handler as channelResponsesHandler } from "@/backend/lambda/handlers/channel-responses";
import { handler as submitHandler } from "@/backend/lambda/handlers/submit";
import { createChannel } from "@/backend/lambda/data";
import {
  resetMockUsers,
  resetMockMemberships,
  resetMockCreatedChannels,
  resetMockSubmissions,
} from "@/backend/lambda/data/dynamodb-client";

type EventArg = Parameters<typeof signupHandler>[0];
type ResultV2 = Awaited<ReturnType<typeof signupHandler>>;
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
  body?: unknown;
  pathParameters?: Record<string, string>;
  queryStringParameters?: Record<string, string>;
}): EventArg {
  return {
    headers: opts.userId ? { "x-user-id": opts.userId } : {},
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    pathParameters: opts.pathParameters,
    queryStringParameters: opts.queryStringParameters,
  } as unknown as EventArg;
}

function parseBody(body: string | undefined): any {
  return JSON.parse(body as string);
}

async function signup(email: string, displayName: string) {
  const result = asStructured(
    await signupHandler(makeEvent({ body: { email, displayName } })),
  );
  expect(result.statusCode).toBe(200);
  return parseBody(result.body).user as { id: string; email: string };
}

async function listWalls(userId: string) {
  const result = asStructured(
    await wallsListHandler(makeEvent({ userId })),
  );
  expect(result.statusCode).toBe(200);
  return parseBody(result.body).walls as { id: string; name: string; kind: string; isPublic: boolean }[];
}

describe("signup auto-provisions per-user channels", () => {
  beforeEach(() => {
    resetMockUsers();
    resetMockMemberships();
    resetMockCreatedChannels();
  });

  it("new user is a member of exactly Personal Archive — no Public wall", async () => {
    const user = await signup("alice@example.com", "Alice");
    const walls = await listWalls(user.id);

    expect(walls.length).toBe(1);

    const archive = walls[0];
    expect(archive?.id).toBe(`channel-${user.id}-archive`);
    expect(archive?.name).toBe("Personal Archive");
    expect(archive?.kind).toBe("group");
    expect(archive?.isPublic).toBe(false);

    expect(walls.some((w) => w.id === "channel-public")).toBe(false);
  });

  it("two users' personal channels are distinct and isolated (AC4)", async () => {
    const alice = await signup("alice2@example.com", "Alice");
    const bob = await signup("bob2@example.com", "Bob");

    const aliceWalls = await listWalls(alice.id);
    const bobWalls = await listWalls(bob.id);

    const aliceIds = new Set(aliceWalls.map((w) => w.id));
    const bobIds = new Set(bobWalls.map((w) => w.id));

    // Alice is a member of only her own archive, never Bob's (and no shared
    // Public wall exists anymore to accidentally leak into).
    expect(aliceIds.has(`channel-${alice.id}-archive`)).toBe(true);
    expect(aliceIds.has(`channel-${bob.id}-archive`)).toBe(false);
    expect(bobIds.has(`channel-${bob.id}-archive`)).toBe(true);
    expect(bobIds.has(`channel-${alice.id}-archive`)).toBe(false);
  });

  it("re-signup (idempotent on email) does not error or duplicate channels/memberships", async () => {
    const first = await signup("carol@example.com", "Carol");
    const second = await signup("carol@example.com", "Carol");

    expect(second.id).toBe(first.id);

    const walls = await listWalls(first.id);
    expect(walls.length).toBe(1);
    const ids = walls.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("BF-8/BF-9 — shared Family wall dedupe, with the submit-to-unlock lock intact", () => {
  const today = new Date().toISOString().slice(0, 10);
  const P1 = `prompt-${today}`;

  beforeEach(() => {
    resetMockUsers();
    resetMockMemberships();
    resetMockCreatedChannels();
    resetMockSubmissions();
  });

  it("BF-8: after Rob invites Katie into his Family channel, Katie sees exactly one Family wall — the shared one, not her own empty duplicate", async () => {
    const rob = await signup("rob@example.com", "Rob");
    const katie = await signup("katie@example.com", "Katie");

    // BF-13: Family is no longer auto-provisioned at signup, so create Rob's
    // Family channel explicitly here (deterministic id, matching the shape
    // auth-signup used to auto-provision) before exercising the BF-8 dedupe.
    const robFamilyChannelId = `channel-${rob.id}-family`;
    await createChannel("Family", "group", false, rob.id, undefined, robFamilyChannelId);

    const inviteResult = asStructured(
      await memberAddHandler(
        makeEvent({
          userId: rob.id,
          pathParameters: { id: robFamilyChannelId },
          body: { email: "katie@example.com" },
        }),
      ),
    );
    expect(inviteResult.statusCode).toBe(200);

    const katieWalls = await listWalls(katie.id);
    const familyWalls = katieWalls.filter((w) => w.name === "Family");

    expect(familyWalls).toHaveLength(1);
    expect(familyWalls[0]?.id).toBe(robFamilyChannelId);

    const robWalls = await listWalls(rob.id);
    expect(robWalls.filter((w) => w.name === "Family")).toHaveLength(1);
  });

  it("BF-9: on the shared Family wall, Katie is locked until she submits, then sees Rob's art (AC2 intact after the BF-8 dedupe)", async () => {
    const rob = await signup("rob2@example.com", "Rob");
    const katie = await signup("katie2@example.com", "Katie");
    const robFamilyChannelId = `channel-${rob.id}-family`;
    await createChannel("Family", "group", false, rob.id, undefined, robFamilyChannelId);

    await memberAddHandler(
      makeEvent({
        userId: rob.id,
        pathParameters: { id: robFamilyChannelId },
        body: { email: "katie2@example.com" },
      }),
    );

    const robSubmit = asStructured(
      await submitHandler(
        makeEvent({
          userId: rob.id,
          body: { promptId: P1, channelIds: [robFamilyChannelId], text: "Rob's drawing" },
        }),
      ),
    );
    expect(robSubmit.statusCode).toBe(200);

    // AC2: Katie hasn't submitted yet — locked, not empty, and Rob's art
    // doesn't leak.
    const katieReadBeforeSubmit = asStructured(
      await channelResponsesHandler(
        makeEvent({
          userId: katie.id,
          pathParameters: { id: robFamilyChannelId },
          queryStringParameters: { promptId: P1 },
        }),
      ),
    );
    expect(katieReadBeforeSubmit.statusCode).toBe(403);
    expect(katieReadBeforeSubmit.body as string).not.toContain("Rob's drawing");

    const katieSubmit = asStructured(
      await submitHandler(
        makeEvent({
          userId: katie.id,
          body: { promptId: P1, channelIds: [robFamilyChannelId], text: "Katie's drawing" },
        }),
      ),
    );
    expect(katieSubmit.statusCode).toBe(200);

    // After Katie submits, she sees Rob's art (and hers) on the shared wall.
    const katieReadAfterSubmit = asStructured(
      await channelResponsesHandler(
        makeEvent({
          userId: katie.id,
          pathParameters: { id: robFamilyChannelId },
          queryStringParameters: { promptId: P1 },
        }),
      ),
    );
    expect(katieReadAfterSubmit.statusCode).toBe(200);
    const katieBody = parseBody(katieReadAfterSubmit.body);
    const texts = katieBody.responses.map((r: { text?: string }) => r.text);
    expect(texts).toContain("Rob's drawing");
    expect(texts).toContain("Katie's drawing");

    // Rob, in turn, sees Katie's submission on the same shared wall.
    const robRead = asStructured(
      await channelResponsesHandler(
        makeEvent({
          userId: rob.id,
          pathParameters: { id: robFamilyChannelId },
          queryStringParameters: { promptId: P1 },
        }),
      ),
    );
    expect(robRead.statusCode).toBe(200);
    expect(parseBody(robRead.body).responses.map((r: { text?: string }) => r.text)).toContain(
      "Katie's drawing",
    );
  });
});
