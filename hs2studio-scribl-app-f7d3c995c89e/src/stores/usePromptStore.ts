import type { TodayPromptResponse } from "@scribl/shared/index";
import { create } from "zustand";

import { dataClient } from "@/src/data";

interface PromptState {
  data: TodayPromptResponse | null;
  loading: boolean;
  error: string | null;
  /** Loads (or reloads) today's prompt via the data client seam. */
  load: () => Promise<void>;
  /**
   * Cache of past-day prompt text, keyed by "YYYY-MM-DD". `null` means the
   * lookup completed and there is no prompt for that date (never crash,
   * just omit the text) - undefined (key absent) means not yet fetched.
   */
  promptsByDate: Record<string, { text: string } | null>;
  /** Loads (and caches) a single day's prompt text via the data client seam. */
  loadPromptByDate: (date: string) => Promise<void>;
}

/**
 * Today's-prompt store. The Today screen reads only from here, never calling
 * the data client directly. Keep loading/error/data states explicit so the
 * screen never renders blank or crashes.
 */
export const usePromptStore = create<PromptState>((set, get) => ({
  data: null,
  loading: false,
  error: null,
  promptsByDate: {},
  load: async (): Promise<void> => {
    set({ loading: true, error: null });
    try {
      const data = await dataClient.getTodayPrompt();
      set({ data, loading: false });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Failed to load today's prompt.";
      set({ error: message, loading: false });
    }
  },
  loadPromptByDate: async (date: string): Promise<void> => {
    if (date in get().promptsByDate) {
      return;
    }
    try {
      const prompt = await dataClient.getPromptByDate(date);
      set((state) => ({
        promptsByDate: {
          ...state.promptsByDate,
          [date]: prompt ? { text: prompt.text } : null,
        },
      }));
    } catch {
      // Resilient by design: a failed by-date lookup just omits the text.
      set((state) => ({
        promptsByDate: { ...state.promptsByDate, [date]: null },
      }));
    }
  },
}));
