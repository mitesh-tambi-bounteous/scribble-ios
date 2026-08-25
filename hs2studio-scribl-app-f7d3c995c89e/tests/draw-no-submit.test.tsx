/**
 * T5/T6 regression test — Bug #1/#2/#4 root cause: draw.tsx used to submit
 * to a hardcoded public wall the instant "Done" is tapped. Confirms
 * handleDone() now only exports + stashes the draft and navigates to
 * /write, WITHOUT calling dataClient.submit or the streak store.
 */

import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockSubmit = jest.fn();
jest.mock("@/src/data", () => ({
  dataClient: { submit: (...args: unknown[]) => mockSubmit(...args) },
}));

const mockRecordSubmission = jest.fn();
jest.mock("@/src/stores/useStreakStore", () => ({
  useStreakStore: { getState: () => ({ recordSubmission: mockRecordSubmission }) },
}));

const mockSetDraft = jest.fn();
jest.mock("@/src/stores/useDraftStore", () => ({
  useDraftStore: { getState: () => ({ setDraft: mockSetDraft }) },
}));

jest.mock("@/src/stores/usePromptStore", () => ({
  usePromptStore: () => ({
    data: { prompt: { id: "prompt-x", text: "Draw a cat", date: "2026-07-01", createdAt: "" } },
    load: jest.fn(),
  }),
}));

const mockExportToImage = jest.fn();
jest.mock("@/components/canvas/DrawingCanvas", () => ({
  __esModule: true,
  default: (props: { apiRef?: { current: unknown } }) => {
    if (props.apiRef) {
      props.apiRef.current = {
        clear: jest.fn(),
        undo: jest.fn(),
        exportToImage: mockExportToImage,
      };
    }
    return null;
  },
}));

import DrawScreen from "../app/draw";

describe("DrawScreen handleDone (Bugs #1/#2/#4 fix)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockPush.mockClear();
    mockSubmit.mockClear();
    mockRecordSubmission.mockClear();
    mockSetDraft.mockClear();
    mockExportToImage.mockReset();
    mockExportToImage.mockReturnValue({
      encodeToBase64: () => "AAAA",
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("does not call dataClient.submit or recordSubmission, stashes the draft, and navigates to /write", async () => {
    const view = await render(<DrawScreen />);
    const doneButton = view.getByText("Done");

    fireEvent.press(doneButton);

    await waitFor(() => expect(mockSetDraft).toHaveBeenCalledTimes(1));

    expect(mockSubmit).not.toHaveBeenCalled();
    expect(mockRecordSubmission).not.toHaveBeenCalled();
    expect(mockSetDraft).toHaveBeenCalledWith(
      expect.objectContaining({ imageRef: "data:image/png;base64,AAAA", promptId: "prompt-x" }),
    );
    expect(mockPush).toHaveBeenCalledWith("/write");
  });
});
