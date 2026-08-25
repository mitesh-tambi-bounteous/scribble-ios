/**
 * WS4 repro test for app/home.tsx: prior behavior rendered 0/blank stats
 * silently on a store failure (no loading/error branch at all). Confirms
 * the screen now shows an explicit loading spinner and a "Try again" error
 * state instead of silently rendering zeros, and that a logout control
 * calls useAuthStore.logout() and routes to /sign-up.
 */

import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-linear-gradient", () => {
  const { View: RNView } = jest.requireActual("react-native");
  return { LinearGradient: RNView };
});

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

jest.mock("@/src/stores/useThemeStore", () => ({
  useThemeStore: (selector: (state: unknown) => unknown) =>
    selector({ theme: "scribble", setTheme: jest.fn() }),
}));

const mockLogout = jest.fn();

jest.mock("@/src/stores/useAuthStore", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ currentUser: { displayName: "Alex" }, logout: mockLogout }),
}));

const mockLoadStats = jest.fn();
const mockLoadStreak = jest.fn();
const mockLoadWalls = jest.fn();
const mockLoadPrompt = jest.fn();

jest.mock("@/src/stores/useStatsStore", () => ({
  useStatsStore: jest.fn(),
}));
jest.mock("@/src/stores/useStreakStore", () => ({
  useStreakStore: jest.fn(),
}));
jest.mock("@/src/stores/useWallsStore", () => ({
  useWallsStore: jest.fn(),
}));
jest.mock("@/src/stores/usePromptStore", () => ({
  usePromptStore: jest.fn(),
}));

import { useStatsStore } from "@/src/stores/useStatsStore";
import { useStreakStore } from "@/src/stores/useStreakStore";
import { useWallsStore } from "@/src/stores/useWallsStore";
import { usePromptStore } from "@/src/stores/usePromptStore";
import HomeScreen from "../app/home";

const mockUseStatsStore = useStatsStore as unknown as jest.Mock;
const mockUseStreakStore = useStreakStore as unknown as jest.Mock;
const mockUseWallsStore = useWallsStore as unknown as jest.Mock;
const mockUsePromptStore = usePromptStore as unknown as jest.Mock;

function setStores(overrides: { loading?: boolean; error?: string | null }): void {
  const { loading = false, error = null } = overrides;
  mockUseStatsStore.mockReturnValue({
    drawingsCount: 0,
    weeklyCompletion: [],
    currentStreak: 0,
    bestStreak: 0,
    loading,
    error,
    load: mockLoadStats,
  });
  mockUseStreakStore.mockReturnValue({ current: 0, loading: false, error: null, load: mockLoadStreak });
  mockUseWallsStore.mockReturnValue({ walls: [], loading: false, error: null, load: mockLoadWalls });
  mockUsePromptStore.mockReturnValue({ data: null, loading: false, error: null, load: mockLoadPrompt });
}

describe("HomeScreen error/loading states (WS4)", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
    mockLogout.mockReset();
    mockLoadStats.mockReset();
    mockLoadStreak.mockReset();
    mockLoadWalls.mockReset();
    mockLoadPrompt.mockReset();
  });

  it("shows a loading spinner (not blank zeros) while any store is loading", async () => {
    setStores({ loading: true });

    const view = await render(<HomeScreen />);

    expect(view.getByTestId("home-loading")).toBeTruthy();
    expect(view.queryByTestId("home-drawings-count")).toBeNull();
  });

  it("shows an explicit error with a Try again button that reloads, instead of silent zeros", async () => {
    setStores({ error: "Failed to load stats." });

    const view = await render(<HomeScreen />);

    expect(view.getByText("Could not load your home screen.")).toBeTruthy();
    fireEvent.press(view.getByTestId("home-retry"));

    expect(mockLoadStats).toHaveBeenCalled();
  });

  it("renders real content (not the error branch) when only the streak store errors (devx repro)", async () => {
    mockUseStatsStore.mockReturnValue({
      drawingsCount: 2,
      weeklyCompletion: [],
      currentStreak: 0,
      bestStreak: 5,
      loading: false,
      error: null,
      load: mockLoadStats,
    });
    mockUseStreakStore.mockReturnValue({
      current: 0,
      loading: false,
      error: "Failed to load streak.",
      load: mockLoadStreak,
    });
    mockUseWallsStore.mockReturnValue({ walls: [], loading: false, error: null, load: mockLoadWalls });
    mockUsePromptStore.mockReturnValue({ data: null, loading: false, error: null, load: mockLoadPrompt });

    const view = await render(<HomeScreen />);

    expect(view.queryByText("Could not load your home screen.")).toBeNull();
    expect(view.getByTestId("home-drawings-count")).toBeTruthy();
  });

  it("logout button calls useAuthStore.logout() and routes to /sign-up", async () => {
    setStores({});
    mockLogout.mockResolvedValueOnce(undefined);

    const view = await render(<HomeScreen />);
    fireEvent.press(view.getByTestId("logout-button"));

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockLogout).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith("/sign-up");
  });
});
