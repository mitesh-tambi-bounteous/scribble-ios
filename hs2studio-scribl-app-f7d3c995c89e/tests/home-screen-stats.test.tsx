/**
 * WS4b-1 home-screen test (app/home.tsx). Confirms the drawings-count,
 * best-streak, and week-strip stats render from useStatsStore rather than
 * the old static POC numbers (143 drawings / "best is 14" / static week).
 */

import { render } from "@testing-library/react-native";
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
    drawingsCount: 27,
    weeklyCompletion: [
      { date: "2026-06-27", done: true },
      { date: "2026-06-28", done: true },
      { date: "2026-06-29", done: false },
      { date: "2026-06-30", done: true },
      { date: "2026-07-01", done: true },
      { date: "2026-07-02", done: false },
      { date: "2026-07-03", done: true },
    ],
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
  }),
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

import HomeScreen from "../app/home";

describe("HomeScreen stats wiring (WS4b-1)", () => {
  it("renders drawingsCount and bestStreak from useStatsStore, not static numbers", async () => {
    const view = await render(<HomeScreen />);

    expect(view.getByTestId("home-drawings-count")).toHaveTextContent("27");
    expect(view.getByTestId("home-best-streak")).toHaveTextContent("21");
    expect(view.queryByText("143")).toBeNull();
  });

  it("renders the week strip from weeklyCompletion with an honest count", async () => {
    const view = await render(<HomeScreen />);

    expect(view.getByTestId("home-week-strip")).toHaveTextContent("5 of 7 drawn");
  });
});
