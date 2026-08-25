/**
 * Task 7: httpDataClient challenge methods (src/data/http.ts).
 *
 * Mirrors tests/http-client.test.ts setup. Confirms the challenge routes hit
 * the exact expected URLs with x-user-id attached, and that 403 error bodies
 * map to the right typed error (NotSubmittedError). No client-side gating -
 * these are all server invariants relayed verbatim.
 */

import type { ApiError, ChallengeDetail, ChallengeEntry } from "@scribl/shared/index";

const ORIGINAL_ENV = process.env.EXPO_PUBLIC_API_BASE_URL;

function resetEnv(): void {
  if (ORIGINAL_ENV === undefined) {
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
  } else {
    process.env.EXPO_PUBLIC_API_BASE_URL = ORIGINAL_ENV;
  }
  delete (globalThis as { fetch?: unknown }).fetch;
}

describe("httpDataClient.getChallengeDetail (Task 7)", () => {
  afterEach(resetEnv);

  it("calls GET /challenges/{id} with x-user-id and returns the detail", async () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = "https://api.test";
    jest.resetModules();

    const detail: ChallengeDetail = {
      challenge: {
        id: "challenge-1",
        channelId: "channel-1",
        creatorId: "user-a",
        word: "lighthouse",
        drawSeconds: 120,
        createdAt: "2026-07-01T00:00:00.000Z",
      },
      state: "open",
      participantCount: 2,
      submittedCount: 0,
      iSubmitted: false,
      entries: [],
      leaderboard: [],
    };
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ detail }),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const { setActiveUser } = require("@/src/data/active-user");
    setActiveUser("user-a");

    const { httpDataClient } = require("@/src/data/http");
    const result = await httpDataClient.getChallengeDetail("challenge-1");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test/challenges/challenge-1");
    expect((init.headers as Record<string, string>)["x-user-id"]).toBe("user-a");
    expect(result).toEqual(detail);
  });

  it("throws NotSubmittedError on a 403 with error: 'not_submitted'", async () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = "https://api.test";
    jest.resetModules();

    const apiError: ApiError = { error: "not_submitted", message: "submit an entry to see the reveal" };
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: jest.fn().mockResolvedValue(apiError),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const { httpDataClient } = require("@/src/data/http");
    const { NotSubmittedError } = require("@/src/data/client");

    await expect(httpDataClient.getChallengeDetail("challenge-1")).rejects.toBeInstanceOf(
      NotSubmittedError,
    );
  });
});

describe("httpDataClient.createChallenge", () => {
  afterEach(resetEnv);

  it("POSTs word/drawSeconds/toolset/backgroundRef to /channels/{id}/challenges", async () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = "https://api.test";
    jest.resetModules();

    const challenge = {
      id: "challenge-1",
      channelId: "channel-1",
      creatorId: "user-a",
      word: "lighthouse",
      drawSeconds: 120,
      toolset: { brushes: ["basic"], colors: ["#000000"] },
      createdAt: "2026-07-01T00:00:00.000Z",
    };
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ challenge }),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const { setActiveUser } = require("@/src/data/active-user");
    setActiveUser("user-a");

    const { httpDataClient } = require("@/src/data/http");
    const result = await httpDataClient.createChallenge("channel-1", {
      word: "lighthouse",
      drawSeconds: 120,
      toolset: { brushes: ["basic"], colors: ["#000000"] },
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test/channels/channel-1/challenges");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      word: "lighthouse",
      drawSeconds: 120,
      toolset: { brushes: ["basic"], colors: ["#000000"] },
      backgroundRef: undefined,
    });
    expect((init.headers as Record<string, string>)["x-user-id"]).toBe("user-a");
    expect(result).toEqual(challenge);
  });
});

describe("httpDataClient.rateChallengeEntry (Task 7)", () => {
  afterEach(resetEnv);

  it("POSTs stars to the ratings path", async () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = "https://api.test";
    jest.resetModules();

    const entry: ChallengeEntry = {
      id: "entry-1",
      challengeId: "challenge-1",
      userId: "user-b",
      authorName: "Bea",
      createdAt: "2026-07-01T00:00:00.000Z",
      averageStars: 4,
      ratingCount: 1,
      myStars: 4,
    };
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ entry }),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const { setActiveUser } = require("@/src/data/active-user");
    setActiveUser("user-a");

    const { httpDataClient } = require("@/src/data/http");
    const result = await httpDataClient.rateChallengeEntry("challenge-1", "entry-1", 4);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test/challenges/challenge-1/entries/entry-1/ratings");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ stars: 4 }));
    expect((init.headers as Record<string, string>)["x-user-id"]).toBe("user-a");
    expect(result).toEqual(entry);
  });
});
