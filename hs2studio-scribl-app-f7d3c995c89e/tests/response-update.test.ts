/**
 * response-update — creator-only edit/regenerate on
 * PATCH /channels/{id}/responses/{responseId}.
 *
 * AC4 channel isolation: non-member -> 403 not_a_member (server-side
 * getMembership, before the creator gate).
 *
 * Creator gate (launch-relevant): only the response's own author (server-
 * resolved authorId on the already-loaded response, never a client claim)
 * may edit caption/backgroundPrompt or trigger a regenerate -> 403
 * not_authorized for any other member.
 */
import { handler as responseUpdateHandler } from "@/backend/lambda/handlers/response-update";
import { handler as submitHandler } from "@/backend/lambda/handlers/submit";
import { handler as channelResponsesHandler } from "@/backend/lambda/handlers/channel-responses";
import {
  resetMockSubmissions,
  resetMockMemberships,
  resetMockResponses,
  getResponseById,
} from "@/backend/lambda/data/dynamodb-client";
import { promptIdForDate } from "@/backend/seeds/seed-data";

jest.mock("@/backend/lambda/enhance/trigger", () => ({
  triggerEnhancement: jest.fn(),
}));
import { triggerEnhancement } from "@/backend/lambda/enhance/trigger";

type EventArg = Parameters<typeof responseUpdateHandler>[0];
type ResultV2 = Awaited<ReturnType<typeof responseUpdateHandler>>;
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
  body?: unknown;
}): EventArg {
  return {
    headers: opts.userId ? { "x-user-id": opts.userId } : {},
    pathParameters: opts.pathParameters,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  } as unknown as EventArg;
}

function parseBody(body: string | undefined): any {
  return JSON.parse(body as string);
}

async function submit(user: string, channel: string, promptId: string, text: string) {
  const result = asStructured(
    await submitHandler(
      makeEvent({ userId: user, body: { promptId, channelIds: [channel], text } }) as unknown as Parameters<
        typeof submitHandler
      >[0],
    ),
  );
  expect(result.statusCode).toBe(200);
}

