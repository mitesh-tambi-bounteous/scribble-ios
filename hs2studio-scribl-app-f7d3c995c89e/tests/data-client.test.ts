/**
 * Foundation smoke test for the S-001 data-client seam (src/data/), extended
 * for S-005's submit-to-unlock (AC2) and reactions coverage.
 *
 * Confirms the mock adapter (the default, zero-AWS DataClient) resolves a
 * seeded TodayPromptResponse whose submissionStatus.submitted is false —
 * i.e. the unsubmitted state the submit-to-unlock gate (AC2) starts from.
 *
 * The mock adapter is a clean slate (no seeded users/responses): each test
 * builds its own fixture via signUp() + setActiveUser() before submitting,
 * then asserts against the response IT created.
 *
 * Each `describe` block below uses jest.resetModules() + a fresh require of
 * "@/src/data/mock" (and "@/src/data/active-user") to get isolated module
 * instances, since mockDataClient/active-user hold module-level overlay
 * state that would otherwise accumulate across tests.
 */

import { mockDataClient } from "@/src/data/mock";
import type { DataClient } from "@/src/data/client";

describe("data-client (S-001 foundation) — getTodayPrompt", () => {
  it("resolves a seeded prompt with submissionStatus.submitted === false", async () => {
    const result = await mockDataClient.getTodayPrompt();

    expect(result.prompt).toBeDefined();
    expect(typeof result.prompt.id).toBe("string");
    expect(result.prompt.id.length).toBeGreaterThan(0);
    expect(typeof result.prompt.date).toBe("string");
    expect(typeof result.prompt.text).toBe("string");
    expect(typeof result.prompt.createdAt).toBe("string");

    expect(result.submissionStatus).toBeDefined();
    expect(result.submissionStatus.submitted).toBe(false);
  });
});

/** Loads fresh, isolated module instances of the mock data client + active-user seam. */
function loadFreshClient(): {
  freshClient: DataClient;
  setActiveUser: (id: string | null) => void;
} {
  jest.resetModules();
  const { mockDataClient: freshClient }: { mockDataClient: DataClient } = require("@/src/data/mock");
  const { setActiveUser } = require("@/src/data/active-user");
  return { freshClient, setActiveUser };
}

describe("data-client (S-005) — submit-to-unlock (AC2)", () => {
  it("rejects getChannelResponses with NotSubmittedError before any submit()", async () => {
    jest.resetModules();
    const { mockDataClient: freshClient }: { mockDataClient: DataClient } = require("@/src/data/mock");
    const { NotSubmittedError: FreshNotSubmittedError } = require("@/src/data/client");
    const { prompt } = await freshClient.getTodayPrompt();

    await expect(freshClient.getChannelResponses("channel-alpha", prompt.id)).rejects.toBeInstanceOf(
      FreshNotSubmittedError,
    );
  });

  it("unlocks after submit(): submissionStatus.submitted becomes true and the wall includes the caller's own response", async () => {
    const { freshClient, setActiveUser } = loadFreshClient();
    const alice = await freshClient.signUp("alice@scribl.test", "Alice");
    setActiveUser(alice.id);

    const { prompt } = await freshClient.getTodayPrompt();

    await freshClient.submit({ promptId: prompt.id, channelIds: ["channel-alpha"] });

    const afterSubmit = await freshClient.getTodayPrompt();
    expect(afterSubmit.submissionStatus.submitted).toBe(true);

    const wall = await freshClient.getChannelResponses("channel-alpha", prompt.id);
    expect(wall.responses.some((response) => response.authorName === "Alice")).toBe(true);
  });
});

describe("data-client (S-017) — getResponse", () => {
  it("rejects getResponse with NotSubmittedError before any submit()", async () => {
    const { freshClient, setActiveUser } = loadFreshClient();
    const { NotSubmittedError: FreshNotSubmittedError } = require("@/src/data/client");
    const alice = await freshClient.signUp("alice@scribl.test", "Alice");
    setActiveUser(alice.id);
    const { prompt } = await freshClient.getTodayPrompt();

    await expect(
      freshClient.getResponse("channel-alpha", prompt.id, "response-nope"),
    ).rejects.toBeInstanceOf(FreshNotSubmittedError);
  });

  it("finds an existing response by id after submit()", async () => {
    const { freshClient, setActiveUser } = loadFreshClient();
    const alice = await freshClient.signUp("alice@scribl.test", "Alice");
    setActiveUser(alice.id);
    const { prompt } = await freshClient.getTodayPrompt();
    await freshClient.submit({ promptId: prompt.id, channelIds: ["channel-alpha"] });

    const expectedId = `response-${alice.id}-${prompt.id}-channel-alpha`;
    const response = await freshClient.getResponse("channel-alpha", prompt.id, expectedId);

    expect(response.id).toBe(expectedId);
    expect(response.authorName).toBe("Alice");
  });

  it("throws a plain Error when the response id is not found after an authorized fetch", async () => {
    const { freshClient, setActiveUser } = loadFreshClient();
    const alice = await freshClient.signUp("alice@scribl.test", "Alice");
    setActiveUser(alice.id);
    const { prompt } = await freshClient.getTodayPrompt();
    await freshClient.submit({ promptId: prompt.id, channelIds: ["channel-alpha"] });

    await expect(
      freshClient.getResponse("channel-alpha", prompt.id, "response-nope"),
    ).rejects.toThrow("Response not found");
  });
});

