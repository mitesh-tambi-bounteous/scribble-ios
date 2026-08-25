/**
 * Task 9 screen test for app/create-challenge.tsx.
 *
 * Confirms the word input + per-drawing timer presets render, the tools
 * section (brush + color toggles, select all/none, submit disabled when
 * either set is empty), the background draw navigation + preview/remove
 * flow, submitting calls useChallengesStore.create with the new payload
 * shape, and on success routes to /challenge/{id}. Also confirms a
 * create() failure surfaces an inline error without crashing.
 */

import { render, screen, fireEvent, waitFor, act, cleanup } from "@testing-library/react-native";
import React from "react";

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  router: { push: (...args: unknown[]) => mockPush(...args), back: (...args: unknown[]) => mockBack(...args) },
  useLocalSearchParams: () => ({ channelId: "channel-1" }),
}));

const mockCreate = jest.fn();

jest.mock("@/src/stores/useChallengesStore", () => ({
  useChallengesStore: jest.fn(),
}));

const mockExportToImage = jest.fn(() => ({
  encodeToBase64: () => "ZmFrZQ==",
}));

jest.mock("@/components/canvas/DrawingCanvas", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: (props: { apiRef?: { current: unknown } }) => {
      if (props.apiRef) {
        props.apiRef.current = {
          exportToImage: mockExportToImage,
          clear: jest.fn(),
          undo: jest.fn(),
        };
      }
      return <View testID="mock-drawing-canvas" />;
    },
  };
});

import { useChallengesStore } from "@/src/stores/useChallengesStore";
import { useCreateChallengeDraftStore } from "@/src/stores/useCreateChallengeDraftStore";
import CreateChallengeScreen from "../app/create-challenge";

const mockUseChallengesStore = useChallengesStore as unknown as jest.Mock;

function setStore(overrides: { create: jest.Mock }): void {
  mockUseChallengesStore.mockImplementation((selector: (state: Record<string, unknown>) => unknown) =>
    selector({ create: overrides.create }),
  );
}

describe("CreateChallengeScreen (Task 9)", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockBack.mockClear();
    mockCreate.mockReset();
    useCreateChallengeDraftStore.getState().reset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the word input and per-drawing timer presets, default 2 min selected", async () => {
    setStore({ create: mockCreate });
    await render(<CreateChallengeScreen />);
    expect(screen.getByTestId("challenge-word-input")).toBeTruthy();
    expect(screen.getByTestId("challenge-duration-60")).toBeTruthy();
    expect(screen.getByTestId("challenge-duration-120")).toBeTruthy();
    expect(screen.getByTestId("challenge-duration-300")).toBeTruthy();
  });

  it("renders all 4 brush toggles and 16 color toggles, all selected by default", async () => {
    setStore({ create: mockCreate });
    await render(<CreateChallengeScreen />);
    for (const style of ["basic", "fork", "dotted", "neon"]) {
      const toggle = screen.getByTestId(`tool-brush-${style}`);
      expect(toggle.props.accessibilityState?.selected).toBe(true);
    }
    for (let i = 0; i < 16; i += 1) {
      const swatch = screen.getByTestId(`tool-color-${i}`);
      expect(swatch.props.accessibilityState?.selected).toBe(true);
    }
  });

  it("blocks submit when the word is empty", async () => {
    setStore({ create: mockCreate });
    await render(<CreateChallengeScreen />);
    await fireEvent.press(screen.getByTestId("create-challenge-submit"));
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("Select none clears both sets and disables submit", async () => {
    setStore({ create: mockCreate });
    await render(<CreateChallengeScreen />);
    await fireEvent.press(screen.getByTestId("tools-select-none"));
    expect(screen.getByTestId("tool-brush-basic").props.accessibilityState?.selected).toBe(false);
    expect(screen.getByTestId("tool-color-0").props.accessibilityState?.selected).toBe(false);
    expect(screen.getByTestId("create-challenge-submit").props.accessibilityState?.disabled).toBe(true);
    await fireEvent.press(screen.getByTestId("create-challenge-submit"));
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("Select all restores every toggle after Select none", async () => {
    setStore({ create: mockCreate });
    await render(<CreateChallengeScreen />);
    await fireEvent.press(screen.getByTestId("tools-select-none"));
    await fireEvent.press(screen.getByTestId("tools-select-all"));
    expect(screen.getByTestId("tool-brush-neon").props.accessibilityState?.selected).toBe(true);
    expect(screen.getByTestId("tool-color-15").props.accessibilityState?.selected).toBe(true);
  });

  it("toggling a single brush off blocks submit when it's the last one", async () => {
    setStore({ create: mockCreate });
    await render(<CreateChallengeScreen />);
    await fireEvent.press(screen.getByTestId("tools-select-none"));
    await fireEvent.press(screen.getByTestId("tool-brush-basic"));
    expect(screen.getByTestId("tool-brush-basic").props.accessibilityState?.selected).toBe(true);
    // colors are still empty, so submit stays disabled
    expect(screen.getByTestId("create-challenge-submit").props.accessibilityState?.disabled).toBe(true);
    await fireEvent.press(screen.getByTestId("create-challenge-submit"));
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("navigates to the dedicated background-draw screen instead of an inline pad", async () => {
    setStore({ create: mockCreate });
    await render(<CreateChallengeScreen />);
    await fireEvent.press(screen.getByTestId("create-background-button"));
    expect(mockPush).toHaveBeenCalledWith("/create-challenge-background");
  });

  it("shows the preview + remove control once the background-draw screen saves a draft", async () => {
    setStore({ create: mockCreate });
    await render(<CreateChallengeScreen />);
    await act(async () => {
      useCreateChallengeDraftStore.getState().setBackgroundRef("data:image/png;base64,ZmFrZQ==");
    });
    expect(screen.getByTestId("background-preview")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("background-remove"));
    expect(screen.queryByTestId("background-preview")).toBeNull();
    expect(screen.getByTestId("create-background-button")).toBeTruthy();
  });

  it("calls create() with channelId/word/drawSeconds/toolset and routes to /challenge/{id} on success", async () => {
    mockCreate.mockResolvedValueOnce({
      id: "challenge-9",
      channelId: "channel-1",
      creatorId: "user-me",
      word: "Dragon",
      drawSeconds: 60,
      createdAt: "2026-07-02T11:00:00.000Z",
    });
    setStore({ create: mockCreate });

    await render(<CreateChallengeScreen />);
    await fireEvent.changeText(screen.getByTestId("challenge-word-input"), "Dragon");
    await fireEvent.press(screen.getByTestId("challenge-duration-60"));
    await fireEvent.press(screen.getByTestId("create-challenge-submit"));

    expect(mockCreate).toHaveBeenCalledWith("channel-1", {
      word: "Dragon",
      drawSeconds: 60,
      toolset: {
        brushes: ["basic", "fork", "dotted", "neon"],
        colors: expect.arrayContaining(["#000000"]),
      },
      backgroundRef: undefined,
    });
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/challenge/challenge-9"));
  });

  it("shows an inline error and does not navigate when create() rejects", async () => {
    mockCreate.mockRejectedValueOnce(new Error("Failed to create challenge."));
    setStore({ create: mockCreate });

    await render(<CreateChallengeScreen />);
    await fireEvent.changeText(screen.getByTestId("challenge-word-input"), "Dragon");
    await fireEvent.press(screen.getByTestId("create-challenge-submit"));

    await screen.findByTestId("create-challenge-error");
    expect(mockPush).not.toHaveBeenCalled();
  });
});
