/**
 * Screen-level auth-redirect test for the Today screen (app/index.tsx).
 *
 * Mocks useAuthStore, usePromptStore, and useStreakStore so each case
 * controls `hydrated` / `currentUser` directly, without touching
 * AsyncStorage or the data client. Confirms:
 *   - not-yet-hydrated shows the auth-check loader and does not redirect.
 *   - hydrated with no current user redirects to /sign-up.
 *   - hydrated with a current user does not redirect (renders Today).
 */

import { render, screen } from "@testing-library/react-native";
import React from "react";

const mockReplace = jest.fn();
const mockLoadPrompt = jest.fn();
const mockLoadStreak = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}));

jest.mock("@/src/stores/useAuthStore", () => ({
  useAuthStore: jest.fn(),
}));
jest.mock("@/src/stores/usePromptStore", () => ({
  usePromptStore: jest.fn(),
}));
jest.mock("@/src/stores/useStreakStore", () => ({
  useStreakStore: jest.fn(),
}));

import { useAuthStore } from "@/src/stores/useAuthStore";
import { usePromptStore } from "@/src/stores/usePromptStore";
import { useStreakStore } from "@/src/stores/useStreakStore";

import TodayScreen from "../app/index";

const mockUseAuthStore = useAuthStore as unknown as jest.Mock;
const mockUsePromptStore = usePromptStore as unknown as jest.Mock;
const mockUseStreakStore = useStreakStore as unknown as jest.Mock;

const ALICE = {
  id: "user-alice",
  email: "alice@scribl.test",
  displayName: "Alice",
  createdAt: "2026-07-01T00:00:00.000Z",
};

function mockAuthState(state: { hydrated: boolean; currentUser: typeof ALICE | null }): void {
  mockUseAuthStore.mockImplementation((selector: (s: typeof state) => unknown) =>
    selector(state),
  );
}

describe("Today screen auth-gate redirect", () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockLoadPrompt.mockClear();
    mockLoadStreak.mockClear();

    mockUsePromptStore.mockReturnValue({
      data: null,
      loading: false,
      error: null,
      load: mockLoadPrompt,
    });
    mockUseStreakStore.mockReturnValue({
      current: 0,
      loading: false,
      error: null,
      load: mockLoadStreak,
    });
  });

  it("shows the auth-check loader and does not redirect while not hydrated", async () => {
    mockAuthState({ hydrated: false, currentUser: null });

    await render(<TodayScreen />);

    expect(screen.getByTestId("auth-check-loading")).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("redirects to /sign-up once hydrated with no current user", async () => {
    mockAuthState({ hydrated: true, currentUser: null });

    await render(<TodayScreen />);

    expect(mockReplace).toHaveBeenCalledWith("/sign-up");
  });

  it("does not redirect once hydrated with a current user", async () => {
    mockAuthState({ hydrated: true, currentUser: ALICE });

    await render(<TodayScreen />);

    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.queryByTestId("auth-check-loading")).toBeNull();
  });
});
