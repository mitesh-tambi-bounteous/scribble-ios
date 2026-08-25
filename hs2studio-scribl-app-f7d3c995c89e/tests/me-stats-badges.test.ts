/**
 * Milestone streak badges (spec 4.5): 7/30/100-day thresholds derived from
 * bestStreak. Boundary matrix on the pure helper, plus one handler-level
 * check that /me/stats includes the badges array.
 */
import { computeBadges } from "@/backend/lambda/data/stats";
import { handler as meStatsHandler } from "@/backend/lambda/handlers/me-stats";
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

function makeEvent(opts: { userId?: string; body?: unknown }): EventArg {
  return {
    headers: opts.userId ? { "x-user-id": opts.userId } : {},
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  } as unknown as EventArg;
}

function parseBody(body: string | undefined): any {
  return JSON.parse(body as string);
}

describe("computeBadges (spec 4.5 milestone thresholds)", () => {
  it("bestStreak 6 -> all three earned=false", () => {
    expect(computeBadges(6)).toEqual([
      { day: 7, earned: false },
      { day: 30, earned: false },
      { day: 100, earned: false },
    ]);
  });

  it("bestStreak 7 -> day7 earned only", () => {
    expect(computeBadges(7)).toEqual([
      { day: 7, earned: true },
      { day: 30, earned: false },
      { day: 100, earned: false },
    ]);
  });

  it("bestStreak 29 -> day7 earned only", () => {
    expect(computeBadges(29)).toEqual([
      { day: 7, earned: true },
      { day: 30, earned: false },
      { day: 100, earned: false },
    ]);
  });

  it("bestStreak 30 -> day7+day30 earned", () => {
    expect(computeBadges(30)).toEqual([
      { day: 7, earned: true },
      { day: 30, earned: true },
      { day: 100, earned: false },
    ]);
  });

  it("bestStreak 99 -> day7+day30 earned", () => {
    expect(computeBadges(99)).toEqual([
      { day: 7, earned: true },
      { day: 30, earned: true },
      { day: 100, earned: false },
    ]);
  });

  it("bestStreak 100 -> all three earned", () => {
    expect(computeBadges(100)).toEqual([
      { day: 7, earned: true },
      { day: 30, earned: true },
      { day: 100, earned: true },
    ]);
  });
});

describe("GET /me/stats includes badges (spec 4.5)", () => {
  beforeEach(() => {
    resetMockSubmissions();
    resetMockMemberships();
    resetMockResponses();
  });

  it("no submissions -> badges array present, all earned=false", async () => {
    const result = asStructured(await meStatsHandler(makeEvent({ userId: "user-nobadges" })));
    expect(result.statusCode).toBe(200);
    const body = parseBody(result.body);
    expect(body.badges).toEqual([
      { day: 7, earned: false },
      { day: 30, earned: false },
      { day: 100, earned: false },
    ]);
  });

  it("after one submission today -> bestStreak 1, badges still all false", async () => {
    const USER = "user-badge-carol";
    const today = new Date().toISOString().slice(0, 10);
    const P1 = promptIdForDate(today);
    const submitResult = asStructured(
      await submitHandler(
        makeEvent({ userId: USER, body: { promptId: P1, channelIds: ["channel-x"], text: "art" } }),
      ),
    );
    expect(submitResult.statusCode).toBe(200);

    const result = asStructured(await meStatsHandler(makeEvent({ userId: USER })));
    expect(result.statusCode).toBe(200);
    const body = parseBody(result.body);
    expect(body.bestStreak).toBe(1);
    expect(body.badges).toEqual([
      { day: 7, earned: false },
      { day: 30, earned: false },
      { day: 100, earned: false },
    ]);
  });
});
