/**
 * Unit test for the shared DrawingImage component
 * (components/DrawingImage.tsx). Renders the real stored drawing (imageRef)
 * as an Image, falling back to synthetic art only when imageRef is absent.
 */

import { render, screen } from "@testing-library/react-native";
import React from "react";
import { StyleSheet, Text } from "react-native";

import { DrawingImage } from "@/components/DrawingImage";

describe("DrawingImage", () => {
  it("renders the fallback when imageRef is absent", async () => {
    await render(<DrawingImage fallback={<Text>fallback-doodle</Text>} />);
    expect(screen.getByText("fallback-doodle")).toBeTruthy();
  });

  it("renders the fallback when imageRef is an empty string", async () => {
    await render(<DrawingImage imageRef="" fallback={<Text>fallback-doodle</Text>} />);
    expect(screen.getByText("fallback-doodle")).toBeTruthy();
  });

  it("renders an Image with the imageRef as source uri when present", async () => {
    await render(
      <DrawingImage
        imageRef="data:image/png;base64,AAAA"
        testID="drawing-image"
        fallback={<Text>fallback-doodle</Text>}
      />,
    );
    expect(screen.queryByText("fallback-doodle")).toBeNull();
    const image = screen.getByTestId("drawing-image");
    expect(image.props.source).toEqual({ uri: "data:image/png;base64,AAAA" });
  });

  it("fills its parent deterministically (absolute, not a percentage height)", async () => {
    // Regression guard: `height: "100%"` collapses to 0px on React Native Web,
    // which made every stored drawing render blank. The image must fill via an
    // absolute inset instead.
    await render(
      <DrawingImage
        imageRef="data:image/png;base64,AAAA"
        testID="drawing-image"
        fallback={<Text>fallback-doodle</Text>}
      />,
    );
    const style = StyleSheet.flatten(screen.getByTestId("drawing-image").props.style);
    expect(style.position).toBe("absolute");
    expect(style.height).not.toBe("100%");
  });
});
