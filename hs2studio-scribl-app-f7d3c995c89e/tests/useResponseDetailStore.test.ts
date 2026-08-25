/**
 * S-017 store test for the response-detail seam
 * (src/stores/useResponseDetailStore.ts).
 *
 * Confirms the store's initial state, and that load() correctly relays the
 * data-client seam's success/failure into { data, loading, error, locked } —
 * the response detail screen reads only from this store, never calling the
 * data client directly. NotSubmittedError (AC2) is relayed as `locked`,
 * never gated locally.
 */

import type { ChannelResponse } from "@scribl/shared/index";

jest.mock("@/src/data", () => ({
  dataClient: {
    getResponse: jest.fn(),
    addReaction: jest.fn(),
    updateResponse: jest.fn(),
  },
}));

import { dataClient } from "@/src/data";
import { NotSubmittedError } from "@/src/data/client";
import {
  ENHANCEMENT_POLL_MAX_ATTEMPTS,
  useResponseDetailStore,
} from "@/src/stores/useResponseDetailStore";
import { useFamilyStore } from "@/src/stores/useFamilyStore";

const mockGetResponse = dataClient.getResponse as jest.Mock;
const mockAddReaction = dataClient.addReaction as jest.Mock;
const mockUpdateResponse = dataClient.updateResponse as jest.Mock;

const SAMPLE: ChannelResponse = {
  id: "response-alice-1",
  promptId: "prompt-x",
  channelId: "channel-1",
  authorId: "user-alice",
  authorName: "Alice",
  text: "A very sleepy cat.",
  createdAt: "2026-07-01T09:00:00.000Z",
  reactions: [],
};

describe("useResponseDetailStore (S-017)", () => {
  beforeEach(() => {
    useResponseDetailStore.setState({ data: null, loading: false, error: null, locked: false });
    mockGetResponse.mockReset();
    mockAddReaction.mockReset();
  });

  it("has an initial state of { data: null, loading: false, error: null, locked: false }", () => {
    expect(useResponseDetailStore.getState()).toMatchObject({
      data: null,
      loading: false,
      error: null,
      locked: false,
    });
  });

  it("load() success sets data, clears loading/error, and leaves locked false", async () => {
    mockGetResponse.mockResolvedValueOnce(SAMPLE);

    await useResponseDetailStore.getState().load("channel-1", "prompt-x", "response-alice-1");

    expect(useResponseDetailStore.getState().data).toEqual(SAMPLE);
    expect(useResponseDetailStore.getState().loading).toBe(false);
    expect(useResponseDetailStore.getState().error).toBeNull();
    expect(useResponseDetailStore.getState().locked).toBe(false);
  });

  it("load() rejecting with NotSubmittedError sets locked true, error set, data unchanged", async () => {
    mockGetResponse.mockRejectedValueOnce(new NotSubmittedError("submit first"));

    await useResponseDetailStore.getState().load("channel-1", "prompt-x", "response-alice-1");

    expect(useResponseDetailStore.getState().locked).toBe(true);
    expect(useResponseDetailStore.getState().error).toBe("submit first");
    expect(useResponseDetailStore.getState().loading).toBe(false);
    expect(useResponseDetailStore.getState().data).toBeNull();
  });

  it("load() rejecting with a plain Error sets error, leaves locked false", async () => {
    mockGetResponse.mockRejectedValueOnce(new Error("boom"));

    await useResponseDetailStore.getState().load("channel-1", "prompt-x", "response-alice-1");

    expect(useResponseDetailStore.getState().error).toBe("boom");
    expect(useResponseDetailStore.getState().locked).toBe(false);
    expect(useResponseDetailStore.getState().loading).toBe(false);
  });
});

describe("useResponseDetailStore.addReaction (WS4)", () => {
  beforeEach(() => {
    useResponseDetailStore.setState({ data: SAMPLE, loading: false, error: null, locked: false });
    mockAddReaction.mockReset();
  });

  it("calls dataClient.addReaction and replaces data with the server's echo", async () => {
    const updated: ChannelResponse = { ...SAMPLE, reactions: [{ emoji: "👍", userId: "user-bob" }] };
    mockAddReaction.mockResolvedValueOnce(updated);

    await useResponseDetailStore.getState().addReaction("channel-1", "prompt-x", "response-alice-1", "👍");

    expect(mockAddReaction).toHaveBeenCalledWith("channel-1", "prompt-x", "response-alice-1", "👍");
    expect(useResponseDetailStore.getState().data).toEqual(updated);
  });

  it("sets error and leaves data unchanged when the server rejects (e.g. 403)", async () => {
    mockAddReaction.mockRejectedValueOnce(new Error("not a member"));

    await useResponseDetailStore.getState().addReaction("channel-1", "prompt-x", "response-alice-1", "👍");

    expect(useResponseDetailStore.getState().error).toBe("not a member");
    expect(useResponseDetailStore.getState().data).toEqual(SAMPLE);
  });
});

