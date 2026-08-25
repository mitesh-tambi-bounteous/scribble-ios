/**
 * Foundation smoke test for the S-001 http-data-client seam (src/data/http.ts),
 * extended for S-005's submit/getChannelResponses/addReaction coverage.
 *
 * Confirms httpDataClient.getTodayPrompt() hits the configured API base URL,
 * relays server errors verbatim (no local gating — AC2/AC4 are server
 * invariants), and fails loudly when the base URL is unconfigured.
 */

import type { ApiError, SubmitResponse, TodayPromptResponse } from "@scribl/shared/index";
import { NotSubmittedError } from "@/src/data/client";

const ORIGINAL_ENV = process.env.EXPO_PUBLIC_API_BASE_URL;

describe("httpDataClient.getTodayPrompt (S-001 foundation)", () => {
  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.EXPO_PUBLIC_API_BASE_URL;
    } else {
      process.env.EXPO_PUBLIC_API_BASE_URL = ORIGINAL_ENV;
    }
    delete (globalThis as { fetch?: unknown }).fetch;
  });

  it("calls fetch against the configured base URL and returns the parsed JSON body", async () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = "https://api.test";
    jest.resetModules();

    const body: TodayPromptResponse = {
      prompt: {
        id: "prompt-1",
        date: "2026-07-01",
        text: "Draw your morning.",
        createdAt: "2026-07-01T00:00:00.000Z",
      },
      submissionStatus: { submitted: false },
      participantCount: 0,
      participants: [],
    };
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(body),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const { setActiveUser } = require("@/src/data/active-user");
    setActiveUser("user-today");

    const { httpDataClient } = require("@/src/data/http");
    const result = await httpDataClient.getTodayPrompt();

    // Identity-gated: /prompt/today attaches the caller's x-user-id (the handler
    // derives per-user submissionStatus from it and 500s without it).
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test/prompt/today");
    expect((init.headers as Record<string, string>)["x-user-id"]).toBe("user-today");
    expect(result).toEqual(body);
  });

  it("relays the server-provided error message on a non-ok response (no local gate, AC2/AC4)", async () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = "https://api.test";
    jest.resetModules();

    const apiError: ApiError = {
      error: "forbidden",
      message: "Submit a response before viewing the channel wall.",
    };
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: jest.fn().mockResolvedValue(apiError),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const { httpDataClient } = require("@/src/data/http");

    await expect(httpDataClient.getTodayPrompt()).rejects.toThrow(apiError.message);
  });

  it("rejects with an error mentioning EXPO_PUBLIC_API_BASE_URL when it is unset", async () => {
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
    jest.resetModules();

    const { httpDataClient } = require("@/src/data/http");

    await expect(httpDataClient.getTodayPrompt()).rejects.toThrow(/EXPO_PUBLIC_API_BASE_URL/);
  });
});

describe("httpDataClient.submit (S-005)", () => {
  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.EXPO_PUBLIC_API_BASE_URL;
    } else {
      process.env.EXPO_PUBLIC_API_BASE_URL = ORIGINAL_ENV;
    }
    delete (globalThis as { fetch?: unknown }).fetch;
  });

  it("POSTs the body to /submit with a content-type header and resolves the parsed SubmitResponse", async () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = "https://api.test";
    jest.resetModules();

    const body: SubmitResponse = {
      submission: {
        id: "submission-1",
        userId: "user-demo",
        promptId: "prompt-1",
        channelIds: ["channel-1"],
        createdAt: "2026-07-01T00:00:00.000Z",
      },
    };
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(body),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const { httpDataClient } = require("@/src/data/http");
    const request = { promptId: "prompt-1", channelIds: ["channel-1"] };
    const result = await httpDataClient.submit(request);

    expect(mockFetch).toHaveBeenCalledWith("https://api.test/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
    expect(result).toEqual(body);
  });
});

describe("httpDataClient.submit sends x-user-id (WS2 defect 1)", () => {
  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.EXPO_PUBLIC_API_BASE_URL;
    } else {
      process.env.EXPO_PUBLIC_API_BASE_URL = ORIGINAL_ENV;
    }
    delete (globalThis as { fetch?: unknown }).fetch;
    jest.resetModules();
  });

  it("attaches the active user's x-user-id header on /submit, like every other authed call", async () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = "https://api.test";
    jest.resetModules();

    const { setActiveUser } = require("@/src/data/active-user");
    setActiveUser("user-demo");

    const body: SubmitResponse = {
      submission: {
        id: "submission-1",
        userId: "user-demo",
        promptId: "prompt-1",
        channelIds: ["channel-1"],
        createdAt: "2026-07-01T00:00:00.000Z",
      },
    };
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(body),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const { httpDataClient } = require("@/src/data/http");
    const request = { promptId: "prompt-1", channelIds: ["channel-1"] };
    await httpDataClient.submit(request);

    const [, init] = mockFetch.mock.calls[0];
    expect((init.headers as Record<string, string>)["x-user-id"]).toBe("user-demo");
  });
});

