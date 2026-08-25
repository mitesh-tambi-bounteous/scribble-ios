/**
 * S-018 screen test for the Share screen (app/share.tsx).
 *
 * Mocks expo-router params and the native/web Share surfaces to confirm the
 * screen dispatches to the right platform API and that Done still navigates
 * home unchanged.
 */

import { render, fireEvent, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Platform, Share } from "react-native";

jest.mock("@/src/config/features", () => ({ AI_ENABLED: true }));

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({
    id: "response-alice-1",
    authorName: "Alice",
    text: "A very sleepy cat.",
    createdAt: "2026-07-02T12:00:00.000Z",
  }),
}));

jest.mock("@/src/stores/usePromptStore", () => ({
  usePromptStore: () => ({
    data: { prompt: { id: "prompt-x", text: "Draw a sleepy cat", date: "2026-07-01", createdAt: "" } },
    load: jest.fn(),
  }),
}));

import ShareScreen from "../app/share";

describe("ShareScreen (S-018)", () => {
  beforeEach(() => {
    mockPush.mockClear();
    jest.restoreAllMocks();
  });

  it("calls Share.share on native platforms", async () => {
    Platform.OS = "ios";
    const shareSpy = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" });

    await render(<ShareScreen />);
    await fireEvent.press(screen.getByText("Share"));

    await waitFor(() => {
      expect(shareSpy).toHaveBeenCalledWith({
        message: "Alice's response: A very sleepy cat.",
        url: "https://scribl.app/response/response-alice-1",
      });
    });
  });

  it("calls navigator.share on web when available", async () => {
    Platform.OS = "web";
    const navigatorShare = jest.fn().mockResolvedValue(undefined);
    (globalThis as unknown as { navigator: unknown }).navigator = {
      share: navigatorShare,
      clipboard: { writeText: jest.fn() },
    };

    await render(<ShareScreen />);
    await fireEvent.press(screen.getByText("Share"));

    await waitFor(() => {
      expect(navigatorShare).toHaveBeenCalledWith({
        title: "Scribl response",
        text: "Alice's response: A very sleepy cat.",
        url: "https://scribl.app/response/response-alice-1",
      });
    });
  });

  it("falls back to clipboard copy on web when navigator.share is unavailable", async () => {
    Platform.OS = "web";
    const writeText = jest.fn().mockResolvedValue(undefined);
    (globalThis as unknown as { navigator: unknown }).navigator = {
      clipboard: { writeText },
    };

    await render(<ShareScreen />);
    await fireEvent.press(screen.getByText("Share"));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("https://scribl.app/response/response-alice-1");
    });
    expect(screen.getByText("Link copied")).toBeTruthy();
  });

  it("navigates home when Done is pressed", async () => {
    Platform.OS = "ios";

    await render(<ShareScreen />);
    await fireEvent.press(screen.getByText("Done"));

    expect(mockPush).toHaveBeenCalledWith("/home");
  });

  it("renders the real response createdAt as a short month + day badge, not the hardcoded APR 22 (WS4)", async () => {
    Platform.OS = "ios";

    await render(<ShareScreen />);

    expect(screen.getByText("JUL 2")).toBeTruthy();
    expect(screen.queryByText("APR 22")).toBeNull();
  });

  it("renders an enhanced image by default when enhancementStatus is ready, and toggle swaps to original", async () => {
    const mockRouter = { push: jest.fn(), back: jest.fn() };
    jest.spyOn(require("expo-router"), "useRouter").mockReturnValue(mockRouter);
    jest.spyOn(require("expo-router"), "useLocalSearchParams").mockReturnValue({
      id: "response-alice-1",
      authorName: "Alice",
      text: "A very sleepy cat.",
      createdAt: "2026-07-02T12:00:00.000Z",
      imageRef: "data:image/png;base64,ORIGINAL",
      enhancedImageRef: "data:image/png;base64,ENHANCED",
      enhancementStatus: "ready",
    });

    Platform.OS = "ios";
    await render(<ShareScreen />);

    // Enhanced image is displayed by default
    expect(screen.getByTestId("enhanced-image")).toBeTruthy();

    // Pressing the toggle shows original
    await fireEvent.press(screen.getByTestId("enhance-toggle"));

    // Now original should be shown (enhanced-image wrapper is gone)
    expect(screen.queryByTestId("enhanced-image")).toBeNull();
  });

  it("does not render toggle when enhancementStatus is pending or absent", async () => {
    const mockRouter = { push: jest.fn(), back: jest.fn() };
    jest.spyOn(require("expo-router"), "useRouter").mockReturnValue(mockRouter);
    jest.spyOn(require("expo-router"), "useLocalSearchParams").mockReturnValue({
      id: "response-alice-1",
      authorName: "Alice",
      text: "A very sleepy cat.",
      createdAt: "2026-07-02T12:00:00.000Z",
      imageRef: "data:image/png;base64,ORIGINAL",
      enhancementStatus: "pending",
    });

    Platform.OS = "ios";
    await render(<ShareScreen />);

    expect(screen.queryByTestId("enhance-toggle")).toBeNull();
  });

  it("normalizes empty string params to undefined (no enhanced ref or status)", async () => {
    const mockRouter = { push: jest.fn(), back: jest.fn() };
    jest.spyOn(require("expo-router"), "useRouter").mockReturnValue(mockRouter);
    jest.spyOn(require("expo-router"), "useLocalSearchParams").mockReturnValue({
      id: "response-alice-1",
      authorName: "Alice",
      text: "A very sleepy cat.",
      createdAt: "2026-07-02T12:00:00.000Z",
      imageRef: "data:image/png;base64,ORIGINAL",
      enhancedImageRef: "",
      enhancementStatus: "",
    });

    Platform.OS = "ios";
    await render(<ShareScreen />);

    // No toggle should render (enhancement params are empty/undefined)
    expect(screen.queryByTestId("enhance-toggle")).toBeNull();
  });
});
