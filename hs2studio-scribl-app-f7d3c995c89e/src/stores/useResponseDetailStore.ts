import type { ChannelResponse } from "@scribl/shared/index";
import { create } from "zustand";

import { dataClient } from "@/src/data";
import { NotSubmittedError } from "@/src/data/client";
import { useFamilyStore } from "@/src/stores/useFamilyStore";

/** Bounded polling knobs for the "pending" enhancement state (T5). */
export const ENHANCEMENT_POLL_MS = 3_000;
export const ENHANCEMENT_POLL_MAX_ATTEMPTS = 10;

/**
 * Pure decision helper for whether polling should continue: true only while
 * the response is still "pending" and the attempt cap hasn't been hit.
 * Kept pure/exported so the bounded-polling behavior is unit-testable
 * without fake timers on the store itself.
 */
export function shouldContinuePolling(
  status: ChannelResponse["enhancementStatus"] | undefined,
  attempts: number,
): boolean {
  return status === "pending" && attempts < ENHANCEMENT_POLL_MAX_ATTEMPTS;
}

interface ResponseDetailState {
  data: ChannelResponse | null;
  loading: boolean;
  error: string | null;
  locked: boolean;
  /** Number of enhancement polls performed for the currently loaded response. */
  pollAttempts: number;
  /**
   * Loads a single response's detail for a prompt via the data client seam.
   * `silent` (used by the background enhancement poll) skips toggling the
   * global `loading` flag so the mounted screen doesn't unmount/remount and
   * lose focus every poll cycle (BF-7).
   */
  load: (
    channelId: string,
    promptId: string,
    responseId: string,
    opts?: { silent?: boolean },
  ) => Promise<void>;
  /**
   * Adds a reaction via the data client, then reflects the server's echo
   * directly into `data` (no client-side gate substitutes for the server's
   * 403s here - errors surface via `error`).
   */
  addReaction: (
    channelId: string,
    promptId: string,
    responseId: string,
    emoji: string,
  ) => Promise<void>;
  /**
   * Bounded poll: re-invokes `load` on a timer while `enhancementStatus` is
   * "pending", up to `ENHANCEMENT_POLL_MAX_ATTEMPTS` attempts, then stops.
   * Returns a cleanup function the caller (screen) must invoke on
   * unmount/terminal state, mirroring app/challenge/[id].tsx's interval.
   */
  startEnhancementPolling: (
    channelId: string,
    promptId: string,
    responseId: string,
  ) => () => void;
  /**
   * Owner-only edit: PATCHes caption/backgroundPrompt (no regenerate) and
   * reflects the server's echo into `data`. Server enforces ownership; this
   * only relays the result / surfaces failures via `error`.
   */
  updateResponse: (
    channelId: string,
    promptId: string,
    responseId: string,
    patch: { text?: string; backgroundPrompt?: string },
  ) => Promise<void>;
  /**
   * Owner-only re-enhancement: PATCHes with regenerate:true, then restarts
   * the bounded enhancement poll (startEnhancementPolling) so the screen
   * picks up the new background once it lands. Returns the poll's cleanup
   * function (mirrors startEnhancementPolling) so the caller can wire it into
   * its own effect/unmount handling.
   */
  regenerate: (
    channelId: string,
    promptId: string,
    responseId: string,
    patch: { text?: string; backgroundPrompt?: string },
  ) => Promise<() => void>;
}

/**
 * Response-detail store. The response detail screen reads only from here,
 * never calling the data client directly. The server enforces
 * submit-to-unlock (AC2) and channel membership (AC4); this store only
 * relays a 403 as `locked`, never substituting a client-side gate.
 */
export const useResponseDetailStore = create<ResponseDetailState>((set, get) => ({
  data: null,
  loading: false,
  error: null,
  locked: false,
  pollAttempts: 0,
  load: async (
    channelId: string,
    promptId: string,
    responseId: string,
    opts?: { silent?: boolean },
  ): Promise<void> => {
    const silent = opts?.silent ?? false;
    if (!silent) set({ loading: true, error: null, locked: false });
    try {
      const data = await dataClient.getResponse(channelId, promptId, responseId);
      set(silent ? { data } : { data, loading: false });
      if (silent && data.enhancementStatus === "ready") {
        useFamilyStore.getState().patchResponse(channelId, promptId, data);
      }
    } catch (caught) {
      if (caught instanceof NotSubmittedError) {
        set(silent ? { locked: true, error: caught.message } : { locked: true, loading: false, error: caught.message });
        return;
      }
      const message = caught instanceof Error ? caught.message : "Failed to load the response.";
      set(silent ? { error: message } : { error: message, loading: false });
    }
  },
  addReaction: async (
    channelId: string,
    promptId: string,
    responseId: string,
    emoji: string,
  ): Promise<void> => {
    if (!get().data) return;
    try {
      const data = await dataClient.addReaction(channelId, promptId, responseId, emoji);
      set({ data });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Failed to add reaction.";
      set({ error: message });
    }
  },
  startEnhancementPolling: (
    channelId: string,
    promptId: string,
    responseId: string,
  ): (() => void) => {
    set({ pollAttempts: 0 });
    let attempts = 0;
    const intervalId = setInterval(() => {
      attempts += 1;
      set({ pollAttempts: attempts });
      const status = get().data?.enhancementStatus;
      if (!shouldContinuePolling(status, attempts - 1)) {
        clearInterval(intervalId);
        // Poll exhausted while still "pending": stop waiting and fall back to
        // the original image instead of spinning forever (BF-6).
        const current = get().data;
        if (current?.enhancementStatus === "pending") {
          set({ data: { ...current, enhancementStatus: "failed" } });
        }
        return;
      }
      void get().load(channelId, promptId, responseId, { silent: true });
    }, ENHANCEMENT_POLL_MS);
    return () => clearInterval(intervalId);
  },
  updateResponse: async (
    channelId: string,
    promptId: string,
    responseId: string,
    patch: { text?: string; backgroundPrompt?: string },
  ): Promise<void> => {
    try {
      const data = await dataClient.updateResponse(channelId, promptId, responseId, patch);
      set({ data, error: null });
      useFamilyStore.getState().patchResponse(channelId, promptId, data);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Failed to save.";
      set({ error: message });
      throw caught;
    }
  },
  regenerate: async (
    channelId: string,
    promptId: string,
    responseId: string,
    patch: { text?: string; backgroundPrompt?: string },
  ): Promise<() => void> => {
    try {
      const data = await dataClient.updateResponse(channelId, promptId, responseId, {
        ...patch,
        regenerate: true,
      });
      set({ data, error: null });
      useFamilyStore.getState().patchResponse(channelId, promptId, data);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Failed to regenerate.";
      set({ error: message });
      throw caught;
    }
    return get().startEnhancementPolling(channelId, promptId, responseId);
  },
}));
