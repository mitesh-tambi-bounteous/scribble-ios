/**
 * Avatar component: a hand-drawn avatar (imageUri) renders as an <Image>
 * clipped to the circle and takes precedence over the color/initial fallback.
 */
import { render } from "@testing-library/react-native";
import React from "react";

jest.mock("expo-linear-gradient", () => {
  const { View: RNView } = jest.requireActual("react-native");
  return { LinearGradient: RNView };
});

import { Avatar } from "@/components/ui/avatar";

const DATA_URI = "data:image/png;base64,AAAA";

describe("Avatar imageUri", () => {
  it("renders the drawn image when imageUri is set (no initial letter)", async () => {
    const view = await render(<Avatar name="Rob" imageUri={DATA_URI} testID="av" size={64} />);
    const image = view.getByTestId("av-image");
    expect((image.props.source as { uri?: string })?.uri).toBe(DATA_URI);
    expect(view.queryByText("R")).toBeNull();
  });

  it("falls back to the initial letter when no imageUri", async () => {
    const view = await render(<Avatar name="Rob" color="#2F6BE2" testID="av" size={64} />);
    expect(view.getByText("R")).toBeTruthy();
  });

  it("falls back to the initial letter when the image fails to load (QA: blank Rob tile)", async () => {
    const view = await render(
      <Avatar name="Rob" imageUri={DATA_URI} color="#2F6BE2" testID="av" size={64} />
    );
    const image = view.getByTestId("av-image");
    image.props.onError?.();
    expect(await view.findByText("R")).toBeTruthy();
  });
});
