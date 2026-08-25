/**
 * WS3 repro test: create-wall must not navigate to /home on failure, and
 * must surface the store error instead of silently swallowing it.
 *
 * Prior bug: app/create-wall.tsx called `await createWall(...)` then
 * unconditionally `router.push("/home")`, and useWallsStore.createWall()
 * caught errors into state without ever telling the caller it failed. That
 * combination meant a failed create-family looked like a success: the user
 * was pushed to /home with no error shown.
 */

import { act, cleanup, render, fireEvent, screen, waitFor } from "@testing-library/react-native";
import React from "react";

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  router: { push: (...args: unknown[]) => mockPush(...args), back: (...args: unknown[]) => mockBack(...args) },
  useLocalSearchParams: () => ({ kind: "group" }),
}));

jest.mock(
  "@react-native-async-storage/async-storage",
  () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

const mockCreateWall = jest.fn();

jest.mock("@/src/stores/useWallsStore", () => {
  const actual = jest.requireActual("@/src/stores/useWallsStore");
  return {
    ...actual,
    useWallsStore: jest.fn(),
  };
});

const mockInviteMember = jest.fn();
jest.mock("@/src/data", () => ({
  dataClient: { inviteMember: (...args: unknown[]) => mockInviteMember(...args) },
}));

import { useWallsStore } from "@/src/stores/useWallsStore";
import CreateWallScreen from "../app/create-wall";

const mockUseWallsStore = useWallsStore as unknown as jest.Mock;

function setStore(overrides: {
  createWall: jest.Mock;
  error: string | null;
  lastCreatedWall?: { id: string } | null;
}): void {
  mockUseWallsStore.mockImplementation((selector: (state: Record<string, unknown>) => unknown) =>
    selector({ createWall: overrides.createWall, error: overrides.error }),
  );
  (mockUseWallsStore as unknown as { getState: () => unknown }).getState = () => ({
    lastCreatedWall: overrides.lastCreatedWall ?? null,
  });
}

describe("CreateWallScreen (WS3 create-family failure handling)", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockBack.mockClear();
    mockCreateWall.mockReset();
    mockInviteMember.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("navigates to /home when createWall resolves true", async () => {
    mockCreateWall.mockResolvedValueOnce(true);
    setStore({ createWall: mockCreateWall, error: null });

    await render(<CreateWallScreen />);
    fireEvent.changeText(screen.getByTestId("create-wall-name"), "Family");
    await screen.findByDisplayValue("Family");
    fireEvent.press(screen.getByTestId("create-wall-submit"));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/home"));
  });

  it("does NOT navigate to /home when createWall resolves false, and shows the error", async () => {
    mockCreateWall.mockResolvedValueOnce(false);
    setStore({ createWall: mockCreateWall, error: "Failed to create wall." });

    await render(<CreateWallScreen />);
    fireEvent.changeText(screen.getByTestId("create-wall-name"), "Family");
    await screen.findByDisplayValue("Family");
    fireEvent.press(screen.getByTestId("create-wall-submit"));

    await waitFor(() => expect(mockCreateWall).toHaveBeenCalled());
    await screen.findByTestId("create-wall-error");
    expect(mockPush).not.toHaveBeenCalledWith("/home");
  });

  it("selecting the Challenge toggle creates a wall with kind: 'challenge'", async () => {
    mockCreateWall.mockResolvedValueOnce(true);
    setStore({ createWall: mockCreateWall, error: null });

    await render(<CreateWallScreen />);
    fireEvent.changeText(screen.getByTestId("create-wall-name"), "Dragon Duel");
    await screen.findByDisplayValue("Dragon Duel");
    await act(async () => {
      fireEvent.press(screen.getByTestId("create-wall-kind-challenge"));
    });
    fireEvent.press(screen.getByTestId("create-wall-submit"));

    await waitFor(() =>
      expect(mockCreateWall).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Dragon Duel", kind: "challenge" }),
      ),
    );
  });

  it("defaults to kind: 'group' when the toggle is left untouched", async () => {
    mockCreateWall.mockResolvedValueOnce(true);
    setStore({ createWall: mockCreateWall, error: null });

    await render(<CreateWallScreen />);
    fireEvent.changeText(screen.getByTestId("create-wall-name"), "Family");
    await screen.findByDisplayValue("Family");
    fireEvent.press(screen.getByTestId("create-wall-submit"));

    await waitFor(() =>
      expect(mockCreateWall).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Family", kind: "group" }),
      ),
    );
  });

  it("invites the entered email into the new wall (WS4), and a rejected invite still navigates home", async () => {
    // Success case: createWall succeeds and an invite email was entered ->
    // inviteMember is called against the newly created wall's real id.
    mockCreateWall.mockResolvedValueOnce(true);
    mockInviteMember.mockResolvedValueOnce({ userId: "user-invitee", displayName: "friend@example.com" });
    setStore({ createWall: mockCreateWall, error: null, lastCreatedWall: { id: "wall-42" } });

    await render(<CreateWallScreen />);
    fireEvent.changeText(screen.getByTestId("create-wall-name"), "Family");
    fireEvent.changeText(screen.getByTestId("create-wall-invite-input"), "friend@example.com");
    await screen.findByDisplayValue("Family");
    fireEvent.press(screen.getByTestId("create-wall-submit"));

    await waitFor(() => expect(mockInviteMember).toHaveBeenCalledWith("wall-42", "friend@example.com"));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/home"));

    // Failure case: a rejected invite must not block navigation to /home -
    // the wall itself was created successfully, so the failed invite is
    // only surfaced inline (create-wall-invite-error), never treated as a
    // create-wall failure.
    mockPush.mockClear();
    mockInviteMember.mockClear();
    mockCreateWall.mockResolvedValueOnce(true);
    mockInviteMember.mockRejectedValueOnce(new Error("not a member"));
    setStore({ createWall: mockCreateWall, error: null, lastCreatedWall: { id: "wall-42" } });

    fireEvent.press(screen.getByTestId("create-wall-submit"));

    await waitFor(() => expect(mockInviteMember).toHaveBeenCalledWith("wall-42", "friend@example.com"));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/home"));
  });
});

