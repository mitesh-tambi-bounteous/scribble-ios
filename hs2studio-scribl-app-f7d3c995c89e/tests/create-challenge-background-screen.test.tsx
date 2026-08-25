/**
 * Canvas-size-parity regression test for app/create-challenge-background.tsx.
 *
 * The background used to be captured on an inline pad sized by a fixed
 * `h-[420px]` wrapper inside app/create-challenge.tsx, while the entry
 * draw canvas (app/draw.tsx, app/challenge/[id].tsx) sizes itself via a
 * `w-full max-w-[760px] self-center flex-1` wrapper — a different onLayout
 * dp size, so the saved background got stretched/compressed when later
 * composited behind the entry canvas. This screen must wrap DrawPad in
 * the exact same ENTRY_CANVAS_FRAME_CLASSNAME, and must save the drawn
 * background into the shared draft store (not local state) so
 * app/create-challenge.tsx picks it up after the round trip.
 */

import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";

const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  router: { back: (...args: unknown[]) => mockBack(...args) },
}));

const mockExportToImage = jest.fn(() => ({
  encodeToBase64: () => "AAAA",
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

import { ENTRY_CANVAS_FRAME_CLASSNAME } from "@/src/lib/canvasFrame";
import { useCreateChallengeDraftStore } from "@/src/stores/useCreateChallengeDraftStore";
import { PALETTE } from "@scribl/shared/tools";
import { DrawPad } from "@/components/canvas/DrawPad";
import CreateChallengeBackgroundScreen from "../app/create-challenge-background";

describe("CreateChallengeBackgroundScreen (canvas-size parity)", () => {
  beforeEach(() => {
    mockBack.mockClear();
    useCreateChallengeDraftStore.getState().reset();
  });

  it("wraps DrawPad in the shared entry-canvas frame class, as a direct child of the screen root", async () => {
    const view = await render(<CreateChallengeBackgroundScreen />);
    const frame = view.getByTestId("entry-canvas-frame");
    expect(frame.props.className).toBe(ENTRY_CANVAS_FRAME_CLASSNAME);
    // Same nesting as app/challenge/[id].tsx: a direct child of the screen
    // root SafeAreaView (no padded/word wrapper stealing space). This is the
    // structural half of canvas-geometry parity.
    expect(frame.parent?.props.testID).toBe("create-challenge-background-screen");
  });

  it("draws the background with the FULL toolset regardless of the challenge's selected toolset — background drawing is never tool-restricted", async () => {
    // The challenge's own toolset restriction applies only to participants
    // drawing the entry (app/challenge/[id].tsx). Even when the draft has a
    // restricted toolset selected, this screen must still offer the full
    // palette/brush set — that restriction was the reported bug.
    const fourColors = PALETTE.slice(0, 4);
    useCreateChallengeDraftStore.getState().setSelectedColors(fourColors);
    useCreateChallengeDraftStore.getState().setSelectedBrushes(["basic", "neon"]);

    const view = await render(<CreateChallengeBackgroundScreen />);
    expect(view.getAllByLabelText(/^Choose color /)).toHaveLength(PALETTE.length);
    expect(view.getByLabelText("Pen brush")).toBeTruthy();
    expect(view.getByLabelText("Neon brush")).toBeTruthy();
    expect(view.getByLabelText("Fork brush")).toBeTruthy();
  });

  it("saves the drawn background into the shared draft store and navigates back", async () => {
    const view = await render(<CreateChallengeBackgroundScreen />);
    fireEvent.press(view.getByText("Save background"));

    await waitFor(() =>
      expect(useCreateChallengeDraftStore.getState().backgroundRef).toBe(
        "data:image/png;base64,AAAA",
      ),
    );
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});

describe("DrawPad palette row spacer (toolbar height parity)", () => {
  // Regression for the vertical-stretch bug: a restricted toolset with <=8
  // colors used to render only one 30px palette row instead of two, making
  // the entry canvas ~38px taller than the background-capture canvas (which
  // always uses the full palette). SkiaCanvas composites the background
  // fit="fill" (components/canvas/SkiaCanvas.tsx:374-381), so any toolbar
  // height difference stretches it.
  it("renders the spacer when the (restricted) palette has 8 or fewer colors", async () => {
    const view = await render(
      <DrawPad onDone={jest.fn()} allowedColors={PALETTE.slice(0, 4)} />,
    );
    expect(
      view.getByTestId("palette-row-spacer", { includeHiddenElements: true }),
    ).toBeTruthy();
  });

  it("does not render the spacer with the full palette (two real rows)", async () => {
    const view = await render(<DrawPad onDone={jest.fn()} />);
    expect(view.queryByTestId("palette-row-spacer")).toBeNull();
  });
});
