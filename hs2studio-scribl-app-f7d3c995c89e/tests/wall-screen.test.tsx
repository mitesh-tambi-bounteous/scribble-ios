/**
 * S-005 screen test for the Wall screen (app/wall.tsx).
 *
 * Mocks useWallStore entirely so each render case controls
 * { data, loading, error, locked, load, react } directly, without touching
 * the real data client. Confirms the screen renders exactly one of the
 * loading / locked / error / response-list states, and wires reaction
 * button presses + "Try again" through to the store.
 */

import { render, fireEvent, screen } from "@testing-library/react-native";
import React from "react";

jest.mock("@/src/config/features", () => ({ AI_ENABLED: true }));

const mockLoad = jest.fn();
const mockReact = jest.fn();
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn(() => true);

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ channelId: "channel-1", promptId: "prompt-x" }),
  // wall.tsx uses the module-level router (tile push + goBack back affordance).
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    back: () => mockBack(),
    replace: (href: unknown) => mockReplace(href),
    canGoBack: () => mockCanGoBack(),
  },
}));

jest.mock("@/src/stores/useWallStore", () => ({
  useWallStore: jest.fn(),
}));

import { useWallStore } from "@/src/stores/useWallStore";
import WallScreen from "../app/wall";

const mockUseWallStore = useWallStore as unknown as jest.Mock;

