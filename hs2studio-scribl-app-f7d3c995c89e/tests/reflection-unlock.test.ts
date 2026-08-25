/**
 * reflection-unlock — a text-only submit for a locked past day (the family
 * screen's ReflectionInput, app/family.tsx) writes a real submission record
 * via POST /submit and subsequently unlocks that day's roster read (AC2):
 * getChannelMembers/channel-members returns members instead of throwing
 * NotSubmittedError / returning 403 not_submitted.
 *
 * Server-layer assertion (Lambda handlers directly), same pattern as
 * submit-to-unlock.test.ts — the unlock is driven by the recorded
 * submission, not any client-side "reflection saved" flag.
 */
import { handler as submitHandler } from "@/backend/lambda/handlers/submit";
import { handler as channelMembersHandler } from "@/backend/lambda/handlers/channel-members";
import {
  resetMockSubmissions,
  resetMockMemberships,
  resetMockResponses,
} from "@/backend/lambda/data/dynamodb-client";

type EventArg = Parameters<typeof submitHandler>[0];
type ResultV2 = Awaited<ReturnType<typeof submitHandler>>;
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

describe("reflection-unlock — text-only submit for a locked past day unlocks that day", () => {
  const USER = "user-reflector";
  const CHANNEL = "channel-alpha";
  const PAST_PROMPT = "prompt-2026-06-20"; // a day the user did not draw for

  beforeEach(() => {
    resetMockSubmissions();
    resetMockMemberships();
    resetMockResponses();
  });

  it("roster read for the past day is locked (403 not_submitted) before any submission", async () => {
    // Join the channel via a different prompt so we isolate the AC2 gate
    // (not AC4) for PAST_PROMPT.
    await submitHandler(
      makeEvent({
        userId: USER,
        body: { promptId: "prompt-2026-06-21", channelIds: [CHANNEL], text: "some other day" },
      }),
    );

    const before = asStructured(
      await channelMembersHandler(
        makeEvent({
          userId: USER,
          pathParameters: { id: CHANNEL },
          queryStringParameters: { promptId: PAST_PROMPT },
        }),
      ),
    );

    expect(before.statusCode).toBe(403);
    expect(parseBody(before.body).error).toBe("not_submitted");
  });

  it("a text-only reflection submit (no image) writes a submission and subsequently unlocks the day", async () => {
    // The reflection-input path: dataClient.submit({ promptId, channelIds, text }) — no imageRef.
    const submitResult = asStructured(
      await submitHandler(
        makeEvent({
          userId: USER,
          body: { promptId: PAST_PROMPT, channelIds: [CHANNEL], text: "I wish I'd drawn the moon." },
        }),
      ),
    );
    expect(submitResult.statusCode).toBe(200);

    const after = asStructured(
      await channelMembersHandler(
        makeEvent({
          userId: USER,
          pathParameters: { id: CHANNEL },
          queryStringParameters: { promptId: PAST_PROMPT },
        }),
      ),
    );

    expect(after.statusCode).toBe(200);
    const { members } = parseBody(after.body);
    expect(Array.isArray(members)).toBe(true);
    const me = members.find((m: { userId: string }) => m.userId === USER);
    expect(me).toBeDefined();
    expect(me.hasDrawnToday).toBe(true);
    expect(me.response.text).toBe("I wish I'd drawn the moon.");
  });
});
