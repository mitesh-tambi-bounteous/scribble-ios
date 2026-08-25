/**
 * app/splash.tsx (S-009): minimal brand-only landing screen. No greeting,
 * prompt, countdown, participant count, streak badge, or loading state.
 * Verifies the brand mark renders, and that both the "Let's start drawing"
 * CTA and the BottomNav Draw FAB replace to "/".
 */

import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}));

jest.mock("expo-linear-gradient", () => {
  const { View } = require("react-native");
  return { LinearGradient: View };
});

import SplashScreen from "../app/splash";

describe("SplashScreen (S-009 brand-only)", () => {
  beforeEach(() => {
    mockReplace.mockReset();
  });

  it("renders the brand mark", async () => {
    const view = await render(<SplashScreen />);

    expect(view.getByTestId("splash-brand")).toBeTruthy();
  });

  it("replaces to / when the 'Let's start drawing' CTA is pressed", async () => {
    const view = await render(<SplashScreen />);

    fireEvent.press(view.getByTestId("splash-start"));

    expect(mockReplace).toHaveBeenCalledWith("/");
  });

  it("replaces to / when the Draw nav button is pressed", async () => {
    const view = await render(<SplashScreen />);

    fireEvent.press(view.getByTestId("nav-draw"));

    expect(mockReplace).toHaveBeenCalledWith("/");
  });
});
