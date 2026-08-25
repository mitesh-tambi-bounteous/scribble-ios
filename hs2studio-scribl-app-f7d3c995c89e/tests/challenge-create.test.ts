/**
 * challenge-create — POST /channels/{id}/challenges.
 *
 * Membership gate (mirrors AC4 on channel-responses.ts): only a member of
 * the channel may create a challenge in it, enforced server-side via
 * getMembership. Also covers request validation (word, drawSeconds - the
 * per-drawing timer - and toolset). Challenges are open-ended (no
 * deadline/duration).
 */
import { handler as submitHandler } from "@/backend/lambda/handlers/submit";
import { handler as challengeCreateHandler } from "@/backend/lambda/handlers/challenge-create";
import {
  resetMockChallenges,
  resetMockMemberships,
  resetMockSubmissions,
  resetMockResponses,
} from "@/backend/lambda/data/dynamodb-client";
import { promptIdForDate } from "@/backend/seeds/seed-data";

type EventArg = Parameters<typeof challengeCreateHandler>[0];
type ResultV2 = Awaited<ReturnType<typeof challengeCreateHandler>>;
type StructuredResult = Exclude<ResultV2, string>;

function asStructured(result: ResultV2): StructuredResult {
  if (typeof result === "string") {
    throw new Error("expected a structured result ({ statusCode, body }), got string: " + result);
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
      makeEvent({ userId: user, body: { promptId, channelIds: [channel], text } }) as any,
    ),
  );
  expect(result.statusCode).toBe(200);
}

const VALID_TOOLSET = { brushes: ["basic", "fork"], colors: ["#000000", "#E23B3B"] };

