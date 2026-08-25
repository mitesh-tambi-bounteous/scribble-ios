import AsyncStorage from "@react-native-async-storage/async-storage";
import type { UpdateUserRequest, User } from "@scribl/shared/index";
import { create } from "zustand";

import { dataClient } from "@/src/data";
import { setActiveUser } from "@/src/data/active-user";
import { UserNotFoundError } from "@/src/data/client";

/**
 * Persisted key for the signed-in user (POC stubbed auth). Stores the FULL
 * user object so the session survives reload without a server round-trip.
 */
const CURRENT_USER_KEY = "scribl:currentUser";

interface AuthState {
  currentUser: User | null;
  loading: boolean;
  error: string | null;
  /** True once hydrate() has completed (success or failure). Boot gate. */
  hydrated: boolean;
  /** Creates a new user via the data client and signs them in. */
  signUp: (email: string, displayName: string) => Promise<void>;
  /** Signs in an existing user, validating both email and displayName. */
  login: (email: string, displayName: string) => Promise<void>;
  /** Lists all registered users (POC multi-user switcher). */
  listUsers: () => Promise<User[]>;
  /** Switches the active session to an already-known user. */
  switchUser: (user: User) => Promise<void>;
  /** Clears the active session. */
  logout: () => Promise<void>;
  /** Updates the signed-in user's profile (name/email/avatarColor). */
  updateProfile: (patch: UpdateUserRequest) => Promise<boolean>;
  /** Re-hydrates currentUser from AsyncStorage + the user list on boot. */
  hydrate: () => Promise<void>;
}

async function persistCurrentUser(user: User | null): Promise<void> {
  try {
    if (user) {
      const persisted: User = {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        createdAt: user.createdAt,
        ...(user.avatarColor !== undefined ? { avatarColor: user.avatarColor } : {}),
        ...(user.avatarImage !== undefined ? { avatarImage: user.avatarImage } : {}),
      };
      await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(persisted));
    } else {
      await AsyncStorage.removeItem(CURRENT_USER_KEY);
    }
  } catch {
    // Persistence is best-effort; the in-memory session still applies.
  }
}

/**
 * Validates a value parsed from storage is a full User. Defensive: a corrupt
 * or legacy (id-only string) value must NOT restore a wrong session.
 */
function isPersistedUser(value: unknown): value is User {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    typeof candidate.email === "string" &&
    typeof candidate.displayName === "string" &&
    typeof candidate.createdAt === "string" &&
    (candidate.avatarColor === undefined || typeof candidate.avatarColor === "string") &&
    (candidate.avatarImage === undefined || typeof candidate.avatarImage === "string")
  );
}

/**
 * Auth store (stubbed, no passwords). Screens read only from here, never
 * calling the data client directly. On any sign-in/switch this also updates
 * the module-scope active-user seam (src/data/active-user.ts) so the http
 * adapter can attach the x-user-id header.
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  currentUser: null,
  loading: false,
  error: null,
  hydrated: false,

  signUp: async (email: string, displayName: string): Promise<void> => {
    set({ loading: true, error: null });
    try {
      const user = await dataClient.signUp(email, displayName);
      setActiveUser(user.id);
      await persistCurrentUser(user);
      set({ currentUser: user, loading: false });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Failed to sign up.";
      set({ error: message, loading: false });
    }
  },

  login: async (email: string, displayName: string): Promise<void> => {
    set({ loading: true, error: null });
    try {
      const user = await dataClient.login(email, displayName);
      setActiveUser(user.id);
      await persistCurrentUser(user);
      set({ currentUser: user, loading: false });
    } catch (caught) {
      const message =
        caught instanceof UserNotFoundError
          ? "No account matches that email and name."
          : caught instanceof Error
            ? caught.message
            : "Failed to log in.";
      set({ error: message, loading: false });
    }
  },

  listUsers: async (): Promise<User[]> => {
    try {
      return await dataClient.listUsers();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Failed to list users.";
      set({ error: message });
      return [];
    }
  },

  switchUser: async (user: User): Promise<void> => {
    setActiveUser(user.id);
    await persistCurrentUser(user);
    set({ currentUser: user, error: null });
  },

  logout: async (): Promise<void> => {
    setActiveUser(null);
    await persistCurrentUser(null);
    set({ currentUser: null });
  },

  updateProfile: async (patch: UpdateUserRequest): Promise<boolean> => {
    const { currentUser } = get();
    if (!currentUser) {
      set({ error: "No signed-in user to update." });
      return false;
    }
    set({ loading: true, error: null });
    try {
      const user = await dataClient.updateUser(currentUser.id, patch);
      setActiveUser(user.id);
      await persistCurrentUser(user);
      set({ currentUser: user, loading: false });
      return true;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Failed to update profile.";
      set({ error: message, loading: false });
      return false;
    }
  },

  hydrate: async (): Promise<void> => {
    set({ loading: true, error: null });
    const restoreEnabled = process.env.EXPO_PUBLIC_RESTORE_SESSION === "1";
    if (!restoreEnabled) {
      // Auto-restore intentionally disabled by default so the app always opens
      // on the Login screen (index.tsx redirects when currentUser is null).
      // The restore path below is kept, not deleted — set
      // EXPO_PUBLIC_RESTORE_SESSION=1 to bring persisted auto-login back.
      set({ currentUser: null, loading: false, hydrated: true });
      return;
    }
    try {
      const raw = await AsyncStorage.getItem(CURRENT_USER_KEY);
      if (!raw) {
        set({ loading: false, hydrated: true });
        return;
      }
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
      if (!isPersistedUser(parsed)) {
        // Corrupt or legacy value: drop it rather than restore a wrong session.
        await persistCurrentUser(null);
        set({ currentUser: null, loading: false, hydrated: true });
        return;
      }
      // Restore the full session locally, no server round-trip required.
      setActiveUser(parsed.id);
      set({ currentUser: parsed, loading: false, hydrated: true });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Failed to restore session.";
      set({ error: message, loading: false, hydrated: true });
    }
  },
}));

/** Test-only accessor mirroring the pattern of other stores' reset helpers. */
export function getAuthStoreState(): AuthState {
  return useAuthStore.getState();
}
