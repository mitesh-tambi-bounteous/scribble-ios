/**
 * backgroundPrompt privacy — ChannelResponse.backgroundPrompt is the
 * creator's PRIVATE AI background-steering prompt (see domain.ts). Verifies
 * the server masks it on the channel-wall read paths (channel-responses,
 * channel-members) for every response NOT authored by the caller, while
 * still returning it on the caller's own response.
 *
 * Fixtures are built against the mock backend's write overlay: submit()
 * grants membership + records a submission, then updateResponse (PATCH,
 * author-only) sets backgroundPrompt on the author's own response.
 */
import { handler as channelResponsesHandler } from "@/backend/lambda/handlers/channel-responses";
import { handler as channelMembersHandler } from "@/backend/lambda/handlers/channel-members";
import { handler as submitHandler } from "@/backend/lambda/handlers/submit";
import { handler as responseUpdateHandler } from "@/backend/lambda/handlers/response-update";
import {
  resetMockSubmissions,
  resetMockMemberships,
  resetMockResponses,
} from "@/backend/lambda/data/dynamodb-client";
import { promptIdForDate } from "@/backend/seeds/seed-data";

type EventArg = Parameters<typeof channelResponsesHandler>[0];
type ResultV2 = Awaited<ReturnType<typeof channelResponsesHandler>>;
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
async function submit(user: string, channel: string, promptId: string): Promise<void> {
  const result = asStructured(
    await submitHandler(
      makeEvent({ userId: user, body: { promptId, channelIds: [channel], text: "my art" } }),
    ),
  );
  expect(result.statusCode).toBe(200);
}

/** Looks up USER's own response id in CHANNEL for prompt P via the (unmasked-to-self) read path. */
async function responseIdFor(
  user: string,
  channel: string,
  promptId: string,
): Promise<string> {
  const result = asStructured(
    await channelResponsesHandler(
      makeEvent({
        userId: user,
        pathParameters: { id: channel },
        queryStringParameters: { promptId },
      }),
    ),
  );
  expect(result.statusCode).toBe(200);
  const { responses } = parseBody(result.body);
  const own = responses.find((r: any) => r.authorId === user);
  if (!own) {
    throw new Error(`no response found for ${user} in ${channel}/${promptId}`);
  }
  return own.id as string;
}

describe("backgroundPrompt privacy on channel-wall reads (creator-only field)", () => {
  const CHANNEL = "channel-privacy";
  const today = new Date().toISOString().slice(0, 10);
  const P1 = promptIdForDate(today);

  const ALICE = "user-alice-privacy";
  const BOB = "user-bob-privacy";
  const SECRET = "a hidden AI steering prompt only alice should see";

  beforeEach(() => {
    resetMockSubmissions();
    resetMockMemberships();
    resetMockResponses();
  });

  async function seedTwoAuthoredResponses(): Promise<void> {
    await submit(ALICE, CHANNEL, P1);
    await submit(BOB, CHANNEL, P1);
    const aliceResponseId = await responseIdFor(ALICE, CHANNEL, P1);

    const patchResult = asStructured(
      await responseUpdateHandler(
        makeEvent({
          userId: ALICE,
          pathParameters: { id: CHANNEL, responseId: aliceResponseId },
          body: { backgroundPrompt: SECRET },
        }),
      ),
    );
    expect(patchResult.statusCode).toBe(200);
  }

  it("channel-responses: caller sees own backgroundPrompt, not the other author's", async () => {
    await seedTwoAuthoredResponses();

    const result = asStructured(
      await channelResponsesHandler(
        makeEvent({
          userId: BOB,
          pathParameters: { id: CHANNEL },
          queryStringParameters: { promptId: P1 },
        }),
      ),
    );
    expect(result.statusCode).toBe(200);
    const { responses } = parseBody(result.body);

    const aliceResponse = responses.find((r: any) => r.authorId === ALICE);
    const bobResponse = responses.find((r: any) => r.authorId === BOB);
    expect(aliceResponse).toBeDefined();
    expect(bobResponse).toBeDefined();

    // Bob is the caller: his own response's backgroundPrompt (if any) would
    // survive, but Alice's must be stripped.
    expect(aliceResponse.backgroundPrompt).toBeUndefined();
  });

  it("channel-responses: the author reading their own wall still sees their backgroundPrompt", async () => {
    await seedTwoAuthoredResponses();

    const result = asStructured(
      await channelResponsesHandler(
        makeEvent({
          userId: ALICE,
          pathParameters: { id: CHANNEL },
          queryStringParameters: { promptId: P1 },
        }),
      ),
    );
    expect(result.statusCode).toBe(200);
    const { responses } = parseBody(result.body);
    const aliceResponse = responses.find((r: any) => r.authorId === ALICE);
    expect(aliceResponse.backgroundPrompt).toBe(SECRET);
  });

  it("channel-members: a peer's embedded response has backgroundPrompt stripped", async () => {
    await seedTwoAuthoredResponses();

    const result = asStructured(
      await channelMembersHandler(
        makeEvent({
          userId: BOB,
          pathParameters: { id: CHANNEL },
          queryStringParameters: { promptId: P1 },
        }),
      ),
    );
    expect(result.statusCode).toBe(200);
    const { members } = parseBody(result.body);
    const aliceMember = members.find((m: any) => m.userId === ALICE);
    expect(aliceMember).toBeDefined();
    expect(aliceMember.response).toBeDefined();
    expect(aliceMember.response.backgroundPrompt).toBeUndefined();
  });

  it("channel-members: the caller's own embedded response keeps backgroundPrompt", async () => {
    await seedTwoAuthoredResponses();

    const result = asStructured(
      await channelMembersHandler(
        makeEvent({
          userId: ALICE,
          pathParameters: { id: CHANNEL },
          queryStringParameters: { promptId: P1 },
        }),
      ),
    );
    expect(result.statusCode).toBe(200);
    const { members } = parseBody(result.body);
    const aliceMember = members.find((m: any) => m.userId === ALICE);
    expect(aliceMember.response.backgroundPrompt).toBe(SECRET);
  });
});
