/**
 * challenge-detail-gate - the blind draw-off invariant proof.
 *
 * Launch-blocking: while a caller has NOT submitted their own entry, GET
 * detail must not leak any entry content ("open" state, blind). Once the
 * caller submits, they immediately see the reveal for themselves ("revealed"
 * state, per-viewer submit-to-unlock / AC2) - independent of whether any
 * other member has submitted. Non-members are denied regardless (403
 * not_a_member). All gates are server-side against the mock data layer,
 * never a client-supplied flag. Challenges are open-ended (no deadline).
 */
import { handler as submitHandler } from "@/backend/lambda/handlers/submit";
import { handler as challengeCreateHandler } from "@/backend/lambda/handlers/challenge-create";
import { handler as challengeEntryHandler } from "@/backend/lambda/handlers/challenge-entry";
import { handler as challengeDetailHandler } from "@/backend/lambda/handlers/challenge-detail";
import {
  resetMockChallenges,
  resetMockMemberships,
  resetMockSubmissions,
  resetMockResponses,
} from "@/backend/lambda/data/dynamodb-client";
import { promptIdForDate } from "@/backend/seeds/seed-data";

type EventArg = Parameters<typeof challengeDetailHandler>[0];
type ResultV2 = Awaited<ReturnType<typeof challengeDetailHandler>>;
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

const VALID_TOOLSET = { brushes: ["basic"], colors: ["#000000"] };

async function createChallengeViaHandler(creator: string, channel: string, word: string) {
  const result = asStructured(
    await challengeCreateHandler(
      makeEvent({
        userId: creator,
        pathParameters: { id: channel },
        body: { word, drawSeconds: 120, toolset: VALID_TOOLSET },
      }),
    ),
  );
  expect(result.statusCode).toBe(200);
  return parseBody(result.body).challenge.id as string;
}

async function submitEntry(user: string, challengeId: string) {
  const result = asStructured(
    await challengeEntryHandler(
      makeEvent({ userId: user, pathParameters: { cid: challengeId }, body: {} }),
    ),
  );
  expect(result.statusCode).toBe(200);
}

async function getDetail(user: string, challengeId: string) {
  return asStructured(
    await challengeDetailHandler(
      makeEvent({ userId: user, pathParameters: { cid: challengeId } }),
    ),
  );
}

describe("challenge-detail-gate - blind draw-off invariant (server-side)", () => {
  const CHANNEL = "channel-detail-gate-test";
  const today = new Date().toISOString().slice(0, 10);
  const P1 = promptIdForDate(today);

  beforeEach(() => {
    resetMockChallenges();
    resetMockMemberships();
    resetMockSubmissions();
    resetMockResponses();
  });

  it("stays blind for a non-submitter, reveals immediately (per-viewer) once that caller submits, and denies non-members throughout", async () => {
    await submit("user-a", CHANNEL, P1, "a joins");
    await submit("user-b", CHANNEL, P1, "b joins");

    const challengeId = await createChallengeViaHandler("user-a", CHANNEL, "castle");

    // Neither has submitted yet: both see the blind "open" view.
    const aBeforeSubmit = await getDetail("user-a", challengeId);
    expect(aBeforeSubmit.statusCode).toBe(200);
    const aBeforeSubmitBody = parseBody(aBeforeSubmit.body).detail;
    expect(aBeforeSubmitBody.state).toBe("open");
    expect(aBeforeSubmitBody.iSubmitted).toBe(false);
    expect(aBeforeSubmitBody.entries).toEqual([]);
    expect(aBeforeSubmitBody.leaderboard).toEqual([]);

    // Non-member C is denied while open.
    const cOpen = await getDetail("user-c", challengeId);
    expect(cOpen.statusCode).toBe(403);
    expect(parseBody(cOpen.body).error).toBe("not_a_member");

    await submitEntry("user-a", challengeId);

    // A submitted -> revealed FOR A, even though B has not submitted.
    const aRevealed = await getDetail("user-a", challengeId);
    expect(aRevealed.statusCode).toBe(200);
    const aRevealedBody = parseBody(aRevealed.body).detail;
    expect(aRevealedBody.state).toBe("revealed");
    expect(aRevealedBody.iSubmitted).toBe(true);
    expect(aRevealedBody.entries.length).toBe(1);
    expect(aRevealedBody.entries[0].userId).toBe("user-a");
    expect(aRevealedBody.leaderboard.length).toBe(1);

    // B still hasn't submitted -> still blind FOR B.
    const bStillOpen = await getDetail("user-b", challengeId);
    expect(bStillOpen.statusCode).toBe(200);
    const bStillOpenBody = parseBody(bStillOpen.body).detail;
    expect(bStillOpenBody.state).toBe("open");
    expect(bStillOpenBody.iSubmitted).toBe(false);
    expect(bStillOpenBody.entries).toEqual([]);

    // Non-member C still denied after A's reveal.
    const cRevealed = await getDetail("user-c", challengeId);
    expect(cRevealed.statusCode).toBe(403);
    expect(parseBody(cRevealed.body).error).toBe("not_a_member");

    await submitEntry("user-b", challengeId);

    // Now B has submitted too -> revealed FOR B, sees both entries.
    const bRevealed = await getDetail("user-b", challengeId);
    expect(bRevealed.statusCode).toBe(200);
    const bRevealedBody = parseBody(bRevealed.body).detail;
    expect(bRevealedBody.state).toBe("revealed");
    expect(bRevealedBody.entries.length).toBe(2);
    const revealedUserIds = bRevealedBody.entries.map((e: { userId: string }) => e.userId);
    expect(revealedUserIds).toContain("user-a");
    expect(revealedUserIds).toContain("user-b");
  });
});
