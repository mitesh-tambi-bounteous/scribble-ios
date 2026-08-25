import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import type { ThemeName } from "@/src/theme/tokens";

/** Persisted key for the user's chosen runtime theme (v2: ignores legacy key). */
const THEME_KEY = "scribl:theme:v2";
/** Legacy key from before "scribble" became the default; best-effort cleanup only. */
const LEGACY_THEME_KEY = "scribl:theme";

const VALID_THEMES: readonly ThemeName[] = ["ink", "studio", "notepad", "scribble"];

interface ThemeState {
  theme: ThemeName;
  /** Sets and persists the active theme. */
  setTheme: (theme: ThemeName) => Promise<void>;
  /** Reads the persisted theme (falls back to "scribble" if unset/invalid). */
  load: () => Promise<void>;
}

/**
 * Runtime theme store. ThemeRoot (app/_layout.tsx) reads `theme` to apply
 * NativeWind `vars()` + the `.theme-*` class; ThemeSwitcher writes it.
 */
export const useThemeStore = create<ThemeState>((set) => ({
  theme: "scribble",
  setTheme: async (theme: ThemeName): Promise<void> => {
    set({ theme });
    try {
      await AsyncStorage.setItem(THEME_KEY, theme);
    } catch {
      // Persistence is best-effort; the in-memory theme still applies.
    }
  },
  load: async (): Promise<void> => {
    try {
      const stored = await AsyncStorage.getItem(THEME_KEY);
      if (stored && (VALID_THEMES as string[]).includes(stored)) {
        set({ theme: stored as ThemeName });
      }
    } catch {
      // Keep the default theme on read failure.
    }
    try {
      await AsyncStorage.removeItem(LEGACY_THEME_KEY);
    } catch {
      // Best-effort cleanup only; never fail load on this.
    }
  },
}));
