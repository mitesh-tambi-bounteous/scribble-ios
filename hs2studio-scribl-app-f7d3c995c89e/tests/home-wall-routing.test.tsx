/**
 * HomeScreen wall-press routing (Batch 2 challenge walls). A wall's `kind`
 * decides where a tap routes: "challenge" -> /challenge-wall,
 * "group" -> /family. No client-side unlock logic; this only asserts
 * navigation target selection.
 */

import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";

const mockPush = jest.fn();

jest.mock("expo-linear-gradient", () => {
  const { View: RNView } = jest.requireActual("react-native");
  return { LinearGradient: RNView };
});

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));

jest.mock("@/src/stores/useStatsStore", () => ({
  useStatsStore: () => ({
    drawingsCount: 0,
    weeklyCompletion: [],
    bestStreak: 0,
    badges: [],
    loading: false,
    error: null,
    load: jest.fn(),
  }),
}));

jest.mock("@/src/stores/useStreakStore", () => ({
  useStreakStore: () => ({ current: 0, load: jest.fn() }),
}));

jest.mock("@/src/stores/usePromptStore", () => ({
  usePromptStore: () => ({ data: { prompt: { id: "prompt-x" } }, load: jest.fn() }),
}));

jest.mock("@/src/stores/useThemeStore", () => ({
  useThemeStore: (selector: (state: unknown) => unknown) =>
    selector({ theme: "scribble", setTheme: jest.fn() }),
}));

jest.mock("@/src/stores/useAuthStore", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ currentUser: { displayName: "Alex" } }),
}));

jest.mock("@/src/stores/useWallsStore", () => ({
  useWallsStore: () => ({
    walls: [
      { id: "wall-group-1", name: "The Smiths", kind: "group" },
      { id: "wall-challenge-1", name: "Dragon Duel", kind: "challenge" },
    ],
    load: jest.fn(),
  }),
}));

import HomeScreen from "../app/home";

describe("HomeScreen wall-press routing (kind-based)", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("a group wall routes to /family with channelId + promptId", async () => {
    await render(<HomeScreen />);
    fireEvent.press(screen.getByTestId("wall-card-wall-group-1"));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/family",
      params: { channelId: "wall-group-1", promptId: "prompt-x" },
    });
  });

  it("a challenge wall routes to /challenge-wall with channelId, never /family", async () => {
    await render(<HomeScreen />);
    fireEvent.press(screen.getByTestId("wall-card-wall-challenge-1"));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/challenge-wall",
      params: { channelId: "wall-challenge-1" },
    });
    const pushedToFamily = mockPush.mock.calls.some(
      (call) => typeof call[0] === "object" && call[0]?.pathname === "/family",
    );
    expect(pushedToFamily).toBe(false);
  });
});
