/**
 * WS4 screen test for app/write.tsx.
 *
 * Confirms the caption screen renders the user's REAL just-submitted
 * drawing (from useDraftStore, stashed by draw.tsx) rather than the static
 * placeholder Doodle, that the caption starts empty (no hardcoded "the one
 * that smells the most edible."), and that the mic button toggles the
 * audioRecorder service's start/stop recording state.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn(() => true);

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: mockReplace }),
  useLocalSearchParams: () => ({ channelId: "channel-public", promptId: "prompt-x" }),
  // Module-level singleton consumed by goBack() (src/lib/nav.ts).
  router: {
    canGoBack: () => mockCanGoBack(),
    back: () => mockBack(),
    replace: (href: unknown) => mockReplace(href),
  },
}));

const mockStartRecording = jest.fn();
const mockStopRecording = jest.fn();

jest.mock("@/src/services/audioRecorder", () => ({
  startRecording: (...args: unknown[]) => mockStartRecording(...args),
  stopRecording: (...args: unknown[]) => mockStopRecording(...args),
}));

jest.mock("@/src/stores/useDraftStore", () => ({
  useDraftStore: jest.fn(),
}));

import { useDraftStore } from "@/src/stores/useDraftStore";
import WriteScreen from "../app/write";

const mockUseDraftStore = useDraftStore as unknown as jest.Mock;

describe("WriteScreen (WS4)", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockBack.mockClear();
    mockReplace.mockClear();
    mockCanGoBack.mockReset();
    mockCanGoBack.mockReturnValue(true);
    mockStartRecording.mockReset();
    mockStopRecording.mockReset();
  });

  it("renders the real drawing from useDraftStore instead of the static placeholder", async () => {
    mockUseDraftStore.mockImplementation((selector: (state: Record<string, unknown>) => unknown) =>
      selector({ imageRef: "data:image/png;base64,AAAA" }),
    );

    const view = await render(<WriteScreen />);

    expect(view.getByTestId("write-drawing-preview")).toBeTruthy();
  });

  it("falls back gracefully (no crash, no real-image testID) when the draft is absent", async () => {
    mockUseDraftStore.mockImplementation((selector: (state: Record<string, unknown>) => unknown) =>
      selector({ imageRef: null }),
    );

    const view = await render(<WriteScreen />);

    expect(view.queryByTestId("write-drawing-preview")).toBeNull();
  });

  it("starts with an empty caption (no hardcoded 'the one that smells the most edible.')", async () => {
    mockUseDraftStore.mockImplementation((selector: (state: Record<string, unknown>) => unknown) =>
      selector({ imageRef: null }),
    );

    const view = await render(<WriteScreen />);

    expect(view.getByTestId("write-caption-input").props.value).toBe("");
  });

  it("mic button toggles recording via the audioRecorder service", async () => {
    mockUseDraftStore.mockImplementation((selector: (state: Record<string, unknown>) => unknown) =>
      selector({ imageRef: null }),
    );
    mockStartRecording.mockResolvedValueOnce(undefined);
    mockStopRecording.mockResolvedValueOnce({ uri: "blob:mock-uri" });

    const view = await render(<WriteScreen />);

    await fireEvent.press(view.getByTestId("write-mic-button"));
    await waitFor(() => expect(mockStartRecording).toHaveBeenCalledTimes(1));

    await fireEvent.press(view.getByTestId("write-mic-button"));
    await waitFor(() => expect(mockStopRecording).toHaveBeenCalledTimes(1));
  });

  it("R6 draft guard: redirects to /draw (replace) when the draft has no imageRef", async () => {
    mockUseDraftStore.mockImplementation((selector: (state: Record<string, unknown>) => unknown) =>
      selector({ imageRef: null }),
    );

    await render(<WriteScreen />);

    expect(mockReplace).toHaveBeenCalledWith("/draw");
  });

  it("does not redirect when an active draft is present", async () => {
    mockUseDraftStore.mockImplementation((selector: (state: Record<string, unknown>) => unknown) =>
      selector({ imageRef: "data:image/png;base64,AAAA" }),
    );

    await render(<WriteScreen />);

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("back affordance pops the stack (router.back) when canGoBack() is true", async () => {
    mockUseDraftStore.mockImplementation((selector: (state: Record<string, unknown>) => unknown) =>
      selector({ imageRef: "data:image/png;base64,AAAA" }),
    );
    mockCanGoBack.mockReturnValue(true);

    const view = await render(<WriteScreen />);
    await fireEvent.press(view.getByLabelText("Go back"));

    expect(mockBack).toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("back affordance falls back to /draw (replace) when the stack is empty", async () => {
    mockUseDraftStore.mockImplementation((selector: (state: Record<string, unknown>) => unknown) =>
      selector({ imageRef: "data:image/png;base64,AAAA" }),
    );
    mockCanGoBack.mockReturnValue(false);

    const view = await render(<WriteScreen />);
    await fireEvent.press(view.getByLabelText("Go back"));

    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith("/draw");
  });

  it("footer copy says the drawing is final but captions stay editable", async () => {
    mockUseDraftStore.mockImplementation((selector: (state: Record<string, unknown>) => unknown) =>
      selector({ imageRef: "data:image/png;base64,AAAA" }),
    );

    const view = await render(<WriteScreen />);

    expect(
      view.getByText("Your drawing is final once it's out there — captions you can still tweak."),
    ).toBeTruthy();
    expect(view.queryByText(/can't edit after this/)).toBeNull();
  });

  it("surfaces a recording error inline instead of crashing", async () => {
    mockUseDraftStore.mockImplementation((selector: (state: Record<string, unknown>) => unknown) =>
      selector({ imageRef: null }),
    );
    mockStartRecording.mockRejectedValueOnce(new Error("mic permission denied"));

    const view = await render(<WriteScreen />);
    await fireEvent.press(view.getByTestId("write-mic-button"));

    await screen.findByText("mic permission denied");
  });
});
