/**
 * Foundation smoke test for the S-001 prompt-store seam (src/stores/usePromptStore.ts).
 *
 * Confirms the store's initial state, and that load() correctly reflects the
 * data-client seam's success/failure into { data, loading, error } — the Today
 * screen reads only from this store, never calling the data client directly.
 */

import type { TodayPromptResponse } from "@scribl/shared/index";

jest.mock("@/src/data", () => ({
  dataClient: { getTodayPrompt: jest.fn() },
}));

import { dataClient } from "@/src/data";
import { usePromptStore } from "@/src/stores/usePromptStore";

const mockGetTodayPrompt = dataClient.getTodayPrompt as jest.Mock;

describe("usePromptStore (S-001 foundation)", () => {
  beforeEach(() => {
    usePromptStore.setState({ data: null, loading: false, error: null });
    mockGetTodayPrompt.mockReset();
  });

  it("has an initial state of { data: null, loading: false, error: null }", () => {
    expect(usePromptStore.getState()).toMatchObject({
      data: null,
      loading: false,
      error: null,
    });
  });

  it("load() success sets data from the data client and clears loading/error", async () => {
    const response: TodayPromptResponse = {
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
    mockGetTodayPrompt.mockResolvedValueOnce(response);

    await usePromptStore.getState().load();

    expect(usePromptStore.getState().data).toEqual(response);
    expect(usePromptStore.getState().loading).toBe(false);
    expect(usePromptStore.getState().error).toBeNull();
  });

  it("load() failure sets error from the rejected data client and leaves data null", async () => {
    mockGetTodayPrompt.mockRejectedValueOnce(new Error("boom"));

    await usePromptStore.getState().load();

    expect(usePromptStore.getState().error).toBe("boom");
    expect(usePromptStore.getState().loading).toBe(false);
    expect(usePromptStore.getState().data).toBeNull();
  });
});
