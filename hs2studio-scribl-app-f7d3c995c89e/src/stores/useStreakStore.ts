import type { IsoDate } from "@scribl/shared/index";
import { create } from "zustand";

import { dataClient } from "@/src/data";

/** Real current date (UTC, YYYY-MM-DD) — matches backend today-prompt.ts. */
const TODAY: IsoDate = new Date().toISOString().slice(0, 10);

interface StreakState {
  current: number;
  lastSubmittedDate?: IsoDate;
  loading: boolean;
  error: string | null;
  /** Loads (or reloads) the streak via the data client seam. */
  load: () => Promise<void>;
  /**
   * Wiring point for when submit is connected to the client (S-003 client
   * integration) — not called from any screen in this slice.
   */
  recordSubmission: () => Promise<void>;
}

/**
 * Streak store. Screens read only from here, never calling the data client
 * directly. Keep loading/error states explicit so the badge never renders
 * blank or crashes.
 */
export const useStreakStore = create<StreakState>((set, get) => ({
  current: 0,
  lastSubmittedDate: undefined,
  loading: false,
  error: null,
  load: async (): Promise<void> => {
    set({ loading: true, error: null });
    try {
      const streak = await dataClient.getStreak();
      set({ current: streak.current, lastSubmittedDate: streak.lastSubmittedDate, loading: false });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Failed to load streak.";
      set({ error: message, loading: false });
    }
  },
  recordSubmission: async (): Promise<void> => {
    await dataClient.recordSubmission(TODAY);
    await get().load();
  },
}));
