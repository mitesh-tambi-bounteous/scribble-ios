/**
 * Store test for useFamilyStore.patchResponse (gallery-sync fix).
 *
 * Confirms patchResponse replaces a matching member's cached `response` in
 * byDay[promptId] in place (immutably), matching by response.id or
 * member.userId === response.authorId, and no-ops when the day/member isn't
 * loaded — this is what keeps the family gallery grid in sync after an edit
 * or regenerate on the response-detail screen.
 */

import type { ChannelMember, ChannelResponse } from "@scribl/shared/index";

const mockGetChannelMembers = jest.fn();

jest.mock("@/src/data", () => ({
  dataClient: { getChannelMembers: (...args: unknown[]) => mockGetChannelMembers(...args), listChannelDays: jest.fn() },
}));

import { useFamilyStore } from "@/src/stores/useFamilyStore";

const RESPONSE: ChannelResponse = {
  id: "response-alice-1",
  promptId: "prompt-x",
  channelId: "channel-1",
  authorId: "user-alice",
  authorName: "Alice",
  text: "original caption",
  createdAt: "2026-07-01T09:00:00.000Z",
  reactions: [],
};

const MEMBER: ChannelMember = {
  userId: "user-alice",
  displayName: "Alice",
  email: "alice@example.com",
  hasDrawnToday: true,
  response: RESPONSE,
};

describe("useFamilyStore.patchResponse", () => {
  beforeEach(() => {
    useFamilyStore.setState({ byDay: {}, members: [], loading: false, error: null, locked: false });
  });

  it("replaces the matching member's response by response.id", () => {
    useFamilyStore.setState({
      byDay: { "channel-1": { "prompt-x": { members: [MEMBER], loading: false, error: null, locked: false } } },
    });

    const updated: ChannelResponse = { ...RESPONSE, text: "new caption" };
    useFamilyStore.getState().patchResponse("channel-1", "prompt-x", updated);

    const member = useFamilyStore.getState().byDay["channel-1"]?.["prompt-x"]?.members[0];
    expect(member?.response?.text).toBe("new caption");
  });

  it("matches by member.userId === response.authorId when response.id doesn't already match a cached member", () => {
    const bareMember: ChannelMember = { ...MEMBER, response: undefined };
    useFamilyStore.setState({
      byDay: { "channel-1": { "prompt-x": { members: [bareMember], loading: false, error: null, locked: false } } },
    });

    useFamilyStore.getState().patchResponse("channel-1", "prompt-x", RESPONSE);

    const member = useFamilyStore.getState().byDay["channel-1"]?.["prompt-x"]?.members[0];
    expect(member?.response?.id).toBe("response-alice-1");
  });

  it("is a no-op when the day isn't loaded", () => {
    useFamilyStore.getState().patchResponse("channel-1", "prompt-x", RESPONSE);

    expect(useFamilyStore.getState().byDay["channel-1"]?.["prompt-x"]).toBeUndefined();
  });

  it("is a no-op when no member in the loaded day matches", () => {
    const otherMember: ChannelMember = {
      userId: "user-bob",
      displayName: "Bob",
      email: "bob@example.com",
      hasDrawnToday: false,
    };
    useFamilyStore.setState({
      byDay: { "channel-1": { "prompt-x": { members: [otherMember], loading: false, error: null, locked: false } } },
    });

    useFamilyStore.getState().patchResponse("channel-1", "prompt-x", RESPONSE);

    expect(useFamilyStore.getState().byDay["channel-1"]?.["prompt-x"]?.members[0]).toEqual(otherMember);
  });

  it("does not bleed a response into another channel's cached day with the same promptId", () => {
    useFamilyStore.setState({
      byDay: {
        "channel-1": { "prompt-x": { members: [MEMBER], loading: false, error: null, locked: false } },
        "channel-2": { "prompt-x": { members: [{ ...MEMBER, response: undefined }], loading: false, error: null, locked: false } },
      },
    });

    const updated: ChannelResponse = { ...RESPONSE, text: "channel-1 only" };
    useFamilyStore.getState().patchResponse("channel-1", "prompt-x", updated);

    expect(useFamilyStore.getState().byDay["channel-1"]?.["prompt-x"]?.members[0]?.response?.text).toBe(
      "channel-1 only",
    );
    expect(useFamilyStore.getState().byDay["channel-2"]?.["prompt-x"]?.members[0]?.response).toBeUndefined();
  });
});

describe("useFamilyStore.loadDays — per-channel scoping", () => {
  beforeEach(() => {
    useFamilyStore.setState({ byDay: {}, members: [], loading: false, error: null, locked: false });
    mockGetChannelMembers.mockReset();
  });

  it("caches results under byDay[channelId][promptId], never bleeding across channels sharing a promptId", async () => {
    mockGetChannelMembers.mockImplementation(async (channelId: string) => [
      { userId: `user-${channelId}`, displayName: channelId, email: "x@x.com", hasDrawnToday: true },
    ]);

    await useFamilyStore.getState().loadDays("channel-1", ["prompt-x"]);
    await useFamilyStore.getState().loadDays("channel-2", ["prompt-x"]);

    const state = useFamilyStore.getState();
    expect(state.byDay["channel-1"]?.["prompt-x"]?.members[0]?.userId).toBe("user-channel-1");
    expect(state.byDay["channel-2"]?.["prompt-x"]?.members[0]?.userId).toBe("user-channel-2");
  });
});
