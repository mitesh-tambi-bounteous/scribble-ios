/**
 * Task 10 screen test for the challenge detail screen
 * (app/challenge/[id].tsx): per-viewer reveal (open+not-submitted -> draw,
 * revealed -> entry grid + leaderboard, since iSubmitted implies revealed and
 * challenges never close), plus the revealed-but-not-submitted locked state.
 * Skia/CanvasKit cannot render in node, so DrawingCanvas is mocked (same
 * pattern as tests/canvas.test.tsx) - these tests exercise the screen's
 * wiring.
 */

import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";

const mockLoad = jest.fn();
const mockSubmitEntry = jest.fn();
const mockRate = jest.fn();
const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useLocalSearchParams: () => ({ id: "challenge-1" }),
  useFocusEffect: (callback: () => void) => {
    const { useEffect } = require("react");
    useEffect(callback, []);
  },
}));

jest.mock("@/src/stores/useChallengeStore", () => ({
  useChallengeStore: jest.fn(),
}));

jest.mock("@/src/data/active-user", () => ({
  getActiveUserId: jest.fn(),
}));

const mockExportToImage = jest.fn(() => ({
  encodeToBase64: () => "ZmFrZQ==",
}));
const mockClear = jest.fn();

jest.mock("@/components/canvas/DrawingCanvas", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: (props: { apiRef?: { current: unknown } }) => {
      if (props.apiRef) {
        props.apiRef.current = {
          exportToImage: mockExportToImage,
          clear: mockClear,
        };
      }
      return <View testID="mock-drawing-canvas" />;
    },
  };
});

import { ENTRY_CANVAS_FRAME_CLASSNAME } from "@/src/lib/canvasFrame";
import { useChallengeStore } from "@/src/stores/useChallengeStore";
import { getActiveUserId } from "@/src/data/active-user";
import ChallengeScreen from "../app/challenge/[id]";

const mockUseChallengeStore = useChallengeStore as unknown as jest.Mock;
const mockGetActiveUserId = getActiveUserId as jest.Mock;

const CHALLENGE = {
  id: "challenge-1",
  channelId: "channel-1",
  word: "Lighthouse",
  drawSeconds: 120,
};

function baseState(overrides: Record<string, unknown> = {}) {
  return {
    detail: null,
    loading: false,
    error: null,
    locked: false,
    load: mockLoad,
    submitEntry: mockSubmitEntry,
    rate: mockRate,
    ...overrides,
  };
}

describe("ChallengeScreen (Task 10)", () => {
  beforeEach(() => {
    mockLoad.mockClear();
    mockSubmitEntry.mockClear();
    mockRate.mockClear();
    mockPush.mockClear();
    mockBack.mockClear();
    mockGetActiveUserId.mockReturnValue("user-me");
  });

  it("shows a loading state", async () => {
    mockUseChallengeStore.mockReturnValue(baseState({ loading: true }));
    await render(<ChallengeScreen />);
    expect(screen.getByTestId("challenge-loading")).toBeTruthy();
  });

  it("shows an error state with retry", async () => {
    mockUseChallengeStore.mockReturnValue(baseState({ error: "Failed to load" }));
    await render(<ChallengeScreen />);
    expect(screen.getByText("Failed to load")).toBeTruthy();
  });

  it("shows the locked state when revealed and the caller did not enter", async () => {
    mockUseChallengeStore.mockReturnValue(baseState({ locked: true }));
    await render(<ChallengeScreen />);
    expect(screen.getByTestId("challenge-locked")).toBeTruthy();
  });

  it("open + not submitted: renders the drawing canvas and Done, with the per-drawing timer, unrestricted toolset", async () => {
    mockUseChallengeStore.mockReturnValue(
      baseState({
        detail: {
          challenge: CHALLENGE,
          state: "open",
          participantCount: 3,
          submittedCount: 1,
          iSubmitted: false,
          entries: [],
          leaderboard: [],
        },
      }),
    );
    await render(<ChallengeScreen />);
    expect(screen.getByTestId("mock-drawing-canvas")).toBeTruthy();
    expect(screen.getByTestId("challenge-done")).toBeTruthy();
    expect(screen.getByText("Lighthouse")).toBeTruthy();
    expect(screen.getByTestId("drawpad-timer")).toBeTruthy();

    // Canvas-geometry parity (the whole point of this fix): the entry-canvas
    // frame must use the SHARED class AND be a DIRECT child of the screen
    // root — exactly like app/create-challenge-background.tsx. If it were
    // re-nested under a padded/word wrapper, w-full/flex-1 would resolve to a
    // smaller, different-aspect canvas and the drawn background would stretch.
    const frame = screen.getByTestId("entry-canvas-frame");
    expect(frame.props.className).toBe(ENTRY_CANVAS_FRAME_CLASSNAME);
    expect(frame.parent?.props.testID).toBe("challenge-screen");

    // Parity with the normal draw canvas: an undefined toolset gives the
    // challenge the full toolset — 16 colors, 6 brush sizes, and the fill tool.
    expect(screen.getAllByLabelText(/^Choose color /)).toHaveLength(16);
    expect(screen.getAllByLabelText(/^Brush size /)).toHaveLength(6);
    expect(screen.getByLabelText("Fill tool")).toBeTruthy();
  });

  it("revealed: renders the entry grid as a static read-only stars readout per entry, with tiles that navigate to the full-screen entry viewer, and the leaderboard winner", async () => {
    mockUseChallengeStore.mockReturnValue(
      baseState({
        detail: {
          challenge: CHALLENGE,
          state: "revealed",
          participantCount: 2,
          submittedCount: 2,
          iSubmitted: true,
          winnerEntryId: "entry-other",
          entries: [
            {
              id: "entry-me",
              userId: "user-me",
              authorName: "Me",
              averageStars: 3,
              ratingCount: 1,
            },
            {
              id: "entry-other",
              userId: "user-other",
              authorName: "Other",
              averageStars: 5,
              ratingCount: 2,
            },
          ],
          leaderboard: [
            { entryId: "entry-other", userId: "user-other", authorName: "Other", averageStars: 5, ratingCount: 2, rank: 1 },
            { entryId: "entry-me", userId: "user-me", authorName: "Me", averageStars: 3, ratingCount: 1, rank: 2 },
          ],
        },
      }),
    );
    await render(<ChallengeScreen />);

    // The grid itself no longer hosts the interactive rating control (that
    // moved to app/challenge/[id]/entry/[entryId].tsx) — it only shows a
    // static, read-only stars readout per entry.
    expect(screen.queryByTestId("rate-entry-entry-me")).toBeNull();
    expect(screen.queryByTestId("rate-entry-entry-other")).toBeNull();
    expect(screen.getByTestId("stars-entry-entry-me")).toBeTruthy();
    expect(screen.getByTestId("stars-entry-entry-other")).toBeTruthy();

    // Tapping a tile navigates to the full-screen entry viewer for that entry.
    fireEvent.press(screen.getByTestId("challenge-entry-tile-entry-me"));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/challenge/[id]/entry/[entryId]",
      params: { id: "challenge-1", entryId: "entry-me" },
    });

    fireEvent.press(screen.getByTestId("challenge-entry-tile-entry-other"));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/challenge/[id]/entry/[entryId]",
      params: { id: "challenge-1", entryId: "entry-other" },
    });

    expect(screen.getByTestId("challenge-winner")).toBeTruthy();
    expect(screen.getByText("Other")).toBeTruthy();
  });
});
