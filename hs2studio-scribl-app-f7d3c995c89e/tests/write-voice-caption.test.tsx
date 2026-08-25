/**
 * T5/T6 test — voice→text (Bug #1). On stop-recording, write.tsx calls the
 * transcriber service; an EMPTY caption is filled with the transcript, but
 * a caption the user already typed is preserved (typed wins).
 */

import { cleanup, fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: mockReplace }),
  // Module-level singleton consumed by goBack() (src/lib/nav.ts).
  router: {
    canGoBack: () => true,
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

const mockTranscribe = jest.fn();
jest.mock("@/src/services/transcriber", () => ({
  transcribe: (...args: unknown[]) => mockTranscribe(...args),
}));

const mockSetCaption = jest.fn();
jest.mock("@/src/stores/useDraftStore", () => ({
  useDraftStore: Object.assign(
    (selector: (state: Record<string, unknown>) => unknown) => selector({ imageRef: null }),
    { getState: () => ({ setCaption: mockSetCaption }) },
  ),
}));

import WriteScreen from "../app/write";

describe("WriteScreen voice -> caption (Bug #1 fix)", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockBack.mockClear();
    mockReplace.mockClear();
    mockStartRecording.mockReset();
    mockStopRecording.mockReset();
    mockTranscribe.mockReset();
    mockSetCaption.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("submit stashes the caption into the draft store and navigates to /choose-channels", async () => {
    const view = await render(<WriteScreen />);

    fireEvent.changeText(view.getByTestId("write-caption-input"), "hello world");
    await waitFor(() =>
      expect(view.getByTestId("write-caption-input").props.value).toBe("hello world"),
    );
    fireEvent.press(view.getByTestId("write-submit-button"));

    expect(mockSetCaption).toHaveBeenCalledWith("hello world");
    expect(mockPush).toHaveBeenCalledWith("/choose-channels");
  });

  it("BF-4: clear button empties the caption", async () => {
    const view = await render(<WriteScreen />);

    fireEvent.changeText(view.getByTestId("write-caption-input"), "hello world");
    await waitFor(() =>
      expect(view.getByTestId("write-caption-input").props.value).toBe("hello world"),
    );

    fireEvent.press(view.getByTestId("write-caption-clear"));
    await waitFor(() => expect(view.getByTestId("write-caption-input").props.value).toBe(""));
  });

  it("BF-4: a second (re-)recording overwrites the first transcript instead of being dropped", async () => {
    mockStartRecording.mockResolvedValue(undefined);
    mockStopRecording
      .mockResolvedValueOnce({ uri: "blob:mock-uri-1" })
      .mockResolvedValueOnce({ uri: "blob:mock-uri-2" });
    mockTranscribe
      .mockResolvedValueOnce({ transcript: "first take" })
      .mockResolvedValueOnce({ transcript: "second take" });

    const view = await render(<WriteScreen />);

    await fireEvent.press(view.getByTestId("write-mic-button"));
    await waitFor(() => expect(mockStartRecording).toHaveBeenCalledTimes(1));
    await fireEvent.press(view.getByTestId("write-mic-button"));
    await waitFor(() =>
      expect(view.getByTestId("write-caption-input").props.value).toBe("first take"),
    );

    await fireEvent.press(view.getByTestId("write-mic-button"));
    await waitFor(() => expect(mockStartRecording).toHaveBeenCalledTimes(2));
    await fireEvent.press(view.getByTestId("write-mic-button"));
    await waitFor(() =>
      expect(view.getByTestId("write-caption-input").props.value).toBe("second take"),
    );
  });

  it("fills an empty caption with the transcript after recording stops", async () => {
    mockStartRecording.mockResolvedValueOnce(undefined);
    mockStopRecording.mockResolvedValueOnce({ uri: "blob:mock-uri" });
    mockTranscribe.mockResolvedValueOnce({ transcript: "a sleepy cat" });

    const view = await render(<WriteScreen />);

    await fireEvent.press(view.getByTestId("write-mic-button"));
    await waitFor(() => expect(mockStartRecording).toHaveBeenCalledTimes(1));

    await fireEvent.press(view.getByTestId("write-mic-button"));
    await waitFor(() => expect(mockTranscribe).toHaveBeenCalledWith("blob:mock-uri"));

    await waitFor(() =>
      expect(view.getByTestId("write-caption-input").props.value).toBe("a sleepy cat"),
    );
  });

  it("preserves a pre-typed caption instead of overwriting it with the transcript", async () => {
    mockStartRecording.mockResolvedValueOnce(undefined);
    mockStopRecording.mockResolvedValueOnce({ uri: "blob:mock-uri" });
    mockTranscribe.mockResolvedValueOnce({ transcript: "a sleepy cat" });

    const view = await render(<WriteScreen />);

    fireEvent.changeText(view.getByTestId("write-caption-input"), "my own caption");

    await fireEvent.press(view.getByTestId("write-mic-button"));
    await waitFor(() => expect(mockStartRecording).toHaveBeenCalledTimes(1));

    await fireEvent.press(view.getByTestId("write-mic-button"));
    await waitFor(() => expect(mockTranscribe).toHaveBeenCalledWith("blob:mock-uri"));
    // Let the resolved transcribe() promise's state update settle before the
    // test ends, so it doesn't bleed into the next test's render.
    await waitFor(() =>
      expect(view.getByTestId("write-caption-input").props.value).toBe("my own caption"),
    );
  });
});
