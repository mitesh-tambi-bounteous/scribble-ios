/**
 * GET /me/stats (WS4a) - identity-gated aggregates, exercised against the
 * mock-mode data store (same pattern as channel-members.test.ts /
 * submit-to-unlock.test.ts).
 */
import { handler as meStatsHandler } from "@/backend/lambda/handlers/me-stats";
import { handler as todayPromptHandler } from "@/backend/lambda/handlers/today-prompt";
import { handler as submitHandler } from "@/backend/lambda/handlers/submit";
import {
  resetMockSubmissions,
  resetMockMemberships,
  resetMockResponses,
} from "@/backend/lambda/data/dynamodb-client";
import { promptIdForDate } from "@/backend/seeds/seed-data";

type EventArg = Parameters<typeof meStatsHandler>[0];
type ResultV2 = Awaited<ReturnType<typeof meStatsHandler>>;
type StructuredResult = Exclude<ResultV2, string>;

function asStructured(result: ResultV2): StructuredResult {
  if (typeof result === "string") {
    throw new Error("expected a structured result, got string: " + result);
  }
  return result;
}

function makeEvent(opts: {
  userId?: string;
  body?: unknown;
}): EventArg {
  return {
    headers: opts.userId ? { "x-user-id": opts.userId } : {},
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  } as unknown as EventArg;
}

function parseBody(body: string | undefined): any {
  return JSON.parse(body as string);
}

const today = new Date().toISOString().slice(0, 10);
const P1 = promptIdForDate(today);

describe("GET /me/stats (WS4a)", () => {
  beforeEach(() => {
    resetMockSubmissions();
    resetMockMemberships();
    resetMockResponses();
  });

  it("missing x-user-id -> 401 unauthenticated", async () => {
    const result = asStructured(await meStatsHandler(makeEvent({})));
    expect(result.statusCode).toBe(401);
  });

  it("no submissions -> drawingsCount 0, 7-length weeklyCompletion all false, streaks 0", async () => {
    const result = asStructured(await meStatsHandler(makeEvent({ userId: "user-nodraws" })));
    expect(result.statusCode).toBe(200);
    const body = parseBody(result.body);
    expect(body.drawingsCount).toBe(0);
    expect(body.weeklyCompletion).toHaveLength(7);
    expect(body.weeklyCompletion.every((e: { done: boolean }) => e.done === false)).toBe(true);
    expect(body.currentStreak).toBe(0);
    expect(body.bestStreak).toBe(0);
  });

  it("after one submission today -> drawingsCount 1, today's entry done=true, streak 1", async () => {
    const USER = "user-carol";
    const submitResult = asStructured(
      await submitHandler(
        makeEvent({ userId: USER, body: { promptId: P1, channelIds: ["channel-x"], text: "art" } }),
      ),
    );
    expect(submitResult.statusCode).toBe(200);

    const result = asStructured(await meStatsHandler(makeEvent({ userId: USER })));
    expect(result.statusCode).toBe(200);
    const body = parseBody(result.body);
    expect(body.drawingsCount).toBe(1);
    expect(body.weeklyCompletion).toHaveLength(7);
    const todayEntry = body.weeklyCompletion.find((e: { date: string }) => e.date === today);
    expect(todayEntry?.done).toBe(true);
    expect(body.currentStreak).toBe(1);
    expect(body.bestStreak).toBe(1);
  });
});

describe("GET /prompt/today participant info (WS4a)", () => {
  beforeEach(() => {
    resetMockSubmissions();
    resetMockMemberships();
    resetMockResponses();
  });

  it("no submissions yet -> participantCount 0, participants []", async () => {
    const result = asStructured(await todayPromptHandler(makeEvent({ userId: "user-x" })));
    expect(result.statusCode).toBe(200);
    const body = parseBody(result.body);
    expect(body.participantCount).toBe(0);
    expect(body.participants).toEqual([]);
  });

  it("two users submit -> participantCount 2", async () => {
    await submitHandler(
      makeEvent({ userId: "user-a", body: { promptId: P1, channelIds: ["channel-x"], text: "a" } }),
    );
    await submitHandler(
      makeEvent({ userId: "user-b", body: { promptId: P1, channelIds: ["channel-x"], text: "b" } }),
    );

    const result = asStructured(await todayPromptHandler(makeEvent({ userId: "user-a" })));
    expect(result.statusCode).toBe(200);
    const body = parseBody(result.body);
    expect(body.participantCount).toBe(2);
    expect(body.participants.length).toBeGreaterThanOrEqual(1);
  });
});
