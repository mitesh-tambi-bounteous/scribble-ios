/**
 * Screen test for the wall members roster (app/wall/[id]/members.tsx).
 *
 * The roster reads members via dataClient.getChannelRoster — AC4-gated
 * membership only, no submit-to-unlock — so it returns identity
 * (displayName/email/avatarColor) plus the channel `createdBy`, with NO peer
 * content (no per-member response, no "drawn today" status). Each row is a
 * plain identity row; the wall CREATOR additionally sees a per-member Remove
 * action (never on their own row). Multi-email invite parses the field and
 * calls dataClient.inviteMember once per valid address.
 *
 * Back affordance: goBack("/settings") — the screen is only reachable by a
 * push from app/settings.tsx.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";

const mockRouterPush = jest.fn();
const mockRouterBack = jest.fn();
const mockGoBack = jest.fn();
const mockGetChannelRoster = jest.fn();
const mockInviteMember = jest.fn();
const mockLeaveWall = jest.fn();
const mockRemoveMember = jest.fn();
const mockLoadWalls = jest.fn();

// Mutable current-user id so individual tests can view the screen as the
// creator or as a non-creator member.
let mockCurrentUserId = "user-alice";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  router: {
    push: (...args: unknown[]) => mockRouterPush(...args),
    back: (...args: unknown[]) => mockRouterBack(...args),
  },
  useLocalSearchParams: () => ({ id: "channel-1" }),
}));

jest.mock("@/src/lib/nav", () => ({
  goBack: (...args: unknown[]) => mockGoBack(...args),
}));

jest.mock("@/src/data", () => ({
  dataClient: {
    getChannelRoster: (...args: unknown[]) => mockGetChannelRoster(...args),
    inviteMember: (...args: unknown[]) => mockInviteMember(...args),
    leaveWall: (...args: unknown[]) => mockLeaveWall(...args),
    removeMember: (...args: unknown[]) => mockRemoveMember(...args),
  },
}));

// Mock the stores so the screen's imports don't pull in AsyncStorage under
// jest. Both support the selector form the screen uses.
jest.mock("@/src/stores/useWallsStore", () => ({
  useWallsStore: (selector: (state: { load: () => void }) => unknown) =>
    selector({ load: mockLoadWalls }),
}));

jest.mock("@/src/stores/useAuthStore", () => ({
  useAuthStore: (selector: (state: { currentUser: { id: string } | null }) => unknown) =>
    selector({ currentUser: { id: mockCurrentUserId } }),
}));

import type { ChannelRosterResponse } from "@scribl/shared/index";
import WallMembersScreen from "../app/wall/[id]/members";

// Alice created the wall; Bob and Carol are members. Identity only — no
// response / hasDrawnToday fields exist on the roster payload.
const roster: ChannelRosterResponse = {
  createdBy: "user-alice",
  members: [
    { userId: "user-alice", displayName: "Alice", email: "alice@x.com", avatarColor: "#FF0000" },
    { userId: "user-bob", displayName: "Bob", email: "bob@x.com", avatarColor: "#00FF00" },
    { userId: "user-carol", displayName: "Carol", email: "carol@x.com", avatarColor: "#0000FF" },
  ],
};

/** Auto-confirms an Alert by invoking the destructive button's onPress. */
function autoConfirm(label: string) {
  const { Alert } = require("react-native");
  return jest.spyOn(Alert, "alert").mockImplementation((...args: unknown[]) => {
    const buttons = args[2] as { text: string; onPress?: () => void }[] | undefined;
    buttons?.find((b) => b.text === label)?.onPress?.();
  });
}

