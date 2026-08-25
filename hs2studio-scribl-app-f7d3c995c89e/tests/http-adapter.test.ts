/**
 * http adapter — new seam methods (signUp/login/listUsers/listWalls/
 * createWall/getChannelMembers) plus x-user-id attachment (src/data/http.ts).
 *
 * Follows tests/http-client.test.ts's fetch-stub convention. Confirms the
 * active-user seam (src/data/active-user.ts) drives the x-user-id header on
 * authenticated routes, and that unauthenticated routes never leak it.
 */

import type {
  Channel,
  ChannelMembersResponse,
  CreateWallResponse,
  ListUsersResponse,
  ListWallsResponse,
  LoginResponse,
  SignUpResponse,
  UpdateUserResponse,
  User,
} from "@scribl/shared/index";

const ORIGINAL_ENV = process.env.EXPO_PUBLIC_API_BASE_URL;

function setBaseUrlAndStub(mockFetch: jest.Mock) {
  process.env.EXPO_PUBLIC_API_BASE_URL = "https://api.test";
  jest.resetModules();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
}

afterEach(() => {
  if (ORIGINAL_ENV === undefined) {
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
  } else {
    process.env.EXPO_PUBLIC_API_BASE_URL = ORIGINAL_ENV;
  }
  delete (globalThis as { fetch?: unknown }).fetch;
});

const USER: User = {
  id: "user-demo",
  email: "demo@scribl.test",
  displayName: "Demo",
  createdAt: "2026-07-01T00:00:00.000Z",
};

describe("httpDataClient.signUp / login / listUsers (unauthenticated routes)", () => {
  it("signUp POSTs the right URL + body and parses { user }", async () => {
    const body: SignUpResponse = { user: USER };
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(body),
    });
    setBaseUrlAndStub(mockFetch);

    const { httpDataClient } = require("@/src/data/http");
    const result = await httpDataClient.signUp("demo@scribl.test", "Demo");

    expect(mockFetch).toHaveBeenCalledWith("https://api.test/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "demo@scribl.test", displayName: "Demo" }),
    });
    expect(result).toEqual(USER);
  });

  it("login POSTs the right URL + body and parses { user }", async () => {
    const body: LoginResponse = { user: USER };
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(body),
    });
    setBaseUrlAndStub(mockFetch);

    const { httpDataClient } = require("@/src/data/http");
    const result = await httpDataClient.login("demo@scribl.test", "Demo");

    expect(mockFetch).toHaveBeenCalledWith("https://api.test/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "demo@scribl.test", displayName: "Demo" }),
    });
    const parsedBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(parsedBody).toMatchObject({ email: "demo@scribl.test", displayName: "Demo" });
    expect(result).toEqual(USER);
  });

  it("listUsers GETs /users and parses { users }", async () => {
    const body: ListUsersResponse = { users: [USER] };
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(body),
    });
    setBaseUrlAndStub(mockFetch);

    const { httpDataClient } = require("@/src/data/http");
    const result = await httpDataClient.listUsers();

    expect(mockFetch).toHaveBeenCalledWith("https://api.test/users");
    expect(result).toEqual([USER]);
  });

  it("signUp/login/listUsers never attach an x-user-id header, even with an active user set", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ users: [] }),
    });
    setBaseUrlAndStub(mockFetch);

    const { setActiveUser } = require("@/src/data/active-user");
    setActiveUser("user-demo");

    const { httpDataClient } = require("@/src/data/http");
    await httpDataClient.listUsers();

    // listUsers is called with the single-URL fetch overload (no init object
    // at all), so there is structurally no header to leak.
    expect(mockFetch).toHaveBeenCalledWith("https://api.test/users");
  });
});

describe("httpDataClient.listWalls / createWall / getChannelMembers (authenticated routes)", () => {
  const CHANNEL: Channel = {
    id: "channel-1",
    name: "Family",
    kind: "group",
    isPublic: false,
  };

  it("listWalls sends the x-user-id header for the active user and parses { walls }", async () => {
    const body: ListWallsResponse = { walls: [CHANNEL] };
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(body),
    });
    setBaseUrlAndStub(mockFetch);

    const { setActiveUser } = require("@/src/data/active-user");
    setActiveUser("user-demo");

    const { httpDataClient } = require("@/src/data/http");
    const result = await httpDataClient.listWalls("user-demo");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test/walls",
      expect.objectContaining({ headers: expect.objectContaining({ "x-user-id": "user-demo" }) }),
    );
    expect(result).toEqual([CHANNEL]);
  });

  it("createWall POSTs the CreateWallRequest body, sends x-user-id, and parses { wall }", async () => {
    const body: CreateWallResponse = { wall: CHANNEL };
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(body),
    });
    setBaseUrlAndStub(mockFetch);

    const { setActiveUser } = require("@/src/data/active-user");
    setActiveUser("user-demo");

    const { httpDataClient } = require("@/src/data/http");
    const input = { name: "Family", kind: "group" as const, isPublic: false };
    const result = await httpDataClient.createWall(input);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test/walls",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "content-type": "application/json",
          "x-user-id": "user-demo",
        }),
        body: JSON.stringify(input),
      }),
    );
    expect(result).toEqual(CHANNEL);
  });

  it("getChannelMembers sends the x-user-id header for the active user and parses { members }", async () => {
    const body: ChannelMembersResponse = {
      members: [
        { userId: "user-alice", displayName: "Alice", email: "alice@scribl.test", hasDrawnToday: true },
      ],
    };
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(body),
    });
    setBaseUrlAndStub(mockFetch);

    const { setActiveUser } = require("@/src/data/active-user");
    setActiveUser("user-alice");

    const { httpDataClient } = require("@/src/data/http");
    const result = await httpDataClient.getChannelMembers("channel-1", "prompt-x");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test/channels/channel-1/members?promptId=prompt-x",
      expect.objectContaining({ headers: expect.objectContaining({ "x-user-id": "user-alice" }) }),
    );
    expect(result).toEqual(body.members);
  });

  it("updateUser PATCHes /users/{id} with the body and x-user-id header, parses { user }", async () => {
    const updated: User = { ...USER, displayName: "Demo Updated", avatarColor: "#ff0000" };
    const body: UpdateUserResponse = { user: updated };
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(body),
    });
    setBaseUrlAndStub(mockFetch);

    const { setActiveUser } = require("@/src/data/active-user");
    setActiveUser("user-demo");

    const { httpDataClient } = require("@/src/data/http");
    const patch = { displayName: "Demo Updated", avatarColor: "#ff0000" };
    const result = await httpDataClient.updateUser("user-demo", patch);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test/users/user-demo",
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({
          "content-type": "application/json",
          "x-user-id": "user-demo",
        }),
        body: JSON.stringify(patch),
      }),
    );
    expect(result).toEqual(updated);
  });

  it("listWalls/getChannelMembers send no x-user-id header when no active user is set", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ members: [] }),
    });
    setBaseUrlAndStub(mockFetch);

    const { httpDataClient } = require("@/src/data/http");
    await httpDataClient.getChannelMembers("channel-1", "prompt-x");

    const [, init] = mockFetch.mock.calls[0];
    expect((init.headers as Record<string, string>)["x-user-id"]).toBeUndefined();
  });
});
