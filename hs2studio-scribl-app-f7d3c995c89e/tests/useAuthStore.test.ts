/**
 * useAuthStore — stubbed-auth session store (src/stores/useAuthStore.ts).
 *
 * Mocks the dataClient seam and the active-user seam. Confirms signUp/login
 * set currentUser and propagate the active user id, switchUser/logout do the
 * same without hitting the network, and hydrate restores a persisted
 * session from the full user object in AsyncStorage (no listUsers call).
 */

jest.mock("@/src/data", () => ({
  dataClient: {
    signUp: jest.fn(),
    login: jest.fn(),
    listUsers: jest.fn(),
  },
}));

jest.mock("@/src/data/active-user", () => ({
  setActiveUser: jest.fn(),
}));

jest.mock(
  "@react-native-async-storage/async-storage",
  () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { User } from "@scribl/shared/index";

import { dataClient } from "@/src/data";
import { setActiveUser } from "@/src/data/active-user";
import { UserNotFoundError } from "@/src/data/client";
import { getAuthStoreState, useAuthStore } from "@/src/stores/useAuthStore";

const mockSignUp = dataClient.signUp as jest.Mock;
const mockLogin = dataClient.login as jest.Mock;
const mockListUsers = dataClient.listUsers as jest.Mock;
const mockSetActiveUser = setActiveUser as jest.Mock;

const ALICE: User = {
  id: "user-alice",
  email: "alice@scribl.test",
  displayName: "Alice",
  createdAt: "2026-07-01T00:00:00.000Z",
};

const BOB: User = {
  id: "user-bob",
  email: "bob@scribl.test",
  displayName: "Bob",
  createdAt: "2026-07-01T00:00:00.000Z",
};

describe("useAuthStore", () => {
  beforeEach(async () => {
    useAuthStore.setState({ currentUser: null, loading: false, error: null });
    mockSignUp.mockReset();
    mockLogin.mockReset();
    mockListUsers.mockReset();
    mockSetActiveUser.mockReset();
    await AsyncStorage.clear();
    process.env.EXPO_PUBLIC_RESTORE_SESSION = "1";
  });

  it("signUp() sets currentUser, calls setActiveUser(user.id), and clears error/loading", async () => {
    mockSignUp.mockResolvedValueOnce(ALICE);

    await useAuthStore.getState().signUp("alice@scribl.test", "Alice");

    expect(mockSignUp).toHaveBeenCalledWith("alice@scribl.test", "Alice");
    expect(mockSetActiveUser).toHaveBeenCalledWith("user-alice");
    expect(getAuthStoreState().currentUser).toEqual(ALICE);
    expect(getAuthStoreState().loading).toBe(false);
    expect(getAuthStoreState().error).toBeNull();
  });

  it("signUp() failure sets error and leaves currentUser null", async () => {
    mockSignUp.mockRejectedValueOnce(new Error("email taken"));

    await useAuthStore.getState().signUp("alice@scribl.test", "Alice");

    expect(getAuthStoreState().error).toBe("email taken");
    expect(getAuthStoreState().currentUser).toBeNull();
    expect(mockSetActiveUser).not.toHaveBeenCalled();
  });

  it("login() sets currentUser and calls setActiveUser(user.id)", async () => {
    mockLogin.mockResolvedValueOnce(BOB);

    await useAuthStore.getState().login("bob@scribl.test", "Bob");

    expect(mockLogin).toHaveBeenCalledWith("bob@scribl.test", "Bob");
    expect(mockSetActiveUser).toHaveBeenCalledWith("user-bob");
    expect(getAuthStoreState().currentUser).toEqual(BOB);
  });

  it("login() with mismatched credentials sets the error and leaves currentUser null", async () => {
    mockLogin.mockRejectedValueOnce(new UserNotFoundError());

    await useAuthStore.getState().login("bob@scribl.test", "Wrong Name");

    expect(getAuthStoreState().error).toBe("No account matches that email and name.");
    expect(getAuthStoreState().currentUser).toBeNull();
    expect(mockSetActiveUser).not.toHaveBeenCalled();
  });

  it("sign-out then sign-in with the same credentials round-trips currentUser", async () => {
    mockLogin.mockResolvedValue(BOB);

    await useAuthStore.getState().login("bob@scribl.test", "Bob");
    expect(getAuthStoreState().currentUser).toEqual(BOB);

    await useAuthStore.getState().logout();
    expect(getAuthStoreState().currentUser).toBeNull();

    await useAuthStore.getState().login("bob@scribl.test", "Bob");
    expect(getAuthStoreState().currentUser).toEqual(BOB);
  });

  it("switchUser() sets currentUser and calls setActiveUser(user.id) without calling the data client", async () => {
    await useAuthStore.getState().switchUser(ALICE);

    expect(mockSetActiveUser).toHaveBeenCalledWith("user-alice");
    expect(getAuthStoreState().currentUser).toEqual(ALICE);
    expect(mockSignUp).not.toHaveBeenCalled();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it("logout() clears currentUser and calls setActiveUser(null)", async () => {
    useAuthStore.setState({ currentUser: ALICE, loading: false, error: null });

    await useAuthStore.getState().logout();

    expect(mockSetActiveUser).toHaveBeenCalledWith(null);
    expect(getAuthStoreState().currentUser).toBeNull();
  });

  it("listUsers() relays dataClient.listUsers()", async () => {
    mockListUsers.mockResolvedValueOnce([ALICE, BOB]);

    const result = await useAuthStore.getState().listUsers();

    expect(result).toEqual([ALICE, BOB]);
  });

  it("hydrate() with no persisted session leaves currentUser null and never calls listUsers", async () => {
    await useAuthStore.getState().hydrate();

    expect(mockListUsers).not.toHaveBeenCalled();
    expect(getAuthStoreState().currentUser).toBeNull();
    expect(getAuthStoreState().loading).toBe(false);
  });

  it("hydrate() restores currentUser from the persisted full user object and calls setActiveUser(user.id) without listUsers", async () => {
    await AsyncStorage.setItem("scribl:currentUser", JSON.stringify(ALICE));

    await useAuthStore.getState().hydrate();

    expect(getAuthStoreState().currentUser).toEqual(ALICE);
    expect(mockSetActiveUser).toHaveBeenCalledWith("user-alice");
    expect(mockListUsers).not.toHaveBeenCalled();
  });

  it("hydrate() with a corrupt/legacy persisted value drops it and leaves currentUser null without calling setActiveUser", async () => {
    // Legacy format stored a bare id string, not a full user object.
    await AsyncStorage.setItem("scribl:currentUser", "user-legacy");

    await useAuthStore.getState().hydrate();

    expect(getAuthStoreState().currentUser).toBeNull();
    expect(mockSetActiveUser).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem("scribl:currentUser")).toBeNull();
  });

  it("hydrate() with EXPO_PUBLIC_RESTORE_SESSION unset does not restore a persisted session", async () => {
    delete process.env.EXPO_PUBLIC_RESTORE_SESSION;
    try {
      await AsyncStorage.setItem("scribl:currentUser", JSON.stringify(ALICE));

      await useAuthStore.getState().hydrate();

      expect(getAuthStoreState().currentUser).toBeNull();
      expect(getAuthStoreState().hydrated).toBe(true);
      expect(mockSetActiveUser).not.toHaveBeenCalled();
    } finally {
      process.env.EXPO_PUBLIC_RESTORE_SESSION = "1";
    }
  });
});
