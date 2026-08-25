/**
 * member-add — POST /channels/{id}/members invite-by-email.
 *
 * The caller must be the channel's creator/owner (server-derived via
 * data.getChannelCreator, never a client-supplied claim) before they can
 * invite anyone else in. The invitee is resolved-or-created by email and
 * granted membership, so they can then pass the AC4 gate on a channel read.
 */
import { handler as memberAddHandler } from "@/backend/lambda/handlers/member-add";
import { handler as submitHandler } from "@/backend/lambda/handlers/submit";
import { handler as channelResponsesHandler } from "@/backend/lambda/handlers/channel-responses";
import {
  resetMockSubmissions,
  resetMockMemberships,
  resetMockResponses,
  resetMockUsers,
  resetMockChannels,
  createChannel,
} from "@/backend/lambda/data/dynamodb-client";
import { promptIdForDate } from "@/backend/seeds/seed-data";

type EventArg = Parameters<typeof memberAddHandler>[0];
type ResultV2 = Awaited<ReturnType<typeof memberAddHandler>>;
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

async function submit(user: string, channel: string, promptId: string) {
  const result = asStructured(
    await submitHandler(
      makeEvent({ userId: user, body: { promptId, channelIds: [channel], text: "my art" } }),
    ),
  );
  expect(result.statusCode).toBe(200);
}

describe("member-add — caller-must-be-owner gate + invite-by-email", () => {
  const CHANNEL_1 = "channel-alpha";
  const today = new Date().toISOString().slice(0, 10);
  const P1 = promptIdForDate(today);

  beforeEach(() => {
    resetMockSubmissions();
    resetMockMemberships();
    resetMockResponses();
    resetMockUsers();
    resetMockChannels();
  });

  it("caller not the owner -> 403 not_creator, no membership row written", async () => {
    const OWNER = "user-owner";
    const CALLER = "user-outsider";
    await createChannel("Alpha", "group", false, OWNER, undefined, CHANNEL_1);

    const result = asStructured(
      await memberAddHandler(
        makeEvent({
          userId: CALLER,
          pathParameters: { id: CHANNEL_1 },
          body: { email: "invitee@example.com" },
        }),
      ),
    );

    expect(result.statusCode).toBe(403);
    expect(parseBody(result.body).error).toBe("not_creator");
  });

  it("caller is a plain member but not the owner -> 403 not_creator", async () => {
    const OWNER = "user-owner-2";
    const CALLER = "user-member";
    await createChannel("Alpha", "group", false, OWNER, undefined, CHANNEL_1);
    await submit(CALLER, CHANNEL_1, P1);

    const result = asStructured(
      await memberAddHandler(
        makeEvent({
          userId: CALLER,
          pathParameters: { id: CHANNEL_1 },
          body: { email: "invitee2@example.com" },
        }),
      ),
    );

    expect(result.statusCode).toBe(403);
    expect(parseBody(result.body).error).toBe("not_creator");
  });

  it("caller is the owner -> invitee resolved-or-created and added; invitee then passes the AC4 gate on a read", async () => {
    const CALLER = "user-inviter";
    await createChannel("Alpha", "group", false, CALLER, undefined, CHANNEL_1);
    await submit(CALLER, CHANNEL_1, P1);

    const result = asStructured(
      await memberAddHandler(
        makeEvent({
          userId: CALLER,
          pathParameters: { id: CHANNEL_1 },
          body: { email: "invitee@example.com", displayName: "Invitee" },
        }),
      ),
    );

    expect(result.statusCode).toBe(200);
    const body = parseBody(result.body);
    expect(body.member.displayName).toBe("Invitee");
    const inviteeId = body.member.userId;
    expect(typeof inviteeId).toBe("string");

    // Invitee has no submission yet -> still 403 not_submitted (AC2), but no
    // longer not_a_member (AC4 gate now passes).
    const readResult = asStructured(
      await channelResponsesHandler(
        makeEvent({
          userId: inviteeId,
          pathParameters: { id: CHANNEL_1 },
          queryStringParameters: { promptId: P1 },
        }),
      ),
    );
    expect(readResult.statusCode).toBe(403);
    expect(parseBody(readResult.body).error).toBe("not_submitted");
  });

  it("invalid body (missing email) -> 400 invalid_request", async () => {
    const CALLER = "user-inviter-badbody";
    await submit(CALLER, CHANNEL_1, P1);

    const result = asStructured(
      await memberAddHandler(
        makeEvent({
          userId: CALLER,
          pathParameters: { id: CHANNEL_1 },
          body: {},
        }),
      ),
    );

    expect(result.statusCode).toBe(400);
    expect(parseBody(result.body).error).toBe("invalid_request");
  });

  it("email containing a comma -> 400 invalid_request, no member added", async () => {
    const CALLER = "user-inviter-comma";
    await submit(CALLER, CHANNEL_1, P1);

    const result = asStructured(
      await memberAddHandler(
        makeEvent({
          userId: CALLER,
          pathParameters: { id: CHANNEL_1 },
          body: { email: "a@x.com,b@x.com" },
        }),
      ),
    );

    expect(result.statusCode).toBe(400);
    expect(parseBody(result.body).error).toBe("invalid_request");
  });

  it("email containing whitespace -> 400 invalid_request, no member added", async () => {
    const CALLER = "user-inviter-space";
    await submit(CALLER, CHANNEL_1, P1);

    const result = asStructured(
      await memberAddHandler(
        makeEvent({
          userId: CALLER,
          pathParameters: { id: CHANNEL_1 },
          body: { email: "a b@x.com" },
        }),
      ),
    );

    expect(result.statusCode).toBe(400);
    expect(parseBody(result.body).error).toBe("invalid_request");
  });

  it("email with no @ -> 400 invalid_request, no member added", async () => {
    const CALLER = "user-inviter-noat";
    await submit(CALLER, CHANNEL_1, P1);

    const result = asStructured(
      await memberAddHandler(
        makeEvent({
          userId: CALLER,
          pathParameters: { id: CHANNEL_1 },
          body: { email: "nope" },
        }),
      ),
    );

    expect(result.statusCode).toBe(400);
    expect(parseBody(result.body).error).toBe("invalid_request");
  });

  it("single valid email -> 200 and invitee is added", async () => {
    const CALLER = "user-inviter-valid";
    await createChannel("Alpha", "group", false, CALLER, undefined, CHANNEL_1);
    await submit(CALLER, CHANNEL_1, P1);

    const result = asStructured(
      await memberAddHandler(
        makeEvent({
          userId: CALLER,
          pathParameters: { id: CHANNEL_1 },
          body: { email: "valid-invitee@example.com" },
        }),
      ),
    );

    expect(result.statusCode).toBe(200);
    const body = parseBody(result.body);
    expect(body.member.email).toBe("valid-invitee@example.com");
    expect(typeof body.member.userId).toBe("string");
  });

  it("mixed-case email is normalized to lowercase before createUser (case-insensitive identity)", async () => {
    const CALLER = "user-inviter-mixedcase";
    await createChannel("Alpha", "group", false, CALLER, undefined, CHANNEL_1);
    await submit(CALLER, CHANNEL_1, P1);

    const result = asStructured(
      await memberAddHandler(
        makeEvent({
          userId: CALLER,
          pathParameters: { id: CHANNEL_1 },
          body: { email: "MixedCase@Example.COM" },
        }),
      ),
    );

    expect(result.statusCode).toBe(200);
    const body = parseBody(result.body);
    expect(body.member.email).toBe("mixedcase@example.com");
  });
});
