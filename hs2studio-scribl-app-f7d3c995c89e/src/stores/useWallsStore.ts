import type { Channel, CreateWallRequest } from "@scribl/shared/index";
import { create } from "zustand";

import { dataClient } from "@/src/data";
import { useAuthStore } from "@/src/stores/useAuthStore";

export type WallKind = Channel["kind"];

/**
 * UI view-model over the shared Channel type. `membersDrew`/`membersWaiting`
 * are presentation-only counters not yet backed by a server invariant; kept
 * undefined until a real endpoint exists so the UI degrades gracefully.
 */
export interface Wall extends Channel {
  membersDrew?: number;
  membersWaiting?: number;
}

function toWall(channel: Channel): Wall {
  return { ...channel };
}

interface WallsState {
  walls: Wall[];
  loading: boolean;
  error: string | null;
  /** The channel createWall() most recently created, on success. Lets
   * callers (e.g. app/create-wall.tsx) chain a follow-up call like
   * inviteMember() against the new channel's real id without changing
   * createWall()'s existing boolean-resolve contract. */
  lastCreatedWall: Channel | null;
  /** Loads the current user's walls via the data client seam. */
  load: () => Promise<void>;
  /**
   * Creates a wall via the data client, then refreshes the list. Resolves
   * to true on success, false on failure (error is also set on state so
   * callers can surface it instead of silently navigating away).
   */
  createWall: (input: CreateWallRequest) => Promise<boolean>;
}

/**
 * Walls store — real data via dataClient.listWalls/createWall, scoped to the
 * current user (src/stores/useAuthStore.ts). No client-side membership
 * gating; that stays server-side (AC4).
 */
export const useWallsStore = create<WallsState>((set, get) => ({
  walls: [],
  loading: false,
  error: null,
  lastCreatedWall: null,
  load: async (): Promise<void> => {
    const userId = useAuthStore.getState().currentUser?.id;
    if (!userId) {
      set({ walls: [], error: null });
      return;
    }
    set({ loading: true, error: null });
    try {
      const walls = await dataClient.listWalls(userId);
      set({ walls: walls.map(toWall), loading: false });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Failed to load walls.";
      set({ error: message, loading: false });
    }
  },
  createWall: async (input: CreateWallRequest): Promise<boolean> => {
    set({ loading: true, error: null });
    try {
      const wall = await dataClient.createWall(input);
      set({ lastCreatedWall: wall });
      await get().load();
      return true;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Failed to create wall.";
      set({ error: message, loading: false });
      return false;
    }
  },
}));
