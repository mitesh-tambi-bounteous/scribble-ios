/**
 * challenge-list — GET /channels/{id}/challenges.
 *
 * Covers the membership gate plus the summary fields (state,
 * participantCount, submittedCount, iSubmitted) computed by
 * challenge-shared.viewerState (per-viewer submit-to-unlock) against the mock data layer.
 */
import { handler as submitHandler } from "@/backend/lambda/handlers/submit";
import { handler as challengeCreateHandler } from "@/backend/lambda/handlers/challenge-create";
import { handler as challengeListHandler } from "@/backend/lambda/handlers/challenge-list";
import {
  resetMockChallenges,
  resetMockMemberships,
  resetMockSubmissions,
  resetMockResponses,
} from "@/backend/lambda/data/dynamodb-client";
import { promptIdForDate } from "@/backend/seeds/seed-data";

type EventArg = Parameters<typeof challengeListHandler>[0];
type ResultV2 = Awaited<ReturnType<typeof challengeListHandler>>;
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

describe("challenge-list (GET /channels/{id}/challenges)", () => {
  const CHANNEL = "channel-list-test";
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
      await challengeListHandler(
        makeEvent({ userId: "user-nonmember", pathParameters: { id: CHANNEL } }),
      ),
    );
    expect(result.statusCode).toBe(403);
    expect(parseBody(result.body).error).toBe("not_a_member");
  });

  it("returns open state with correct participantCount/submittedCount/iSubmitted", async () => {
    await submit("user-alice", CHANNEL, P1, "alice joins");
    await submit("user-bob", CHANNEL, P1, "bob joins");

    const createResult = asStructured(
      await challengeCreateHandler(
        makeEvent({
          userId: "user-alice",
          pathParameters: { id: CHANNEL },
          body: { word: "castle", drawSeconds: 120, toolset: { brushes: ["basic"], colors: ["#000000"] } },
        }),
      ),
    );
    expect(createResult.statusCode).toBe(200);

    const listResult = asStructured(
      await challengeListHandler(
        makeEvent({ userId: "user-alice", pathParameters: { id: CHANNEL } }),
      ),
    );
    expect(listResult.statusCode).toBe(200);
    const body = parseBody(listResult.body);
    expect(body.challenges.length).toBe(1);
    const summary = body.challenges[0];
    expect(summary.state).toBe("open");
    expect(summary.participantCount).toBe(2);
    expect(summary.submittedCount).toBe(0);
    expect(summary.iSubmitted).toBe(false);
  });

  it("reflects iSubmitted true for a member who has an entry, false for one who doesn't", async () => {
    await submit("user-alice", CHANNEL, P1, "alice joins");
    await submit("user-bob", CHANNEL, P1, "bob joins");

    const createResult = asStructured(
      await challengeCreateHandler(
        makeEvent({
          userId: "user-alice",
          pathParameters: { id: CHANNEL },
          body: { word: "castle", drawSeconds: 120, toolset: { brushes: ["basic"], colors: ["#000000"] } },
        }),
      ),
    );
    const challengeId = parseBody(createResult.body).challenge.id;

    const { putChallengeEntry } = require("@/backend/lambda/data/dynamodb-client");
    await putChallengeEntry({ id: `entry-${challengeId}-alice`, challengeId, userId: "user-alice" });

    const listResult = asStructured(
      await challengeListHandler(
        makeEvent({ userId: "user-alice", pathParameters: { id: CHANNEL } }),
      ),
    );
    const aliceSummary = parseBody(listResult.body).challenges[0];
    expect(aliceSummary.iSubmitted).toBe(true);
    expect(aliceSummary.submittedCount).toBe(1);

    const bobListResult = asStructured(
      await challengeListHandler(makeEvent({ userId: "user-bob", pathParameters: { id: CHANNEL } })),
    );
    const bobSummary = parseBody(bobListResult.body).challenges[0];
    expect(bobSummary.iSubmitted).toBe(false);
    expect(bobSummary.submittedCount).toBe(1);
  });

  it("does not include entry images in the list response", async () => {
    await submit("user-alice", CHANNEL, P1, "alice joins");
    const createResult = asStructured(
      await challengeCreateHandler(
        makeEvent({
          userId: "user-alice",
          pathParameters: { id: CHANNEL },
          body: { word: "castle", drawSeconds: 120, toolset: { brushes: ["basic"], colors: ["#000000"] } },
        }),
      ),
    );
    expect(createResult.statusCode).toBe(200);

    const listResult = asStructured(
      await challengeListHandler(makeEvent({ userId: "user-alice", pathParameters: { id: CHANNEL } })),
    );
    expect(listResult.body as string).not.toContain("imageRef");
    expect(listResult.body as string).not.toContain("entries");
  });
});
