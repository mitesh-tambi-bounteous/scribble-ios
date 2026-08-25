/**
 * Task 8 store test for the single-challenge detail seam
 * (src/stores/useChallengeStore.ts).
 *
 * Confirms load() relays getChallengeDetail() into
 * { detail, loading, error, locked }: a normal open-blind detail
 * (state === "open", entries: []) is NOT locked, while a NotSubmittedError
 * (revealed-but-not-submitted, AC2) sets locked true and detail null.
 * submitEntry()/rate() call the data client then reload, per the
 * useWallStore/useWallsStore conventions.
 */

import type { ChallengeDetail } from "@scribl/shared/index";

jest.mock("@/src/data", () => ({
  dataClient: {
    getChallengeDetail: jest.fn(),
    submitChallengeEntry: jest.fn(),
    rateChallengeEntry: jest.fn(),
  },
}));

import { dataClient } from "@/src/data";
import { NotSubmittedError } from "@/src/data/client";
import { useChallengeStore } from "@/src/stores/useChallengeStore";

const mockGetChallengeDetail = dataClient.getChallengeDetail as jest.Mock;
const mockSubmitChallengeEntry = dataClient.submitChallengeEntry as jest.Mock;
const mockRateChallengeEntry = dataClient.rateChallengeEntry as jest.Mock;

const OPEN_DETAIL: ChallengeDetail = {
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
  entries: [],
  leaderboard: [],
};

const REVEALED_DETAIL: ChallengeDetail = {
  ...OPEN_DETAIL,
  state: "revealed",
  submittedCount: 3,
  iSubmitted: true,
  entries: [
    {
      id: "entry-1",
      challengeId: "challenge-1",
      userId: "user-alice",
      authorName: "Alice",
      createdAt: "2026-07-02T09:30:00.000Z",
      averageStars: 4,
      ratingCount: 1,
    },
  ],
  leaderboard: [
    { entryId: "entry-1", userId: "user-alice", authorName: "Alice", averageStars: 4, ratingCount: 1, rank: 1 },
  ],
};

describe("useChallengeStore (task 8)", () => {
  beforeEach(() => {
    useChallengeStore.setState({ detail: null, loading: false, error: null, locked: false });
    mockGetChallengeDetail.mockReset();
    mockSubmitChallengeEntry.mockReset();
    mockRateChallengeEntry.mockReset();
  });

  it("has an initial state of { detail: null, loading: false, error: null, locked: false }", () => {
    expect(useChallengeStore.getState()).toMatchObject({
      detail: null,
      loading: false,
      error: null,
      locked: false,
    });
  });

  it("load() with an open-blind detail sets detail, leaves locked false", async () => {
    mockGetChallengeDetail.mockResolvedValueOnce(OPEN_DETAIL);

    await useChallengeStore.getState().load("challenge-1");

    expect(useChallengeStore.getState().detail).toEqual(OPEN_DETAIL);
    expect(useChallengeStore.getState().locked).toBe(false);
    expect(useChallengeStore.getState().loading).toBe(false);
    expect(useChallengeStore.getState().error).toBeNull();
  });

  it("load() rejecting with NotSubmittedError sets locked true, detail null", async () => {
    mockGetChallengeDetail.mockRejectedValueOnce(new NotSubmittedError("submit an entry to see the reveal"));

    await useChallengeStore.getState().load("challenge-1");

    expect(useChallengeStore.getState().locked).toBe(true);
    expect(useChallengeStore.getState().detail).toBeNull();
    expect(useChallengeStore.getState().error).toBe("submit an entry to see the reveal");
    expect(useChallengeStore.getState().loading).toBe(false);
  });

  it("load() rejecting with a plain Error sets error, leaves locked false", async () => {
    mockGetChallengeDetail.mockRejectedValueOnce(new Error("boom"));

    await useChallengeStore.getState().load("challenge-1");

    expect(useChallengeStore.getState().error).toBe("boom");
    expect(useChallengeStore.getState().locked).toBe(false);
    expect(useChallengeStore.getState().loading).toBe(false);
  });

  it("load({ background: true }) keeps the current detail and never sets error on a failed refresh", async () => {
    // A live poll while the user is mid-draw: a transient failure must NOT wipe
    // the current detail or flip the screen to the error/loading state (which
    // would unmount and clear the drawing canvas).
    useChallengeStore.setState({ detail: OPEN_DETAIL, loading: false, error: null, locked: false });
    mockGetChallengeDetail.mockRejectedValueOnce(new Error("network blip"));

    await useChallengeStore.getState().load("challenge-1", { background: true });

    expect(useChallengeStore.getState().detail).toEqual(OPEN_DETAIL);
    expect(useChallengeStore.getState().loading).toBe(false);
    expect(useChallengeStore.getState().error).toBeNull();
    expect(useChallengeStore.getState().locked).toBe(false);
  });

  it("submitEntry() calls the client then reloads the detail", async () => {
    mockSubmitChallengeEntry.mockResolvedValueOnce(REVEALED_DETAIL.entries[0]);
    mockGetChallengeDetail.mockResolvedValueOnce(REVEALED_DETAIL);

    await useChallengeStore.getState().submitEntry("challenge-1", "img-ref");

    expect(mockSubmitChallengeEntry).toHaveBeenCalledWith("challenge-1", "img-ref");
    expect(mockGetChallengeDetail).toHaveBeenCalledWith("challenge-1");
    expect(useChallengeStore.getState().detail).toEqual(REVEALED_DETAIL);
  });

  it("rate() calls the client then reloads the detail", async () => {
    mockRateChallengeEntry.mockResolvedValueOnce(REVEALED_DETAIL.entries[0]);
    mockGetChallengeDetail.mockResolvedValueOnce(REVEALED_DETAIL);

    await useChallengeStore.getState().rate("challenge-1", "entry-1", 5);

    expect(mockRateChallengeEntry).toHaveBeenCalledWith("challenge-1", "entry-1", 5);
    expect(mockGetChallengeDetail).toHaveBeenCalledWith("challenge-1");
    expect(useChallengeStore.getState().detail).toEqual(REVEALED_DETAIL);
  });
});