describe("httpDataClient.getChannelResponses (S-005, AC2/AC4)", () => {
  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.EXPO_PUBLIC_API_BASE_URL;
    } else {
      process.env.EXPO_PUBLIC_API_BASE_URL = ORIGINAL_ENV;
    }
    delete (globalThis as { fetch?: unknown }).fetch;
  });

  it("calls fetch with the exact expected URL", async () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = "https://api.test";
    jest.resetModules();

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ channelId: "channel-1", promptId: "prompt-x", responses: [] }),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const { setActiveUser } = require("@/src/data/active-user");
    setActiveUser("user-reader");

    const { httpDataClient } = require("@/src/data/http");
    await httpDataClient.getChannelResponses("channel-1", "prompt-x");

    // Identity-gated (AC2/AC4 are resolved from the caller): attaches x-user-id.
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test/channels/channel-1/responses?promptId=prompt-x");
    expect((init.headers as Record<string, string>)["x-user-id"]).toBe("user-reader");
  });

  it("throws NotSubmittedError on a 403 with error: 'not_submitted' (AC2)", async () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = "https://api.test";
    jest.resetModules();

    const apiError: ApiError = { error: "not_submitted", message: "submit first" };
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: jest.fn().mockResolvedValue(apiError),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const { httpDataClient } = require("@/src/data/http");
    const { NotSubmittedError: FreshNotSubmittedError } = require("@/src/data/client");

    await expect(httpDataClient.getChannelResponses("channel-1", "prompt-x")).rejects.toBeInstanceOf(
      FreshNotSubmittedError,
    );
    await expect(httpDataClient.getChannelResponses("channel-1", "prompt-x")).rejects.toThrow(
      apiError.message,
    );
  });

  it("throws a plain Error (not NotSubmittedError) on a non-403 failure, or a 403 with a different error field (AC4)", async () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = "https://api.test";
    jest.resetModules();

    const apiError: ApiError = { error: "forbidden", message: "not a member of this channel" };
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: jest.fn().mockResolvedValue(apiError),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const { httpDataClient } = require("@/src/data/http");

    await expect(httpDataClient.getChannelResponses("channel-1", "prompt-x")).rejects.not.toBeInstanceOf(
      NotSubmittedError,
    );
    await expect(httpDataClient.getChannelResponses("channel-1", "prompt-x")).rejects.toThrow(
      apiError.message,
    );
  });
});

describe("httpDataClient.addReaction (backend contract landed)", () => {
  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.EXPO_PUBLIC_API_BASE_URL;
    } else {
      process.env.EXPO_PUBLIC_API_BASE_URL = ORIGINAL_ENV;
    }
    delete (globalThis as { fetch?: unknown }).fetch;
  });

  it("POSTs {emoji} with promptId as a query param and x-user-id, returning the updated response", async () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = "https://api.test";
    jest.resetModules();

    const { setActiveUser } = require("@/src/data/active-user");
    setActiveUser("user-reactor");

    const updatedResponse = {
      id: "response-alice-1",
      promptId: "prompt-x",
      channelId: "channel-1",
      authorId: "user-alice",
      authorName: "Alice",
      createdAt: "2026-07-01T09:00:00.000Z",
      reactions: [{ emoji: "👍", userId: "user-reactor" }],
    };
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ response: updatedResponse }),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const { httpDataClient } = require("@/src/data/http");
    const result = await httpDataClient.addReaction(
      "channel-1",
      "prompt-x",
      "response-alice-1",
      "👍",
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(
      "https://api.test/channels/channel-1/responses/response-alice-1/reactions?promptId=prompt-x",
    );
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ emoji: "👍" }));
    expect((init.headers as Record<string, string>)["x-user-id"]).toBe("user-reactor");
    expect(result).toEqual(updatedResponse);
  });

  it("relays a 403 not_submitted as NotSubmittedError (no local gate, AC2)", async () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = "https://api.test";
    jest.resetModules();

    const apiError: ApiError = { error: "not_submitted", message: "submit first" };
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: jest.fn().mockResolvedValue(apiError),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const { httpDataClient } = require("@/src/data/http");
    const { NotSubmittedError: FreshNotSubmittedError } = require("@/src/data/client");

    await expect(
      httpDataClient.addReaction("channel-1", "prompt-x", "response-alice-1", "👍"),
    ).rejects.toBeInstanceOf(FreshNotSubmittedError);
  });
});

