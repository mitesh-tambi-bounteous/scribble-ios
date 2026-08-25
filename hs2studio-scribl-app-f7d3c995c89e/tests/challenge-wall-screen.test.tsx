/**
 * Screen test for app/challenge-wall.tsx.
 *
 * The Challenges section (word + state chip + submitted/participant count,
 * and the "New challenge" button) moved here from app/family.tsx (Batch 2:
 * challenge-kind walls route to /challenge-wall, group-kind walls stay on
 * /family). This suite replaces tests/family-challenges-section.test.tsx.
 */

import { render, screen, fireEvent } from "@testing-library/react-native";
import React from "react";

const mockPush = jest.fn();
const mockGoBack = jest.fn();

jest.mock("expo-router", () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
  useLocalSearchParams: () => ({ channelId: "channel-1" }),
}));

jest.mock("@/src/lib/nav", () => ({
  goBack: (...args: unknown[]) => mockGoBack(...args),
}));

jest.mock("@/src/stores/useWallsStore", () => ({
  useWallsStore: jest.fn(),
}));

jest.mock("@/src/stores/useChallengesStore", () => ({
  useChallengesStore: jest.fn(),
}));

import { useWallsStore } from "@/src/stores/useWallsStore";
import { useChallengesStore } from "@/src/stores/useChallengesStore";
import ChallengeWallScreen from "../app/challenge-wall";

const mockUseWallsStore = useWallsStore as unknown as jest.Mock;
const mockUseChallengesStore = useChallengesStore as unknown as jest.Mock;

describe("ChallengeWallScreen — challenges list (moved off app/family.tsx)", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockGoBack.mockClear();
    mockUseWallsStore.mockReturnValue({
      walls: [{ id: "channel-1", name: "The Smiths", kind: "challenge" }],
      load: jest.fn(),
    });
    mockUseChallengesStore.mockReturnValue({
      challenges: [
        {
          challenge: {
            id: "challenge-1",
            channelId: "channel-1",
            creatorId: "user-me",
            word: "Dragon",
            deadlineAt: "2026-07-02T12:00:00.000Z",
            createdAt: "2026-07-02T11:00:00.000Z",
          },
          state: "open",
          participantCount: 3,
          submittedCount: 1,
          iSubmitted: true,
        },
      ],
      loading: false,
      error: null,
      load: jest.fn(),
      create: jest.fn(),
    });
  });

  it("renders a challenge row with the word and state chip from the store", async () => {
    await render(<ChallengeWallScreen />);
    expect(screen.getByText("Dragon")).toBeTruthy();
    expect(screen.getByText("open")).toBeTruthy();
    expect(screen.getByText("1/3")).toBeTruthy();
  });

  it("routes to /create-challenge with channelId when New challenge is pressed", async () => {
    await render(<ChallengeWallScreen />);
    fireEvent.press(screen.getByTestId("new-challenge-button"));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/create-challenge",
      params: { channelId: "channel-1" },
    });
  });

  it("tapping a challenge row routes to /challenge/[id]", async () => {
    await render(<ChallengeWallScreen />);
    fireEvent.press(screen.getByTestId("challenge-row"));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/challenge/[id]",
      params: { id: "challenge-1" },
    });
  });
});
