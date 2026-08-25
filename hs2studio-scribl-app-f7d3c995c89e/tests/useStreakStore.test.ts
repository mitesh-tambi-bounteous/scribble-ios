/**
 * S-006 streak-store tests (src/stores/useStreakStore.ts). Mirrors
 * tests/usePromptStore.test.ts: confirms initial state, and that load()
 * correctly reflects the data-client seam's success/failure into
 * { current, lastSubmittedDate, loading, error } — the Today screen reads
 * only from this store, never calling the data client directly.
 */

import type { Streak } from "@scribl/shared/index";

jest.mock("@/src/data", () => ({
  dataClient: { getStreak: jest.fn(), recordSubmission: jest.fn() },
}));

import { dataClient } from "@/src/data";
import { useStreakStore } from "@/src/stores/useStreakStore";

const mockGetStreak = dataClient.getStreak as jest.Mock;
const mockRecordSubmission = dataClient.recordSubmission as jest.Mock;

describe("useStreakStore (S-006)", () => {
  beforeEach(() => {
    useStreakStore.setState({
      current: 0,
      lastSubmittedDate: undefined,
      loading: false,
      error: null,
    });
    mockGetStreak.mockReset();
    mockRecordSubmission.mockReset();
  });

  it("has an initial state of { current: 0, lastSubmittedDate: undefined, loading: false, error: null }", () => {
    expect(useStreakStore.getState()).toMatchObject({
      current: 0,
      lastSubmittedDate: undefined,
      loading: false,
      error: null,
    });
  });

  it("load() success sets current/lastSubmittedDate from the data client and clears loading/error", async () => {
    const streak: Streak = { current: 3, lastSubmittedDate: "2026-07-01" };
    mockGetStreak.mockResolvedValueOnce(streak);

    await useStreakStore.getState().load();

    expect(useStreakStore.getState().current).toBe(3);
    expect(useStreakStore.getState().lastSubmittedDate).toBe("2026-07-01");
    expect(useStreakStore.getState().loading).toBe(false);
    expect(useStreakStore.getState().error).toBeNull();
  });

  it("load() failure sets error from the rejected data client and leaves current at its default", async () => {
    mockGetStreak.mockRejectedValueOnce(new Error("boom"));

    await useStreakStore.getState().load();

    expect(useStreakStore.getState().error).toBe("boom");
    expect(useStreakStore.getState().loading).toBe(false);
    expect(useStreakStore.getState().current).toBe(0);
  });
});
