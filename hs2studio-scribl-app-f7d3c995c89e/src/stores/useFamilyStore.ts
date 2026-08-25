import type { ChannelMember, ChannelResponse } from "@scribl/shared/index";
import { create } from "zustand";

import { dataClient } from "@/src/data";
import { NotSubmittedError } from "@/src/data/client";

/** Per-day slice of the family wall: one prompt's members/lock/error state. */
export interface FamilyDayState {
  members: ChannelMember[];
  loading: boolean;
  error: string | null;
  locked: boolean;
}

const EMPTY_DAY: FamilyDayState = { members: [], loading: false, error: null, locked: false };

/** A channel's day list metadata, as returned by dataClient.listChannelDays. */
export interface ChannelDayMeta {
  promptId: string;
  isoDate: string;
  responseCount: number;
}

interface FamilyState {
  members: ChannelMember[];
  loading: boolean;
  error: string | null;
  locked: boolean;
  /** Loads a channel's members (and today's drawn status) via the data client seam. */
  load: (channelId: string, promptId: string) => Promise<void>;
  /**
   * Per-channel, per-prompt-day results: byDay[channelId][promptId]. Scoped
   * by channel (not flat) so a submit in one wall can never bleed stale/
   * cross-channel member data into another wall's grid.
   */
  byDay: Record<string, Record<string, FamilyDayState>>;
  /** Loads several prompt-days' members in parallel via the data client seam. */
  loadDays: (channelId: string, promptIds: string[]) => Promise<void>;
  /** Convenience read: byDay[channelId] ?? {} - callers use this instead of indexing byDay directly. */
  daysForChannel: (channelId: string) => Record<string, FamilyDayState>;
  /** Day-list metadata (no peer content, AC4-gated only), keyed by channelId. */
  daysByChannel: Record<string, ChannelDayMeta[]>;
  daysLoading: boolean;
  daysError: string | null;
  /** Loads a channel's day list (newest-first) via dataClient.listChannelDays. */
  loadChannelDays: (channelId: string) => Promise<void>;
  /**
   * Patches a single member's cached response in byDay[channelId][promptId]
   * (e.g. after an edit/regenerate on the response-detail screen), so the
   * gallery grid doesn't show stale caption/enhanced-image data. No-op if
   * the channel, day, or matching member isn't loaded.
   */
  patchResponse: (channelId: string, promptId: string, response: ChannelResponse) => void;
}

/**
 * Family (group channel) members store. The Family screen reads only from
 * here, never calling the data client directly. Server-enforced
 * submit-to-unlock (AC2) is relayed as `locked`; never gated locally.
 */
export const useFamilyStore = create<FamilyState>((set) => ({
  members: [],
  loading: false,
  error: null,
  locked: false,
  byDay: {},
  daysByChannel: {},
  daysLoading: false,
  daysError: null,
  loadChannelDays: async (channelId: string): Promise<void> => {
    set({ daysLoading: true, daysError: null });
    try {
      const days = await dataClient.listChannelDays(channelId);
      set((state) => ({
        daysByChannel: { ...state.daysByChannel, [channelId]: days },
        daysLoading: false,
      }));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Failed to load days.";
      set({ daysError: message, daysLoading: false });
    }
  },
  load: async (channelId: string, promptId: string): Promise<void> => {
    set({ loading: true, error: null, locked: false });
    try {
      const members = await dataClient.getChannelMembers(channelId, promptId);
      set({ members, loading: false });
    } catch (caught) {
      if (caught instanceof NotSubmittedError) {
        set({ locked: true, loading: false, error: caught.message });
        return;
      }
      const message = caught instanceof Error ? caught.message : "Failed to load channel members.";
      set({ error: message, loading: false });
    }
  },
  daysForChannel: (channelId: string): Record<string, FamilyDayState> => {
    return useFamilyStore.getState().byDay[channelId] ?? {};
  },
  loadDays: async (channelId: string, promptIds: string[]): Promise<void> => {
    set((state) => {
      const channelDays = { ...(state.byDay[channelId] ?? {}) };
      for (const promptId of promptIds) {
        channelDays[promptId] = { ...(channelDays[promptId] ?? EMPTY_DAY), loading: true, error: null, locked: false };
      }
      return { byDay: { ...state.byDay, [channelId]: channelDays } };
    });

    await Promise.all(
      promptIds.map(async (promptId) => {
        try {
          const members = await dataClient.getChannelMembers(channelId, promptId);
          set((state) => ({
            byDay: {
              ...state.byDay,
              [channelId]: {
                ...(state.byDay[channelId] ?? {}),
                [promptId]: { members, loading: false, error: null, locked: false },
              },
            },
          }));
        } catch (caught) {
          if (caught instanceof NotSubmittedError) {
            set((state) => ({
              byDay: {
                ...state.byDay,
                [channelId]: {
                  ...(state.byDay[channelId] ?? {}),
                  [promptId]: { members: [], loading: false, error: caught.message, locked: true },
                },
              },
            }));
            return;
          }
          const message = caught instanceof Error ? caught.message : "Failed to load channel members.";
          set((state) => ({
            byDay: {
              ...state.byDay,
              [channelId]: {
                ...(state.byDay[channelId] ?? {}),
                [promptId]: { members: [], loading: false, error: message, locked: false },
              },
            },
          }));
        }
      })
    );
  },
  patchResponse: (channelId: string, promptId: string, response: ChannelResponse): void => {
    set((state) => {
      const channelDays = state.byDay[channelId];
      const day = channelDays?.[promptId];
      if (!day) return state;
      let changed = false;
      const members = day.members.map((member) => {
        const matches = member.response?.id === response.id || member.userId === response.authorId;
        if (!matches) return member;
        changed = true;
        return { ...member, response };
      });
      if (!changed) return state;
      return {
        byDay: {
          ...state.byDay,
          [channelId]: { ...channelDays, [promptId]: { ...day, members } },
        },
      };
    });
  },
}));
