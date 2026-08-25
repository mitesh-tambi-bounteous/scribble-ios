/**
 * Task 8 store test for the per-channel challenges list
 * (src/stores/useChallengesStore.ts).
 *
 * Confirms load() relays listChallenges() into { challenges, loading, error }
 * and create() returns the created challenge for the screen to navigate
 * with, following the useWallsStore/useWallStore conventions.
 */

import type { Challenge, ChallengeSummary } from "@scribl/shared/index";
import type { CreateChallengeInput } from "@/src/data/client";

jest.mock("@/src/data", () => ({
  dataClient: { listChallenges: jest.fn(), createChallenge: jest.fn() },
}));

import { dataClient } from "@/src/data";
import { useChallengesStore } from "@/src/stores/useChallengesStore";

const mockListChallenges = dataClient.listChallenges as jest.Mock;
const mockCreateChallenge = dataClient.createChallenge as jest.Mock;

const SAMPLE_SUMMARY: ChallengeSummary = {
  challenge: {
    id: "challenge-1",
    channelId: "channel-1",
    creatorId: "user-alice",
    word: "Dragon",
    drawSeconds: 60,
    createdAt: "2026-07-02T09:00:00.000Z",
  },
  state: "open",
  participantCount: 3,
  submittedCount: 0,
  iSubmitted: false,
};

const SAMPLE_CHALLENGE: Challenge = SAMPLE_SUMMARY.challenge;

describe("useChallengesStore (task 8)", () => {
  beforeEach(() => {
    useChallengesStore.setState({ challenges: [], loading: false, error: null });
    mockListChallenges.mockReset();
    mockCreateChallenge.mockReset();
  });

  it("has an initial state of { challenges: [], loading: false, error: null }", () => {
    expect(useChallengesStore.getState()).toMatchObject({
      challenges: [],
      loading: false,
      error: null,
    });
  });

  it("load() success sets challenges and clears loading/error", async () => {
    mockListChallenges.mockResolvedValueOnce([SAMPLE_SUMMARY]);

    await useChallengesStore.getState().load("channel-1");

    expect(useChallengesStore.getState().challenges).toEqual([SAMPLE_SUMMARY]);
    expect(useChallengesStore.getState().loading).toBe(false);
    expect(useChallengesStore.getState().error).toBeNull();
  });

  it("load() failure sets error, leaves challenges unchanged", async () => {
    mockListChallenges.mockRejectedValueOnce(new Error("boom"));

    await useChallengesStore.getState().load("channel-1");

    expect(useChallengesStore.getState().error).toBe("boom");
    expect(useChallengesStore.getState().loading).toBe(false);
    expect(useChallengesStore.getState().challenges).toEqual([]);
  });

  it("create() returns the created challenge and clears error", async () => {
    mockCreateChallenge.mockResolvedValueOnce(SAMPLE_CHALLENGE);

    const input: CreateChallengeInput = {
      word: "Dragon",
      drawSeconds: 60,
      toolset: { brushes: ["basic"], colors: ["#000000"] },
    };
    const result = await useChallengesStore.getState().create("channel-1", input);

    expect(result).toEqual(SAMPLE_CHALLENGE);
    expect(mockCreateChallenge).toHaveBeenCalledWith("channel-1", input);
    expect(useChallengesStore.getState().error).toBeNull();
  });

  it("create() failure sets error and rethrows", async () => {
    mockCreateChallenge.mockRejectedValueOnce(new Error("create failed"));

    const input: CreateChallengeInput = {
      word: "Dragon",
      drawSeconds: 60,
      toolset: { brushes: ["basic"], colors: ["#000000"] },
    };
    await expect(useChallengesStore.getState().create("channel-1", input)).rejects.toThrow(
      "create failed",
    );

    expect(useChallengesStore.getState().error).toBe("create failed");
  });
});
