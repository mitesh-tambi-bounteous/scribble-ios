/**
 * WS1 reproduce-first: real auth session persistence + x-user-id after login.
 *
 * Reproduces the session-survival bug: after signUp -> logout -> login, a
 * simulated app reload (hydrate) must restore currentUser and the active
 * user id WITHOUT relying on dataClient.listUsers(). Also asserts the http
 * client attaches x-user-id once the session is active.
 *
 * The dataClient seam is mocked; the active-user seam is REAL so the http
 * adapter and the store share one instance (that is the point of the check).
 */

jest.mock("@/src/data", () => ({
  dataClient: {
    signUp: jest.fn(),
    login: jest.fn(),
    listUsers: jest.fn(),
  },
}));

jest.mock(
  "@react-native-async-storage/async-storage",
  () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { User } from "@scribl/shared/index";

import { dataClient } from "@/src/data";
import { getActiveUserId, setActiveUser } from "@/src/data/active-user";
import { getAuthStoreState, useAuthStore } from "@/src/stores/useAuthStore";

const mockSignUp = dataClient.signUp as jest.Mock;
const mockLogin = dataClient.login as jest.Mock;
const mockListUsers = dataClient.listUsers as jest.Mock;

const ALICE: User = {
  id: "user-alice",
  email: "alice@scribl.test",
  displayName: "Alice",
  createdAt: "2026-07-01T00:00:00.000Z",
};

beforeAll(() => {
  process.env.EXPO_PUBLIC_API_BASE_URL = "https://api.test";
  process.env.EXPO_PUBLIC_RESTORE_SESSION = "1";
});

describe("auth session persistence (WS1)", () => {
  beforeEach(async () => {
    useAuthStore.setState({ currentUser: null, loading: false, error: null, hydrated: false });
    setActiveUser(null);
    mockSignUp.mockReset();
    mockLogin.mockReset();
    mockListUsers.mockReset();
    await AsyncStorage.clear();
    delete (globalThis as { fetch?: unknown }).fetch;
  });

  it("signUp -> logout -> login -> reload restores the session without listUsers, and http sends x-user-id", async () => {
    mockSignUp.mockResolvedValueOnce(ALICE);
    mockLogin.mockResolvedValueOnce(ALICE);
    // A reload must NOT depend on this: keep it empty to prove independence.
    mockListUsers.mockResolvedValue([]);

    await useAuthStore.getState().signUp("alice@scribl.test", "Alice");
    await useAuthStore.getState().logout();
    await useAuthStore.getState().login("alice@scribl.test", "Alice");

    expect(getAuthStoreState().currentUser).toEqual(ALICE);
    expect(getActiveUserId()).toBe("user-alice");

    // Simulate an app reload: in-memory store + active-user cleared, storage
    // survives.
    setActiveUser(null);
    useAuthStore.setState({ currentUser: null, hydrated: false, loading: false, error: null });

    await useAuthStore.getState().hydrate();

    expect(mockListUsers).not.toHaveBeenCalled();
    expect(getAuthStoreState().currentUser).toEqual(ALICE);
    expect(getActiveUserId()).toBe("user-alice");

    // The http adapter reads the (now-restored) active user seam and attaches
    // the x-user-id header on authenticated routes.
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ members: [] }),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const { httpDataClient } = require("@/src/data/http");
    await httpDataClient.getChannelMembers("channel-1", "prompt-x");

    const [, init] = mockFetch.mock.calls[0];
    expect((init.headers as Record<string, string>)["x-user-id"]).toBe("user-alice");
  });
});
