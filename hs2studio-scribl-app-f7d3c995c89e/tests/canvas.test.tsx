/**
 * S-002/S-005/S-006 canvas-slice screen tests (AC3): Today -> Draw
 * navigation, the Today streak badge, and the draw-canvas export/preview
 * flow. DrawScreen no longer submits or records a streak — "Done" only
 * exports the drawing, stashes it into useDraftStore, and navigates to
 * app/write.tsx. The real submit-to-unlock call (AC2/AC7) and the
 * streak<->submit wiring now live in app/choose-channels.tsx, after caption
 * entry and channel selection. Skia/CanvasKit cannot render in node, so the
 * drawing surface (DrawingCanvas) is mocked here — these tests exercise the
 * screens' wiring, not the real Skia rasterizer.
 */

import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockLoad = jest.fn();
const mockLoadStreak = jest.fn();
const mockRecordSubmission = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

jest.mock("@/src/stores/usePromptStore", () => ({
  usePromptStore: jest.fn(),
}));

jest.mock("@/src/data", () => ({
  dataClient: { submit: jest.fn() },
}));

jest.mock("@/src/stores/useStreakStore", () => ({
  useStreakStore: jest.fn(),
}));

jest.mock("@/src/stores/useOnboardingStore", () => ({
  useOnboardingStore: jest.fn(),
}));

const mockSetDraft = jest.fn();

jest.mock("@/src/stores/useDraftStore", () => ({
  useDraftStore: { getState: () => ({ setDraft: mockSetDraft }) },
}));

const AUTHED_USER = {
  id: "user-demo",
  email: "demo@scribl.test",
  displayName: "Demo",
  createdAt: "2026-07-01T00:00:00.000Z",
};

jest.mock("@/src/stores/useAuthStore", () => ({
  useAuthStore: (selector: (s: { hydrated: boolean; currentUser: typeof AUTHED_USER }) => unknown) =>
    selector({ hydrated: true, currentUser: AUTHED_USER }),
}));

const mockExportToImage = jest.fn(() => ({
  encodeToBase64: () => "ZmFrZQ==",
}));
const mockClear = jest.fn();

jest.mock("@/components/canvas/DrawingCanvas", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: (props: { apiRef?: { current: unknown } }) => {
      if (props.apiRef) {
        props.apiRef.current = {
          exportToImage: mockExportToImage,
          clear: mockClear,
        };
      }
      return <View testID="mock-drawing-canvas" />;
    },
  };
});

import { usePromptStore } from "@/src/stores/usePromptStore";
import { useStreakStore } from "@/src/stores/useStreakStore";
import { useOnboardingStore } from "@/src/stores/useOnboardingStore";
import { dataClient } from "@/src/data";
import TodayScreen from "../app/index";
import DrawScreen from "../app/draw";

const mockSubmit = dataClient.submit as jest.Mock;

/**
 * DrawScreen calls `useStreakStore.getState().recordSubmission()` imperatively
 * on submit success (the streak<->submit wiring). Attach a `getState` to the
 * mocked store so that call resolves to our spy.
 */
function installStreakGetState(): void {
  (useStreakStore as unknown as { getState: jest.Mock }).getState = jest
    .fn()
    .mockReturnValue({ recordSubmission: mockRecordSubmission });
}

const loadedPromptState = {
  data: {
    prompt: {
      id: "prompt-1",
      date: "2026-07-01",
      text: "Draw a cat",
      createdAt: "2026-07-01T00:00:00.000Z",
    },
    submissionStatus: { submitted: false },
  },
  loading: false,
  error: null,
  load: mockLoad,
};

describe("TodayScreen navigation (AC3)", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockBack.mockClear();
    mockLoad.mockClear();
    mockLoadStreak.mockClear();
    (usePromptStore as unknown as jest.Mock).mockReturnValue(loadedPromptState);
    (useStreakStore as unknown as jest.Mock).mockReturnValue({
      current: 0,
      lastSubmittedDate: undefined,
      loading: false,
      error: null,
      load: mockLoadStreak,
      recordSubmission: jest.fn(),
    });
    (useOnboardingStore as unknown as jest.Mock).mockReturnValue({
      hasOnboarded: true,
      checkOnboarded: jest.fn(),
      completeOnboarding: jest.fn(),
    });
  });

  it('pressing "Open the canvas" pushes /draw', async () => {
    await render(<TodayScreen />);

    expect(screen.getByText("Draw a cat")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("today-open-canvas"));

    expect(mockPush).toHaveBeenCalledWith("/draw");
  });
});

