/**
 * T5/T6 test for app/choose-channels.tsx — Bug #2/#4 fix. Renders the
 * caller's channels from useWallsStore as a multi-select list; submit is
 * disabled until at least one is selected, and pressing submit calls
 * dataClient.submit with the selected channelIds plus the draft's caption
 * and imageRef, then navigates on success.
 *
 * W2c additions: post-submit stack normalization (R5 — dismissAll →
 * replace("/home") → push(dest), in that order) and the R6 draft guard
 * (no imageRef on mount → replace("/draw")).
 */

import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockDismissAll = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn(() => true);

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, dismissAll: mockDismissAll }),
  // Module-level singleton consumed by goBack() (src/lib/nav.ts).
  router: {
    canGoBack: () => mockCanGoBack(),
    back: () => mockBack(),
    replace: (href: unknown) => mockReplace(href),
  },
}));

const mockSubmit = jest.fn();
jest.mock("@/src/data", () => ({
  dataClient: { submit: (...args: unknown[]) => mockSubmit(...args) },
}));

const mockRecordSubmission = jest.fn();
jest.mock("@/src/stores/useStreakStore", () => ({
  useStreakStore: { getState: () => ({ recordSubmission: mockRecordSubmission }) },
}));

const mockLoad = jest.fn();
const mockClearDraft = jest.fn();
jest.mock("@/src/stores/useWallsStore", () => ({
  useWallsStore: jest.fn(),
}));

const mockDraftState: {
  imageRef: string | null;
  promptId: string | null;
  caption: string | null;
  channelId: string | null;
} = {
  imageRef: "data:image/png;base64,AAAA",
  promptId: "prompt-x",
  caption: "hello",
  channelId: null,
};

jest.mock("@/src/stores/useDraftStore", () => ({
  useDraftStore: Object.assign(() => mockDraftState, {
    getState: () => ({ ...mockDraftState, clearDraft: mockClearDraft }),
  }),
}));

import { useWallsStore } from "@/src/stores/useWallsStore";
import ChooseChannelsScreen from "../app/choose-channels";

const mockUseWallsStore = useWallsStore as unknown as jest.Mock;

describe("ChooseChannelsScreen (Bug #2/#4 fix)", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
    mockDismissAll.mockClear();
    mockBack.mockClear();
    mockCanGoBack.mockReset();
    mockCanGoBack.mockReturnValue(true);
    mockSubmit.mockReset();
    mockRecordSubmission.mockClear();
    mockLoad.mockClear();
    mockClearDraft.mockClear();
    mockDraftState.imageRef = "data:image/png;base64,AAAA";
    mockDraftState.promptId = "prompt-x";
    mockDraftState.caption = "hello";
    mockUseWallsStore.mockReturnValue({
      walls: [
        { id: "channel-alpha", name: "Alpha", kind: "group", isPublic: false },
        { id: "channel-family", name: "Family", kind: "group", isPublic: false },
      ],
      load: mockLoad,
    });
  });

  it("disables submit with no selection", async () => {
    const view = await render(<ChooseChannelsScreen />);
    expect(view.getByTestId("share-submit-button").props.accessibilityState?.disabled).toBe(true);
  });

  it("selecting channels + pressing submit calls dataClient.submit with channelIds + caption + imageRef", async () => {
    mockSubmit.mockResolvedValueOnce(undefined);
    const view = await render(<ChooseChannelsScreen />);

    fireEvent.press(view.getByTestId("channel-option-channel-family"));
    await waitFor(() =>
      expect(view.getByTestId("share-submit-button").props.accessibilityState?.disabled).toBe(
        false,
      ),
    );
    fireEvent.press(view.getByTestId("share-submit-button"));

    await waitFor(() =>
      expect(mockSubmit).toHaveBeenCalledWith({
        promptId: "prompt-x",
        channelIds: ["channel-family"],
        imageRef: "data:image/png;base64,AAAA",
        text: "hello",
      }),
    );

    await waitFor(() => expect(mockRecordSubmission).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockPush).toHaveBeenCalled());
  });

  it("navigates after a successful submit", async () => {
    mockSubmit.mockResolvedValueOnce(undefined);
    const view = await render(<ChooseChannelsScreen />);

    fireEvent.press(view.getByTestId("channel-option-channel-alpha"));
    await waitFor(() =>
      expect(view.getByTestId("share-submit-button").props.accessibilityState?.disabled).toBe(
        false,
      ),
    );
    fireEvent.press(view.getByTestId("share-submit-button"));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({ pathname: "/family" })),
    );
  });

  it("R5: successful submit normalizes the stack — dismissAll, then replace('/home'), then push(dest), in that order", async () => {
    mockSubmit.mockResolvedValueOnce(undefined);
    const view = await render(<ChooseChannelsScreen />);

    fireEvent.press(view.getByTestId("channel-option-channel-alpha"));
    await waitFor(() =>
      expect(view.getByTestId("share-submit-button").props.accessibilityState?.disabled).toBe(
        false,
      ),
    );
    fireEvent.press(view.getByTestId("share-submit-button"));

    await waitFor(() => expect(mockPush).toHaveBeenCalled());

    expect(mockDismissAll).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/home");
    expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({ pathname: "/family" }));
    expect(mockClearDraft).toHaveBeenCalledTimes(1);

    const dismissOrder = mockDismissAll.mock.invocationCallOrder[0];
    const replaceOrder = mockReplace.mock.invocationCallOrder[0];
    const pushOrder = mockPush.mock.invocationCallOrder[0];
    expect(dismissOrder).toBeLessThan(replaceOrder);
    expect(replaceOrder).toBeLessThan(pushOrder);
  });

  it("failed submit does not normalize the stack and does not clear the draft", async () => {
    mockSubmit.mockRejectedValueOnce(new Error("network down"));
    const view = await render(<ChooseChannelsScreen />);

    fireEvent.press(view.getByTestId("channel-option-channel-alpha"));
    await waitFor(() =>
      expect(view.getByTestId("share-submit-button").props.accessibilityState?.disabled).toBe(
        false,
      ),
    );
    fireEvent.press(view.getByTestId("share-submit-button"));

    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1));

    expect(mockDismissAll).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockClearDraft).not.toHaveBeenCalled();
  });

  it("footer copy says the drawing is final but captions stay editable", async () => {
    const view = await render(<ChooseChannelsScreen />);

    expect(
      view.getByText("Your drawing is final once it's out there — captions you can still tweak."),
    ).toBeTruthy();
    expect(view.queryByText(/can't edit after this/)).toBeNull();
  });

  it("R6 draft guard: redirects to /draw (replace) when the draft has no imageRef on mount", async () => {
    mockDraftState.imageRef = null;
    await render(<ChooseChannelsScreen />);
    expect(mockReplace).toHaveBeenCalledWith("/draw");
  });
});
