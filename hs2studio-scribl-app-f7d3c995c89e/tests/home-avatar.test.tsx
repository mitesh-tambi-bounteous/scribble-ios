/**
 * W2e avatar test (app/home.tsx). Confirms the home screen header avatar
 * uses the shared Avatar component instead of ad-hoc View/LinearGradient branches.
 * Tests both avatarColor-set (solid color) and fallback (gradient) cases.
 */

import { render } from "@testing-library/react-native";
import React from "react";

const mockPush = jest.fn();
let mockAvatarColor: string | undefined = "#FF5A5F";

jest.mock("expo-linear-gradient", () => {
  const { View: RNView } = jest.requireActual("react-native");
  return { LinearGradient: RNView };
});

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));

jest.mock("@/src/stores/useStatsStore", () => ({
  useStatsStore: () => ({
    drawingsCount: 5,
    weeklyCompletion: [
      { date: "2026-06-27", done: false },
      { date: "2026-06-28", done: false },
      { date: "2026-06-29", done: false },
      { date: "2026-06-30", done: false },
      { date: "2026-07-01", done: false },
      { date: "2026-07-02", done: false },
      { date: "2026-07-03", done: false },
    ],
    currentStreak: 0,
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
    selector({
      currentUser: { displayName: "Alice", avatarColor: mockAvatarColor },
    }),
}));

import HomeScreen from "../app/home";

describe("HomeScreen avatar (W2e)", () => {
  it("renders the shared Avatar component with avatarColor when set", async () => {
    mockAvatarColor = "#FF5A5F";
    const view = await render(<HomeScreen />);

    // Avatar should be rendered with testID
    const avatar = view.getByTestId("home-avatar");
    expect(avatar).toBeTruthy();

    // The avatar should have the backgroundColor style from avatarColor
    expect(avatar).toHaveStyle({ backgroundColor: "#FF5A5F" });
  });

  it("renders the shared Avatar component with gradient fallback when avatarColor is not set", async () => {
    mockAvatarColor = undefined;
    const view = await render(<HomeScreen />);

    // Avatar should still be rendered with testID (not a raw LinearGradient)
    const avatar = view.getByTestId("home-avatar");
    expect(avatar).toBeTruthy();

    // Avatar should not have a solid backgroundColor when color prop is undefined
    // (it will use the gradient fallback internally)
    expect(avatar).toHaveStyle({ backgroundColor: undefined });
  });
});
