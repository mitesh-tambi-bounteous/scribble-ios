/**
 * Unit tests for components/EnhancedToggleImage.tsx (W1c). Confirms the
 * enhanced/original toggle and status chrome behave per docs/design/ux-flow-spec.md §7,
 * and that the AI_ENABLED kill-switch (src/config/features.ts) fully hides all
 * AI chrome when off while leaving the plain image rendering untouched.
 */

import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { View } from "react-native";

// Default to AI ON for this file's primary suite; the "AI_ENABLED=false"
// suite below overrides via jest.resetModules() + a scoped jest.doMock.
jest.mock("@/src/config/features", () => ({ AI_ENABLED: true }));

import { EnhancedToggleImage } from "@/components/EnhancedToggleImage";

const ORIGINAL = "data:image/png;base64,AAAA";
const ENHANCED = "data:image/png;base64,BBBB";

describe("EnhancedToggleImage (AI_ENABLED=true)", () => {
  it("shows the enhanced image by default when ready, and toggles to original and back", async () => {
    await render(
      <EnhancedToggleImage
        imageRef={ORIGINAL}
        enhancedImageRef={ENHANCED}
        enhancementStatus="ready"
        testID="response-image"
        fallback={<></>}
      />,
    );

    expect(screen.getByTestId("enhanced-image")).toBeTruthy();
    expect(screen.getByTestId("response-image").props.source.uri).toBe(ENHANCED);

    await fireEvent.press(screen.getByTestId("enhance-toggle"));
    expect(screen.queryByTestId("enhanced-image")).toBeNull();
    expect(screen.getByTestId("response-image").props.source.uri).toBe(ORIGINAL);

    await fireEvent.press(screen.getByTestId("enhance-toggle"));
    expect(screen.getByTestId("enhanced-image")).toBeTruthy();
    expect(screen.getByTestId("response-image").props.source.uri).toBe(ENHANCED);
  });

  it("shows pending chrome in detail variant and no toggle affordance", async () => {
    await render(
      <EnhancedToggleImage
        imageRef={ORIGINAL}
        enhancementStatus="pending"
        variant="detail"
        testID="response-image"
        fallback={<></>}
      />,
    );

    expect(screen.getByTestId("enhanced-pending")).toBeTruthy();
    expect(screen.queryByTestId("enhance-toggle")).toBeNull();
    expect(screen.queryByTestId("enhanced-image")).toBeNull();
  });

  it("shows failed chrome in detail variant and no toggle affordance", async () => {
    await render(
      <EnhancedToggleImage
        imageRef={ORIGINAL}
        enhancementStatus="failed"
        variant="detail"
        testID="response-image"
        fallback={<></>}
      />,
    );

    expect(screen.getByTestId("enhanced-failed")).toBeTruthy();
    expect(screen.queryByTestId("enhance-toggle")).toBeNull();
  });

  it("renders plain original with no toggle when there is no enhancedImageRef", async () => {
    await render(
      <EnhancedToggleImage
        imageRef={ORIGINAL}
        enhancementStatus="ready"
        testID="response-image"
        fallback={<></>}
      />,
    );

    expect(screen.queryByTestId("enhance-toggle")).toBeNull();
    expect(screen.queryByTestId("enhanced-image")).toBeNull();
    expect(screen.getByTestId("response-image").props.source.uri).toBe(ORIGINAL);
  });

  it("controlled mode renders no internal pill and reflects the showOriginal prop", async () => {
    const onToggle = jest.fn();
    const props = {
      imageRef: ORIGINAL,
      enhancedImageRef: ENHANCED,
      enhancementStatus: "ready" as const,
      variant: "detail" as const,
      testID: "response-image",
      onToggleOriginal: onToggle,
      fallback: <></>,
    };

    const view = await render(<EnhancedToggleImage {...props} showOriginal={false} />);
    // Parent owns the pill in controlled mode: none rendered here.
    expect(screen.queryByTestId("enhance-toggle")).toBeNull();
    expect(screen.getByTestId("response-image").props.source.uri).toBe(ENHANCED);

    await view.rerender(<EnhancedToggleImage {...props} showOriginal={true} />);
    expect(screen.getByTestId("response-image").props.source.uri).toBe(ORIGINAL);
  });

  it("tile variant renders no status chrome while pending", async () => {
    await render(
      <EnhancedToggleImage
        imageRef={ORIGINAL}
        enhancementStatus="pending"
        variant="tile"
        testID="response-image"
        fallback={<></>}
      />,
    );

    expect(screen.queryByTestId("enhanced-pending")).toBeNull();
    expect(screen.queryByTestId("enhanced-failed")).toBeNull();
    expect(screen.queryByTestId("enhance-toggle")).toBeNull();
  });
});

describe("EnhancedToggleImage (AI_ENABLED=false)", () => {
  // The mocked features module is a live CommonJS binding (babel/TS compile
  // named imports to property access, not a destructured local), so flipping
  // this field on the shared mock retroactively changes what the
  // already-imported component sees — no resetModules/re-require needed
  // (which would otherwise create a second React instance and break hooks).
  const features = jest.requireMock("@/src/config/features") as { AI_ENABLED: boolean };

  beforeEach(() => {
    features.AI_ENABLED = false;
  });

  afterAll(() => {
    features.AI_ENABLED = true;
  });

  it("renders no AI chrome at all regardless of status, only the plain image", async () => {
    const Comp = EnhancedToggleImage;
    await render(
      <Comp
        imageRef={ORIGINAL}
        enhancedImageRef={ENHANCED}
        enhancementStatus="pending"
        variant="detail"
        testID="response-image"
        fallback={<></>}
      />,
    );

    expect(screen.queryByTestId("enhanced-pending")).toBeNull();
    expect(screen.queryByTestId("enhanced-failed")).toBeNull();
    expect(screen.queryByTestId("enhance-toggle")).toBeNull();
    expect(screen.queryByTestId("enhanced-pending-badge")).toBeNull();
    expect(screen.queryByTestId("enhanced-image")).toBeNull();
    expect(screen.getByTestId("response-image").props.source.uri).toBe(ORIGINAL);
  });

  it("renders no toggle even when status is ready with an enhancedImageRef", async () => {
    const Comp = EnhancedToggleImage;
    await render(
      <Comp
        imageRef={ORIGINAL}
        enhancedImageRef={ENHANCED}
        enhancementStatus="ready"
        testID="response-image"
        fallback={<></>}
      />,
    );

    expect(screen.queryByTestId("enhance-toggle")).toBeNull();
    expect(screen.queryByTestId("enhanced-image")).toBeNull();
    expect(screen.getByTestId("response-image").props.source.uri).toBe(ORIGINAL);
  });

  it("falls back to the enhanced image when only enhancedImageRef exists (no doodle fallback)", async () => {
    const Comp = EnhancedToggleImage;
    await render(
      <Comp
        enhancedImageRef={ENHANCED}
        enhancementStatus="ready"
        testID="response-image"
        fallback={<View testID="doodle-fallback" />}
      />,
    );

    expect(screen.queryByTestId("doodle-fallback")).toBeNull();
    expect(screen.getByTestId("response-image").props.source.uri).toBe(ENHANCED);
  });

  it("tile variant renders no pending badge", async () => {
    const Comp = EnhancedToggleImage;
    await render(
      <Comp
        imageRef={ORIGINAL}
        enhancementStatus="pending"
        variant="tile"
        testID="response-image"
        fallback={<></>}
      />,
    );

    expect(screen.queryByTestId("enhanced-pending-badge")).toBeNull();
  });
});