describe("WallMembersScreen", () => {
  beforeEach(() => {
    mockCurrentUserId = "user-alice";
    mockRouterPush.mockClear();
    mockRouterBack.mockClear();
    mockGoBack.mockClear();
    mockInviteMember.mockReset();
    mockInviteMember.mockResolvedValue(undefined);
    mockGetChannelRoster.mockReset();
    mockGetChannelRoster.mockResolvedValue(roster);
    mockLeaveWall.mockReset();
    mockLeaveWall.mockResolvedValue(undefined);
    mockRemoveMember.mockReset();
    mockRemoveMember.mockResolvedValue(undefined);
    mockLoadWalls.mockReset();
    mockLoadWalls.mockResolvedValue(undefined);
  });

  it("renders identity rows (avatar + name + email) from getChannelRoster", async () => {
    await render(<WallMembersScreen />);
    await waitFor(() => expect(screen.getByText("Bob")).toBeTruthy());

    expect(mockGetChannelRoster).toHaveBeenCalledWith("channel-1");
    expect(screen.getByTestId("member-avatar-user-bob")).toBeTruthy();
    expect(screen.getByText("bob@x.com")).toBeTruthy();
    expect(screen.getByText("Carol")).toBeTruthy();
    expect(screen.getByText("carol@x.com")).toBeTruthy();
  });

  it("as the creator, shows Remove on other members but not on the creator's own row", async () => {
    await render(<WallMembersScreen />);
    await waitFor(() => expect(screen.getByText("Bob")).toBeTruthy());

    expect(screen.getByTestId("wall-remove-member-user-bob")).toBeTruthy();
    expect(screen.getByTestId("wall-remove-member-user-carol")).toBeTruthy();
    expect(screen.queryByTestId("wall-remove-member-user-alice")).toBeNull();
  });

  it("creator Remove confirms, calls dataClient.removeMember, and reloads the roster", async () => {
    const alertSpy = autoConfirm("Remove");
    await render(<WallMembersScreen />);
    await waitFor(() => expect(screen.getByText("Bob")).toBeTruthy());

    fireEvent.press(screen.getByTestId("wall-remove-member-user-bob"));

    await waitFor(() => expect(mockRemoveMember).toHaveBeenCalledWith("channel-1", "user-bob"));
    // Initial load + reload after removal.
    expect(mockGetChannelRoster).toHaveBeenCalledTimes(2);
    alertSpy.mockRestore();
  });

  it("as a non-creator member, shows no Remove actions", async () => {
    mockCurrentUserId = "user-bob";
    await render(<WallMembersScreen />);
    await waitFor(() => expect(screen.getByText("Bob")).toBeTruthy());

    expect(screen.queryByTestId("wall-remove-member-user-alice")).toBeNull();
    expect(screen.queryByTestId("wall-remove-member-user-carol")).toBeNull();
  });

  it("as the creator, shows the Add-member invite card", async () => {
    await render(<WallMembersScreen />);
    await waitFor(() => expect(screen.getByText("Bob")).toBeTruthy());

    expect(screen.getByTestId("wall-add-member-input")).toBeTruthy();
    expect(screen.getByTestId("wall-add-member-button")).toBeTruthy();
  });

  it("as a non-creator member, hides the Add-member invite card (server is owner-only)", async () => {
    mockCurrentUserId = "user-bob";
    await render(<WallMembersScreen />);
    await waitFor(() => expect(screen.getByText("Bob")).toBeTruthy());

    expect(screen.queryByTestId("wall-add-member-input")).toBeNull();
    expect(screen.queryByTestId("wall-add-member-button")).toBeNull();
  });

  it("multi-email invite calls inviteMember once per valid address and flags invalid ones", async () => {
    await render(<WallMembersScreen />);
    await waitFor(() => expect(screen.getByText("Bob")).toBeTruthy());

    fireEvent.changeText(
      screen.getByTestId("wall-add-member-input"),
      "a@x.com, bogus, c@x.com",
    );
    // Wait for the controlled input to flush so the (initially disabled)
    // add-member button is enabled before we press it.
    await screen.findByDisplayValue("a@x.com, bogus, c@x.com");
    fireEvent.press(screen.getByTestId("wall-add-member-button"));

    await waitFor(() => expect(mockInviteMember).toHaveBeenCalledTimes(2));
    expect(mockInviteMember).toHaveBeenCalledWith("channel-1", "a@x.com");
    expect(mockInviteMember).toHaveBeenCalledWith("channel-1", "c@x.com");
    expect(mockInviteMember).not.toHaveBeenCalledWith("channel-1", "bogus");

    const result = await screen.findByTestId("wall-add-member-result");
    expect(result.props.children).toContain("Added 2");
    expect(result.props.children).toContain("Invalid: bogus");
  });

  it("Leave wall confirms, calls dataClient.leaveWall, reloads walls, and navigates back", async () => {
    const alertSpy = autoConfirm("Leave");
    await render(<WallMembersScreen />);
    await waitFor(() => expect(screen.getByText("Bob")).toBeTruthy());

    fireEvent.press(screen.getByTestId("wall-leave-button"));

    await waitFor(() => expect(mockLeaveWall).toHaveBeenCalledWith("channel-1"));
    expect(mockLoadWalls).toHaveBeenCalled();
    expect(mockRouterBack).toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it("header back uses goBack('/settings')", async () => {
    await render(<WallMembersScreen />);
    await waitFor(() => expect(screen.getByText("Bob")).toBeTruthy());
    fireEvent.press(screen.getByLabelText("Go back"));
    expect(mockGoBack).toHaveBeenCalledWith("/settings");
  });
});