describe("challenge-create (POST /channels/{id}/challenges)", () => {
  const CHANNEL = "channel-create-test";
  const today = new Date().toISOString().slice(0, 10);
  const P1 = promptIdForDate(today);

  beforeEach(() => {
    resetMockChallenges();
    resetMockMemberships();
    resetMockSubmissions();
    resetMockResponses();
  });

  it("denies a non-member with 403 not_a_member", async () => {
    const result = asStructured(
      await challengeCreateHandler(
        makeEvent({
          userId: "user-nonmember",
          pathParameters: { id: CHANNEL },
          body: { word: "castle", drawSeconds: 120, toolset: VALID_TOOLSET },
        }),
      ),
    );
    expect(result.statusCode).toBe(403);
    expect(parseBody(result.body).error).toBe("not_a_member");
  });

  it("rejects an empty word with 400 invalid_request", async () => {
    await submit("user-member", CHANNEL, P1, "joining");
    const result = asStructured(
      await challengeCreateHandler(
        makeEvent({
          userId: "user-member",
          pathParameters: { id: CHANNEL },
          body: { word: "", drawSeconds: 120, toolset: VALID_TOOLSET },
        }),
      ),
    );
    expect(result.statusCode).toBe(400);
    expect(parseBody(result.body).error).toBe("invalid_request");
  });

  it("rejects drawSeconds below the 10s floor with 400 invalid_request", async () => {
    await submit("user-member", CHANNEL, P1, "joining");
    const result = asStructured(
      await challengeCreateHandler(
        makeEvent({
          userId: "user-member",
          pathParameters: { id: CHANNEL },
          body: { word: "castle", drawSeconds: 5, toolset: VALID_TOOLSET },
        }),
      ),
    );
    expect(result.statusCode).toBe(400);
    expect(parseBody(result.body).error).toBe("invalid_request");
  });

  it("rejects drawSeconds above the 3600s ceiling with 400 invalid_request", async () => {
    await submit("user-member", CHANNEL, P1, "joining");
    const result = asStructured(
      await challengeCreateHandler(
        makeEvent({
          userId: "user-member",
          pathParameters: { id: CHANNEL },
          body: { word: "castle", drawSeconds: 99999, toolset: VALID_TOOLSET },
        }),
      ),
    );
    expect(result.statusCode).toBe(400);
    expect(parseBody(result.body).error).toBe("invalid_request");
  });

  it("rejects a non-integer drawSeconds with 400 invalid_request", async () => {
    await submit("user-member", CHANNEL, P1, "joining");
    const result = asStructured(
      await challengeCreateHandler(
        makeEvent({
          userId: "user-member",
          pathParameters: { id: CHANNEL },
          body: { word: "castle", drawSeconds: 60.5, toolset: VALID_TOOLSET },
        }),
      ),
    );
    expect(result.statusCode).toBe(400);
    expect(parseBody(result.body).error).toBe("invalid_request");
  });

  it("rejects an empty toolset.brushes with 400 invalid_request", async () => {
    await submit("user-member", CHANNEL, P1, "joining");
    const result = asStructured(
      await challengeCreateHandler(
        makeEvent({
          userId: "user-member",
          pathParameters: { id: CHANNEL },
          body: { word: "castle", drawSeconds: 120, toolset: { brushes: [], colors: ["#000000"] } },
        }),
      ),
    );
    expect(result.statusCode).toBe(400);
    expect(parseBody(result.body).error).toBe("invalid_request");
  });

  it("rejects an empty toolset.colors with 400 invalid_request", async () => {
    await submit("user-member", CHANNEL, P1, "joining");
    const result = asStructured(
      await challengeCreateHandler(
        makeEvent({
          userId: "user-member",
          pathParameters: { id: CHANNEL },
          body: { word: "castle", drawSeconds: 120, toolset: { brushes: ["basic"], colors: [] } },
        }),
      ),
    );
    expect(result.statusCode).toBe(400);
    expect(parseBody(result.body).error).toBe("invalid_request");
  });

  it("rejects a toolset.brushes value outside BRUSH_STYLE_IDS with 400 invalid_request", async () => {
    await submit("user-member", CHANNEL, P1, "joining");
    const result = asStructured(
      await challengeCreateHandler(
        makeEvent({
          userId: "user-member",
          pathParameters: { id: CHANNEL },
          body: {
            word: "castle",
            drawSeconds: 120,
            toolset: { brushes: ["glitter"], colors: ["#000000"] },
          },
        }),
      ),
    );
    expect(result.statusCode).toBe(400);
    expect(parseBody(result.body).error).toBe("invalid_request");
  });

  it("rejects a toolset.colors value outside PALETTE with 400 invalid_request", async () => {
    await submit("user-member", CHANNEL, P1, "joining");
    const result = asStructured(
      await challengeCreateHandler(
        makeEvent({
          userId: "user-member",
          pathParameters: { id: CHANNEL },
          body: { word: "castle", drawSeconds: 120, toolset: { brushes: ["basic"], colors: ["#FFFFFF"] } },
        }),
      ),
    );
    expect(result.statusCode).toBe(400);
    expect(parseBody(result.body).error).toBe("invalid_request");
  });

  it("rejects a backgroundRef that doesn't start with data:image/ with 400 invalid_request", async () => {
    await submit("user-member", CHANNEL, P1, "joining");
    const result = asStructured(
      await challengeCreateHandler(
        makeEvent({
          userId: "user-member",
          pathParameters: { id: CHANNEL },
          body: {
            word: "castle",
            drawSeconds: 120,
            toolset: VALID_TOOLSET,
            backgroundRef: "not-a-data-uri",
          },
        }),
      ),
    );
    expect(result.statusCode).toBe(400);
    expect(parseBody(result.body).error).toBe("invalid_request");
  });

  it("rejects a backgroundRef at/over the 2,000,000 char cap with 400 invalid_request", async () => {
    await submit("user-member", CHANNEL, P1, "joining");
    const tooLong = `data:image/png;base64,${"A".repeat(2_000_000)}`;
    const result = asStructured(
      await challengeCreateHandler(
        makeEvent({
          userId: "user-member",
          pathParameters: { id: CHANNEL },
          body: { word: "castle", drawSeconds: 120, toolset: VALID_TOOLSET, backgroundRef: tooLong },
        }),
      ),
    );
    expect(result.statusCode).toBe(400);
    expect(parseBody(result.body).error).toBe("invalid_request");
  });

  it("creates a challenge for a member with 200 and persists word/drawSeconds/toolset", async () => {
    await submit("user-member", CHANNEL, P1, "joining");
    const result = asStructured(
      await challengeCreateHandler(
        makeEvent({
          userId: "user-member",
          pathParameters: { id: CHANNEL },
          body: { word: "castle", drawSeconds: 120, toolset: VALID_TOOLSET },
        }),
      ),
    );
    expect(result.statusCode).toBe(200);
    const body = parseBody(result.body);
    expect(body.challenge.channelId).toBe(CHANNEL);
    expect(body.challenge.creatorId).toBe("user-member");
    expect(body.challenge.word).toBe("castle");
    expect(body.challenge.drawSeconds).toBe(120);
    expect(body.challenge.toolset).toEqual(VALID_TOOLSET);
    expect(body.challenge.deadlineAt).toBeUndefined();
  });

  it("creates a challenge with an optional backgroundRef", async () => {
    await submit("user-member", CHANNEL, P1, "joining");
    const backgroundRef = "data:image/png;base64,ABC123";
    const result = asStructured(
      await challengeCreateHandler(
        makeEvent({
          userId: "user-member",
          pathParameters: { id: CHANNEL },
          body: { word: "castle", drawSeconds: 120, toolset: VALID_TOOLSET, backgroundRef },
        }),
      ),
    );
    expect(result.statusCode).toBe(200);
    expect(parseBody(result.body).challenge.backgroundRef).toBe(backgroundRef);
  });
});
