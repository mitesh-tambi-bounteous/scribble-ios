/**
 * Screen test for the full-screen challenge entry viewer
 * (app/challenge/[id]/entry/[entryId].tsx): the interactive star-rating
 * control (moved here from the challenge results grid, see Bug B) is
 * disabled for the caller's own entry and enabled for others.
 */

import { render, screen } from "@testing-library/react-native";
import React from "react";

const mockLoad = jest.fn();
const mockRate = jest.fn();
const mockBack = jest.fn();
let mockEntryId = "entry-me";

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack }),
  useLocalSearchParams: () => ({ id: "challenge-1", entryId: mockEntryId }),
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

import { useChallengeStore } from "@/src/stores/useChallengeStore";
import { getActiveUserId } from "@/src/data/active-user";
import ChallengeEntryScreen from "../app/challenge/[id]/entry/[entryId]";

const mockUseChallengeStore = useChallengeStore as unknown as jest.Mock;
const mockGetActiveUserId = getActiveUserId as jest.Mock;

const CHALLENGE = {
  id: "challenge-1",
  channelId: "channel-1",
  word: "Lighthouse",
  drawSeconds: 120,
};

const ENTRIES = [
  {
    id: "entry-me",
    userId: "user-me",
    authorName: "Me",
    averageStars: 3,
    ratingCount: 1,
    imageRef: "data:image/png;base64,me",
  },
  {
    id: "entry-other",
    userId: "user-other",
    authorName: "Other",
    averageStars: 5,
    ratingCount: 2,
    imageRef: "data:image/png;base64,other",
  },
];

function baseState(overrides: Record<string, unknown> = {}) {
  return {
    detail: {
      challenge: CHALLENGE,
      state: "revealed",
      participantCount: 2,
      submittedCount: 2,
      iSubmitted: true,
      entries: ENTRIES,
      leaderboard: [],
    },
    loading: false,
    error: null,
    locked: false,
    load: mockLoad,
    rate: mockRate,
    ...overrides,
  };
}

describe("ChallengeEntryScreen (Bug B)", () => {
  beforeEach(() => {
    mockLoad.mockClear();
    mockRate.mockClear();
    mockBack.mockClear();
    mockGetActiveUserId.mockReturnValue("user-me");
    mockEntryId = "entry-me";
  });

  it("disables the star-rating control for the caller's own entry", async () => {
    mockEntryId = "entry-me";
    mockUseChallengeStore.mockReturnValue(baseState());
    await render(<ChallengeEntryScreen />);
    const control = screen.getByTestId("rate-entry-entry-me");
    expect(control.props.accessibilityState?.disabled).toBe(true);
  });

  it("enables the star-rating control for another participant's entry", async () => {
    mockEntryId = "entry-other";
    mockUseChallengeStore.mockReturnValue(baseState());
    await render(<ChallengeEntryScreen />);
    const control = screen.getByTestId("rate-entry-entry-other");
    expect(control.props.accessibilityState?.disabled ?? false).toBe(false);
  });

  it("renders the drawing full-screen using the entry's imageRef", async () => {
    mockEntryId = "entry-other";
    mockUseChallengeStore.mockReturnValue(baseState());
    await render(<ChallengeEntryScreen />);
    const image = screen.getByTestId("entry-drawing-image");
    expect(image.props.source).toEqual({ uri: "data:image/png;base64,other" });
  });

  it("rates another user's entry when a star is pressed", async () => {
    mockEntryId = "entry-other";
    mockUseChallengeStore.mockReturnValue(baseState());
    await render(<ChallengeEntryScreen />);
    const { fireEvent } = require("@testing-library/react-native");
    fireEvent.press(screen.getByLabelText("Rate 4 stars"));
    expect(mockRate).toHaveBeenCalledWith("challenge-1", "entry-other", 4);
  });
});
