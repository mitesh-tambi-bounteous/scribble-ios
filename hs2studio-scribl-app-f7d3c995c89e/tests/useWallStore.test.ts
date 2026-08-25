/**
 * S-005 store test for the channel-wall seam (src/stores/useWallStore.ts).
 *
 * Confirms the store's initial state, and that load()/react() correctly
 * relay the data-client seam's success/failure into
 * { data, loading, error, locked } — the Wall screen reads only from this
 * store, never calling the data client directly. NotSubmittedError (AC2) is
 * relayed as `locked`, never gated locally.
 */

import type { ChannelResponsesResponse } from "@scribl/shared/index";

jest.mock("@/src/data", () => ({
  dataClient: { getChannelResponses: jest.fn(), addReaction: jest.fn() },
}));

import { dataClient } from "@/src/data";
import { NotSubmittedError } from "@/src/data/client";
import { useWallStore } from "@/src/stores/useWallStore";

const mockGetChannelResponses = dataClient.getChannelResponses as jest.Mock;
const mockAddReaction = dataClient.addReaction as jest.Mock;

const SAMPLE: ChannelResponsesResponse = {
  channelId: "channel-1",
  promptId: "prompt-x",
  responses: [
    {
      id: "response-alice-1",
      promptId: "prompt-x",
      channelId: "channel-1",
      authorId: "user-alice",
      authorName: "Alice",
      text: "A very sleepy cat.",
      createdAt: "2026-07-01T09:00:00.000Z",
      reactions: [],
    },
  ],
};

describe("useWallStore (S-005)", () => {
  beforeEach(() => {
    useWallStore.setState({ data: null, loading: false, error: null, locked: false });
    mockGetChannelResponses.mockReset();
    mockAddReaction.mockReset();
  });

  it("has an initial state of { data: null, loading: false, error: null, locked: false }", () => {
    expect(useWallStore.getState()).toMatchObject({
      data: null,
      loading: false,
      error: null,
      locked: false,
    });
  });

  it("load() success sets data, clears loading/error, and leaves locked false", async () => {
    mockGetChannelResponses.mockResolvedValueOnce(SAMPLE);

    await useWallStore.getState().load("channel-1", "prompt-x");

    expect(useWallStore.getState().data).toEqual(SAMPLE);
    expect(useWallStore.getState().loading).toBe(false);
    expect(useWallStore.getState().error).toBeNull();
    expect(useWallStore.getState().locked).toBe(false);
  });

  it("load() rejecting with NotSubmittedError sets locked true, error set, data unchanged", async () => {
    mockGetChannelResponses.mockRejectedValueOnce(new NotSubmittedError("submit first"));

    await useWallStore.getState().load("channel-1", "prompt-x");

    expect(useWallStore.getState().locked).toBe(true);
    expect(useWallStore.getState().error).toBe("submit first");
    expect(useWallStore.getState().loading).toBe(false);
    expect(useWallStore.getState().data).toBeNull();
  });

  it("load() rejecting with a plain Error sets error, leaves locked false", async () => {
    mockGetChannelResponses.mockRejectedValueOnce(new Error("boom"));

    await useWallStore.getState().load("channel-1", "prompt-x");

    expect(useWallStore.getState().error).toBe("boom");
    expect(useWallStore.getState().locked).toBe(false);
    expect(useWallStore.getState().loading).toBe(false);
  });

  it("react() success replaces the matching response, leaves other fields alone", async () => {
    useWallStore.setState({ data: SAMPLE, loading: false, error: null, locked: false });
    const updatedResponse = {
      ...SAMPLE.responses[0],
      reactions: [{ emoji: "👍", userId: "user-demo" }],
    };
    mockAddReaction.mockResolvedValueOnce(updatedResponse);

    await useWallStore.getState().react("channel-1", "prompt-x", "response-alice-1", "👍");

    const { data } = useWallStore.getState();
    expect(data?.responses).toEqual([updatedResponse]);
    expect(data?.channelId).toBe(SAMPLE.channelId);
    expect(data?.promptId).toBe(SAMPLE.promptId);
  });

  it("react() failure sets error, leaves data unchanged", async () => {
    useWallStore.setState({ data: SAMPLE, loading: false, error: null, locked: false });
    mockAddReaction.mockRejectedValueOnce(new Error("react failed"));

    await useWallStore.getState().react("channel-1", "prompt-x", "response-alice-1", "👍");

    expect(useWallStore.getState().error).toBe("react failed");
    expect(useWallStore.getState().data).toEqual(SAMPLE);
  });

  it("react() when data is null resolves without calling dataClient.addReaction", async () => {
    useWallStore.setState({ data: null, loading: false, error: null, locked: false });

    await useWallStore.getState().react("channel-1", "prompt-x", "response-alice-1", "👍");

    expect(mockAddReaction).not.toHaveBeenCalled();
    expect(useWallStore.getState().data).toBeNull();
  });

  it("loadArchive() merges responses across all promptIds sorted newest-first by createdAt", async () => {
    mockGetChannelResponses.mockImplementation((_channelId: string, promptId: string) => {
      if (promptId === "prompt-old") {
        return Promise.resolve({
          channelId: "channel-1-archive",
          promptId: "prompt-old",
          responses: [
            {
              id: "response-old",
              promptId: "prompt-old",
              channelId: "channel-1-archive",
              authorId: "user-me",
              authorName: "You",
              text: "Older",
              createdAt: "2026-06-20T09:00:00.000Z",
              reactions: [],
            },
          ],
        });
      }
      return Promise.resolve({
        channelId: "channel-1-archive",
        promptId: "prompt-new",
        responses: [
          {
            id: "response-new",
            promptId: "prompt-new",
            channelId: "channel-1-archive",
            authorId: "user-me",
            authorName: "You",
            text: "Newer",
            createdAt: "2026-07-01T09:00:00.000Z",
            reactions: [],
          },
        ],
      });
    });

    await useWallStore.getState().loadArchive("channel-1-archive", ["prompt-old", "prompt-new"]);

    const { archiveResponses, archiveLoading } = useWallStore.getState();
    expect(archiveLoading).toBe(false);
    expect(archiveResponses.map((r) => r.id)).toEqual(["response-new", "response-old"]);
  });
});
