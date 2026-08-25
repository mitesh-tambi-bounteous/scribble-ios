/**
 * Draw screen palette + brush UI — confirms the doubled toolset renders:
 * 16 color swatches (double-stacked) and 6 brush sizes. Mocks mirror
 * draw-no-submit.test.tsx so DrawScreen can render headless.
 */
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/src/data", () => ({
  dataClient: { submit: jest.fn() },
}));

jest.mock("@/src/stores/useStreakStore", () => ({
  useStreakStore: { getState: () => ({ recordSubmission: jest.fn() }) },
}));

jest.mock("@/src/stores/useDraftStore", () => ({
  useDraftStore: { getState: () => ({ setDraft: jest.fn() }) },
}));

jest.mock("@/src/stores/usePromptStore", () => ({
  usePromptStore: () => ({
    data: { prompt: { id: "prompt-x", text: "Draw a cat", date: "2026-07-01", createdAt: "" } },
    load: jest.fn(),
  }),
}));

jest.mock("@/components/canvas/DrawingCanvas", () => ({
  __esModule: true,
  default: (props: { apiRef?: { current: unknown } }) => {
    if (props.apiRef) {
      props.apiRef.current = {
        clear: jest.fn(),
        undo: jest.fn(),
        exportToImage: jest.fn(),
      };
    }
    return null;
  },
}));

import DrawScreen from "../app/draw";

describe("DrawScreen palette + brushes (doubled)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders 16 color swatches", async () => {
    const view = await render(<DrawScreen />);
    expect(view.getAllByLabelText(/^Choose color /)).toHaveLength(16);
  });

  it("renders 6 brush sizes", async () => {
    const view = await render(<DrawScreen />);
    expect(view.getAllByLabelText(/^Brush size /)).toHaveLength(6);
  });

  it("renders the pen brush plus the 3 extended stylized brushes (fork, dotted, neon)", async () => {
    const view = await render(<DrawScreen />);
    expect(view.getByLabelText("Pen brush")).toBeTruthy();
    expect(view.getByLabelText("Fork brush")).toBeTruthy();
    expect(view.getByLabelText("Dotted brush")).toBeTruthy();
    expect(view.getByLabelText("Neon brush")).toBeTruthy();
  });

  it("keeps a special brush style selected when a size dot is tapped", async () => {
    const view = await render(<DrawScreen />);
    await fireEvent.press(view.getByLabelText("Neon brush"));
    expect(view.getByLabelText("Neon brush").props.accessibilityState.selected).toBe(true);

    await fireEvent.press(view.getByLabelText("Brush size 12"));

    expect(view.getByLabelText("Neon brush").props.accessibilityState.selected).toBe(true);
    expect(view.getByLabelText("Brush size 12").props.accessibilityState.selected).toBe(true);
  });
});
