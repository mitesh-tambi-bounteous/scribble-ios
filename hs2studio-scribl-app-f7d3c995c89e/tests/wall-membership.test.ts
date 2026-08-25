/**
 * wall-membership — channel-roster (AC4-only, no AC2) + member-remove
 * (self-leave / creator-removes-other).
 *
 * See tests/channel-isolation.test.ts and tests/member-add.test.ts for the
 * shared handler-invocation conventions this file follows.
 */
import { handler as channelRosterHandler } from "@/backend/lambda/handlers/channel-roster";
import { handler as memberAddHandler } from "@/backend/lambda/handlers/member-add";
import { handler as memberRemoveHandler } from "@/backend/lambda/handlers/member-remove";
import * as dynamo from "@/backend/lambda/data/dynamodb-client";
import {
  createChannel,
  resetMockSubmissions,
  resetMockMemberships,
  resetMockResponses,
  resetMockUsers,
  resetMockChannels,
} from "@/backend/lambda/data/dynamodb-client";

type EventArg = Parameters<typeof channelRosterHandler>[0];
type ResultV2 = Awaited<ReturnType<typeof channelRosterHandler>>;
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

describe("wall-membership — channel-roster (AC4 only) + member-remove", () => {
  const CHANNEL_1 = "channel-membership-test";
  const ALICE = "user-alice";

  beforeEach(async () => {
    resetMockSubmissions();
    resetMockMemberships();
    resetMockResponses();
    resetMockUsers();
    resetMockChannels();

    // Establishes CHANNEL_1 with alice as creator; createChannel also grants
    // alice membership as a side effect.
    await createChannel("Membership Test", "group", false, ALICE, undefined, CHANNEL_1);

    // Alice invites bob in (alice is already a member so she can invite).
    const inviteResult = asStructured(
      await memberAddHandler(
        makeEvent({
          userId: ALICE,
          pathParameters: { id: CHANNEL_1 },
          body: { email: "bob@example.com", displayName: "Bob" },
        }),
      ),
    );
    expect(inviteResult.statusCode).toBe(200);
  });

  it("roster non-member read is denied 403 not_a_member", async () => {
    const result = asStructured(
      await channelRosterHandler(
        makeEvent({
          userId: "user-outsider",
          pathParameters: { id: CHANNEL_1 },
        }),
      ),
    );

    expect(result.statusCode).toBe(403);
    expect(parseBody(result.body).error).toBe("not_a_member");
  });

  it("roster member-but-unsubmitted read is 200 (AC2 does NOT gate the roster)", async () => {
    // Alice is a member and creator but has recorded NO submission for
    // today's prompt anywhere in this test.
    const result = asStructured(
      await channelRosterHandler(
        makeEvent({
          userId: ALICE,
          pathParameters: { id: CHANNEL_1 },
        }),
      ),
    );

    expect(result.statusCode).toBe(200);
    const body = parseBody(result.body);
    expect(body.createdBy).toBe(ALICE);
    expect(
      body.members.some((m: { userId: string }) => m.userId === ALICE),
    ).toBe(true);
    // Regression proof: no art/response text of any kind is present, since
    // none was ever submitted and the roster shape carries no response field.
    expect(result.body as string).not.toMatch(/response|imageRef|reactions/);
  });

  it("member-remove: creator removes another member -> 200, then roster no longer shows them", async () => {
    // Resolve bob's actual userId from the roster (invite mints a fresh id
    // derived from the email local-part).
    const rosterBefore = asStructured(
      await channelRosterHandler(
        makeEvent({ userId: ALICE, pathParameters: { id: CHANNEL_1 } }),
      ),
    );
    const bobId = parseBody(rosterBefore.body).members.find(
      (m: { email: string }) => m.email === "bob@example.com",
    ).userId;

    const removeResult = asStructured(
      await memberRemoveHandler(
        makeEvent({
          userId: ALICE,
          pathParameters: { id: CHANNEL_1 },
          queryStringParameters: { userId: bobId },
        }),
      ),
    );

    expect(removeResult.statusCode).toBe(200);
    expect(parseBody(removeResult.body)).toEqual({ ok: true });

    const rosterAfter = asStructured(
      await channelRosterHandler(
        makeEvent({ userId: ALICE, pathParameters: { id: CHANNEL_1 } }),
      ),
    );
    expect(rosterAfter.statusCode).toBe(200);
    const membersAfter = parseBody(rosterAfter.body).members;
    expect(membersAfter.some((m: { userId: string }) => m.userId === bobId)).toBe(false);
  });

  it("member-remove: non-creator cannot remove the creator -> 403 not_creator, creator still present", async () => {
    const rosterBefore = asStructured(
      await channelRosterHandler(
        makeEvent({ userId: ALICE, pathParameters: { id: CHANNEL_1 } }),
      ),
    );
    const bobId = parseBody(rosterBefore.body).members.find(
      (m: { email: string }) => m.email === "bob@example.com",
    ).userId;

    const removeResult = asStructured(
      await memberRemoveHandler(
        makeEvent({
          userId: bobId,
          pathParameters: { id: CHANNEL_1 },
          queryStringParameters: { userId: ALICE },
        }),
      ),
    );

    expect(removeResult.statusCode).toBe(403);
    expect(parseBody(removeResult.body).error).toBe("not_creator");

    const rosterAfter = asStructured(
      await channelRosterHandler(
        makeEvent({ userId: ALICE, pathParameters: { id: CHANNEL_1 } }),
      ),
    );
    expect(
      parseBody(rosterAfter.body).members.some(
        (m: { userId: string }) => m.userId === ALICE,
      ),
    ).toBe(true);
  });

  it("member-remove: self-leave removes only the caller", async () => {
    const rosterBefore = asStructured(
      await channelRosterHandler(
        makeEvent({ userId: ALICE, pathParameters: { id: CHANNEL_1 } }),
      ),
    );
    const bobId = parseBody(rosterBefore.body).members.find(
      (m: { email: string }) => m.email === "bob@example.com",
    ).userId;

    const removeResult = asStructured(
      await memberRemoveHandler(
        makeEvent({
          userId: bobId,
          pathParameters: { id: CHANNEL_1 },
        }),
      ),
    );

    expect(removeResult.statusCode).toBe(200);
    expect(parseBody(removeResult.body)).toEqual({ ok: true });

    // Bob removed himself; he is no longer a member so the roster read for
    // him is now 403, while alice's read still succeeds.
    const bobReadAfter = asStructured(
      await channelRosterHandler(
        makeEvent({ userId: bobId, pathParameters: { id: CHANNEL_1 } }),
      ),
    );
    expect(bobReadAfter.statusCode).toBe(403);

    const rosterAfter = asStructured(
      await channelRosterHandler(
        makeEvent({ userId: ALICE, pathParameters: { id: CHANNEL_1 } }),
      ),
    );
    expect(
      parseBody(rosterAfter.body).members.some(
        (m: { userId: string }) => m.userId === ALICE,
      ),
    ).toBe(true);
  });

  it("sole-owner-leave invariant: creator self-leave with only 1 member -> 409 sole_owner, deleteMembership not called", async () => {
    // Fresh channel with ONLY the creator as a member (bob is not invited
    // here), so countChannelMembers === 1 for this channel.
    const SOLO_CHANNEL = "channel-solo-owner";
    await createChannel("Solo", "group", false, ALICE, undefined, SOLO_CHANNEL);

    const deleteSpy = jest.spyOn(dynamo, "deleteMembership");

    const removeResult = asStructured(
      await memberRemoveHandler(
        makeEvent({ userId: ALICE, pathParameters: { id: SOLO_CHANNEL } }),
      ),
    );

    expect(removeResult.statusCode).toBe(409);
    expect(parseBody(removeResult.body).error).toBe("sole_owner");
    expect(deleteSpy).not.toHaveBeenCalled();
    deleteSpy.mockRestore();
  });

  it("sole-owner-leave invariant: creator self-leave with 2 members -> 200, deleteMembership called with (channelId, callerId)", async () => {
    // CHANNEL_1 already has alice (creator) + bob (invited in beforeEach), so
    // countChannelMembers === 2 for this channel.
    const deleteSpy = jest.spyOn(dynamo, "deleteMembership");

    const removeResult = asStructured(
      await memberRemoveHandler(
        makeEvent({ userId: ALICE, pathParameters: { id: CHANNEL_1 } }),
      ),
    );

    expect(removeResult.statusCode).toBe(200);
    expect(parseBody(removeResult.body)).toEqual({ ok: true });
    expect(deleteSpy).toHaveBeenCalledWith(CHANNEL_1, ALICE);
    deleteSpy.mockRestore();
  });
});