describe("data-client (S-005) — reactions (AC5)", () => {
  it("addReaction appends a reaction, reflected in a subsequent getChannelResponses call", async () => {
    const { freshClient, setActiveUser } = loadFreshClient();
    const alice = await freshClient.signUp("alice@scribl.test", "Alice");
    setActiveUser(alice.id);
    const { prompt } = await freshClient.getTodayPrompt();
    await freshClient.submit({ promptId: prompt.id, channelIds: ["channel-alpha"] });

    const responseId = `response-${alice.id}-${prompt.id}-channel-alpha`;

    const updated = await freshClient.addReaction(
      "channel-alpha",
      prompt.id,
      responseId,
      "👍",
    );

    expect(updated.reactions).toEqual(
      expect.arrayContaining([{ emoji: "👍", userId: expect.any(String) }]),
    );

    const wall = await freshClient.getChannelResponses("channel-alpha", prompt.id);
    const response = wall.responses.find((candidate) => candidate.id === responseId);
    expect(response?.reactions).toEqual(
      expect.arrayContaining([{ emoji: "👍", userId: expect.any(String) }]),
    );
  });
});

describe("data-client (auth) — login matches email AND displayName", () => {
  it("returns the user when email + name match (case/whitespace-insensitive)", async () => {
    const { freshClient } = loadFreshClient();
    const bob = await freshClient.signUp("bob@scribl.test", "Bob");

    const result = await freshClient.login("  BOB@Scribl.TEST ", "  bOb ");

    expect(result).toEqual(bob);
  });

  it("throws UserNotFoundError when the email matches but the name does not", async () => {
    const { freshClient } = loadFreshClient();
    const { UserNotFoundError: FreshUserNotFoundError } = require("@/src/data/client");
    await freshClient.signUp("bob@scribl.test", "Bob");

    await expect(freshClient.login("bob@scribl.test", "Alice")).rejects.toBeInstanceOf(
      FreshUserNotFoundError,
    );
  });

  it("throws UserNotFoundError when the email does not match", async () => {
    const { freshClient } = loadFreshClient();
    const { UserNotFoundError: FreshUserNotFoundError } = require("@/src/data/client");
    await freshClient.signUp("bob@scribl.test", "Bob");

    await expect(freshClient.login("nobody@scribl.test", "Bob")).rejects.toBeInstanceOf(
      FreshUserNotFoundError,
    );
  });
});

describe("data-client (WS4) — inviteMember", () => {
  it("adds a brand-new invitee (by email) as a channel member", async () => {
    const { freshClient, setActiveUser } = loadFreshClient();
    const alice = await freshClient.signUp("alice@scribl.test", "Alice");
    setActiveUser(alice.id);
    const wall = await freshClient.createWall({ name: "Family", kind: "group", isPublic: false });

    const member = await freshClient.inviteMember(wall.id, "bob@scribl.test", "Bob");

    expect(member.displayName).toBe("Bob");
    expect(typeof member.userId).toBe("string");
  });

  it("reuses an existing user's account when the email already has one", async () => {
    const { freshClient, setActiveUser } = loadFreshClient();
    const alice = await freshClient.signUp("alice@scribl.test", "Alice");
    setActiveUser(alice.id);
    const bob = await freshClient.signUp("bob@scribl.test", "Bob");
    const wall = await freshClient.createWall({ name: "Family", kind: "group", isPublic: false });

    const member = await freshClient.inviteMember(wall.id, "bob@scribl.test");

    expect(member.userId).toBe(bob.id);
  });
});

describe("data-client (Settings) — updateUser", () => {
  it("mutates the in-memory user and returns the updated User", async () => {
    const { freshClient } = loadFreshClient();
    const alice = await freshClient.signUp("alice@scribl.test", "Alice");

    const updated = await freshClient.updateUser(alice.id, {
      displayName: "Alicia",
      email: "alicia@scribl.test",
      avatarColor: "#00ff00",
    });

    expect(updated.id).toBe(alice.id);
    expect(updated.displayName).toBe("Alicia");
    expect(updated.email).toBe("alicia@scribl.test");
    expect(updated.avatarColor).toBe("#00ff00");

    const [again] = await freshClient.listUsers();
    expect(again.displayName).toBe("Alicia");
  });

  it("throws for an unknown user id", async () => {
    const { freshClient } = loadFreshClient();
    await expect(freshClient.updateUser("user-nope", { displayName: "X" })).rejects.toThrow();
  });
});

describe("data-client (Settings) — getChannelMembers includes email", () => {
  it("returns email per member", async () => {
    const { freshClient, setActiveUser } = loadFreshClient();
    const alice = await freshClient.signUp("alice@scribl.test", "Alice");
    setActiveUser(alice.id);
    const { prompt } = await freshClient.getTodayPrompt();
    // Personal Archive is the one channel a fresh signup is auto-joined to
    // (no Public wall to lean on anymore), so submitting there is what
    // populates channelMembers for the getChannelMembers read below.
    const archiveChannelId = `channel-${alice.id}-archive`;
    await freshClient.submit({ promptId: prompt.id, channelIds: [archiveChannelId] });

    const members = await freshClient.getChannelMembers(archiveChannelId, prompt.id);

    const aliceMember = members.find((m) => m.userId === alice.id);
    expect(aliceMember?.email).toBe("alice@scribl.test");
  });
});