describe("response-update — AC4 then creator gate on PATCH responses/{responseId}", () => {
  const CHANNEL_1 = "channel-alpha";
  const CHANNEL_2 = "channel-beta";
  const today = new Date().toISOString().slice(0, 10);
  const P1 = promptIdForDate(today);

  const originalEnhanceEnabled = process.env.ENHANCE_ENABLED;

  beforeEach(() => {
    resetMockSubmissions();
    resetMockMemberships();
    resetMockResponses();
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (originalEnhanceEnabled === undefined) {
      delete process.env.ENHANCE_ENABLED;
    } else {
      process.env.ENHANCE_ENABLED = originalEnhanceEnabled;
    }
  });

  async function getOwnResponseId(user: string, channel: string) {
    const raw = {
      headers: { "x-user-id": user },
      pathParameters: { id: channel },
      queryStringParameters: { promptId: P1 },
    } as unknown as Parameters<typeof channelResponsesHandler>[0];
    const result = asStructured(await channelResponsesHandler(raw));
    const own = parseBody(result.body).responses.find((r: { authorId: string }) => r.authorId === user);
    if (!own) {
      throw new Error(`no response found for author ${user} in channel ${channel}`);
    }
    return own.id as string;
  }

  it("non-member -> 403 not_a_member", async () => {
    const AUTHOR = "user-ru-author-1";
    await submit(AUTHOR, CHANNEL_1, P1, "my art");
    const responseId = await getOwnResponseId(AUTHOR, CHANNEL_1);

    const NON_MEMBER = "user-ru-nonmember";
    const result = asStructured(
      await responseUpdateHandler(
        makeEvent({
          userId: NON_MEMBER,
          pathParameters: { id: CHANNEL_1, responseId },
          body: { text: "hacked caption" },
        }),
      ),
    );

    expect(result.statusCode).toBe(403);
    expect(parseBody(result.body).error).toBe("not_a_member");

    const unchanged = await getResponseById(responseId);
    expect(unchanged?.text).not.toBe("hacked caption");
  });

  it("non-author member -> 403 not_authorized (creator gate)", async () => {
    const AUTHOR = "user-ru-author-2";
    const OTHER_MEMBER = "user-ru-other-member";
    await submit(AUTHOR, CHANNEL_1, P1, "author's art");
    await submit(OTHER_MEMBER, CHANNEL_1, P1, "other member's art");
    const responseId = await getOwnResponseId(AUTHOR, CHANNEL_1);

    const result = asStructured(
      await responseUpdateHandler(
        makeEvent({
          userId: OTHER_MEMBER,
          pathParameters: { id: CHANNEL_1, responseId },
          body: { text: "not my response" },
        }),
      ),
    );

    expect(result.statusCode).toBe(403);
    expect(parseBody(result.body).error).toBe("not_authorized");

    const unchanged = await getResponseById(responseId);
    expect(unchanged?.text).toBe("author's art");
  });

  it("unauthenticated -> 401", async () => {
    const AUTHOR = "user-ru-author-3";
    await submit(AUTHOR, CHANNEL_1, P1, "my art");
    const responseId = await getOwnResponseId(AUTHOR, CHANNEL_1);

    const result = asStructured(
      await responseUpdateHandler(
        makeEvent({
          pathParameters: { id: CHANNEL_1, responseId },
          body: { text: "no auth" },
        }),
      ),
    );

    expect(result.statusCode).toBe(401);
  });

  it("author updates caption -> persists and returns 200", async () => {
    const AUTHOR = "user-ru-author-4";
    await submit(AUTHOR, CHANNEL_1, P1, "original caption");
    const responseId = await getOwnResponseId(AUTHOR, CHANNEL_1);

    const result = asStructured(
      await responseUpdateHandler(
        makeEvent({
          userId: AUTHOR,
          pathParameters: { id: CHANNEL_1, responseId },
          body: { text: "updated caption" },
        }),
      ),
    );

    expect(result.statusCode).toBe(200);
    expect(parseBody(result.body).response.text).toBe("updated caption");

    const persisted = await getResponseById(responseId);
    expect(persisted?.text).toBe("updated caption");
  });

  it("author sets backgroundPrompt -> persisted, round-trips, and is distinct from text/caption", async () => {
    const AUTHOR = "user-ru-author-5";
    await submit(AUTHOR, CHANNEL_1, P1, "the caption");
    const responseId = await getOwnResponseId(AUTHOR, CHANNEL_1);

    const result = asStructured(
      await responseUpdateHandler(
        makeEvent({
          userId: AUTHOR,
          pathParameters: { id: CHANNEL_1, responseId },
          body: { backgroundPrompt: "sunset over mountains" },
        }),
      ),
    );

    expect(result.statusCode).toBe(200);
    const body = parseBody(result.body).response;
    expect(body.backgroundPrompt).toBe("sunset over mountains");
    expect(body.text).toBe("the caption");
    expect(body.text).not.toBe(body.backgroundPrompt);

    const persisted = await getResponseById(responseId);
    expect(persisted?.backgroundPrompt).toBe("sunset over mountains");
    expect(persisted?.text).toBe("the caption");
  });

  it("author regenerate:true -> enhancementStatus becomes pending and enhance pipeline invoked with threaded backgroundPrompt", async () => {
    process.env.ENHANCE_ENABLED = "1";
    const AUTHOR = "user-ru-author-6";
    await submit(AUTHOR, CHANNEL_1, P1, "regenerate me");
    const responseId = await getOwnResponseId(AUTHOR, CHANNEL_1);
    (triggerEnhancement as jest.Mock).mockClear();

    const result = asStructured(
      await responseUpdateHandler(
        makeEvent({
          userId: AUTHOR,
          pathParameters: { id: CHANNEL_1, responseId },
          body: { backgroundPrompt: "cozy library", regenerate: true },
        }),
      ),
    );

    expect(result.statusCode).toBe(200);
    expect(parseBody(result.body).response.enhancementStatus).toBe("pending");

    const persisted = await getResponseById(responseId);
    expect(persisted?.enhancementStatus).toBe("pending");

    expect(triggerEnhancement).toHaveBeenCalledTimes(1);
    const callArgs = (triggerEnhancement as jest.Mock).mock.calls[0][0];
    expect(callArgs.responseId).toBe(responseId);
    expect(callArgs.backgroundPrompt).toBe("cozy library");
  });

  it("regenerate:true with ENHANCE_ENABLED unset -> 200, edits persist, never marks pending or fires enhance (no stuck-pending)", async () => {
    delete process.env.ENHANCE_ENABLED;
    const AUTHOR = "user-ru-author-7";
    await submit(AUTHOR, CHANNEL_1, P1, "regenerate me too");
    const responseId = await getOwnResponseId(AUTHOR, CHANNEL_1);
    (triggerEnhancement as jest.Mock).mockClear();

    const result = asStructured(
      await responseUpdateHandler(
        makeEvent({
          userId: AUTHOR,
          pathParameters: { id: CHANNEL_1, responseId },
          body: { backgroundPrompt: "cozy library", regenerate: true },
        }),
      ),
    );

    expect(result.statusCode).toBe(200);
    const body = parseBody(result.body).response;
    expect(body.backgroundPrompt).toBe("cozy library");
    expect(body.enhancementStatus).not.toBe("pending");

    const persisted = await getResponseById(responseId);
    expect(persisted?.backgroundPrompt).toBe("cozy library");
    expect(persisted?.enhancementStatus).not.toBe("pending");

    expect(triggerEnhancement).not.toHaveBeenCalled();
  });
});