describe("useResponseDetailStore.load silent option (BF-7)", () => {
  beforeEach(() => {
    useResponseDetailStore.setState({ data: SAMPLE, loading: false, error: null, locked: false });
    mockGetResponse.mockReset();
  });

  it("a silent load never toggles the global loading flag", async () => {
    let sawLoadingTrueDuringCall = false;
    mockGetResponse.mockImplementationOnce(async () => {
      sawLoadingTrueDuringCall = useResponseDetailStore.getState().loading;
      return { ...SAMPLE, text: "refreshed" };
    });

    await useResponseDetailStore
      .getState()
      .load("channel-1", "prompt-x", "response-alice-1", { silent: true });

    expect(sawLoadingTrueDuringCall).toBe(false);
    expect(useResponseDetailStore.getState().loading).toBe(false);
    expect(useResponseDetailStore.getState().data?.text).toBe("refreshed");
  });

  it("a non-silent load still toggles loading true then false (unchanged behavior)", async () => {
    let sawLoadingTrueDuringCall = false;
    mockGetResponse.mockImplementationOnce(async () => {
      sawLoadingTrueDuringCall = useResponseDetailStore.getState().loading;
      return SAMPLE;
    });

    await useResponseDetailStore.getState().load("channel-1", "prompt-x", "response-alice-1");

    expect(sawLoadingTrueDuringCall).toBe(true);
    expect(useResponseDetailStore.getState().loading).toBe(false);
  });
});

describe("useResponseDetailStore.startEnhancementPolling (BF-6/BF-7)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockGetResponse.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("polls via a silent load, never toggling the global loading flag", async () => {
    const pending: ChannelResponse = { ...SAMPLE, enhancementStatus: "pending" };
    useResponseDetailStore.setState({ data: pending, loading: false, error: null, locked: false });
    mockGetResponse.mockResolvedValue({ ...pending });

    const stop = useResponseDetailStore
      .getState()
      .startEnhancementPolling("channel-1", "prompt-x", "response-alice-1");

    await jest.advanceTimersByTimeAsync(3_000);

    expect(mockGetResponse).toHaveBeenCalledTimes(1);
    expect(useResponseDetailStore.getState().loading).toBe(false);
    stop();
  });

  it("falls back to a terminal (failed) status instead of spinning forever once polling is exhausted", async () => {
    const pending: ChannelResponse = { ...SAMPLE, enhancementStatus: "pending" };
    useResponseDetailStore.setState({ data: pending, loading: false, error: null, locked: false });
    mockGetResponse.mockResolvedValue({ ...pending });

    const stop = useResponseDetailStore
      .getState()
      .startEnhancementPolling("channel-1", "prompt-x", "response-alice-1");

    await jest.advanceTimersByTimeAsync(3_000 * (ENHANCEMENT_POLL_MAX_ATTEMPTS + 1));

    expect(useResponseDetailStore.getState().data?.enhancementStatus).toBe("failed");
    stop();
  });
});

describe("useResponseDetailStore -> useFamilyStore gallery sync", () => {
  beforeEach(() => {
    useResponseDetailStore.setState({ data: SAMPLE, loading: false, error: null, locked: false });
    useFamilyStore.setState({
      byDay: {
        "channel-1": {
          "prompt-x": {
            members: [
              {
                userId: "user-alice",
                displayName: "Alice",
                email: "alice@example.com",
                hasDrawnToday: true,
                response: SAMPLE,
              },
            ],
            loading: false,
            error: null,
            locked: false,
          },
        },
      },
      members: [],
      loading: false,
      error: null,
      locked: false,
    });
    mockUpdateResponse.mockReset();
    mockGetResponse.mockReset();
  });

  it("updateResponse (Save) patches the family store's cached member response", async () => {
    const updated: ChannelResponse = { ...SAMPLE, text: "edited caption" };
    mockUpdateResponse.mockResolvedValueOnce(updated);

    await useResponseDetailStore
      .getState()
      .updateResponse("channel-1", "prompt-x", "response-alice-1", { text: "edited caption" });

    expect(useFamilyStore.getState().byDay["channel-1"]?.["prompt-x"]?.members[0]?.response?.text).toBe(
      "edited caption",
    );
  });

  it("regenerate patches the family store immediately with the pending response", async () => {
    const pending: ChannelResponse = { ...SAMPLE, enhancementStatus: "pending" };
    mockUpdateResponse.mockResolvedValueOnce(pending);
    mockGetResponse.mockResolvedValue(pending);

    const stop = await useResponseDetailStore
      .getState()
      .regenerate("channel-1", "prompt-x", "response-alice-1", {});

    expect(useFamilyStore.getState().byDay["channel-1"]?.["prompt-x"]?.members[0]?.response?.enhancementStatus).toBe(
      "pending",
    );
    stop();
  });

  it("a silent poll resolving to 'ready' patches the family store with the new enhancedImageRef", async () => {
    const ready: ChannelResponse = {
      ...SAMPLE,
      enhancementStatus: "ready",
      enhancedImageRef: "data:image/png;base64,NEWBG",
    };
    mockGetResponse.mockResolvedValueOnce(ready);

    await useResponseDetailStore
      .getState()
      .load("channel-1", "prompt-x", "response-alice-1", { silent: true });

    expect(
      useFamilyStore.getState().byDay["channel-1"]?.["prompt-x"]?.members[0]?.response?.enhancedImageRef,
    ).toBe("data:image/png;base64,NEWBG");
  });
});
