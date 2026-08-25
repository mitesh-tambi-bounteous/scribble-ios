/**
 * T7 test for app/home.tsx: milestone badges (spec 4.5) render from
 * useStatsStore's `badges` field with earned vs locked states distinguishable
 * via testID and accessibilityLabel.
 */

import { render } from "@testing-library/react-native";
import React from "react";

jest.mock("expo-linear-gradient", () => {
  const { View: RNView } = jest.requireActual("react-native");
  return { LinearGradient: RNView };
});

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

jest.mock("@/src/stores/useStatsStore", () => ({
  useStatsStore: jest.fn(),
}));

jest.mock("@/src/stores/useStreakStore", () => ({
  useStreakStore: () => ({ current: 5, load: jest.fn() }),
}));

jest.mock("@/src/stores/useWallsStore", () => ({
  useWallsStore: () => ({ walls: [], load: jest.fn() }),
}));

jest.mock("@/src/stores/usePromptStore", () => ({
  usePromptStore: () => ({ data: null, load: jest.fn() }),
}));

jest.mock("@/src/stores/useThemeStore", () => ({
  useThemeStore: (selector: (state: unknown) => unknown) =>
    selector({ theme: "scribble", setTheme: jest.fn() }),
}));

jest.mock("@/src/stores/useAuthStore", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ currentUser: { displayName: "Alex" } }),
}));

import { useStatsStore } from "@/src/stores/useStatsStore";
import HomeScreen from "../app/home";

const mockUseStatsStore = useStatsStore as unknown as jest.Mock;

describe("HomeScreen milestone badges (spec 4.5)", () => {
  it("renders earned and locked badges from useStatsStore.badges", async () => {
    mockUseStatsStore.mockReturnValue({
      drawingsCount: 27,
      weeklyCompletion: [],
      currentStreak: 5,
      bestStreak: 21,
      badges: [
        { day: 7, earned: true },
        { day: 30, earned: false },
        { day: 100, earned: false },
      ],
      loading: false,
      error: null,
      load: jest.fn(),
    });

    const view = await render(<HomeScreen />);

    const earned = view.getByTestId("milestone-badge-7");
    const lockedThirty = view.getByTestId("milestone-badge-30");
    const lockedHundred = view.getByTestId("milestone-badge-100");

    expect(earned.props.accessibilityLabel).toBe("7-day badge earned");
    expect(lockedThirty.props.accessibilityLabel).toBe("30-day badge locked");
    expect(lockedHundred.props.accessibilityLabel).toBe("100-day badge locked");
  });

  it("renders no milestones section when badges is empty", async () => {
    mockUseStatsStore.mockReturnValue({
      drawingsCount: 27,
      weeklyCompletion: [],
      currentStreak: 5,
      bestStreak: 21,
      badges: [],
      loading: false,
      error: null,
      load: jest.fn(),
    });

    const view = await render(<HomeScreen />);

    expect(view.queryByTestId("milestone-badge-7")).toBeNull();
  });
});
