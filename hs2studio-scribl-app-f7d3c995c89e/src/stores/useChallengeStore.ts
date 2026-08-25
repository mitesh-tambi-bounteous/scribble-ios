import type { ChallengeDetail } from "@scribl/shared/index";
import { create } from "zustand";

import { dataClient } from "@/src/data";
import { NotSubmittedError } from "@/src/data/client";

interface ChallengeState {
  detail: ChallengeDetail | null;
  loading: boolean;
  error: string | null;
  locked: boolean;
  /**
   * Loads a single challenge's detail via the data client seam. A
   * NotSubmittedError (revealed-but-caller-did-not-enter, AC2) sets
   * `locked = true` and clears `detail`. The blind, still-open state is a
   * normal detail (`state === "open"`, `entries: []`), never `locked`.
   *
   * Pass `{ background: true }` for a silent poll refresh: it does NOT flip
   * `loading` (so the screen never unmounts the live canvas mid-draw) and
   * leaves the current detail in place if the refetch fails.
   */
  load: (challengeId: string, options?: { background?: boolean }) => Promise<void>;
  /** Submits the caller's entry, then reloads the detail. */
  submitEntry: (challengeId: string, imageRef?: string) => Promise<void>;
  /** Rates another member's entry, then reloads the detail. */
  rate: (challengeId: string, entryId: string, stars: number) => Promise<void>;
}

/**
 * Single-challenge detail store. The challenge-detail screen reads only
 * from here, never calling the data client directly. Server-enforced
 * invariants (submit-to-unlock, reveal timing) are only ever relayed, never
 * substituted with a client-side gate.
 */
export const useChallengeStore = create<ChallengeState>((set, get) => ({
  detail: null,
  loading: false,
  error: null,
  locked: false,
  load: async (challengeId: string, options?: { background?: boolean }): Promise<void> => {
    const background = options?.background ?? false;
    // A background poll must not flip `loading` — the challenge screen gates the
    // live drawing canvas on `!loading`, so toggling it mid-draw unmounts the
    // canvas and wipes the in-progress art.
    if (!background) set({ loading: true, error: null, locked: false });
    try {
      const detail = await dataClient.getChallengeDetail(challengeId);
      set({ detail, loading: false, error: null, locked: false });
    } catch (caught) {
      // On a silent refresh failure, keep the current detail/state rather than
      // wiping to a locked/error screen out from under the user.
      if (background) return;
      if (caught instanceof NotSubmittedError) {
        set({ locked: true, detail: null, loading: false, error: caught.message });
        return;
      }
      const message = caught instanceof Error ? caught.message : "Failed to load the challenge.";
      set({ error: message, loading: false });
    }
  },
  submitEntry: async (challengeId: string, imageRef?: string): Promise<void> => {
    await dataClient.submitChallengeEntry(challengeId, imageRef);
    await get().load(challengeId);
  },
  rate: async (challengeId: string, entryId: string, stars: number): Promise<void> => {
    await dataClient.rateChallengeEntry(challengeId, entryId, stars);
    await get().load(challengeId);
  },
}));