describe("WallScreen (S-005)", () => {
  beforeEach(() => {
    mockLoad.mockClear();
    mockReact.mockClear();
    mockPush.mockClear();
    mockBack.mockClear();
    mockReplace.mockClear();
    mockCanGoBack.mockReset();
    mockCanGoBack.mockReturnValue(true);
  });

  it("renders wall-loading and no response list when loading", async () => {
    mockUseWallStore.mockReturnValue({
      data: null,
      loading: true,
      error: null,
      locked: false,
      load: mockLoad,
      react: mockReact,
    });

    await render(<WallScreen />);

    expect(screen.getByTestId("wall-loading")).toBeTruthy();
    expect(screen.queryByTestId("wall-tile")).toBeNull();
  });

  it("renders the locked message and no response testIDs when locked", async () => {
    mockUseWallStore.mockReturnValue({
      data: null,
      loading: false,
      error: "submit your response to unlock this channel",
      locked: true,
      load: mockLoad,
      react: mockReact,
    });

    await render(<WallScreen />);

    expect(screen.getByText("Submit today's drawing to unlock the wall.")).toBeTruthy();
    expect(screen.queryByTestId("wall-tile")).toBeNull();
  });

  it("renders a response with author, text, and reaction buttons; pressing a reaction calls react()", async () => {
    mockUseWallStore.mockReturnValue({
      data: {
        channelId: "channel-1",
        promptId: "prompt-x",
        responses: [
          {
            id: "response-alice-1",
            promptId: "prompt-x",
            channelId: "channel-1",
            authorId: "user-alice",
            authorName: "Alice",
            text: "A very sleepy cat.",
            createdAt: "2026-07-01T09:00:00.000Z",
            reactions: [],
          },
        ],
      },
      loading: false,
      error: null,
      locked: false,
      load: mockLoad,
      react: mockReact,
    });

    await render(<WallScreen />);

    expect(screen.getByTestId("wall-tile")).toBeTruthy();
    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.getByText("A very sleepy cat.")).toBeTruthy();
    // No imageRef -> fallback Doodle rendered, no <Image> testID present.
    expect(screen.queryByTestId("response-image-response-alice-1")).toBeNull();

    await fireEvent.press(screen.getByText("👍 0"));

    expect(mockReact).toHaveBeenCalledWith("channel-1", "prompt-x", "response-alice-1", "👍");
  });

  it("renders a real stored drawing (imageRef) as an Image instead of the Doodle fallback", async () => {
    mockUseWallStore.mockReturnValue({
      data: {
        channelId: "channel-1",
        promptId: "prompt-x",
        responses: [
          {
            id: "response-bob-1",
            promptId: "prompt-x",
            channelId: "channel-1",
            authorId: "user-bob",
            authorName: "Bob",
            imageRef: "data:image/png;base64,AAAA",
            createdAt: "2026-07-01T09:00:00.000Z",
            reactions: [],
          },
        ],
      },
      loading: false,
      error: null,
      locked: false,
      load: mockLoad,
      react: mockReact,
    });

    await render(<WallScreen />);

    expect(screen.getByTestId("response-image-response-bob-1")).toBeTruthy();
  });

  it("renders an enhanced image by default when enhancementStatus is ready, and toggle swaps to original", async () => {
    mockUseWallStore.mockReturnValue({
      data: {
        channelId: "channel-1",
        promptId: "prompt-x",
        responses: [
          {
            id: "response-charlie-1",
            promptId: "prompt-x",
            channelId: "channel-1",
            authorId: "user-charlie",
            authorName: "Charlie",
            imageRef: "data:image/png;base64,ORIGINAL",
            enhancedImageRef: "data:image/png;base64,ENHANCED",
            enhancementStatus: "ready",
            createdAt: "2026-07-01T09:00:00.000Z",
            reactions: [],
          },
        ],
      },
      loading: false,
      error: null,
      locked: false,
      load: mockLoad,
      react: mockReact,
    });

    await render(<WallScreen />);

    // Enhanced image is displayed by default
    expect(screen.getByTestId("enhanced-image")).toBeTruthy();

    // Pressing the toggle shows original
    await fireEvent.press(screen.getByTestId("enhance-toggle"));

    // Now original should be shown (enhanced-image wrapper is gone)
    expect(screen.queryByTestId("enhanced-image")).toBeNull();
  });

  it("does not render toggle when enhancementStatus is pending or absent", async () => {
    mockUseWallStore.mockReturnValue({
      data: {
        channelId: "channel-1",
        promptId: "prompt-x",
        responses: [
          {
            id: "response-diana-1",
            promptId: "prompt-x",
            channelId: "channel-1",
            authorId: "user-diana",
            authorName: "Diana",
            imageRef: "data:image/png;base64,ORIGINAL",
            enhancementStatus: "pending",
            createdAt: "2026-07-01T09:00:00.000Z",
            reactions: [],
          },
        ],
      },
      loading: false,
      error: null,
      locked: false,
      load: mockLoad,
      react: mockReact,
    });

    await render(<WallScreen />);

    expect(screen.queryByTestId("enhance-toggle")).toBeNull();
  });

  it("R1/R2 back affordance pops the stack (router.back) when canGoBack() is true", async () => {
    mockUseWallStore.mockReturnValue({
      data: null,
      loading: false,
      error: null,
      locked: false,
      load: mockLoad,
      react: mockReact,
    });
    mockCanGoBack.mockReturnValue(true);

    const view = await render(<WallScreen />);
    await fireEvent.press(view.getByLabelText("Go back"));

    expect(mockBack).toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("R2 back affordance falls back to /home (replace) when the stack is empty", async () => {
    mockUseWallStore.mockReturnValue({
      data: null,
      loading: false,
      error: null,
      locked: false,
      load: mockLoad,
      react: mockReact,
    });
    mockCanGoBack.mockReturnValue(false);

    const view = await render(<WallScreen />);
    await fireEvent.press(view.getByLabelText("Go back"));

    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith("/home");
  });

  it("renders the error state and re-calls load() when Try again is pressed", async () => {
    mockUseWallStore.mockReturnValue({
      data: null,
      loading: false,
      error: "network error",
      locked: false,
      load: mockLoad,
      react: mockReact,
    });

    await render(<WallScreen />);

    expect(screen.getByText("Could not load the wall.")).toBeTruthy();

    await fireEvent.press(screen.getByText("Try again"));

    expect(mockLoad).toHaveBeenCalledWith("channel-1", "prompt-x");
  });
});
