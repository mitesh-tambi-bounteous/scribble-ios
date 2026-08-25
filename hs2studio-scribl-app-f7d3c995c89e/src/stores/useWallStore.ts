import type { ChannelResponse, ChannelResponsesResponse } from "@scribl/shared/index";
import { create } from "zustand";

import { dataClient } from "@/src/data";
import { NotSubmittedError } from "@/src/data/client";

interface WallState {
  data: ChannelResponsesResponse | null;
  loading: boolean;
  error: string | null;
  locked: boolean;
  /** Loads the channel wall for a prompt via the data client seam. */
  load: (channelId: string, promptId: string) => Promise<void>;
  /** Flat gallery of a Personal Archive channel's responses across all known prompt-days. */
  archiveResponses: ChannelResponse[];
  archiveLoading: boolean;
  /**
   * Loads a Personal Archive channel's responses across `promptIds` (no
   * day-grouping, unlimited draws - the archive is exempt from
   * submit-to-unlock server-side) and merges them into one flat list.
   * Per-day 403s (not yet drawn that day) are skipped, never surfaced as an
   * error - the archive simply shows whatever exists.
   */
  loadArchive: (channelId: string, promptIds: string[]) => Promise<void>;
  /** Adds a reaction to a response and reflects the server's echo locally. */
  react: (
    channelId: string,
    promptId: string,
    responseId: string,
    emoji: string,
  ) => Promise<void>;
}

/**
 * Channel-wall store. The Wall screen reads only from here, never calling the
 * data client directly. The server enforces submit-to-unlock (AC2) and
 * channel membership (AC4); this store only relays a 403 as `locked`, never
 * substituting a client-side gate.
 */
export const useWallStore = create<WallState>((set, get) => ({
  data: null,
  loading: false,
  error: null,
  locked: false,
  archiveResponses: [],
  archiveLoading: false,
  loadArchive: async (channelId: string, promptIds: string[]): Promise<void> => {
    set({ archiveLoading: true });
    const results = await Promise.all(
      promptIds.map(async (promptId) => {
        try {
          const data = await dataClient.getChannelResponses(channelId, promptId);
          return data.responses;
        } catch {
          // Not-submitted (or any other) failure for that day: skip it, the
          // archive gallery just shows whatever exists.
          return [];
        }
      }),
    );
    const merged = new Map<string, ChannelResponse>();
    for (const responses of results) {
      for (const response of responses) {
        merged.set(response.id, response);
      }
    }
    // Newest-first, so the archive gallery reads most-recent-doodle-first
    // regardless of the order the per-day fetches settled in.
    const sorted = Array.from(merged.values()).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    set({ archiveResponses: sorted, archiveLoading: false });
  },
  load: async (channelId: string, promptId: string): Promise<void> => {
    set({ loading: true, error: null, locked: false });
    try {
      const data = await dataClient.getChannelResponses(channelId, promptId);
      set({ data, loading: false });
    } catch (caught) {
      if (caught instanceof NotSubmittedError) {
        set({ locked: true, loading: false, error: caught.message });
        return;
      }
      const message = caught instanceof Error ? caught.message : "Failed to load the wall.";
      set({ error: message, loading: false });
    }
  },
  react: async (
    channelId: string,
    promptId: string,
    responseId: string,
    emoji: string,
  ): Promise<void> => {
    const { data } = get();
    if (!data) return;
    try {
      const updatedResponse = await dataClient.addReaction(channelId, promptId, responseId, emoji);
      const responses = data.responses.map((response) =>
        response.id === updatedResponse.id ? updatedResponse : response,
      );
      set({ data: { ...data, responses } });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Failed to add reaction.";
      set({ error: message });
    }
  },
}));
