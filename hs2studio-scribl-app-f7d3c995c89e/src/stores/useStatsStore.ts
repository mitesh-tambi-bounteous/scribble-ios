import type { MilestoneBadge, WeeklyCompletionEntry } from "@scribl/shared/index";
import { create } from "zustand";

import { dataClient } from "@/src/data";

interface StatsState {
  drawingsCount: number;
  weeklyCompletion: WeeklyCompletionEntry[];
  currentStreak: number;
  bestStreak: number;
  /** Milestone streak badges (spec 4.5): 7/30/100-day thresholds. */
  badges: MilestoneBadge[];
  loading: boolean;
  error: string | null;
  /** Loads (or reloads) the caller's real stats via the data client seam. */
  load: () => Promise<void>;
}

/**
 * Stats store (WS4a). Screens read only from here, never calling the data
 * client directly. Backs the home/start-drawing screens' real numbers
 * (drawings count, weekly completion strip, current/best streak) once WS4b
 * wires it in. Keep loading/error states explicit so those screens never
 * render blank or crash.
 */
export const useStatsStore = create<StatsState>((set) => ({
  drawingsCount: 0,
  weeklyCompletion: [],
  currentStreak: 0,
  bestStreak: 0,
  badges: [],
  loading: false,
  error: null,
  load: async (): Promise<void> => {
    set({ loading: true, error: null });
    try {
      const stats = await dataClient.getMyStats();
      set({
        drawingsCount: stats.drawingsCount,
        weeklyCompletion: stats.weeklyCompletion,
        currentStreak: stats.currentStreak,
        bestStreak: stats.bestStreak,
        badges: stats.badges,
        loading: false,
      });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Failed to load stats.";
      set({ error: message, loading: false });
    }
  },
}));