describe("httpDataClient.updateResponse (edit/regenerate)", () => {
  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.EXPO_PUBLIC_API_BASE_URL;
    } else {
      process.env.EXPO_PUBLIC_API_BASE_URL = ORIGINAL_ENV;
    }
    delete (globalThis as { fetch?: unknown }).fetch;
  });

  it("PATCHes the patch body and unwraps the {response} envelope the handler returns", async () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = "https://api.test";
    jest.resetModules();

    const { setActiveUser } = require("@/src/data/active-user");
    setActiveUser("user-alice");

    const updatedResponse = {
      id: "response-alice-1",
      promptId: "prompt-x",
      channelId: "channel-1",
      authorId: "user-alice",
      authorName: "Alice",
      createdAt: "2026-07-01T09:00:00.000Z",
      text: "new caption",
      backgroundPrompt: "sunny meadow",
      enhancementStatus: "pending",
      reactions: [],
    };
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ response: updatedResponse }),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const { httpDataClient } = require("@/src/data/http");
    const result = await httpDataClient.updateResponse(
      "channel-1",
      "prompt-x",
      "response-alice-1",
      { text: "new caption", backgroundPrompt: "sunny meadow", regenerate: true },
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(
      "https://api.test/channels/channel-1/responses/response-alice-1?promptId=prompt-x",
    );
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe(
      JSON.stringify({ text: "new caption", backgroundPrompt: "sunny meadow", regenerate: true }),
    );
    expect((init.headers as Record<string, string>)["x-user-id"]).toBe("user-alice");
    // Regression guard: must return the unwrapped ChannelResponse, not the
    // {response:...} envelope the handler sends (the detail screen reads
    // .id/.imageRef/.authorId off the top level).
    expect(result).toEqual(updatedResponse);
    expect((result as { response?: unknown }).response).toBeUndefined();
  });
});

describe("httpDataClient.inviteMember (backend contract landed)", () => {
  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.EXPO_PUBLIC_API_BASE_URL;
    } else {
      process.env.EXPO_PUBLIC_API_BASE_URL = ORIGINAL_ENV;
    }
    delete (globalThis as { fetch?: unknown }).fetch;
  });

  it("POSTs {email, displayName} to /channels/:id/members with x-user-id, returning the member", async () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = "https://api.test";
    jest.resetModules();

    const { setActiveUser } = require("@/src/data/active-user");
    setActiveUser("user-inviter");

    const member = { userId: "user-invitee", displayName: "Invitee", hasDrawnToday: false };
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ member }),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const { httpDataClient } = require("@/src/data/http");
    const result = await httpDataClient.inviteMember("channel-1", "invitee@example.com", "Invitee");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test/channels/channel-1/members");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ email: "invitee@example.com", displayName: "Invitee" }));
    expect((init.headers as Record<string, string>)["x-user-id"]).toBe("user-inviter");
    expect(result).toEqual(member);
  });

  it("relays a 403 not_a_member as a plain Error (no local gate, AC4)", async () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = "https://api.test";
    jest.resetModules();

    const apiError: ApiError = { error: "not_a_member", message: "you are not a member" };
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: jest.fn().mockResolvedValue(apiError),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const { httpDataClient } = require("@/src/data/http");

    await expect(
      httpDataClient.inviteMember("channel-1", "invitee@example.com"),
    ).rejects.toThrow(apiError.message);
  });
});

describe("httpDataClient.getStreak (devx repro)", () => {
  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.EXPO_PUBLIC_API_BASE_URL;
    } else {
      process.env.EXPO_PUBLIC_API_BASE_URL = ORIGINAL_ENV;
    }
    delete (globalThis as { fetch?: unknown }).fetch;
  });

  it("hits /me/stats (not /streak) and maps currentStreak -> current", async () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = "https://api.test";
    jest.resetModules();

    const stats = {
      currentStreak: 4,
      bestStreak: 9,
      weeklyCompletion: [],
      drawingsCount: 3,
    };
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(stats),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const { httpDataClient } = require("@/src/data/http");
    const result = await httpDataClient.getStreak();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test/me/stats");
    expect(result).toEqual({ current: 4 });
  });
});

describe("httpDataClient network error normalization (WS4)", () => {
  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.EXPO_PUBLIC_API_BASE_URL;
    } else {
      process.env.EXPO_PUBLIC_API_BASE_URL = ORIGINAL_ENV;
    }
    delete (globalThis as { fetch?: unknown }).fetch;
  });

  it("wraps a rejecting fetch (offline) into a NetworkError with a human message, not the raw 'Failed to fetch'", async () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = "https://api.test";
    jest.resetModules();

    const mockFetch = jest.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const { httpDataClient } = require("@/src/data/http");
    const { NetworkError: FreshNetworkError } = require("@/src/data/client");

    await expect(httpDataClient.getTodayPrompt()).rejects.toBeInstanceOf(FreshNetworkError);
    await expect(httpDataClient.getTodayPrompt()).rejects.toThrow(
      "Can't reach the server. Check your connection and try again.",
    );
  });
});