describe("TodayScreen streak badge (S-006)", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockBack.mockClear();
    mockLoad.mockClear();
    mockLoadStreak.mockClear();
    (usePromptStore as unknown as jest.Mock).mockReturnValue(loadedPromptState);
    (useOnboardingStore as unknown as jest.Mock).mockReturnValue({
      hasOnboarded: true,
      checkOnboarded: jest.fn(),
      completeOnboarding: jest.fn(),
    });
  });

  it("shows the streak badge with seeded mock data when current > 0", async () => {
    (useStreakStore as unknown as jest.Mock).mockReturnValue({
      current: 3,
      lastSubmittedDate: "2026-07-01",
      loading: false,
      error: null,
      load: mockLoadStreak,
      recordSubmission: jest.fn(),
    });

    await render(<TodayScreen />);

    expect(screen.getByText("Your streak")).toBeTruthy();
    expect(screen.getByText(/3\s*days/)).toBeTruthy();
  });

  it("does not show the streak badge while loading", async () => {
    (useStreakStore as unknown as jest.Mock).mockReturnValue({
      current: 3,
      lastSubmittedDate: "2026-07-01",
      loading: true,
      error: null,
      load: mockLoadStreak,
      recordSubmission: jest.fn(),
    });

    await render(<TodayScreen />);

    expect(screen.queryByText(/day streak/)).toBeNull();
  });

  it("does not show the streak badge when current is 0", async () => {
    (useStreakStore as unknown as jest.Mock).mockReturnValue({
      current: 0,
      lastSubmittedDate: undefined,
      loading: false,
      error: null,
      load: mockLoadStreak,
      recordSubmission: jest.fn(),
    });

    await render(<TodayScreen />);

    expect(screen.queryByText(/day streak/)).toBeNull();
  });
});

describe("DrawScreen export + preview (AC3)", () => {
  beforeEach(() => {
    mockExportToImage.mockClear();
    mockClear.mockClear();
    mockLoad.mockClear();
    mockPush.mockClear();
    mockSubmit.mockReset();
    mockRecordSubmission.mockReset();
    mockSetDraft.mockClear();
    installStreakGetState();
    (usePromptStore as unknown as jest.Mock).mockReturnValue(loadedPromptState);
  });

  it('pressing "Done" calls exportToImage and shows a base64 PNG preview', async () => {
    await render(<DrawScreen />);

    await fireEvent.press(screen.getByText("Done"));

    expect(mockExportToImage).toHaveBeenCalledTimes(1);

    const preview = screen.getByTestId("export-preview");
    expect(preview.props.source.uri).toMatch(/^data:image\/png;base64,/);
    expect(preview.props.source.uri).toBe("data:image/png;base64,ZmFrZQ==");
  });

  it('pressing "Done" stashes the draft and navigates to /write WITHOUT submitting or recording a streak', async () => {
    await render(<DrawScreen />);

    await fireEvent.press(screen.getByText("Done"));

    expect(mockSetDraft).toHaveBeenCalledWith({
      imageRef: expect.stringMatching(/^data:image\/png;base64,/),
      promptId: "prompt-1",
    });
    expect(mockPush).toHaveBeenCalledWith("/write");

    // Submit-to-unlock (AC2) no longer happens here — it happens later, in
    // app/choose-channels.tsx, once channel(s) are chosen. Prove the client
    // cannot short-circuit that gate by submitting (or advancing the streak)
    // straight out of the draw screen.
    expect(mockSubmit).not.toHaveBeenCalled();
    expect(mockRecordSubmission).not.toHaveBeenCalled();
  });

  it("shows an inline export error and does not navigate when exportToImage throws", async () => {
    mockExportToImage.mockImplementationOnce(() => {
      throw new Error("could not export your drawing");
    });

    await render(<DrawScreen />);

    await fireEvent.press(screen.getByText("Done"));

    expect(screen.getByText("could not export your drawing")).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockSetDraft).not.toHaveBeenCalled();
    expect(mockSubmit).not.toHaveBeenCalled();
  });
});
