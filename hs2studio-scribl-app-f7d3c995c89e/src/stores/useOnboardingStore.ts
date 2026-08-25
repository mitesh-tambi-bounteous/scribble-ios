import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

/** Persisted flag key — set once the user finishes the tutorial. */
const HAS_ONBOARDED_KEY = "scribl:hasOnboarded";

interface OnboardingState {
  /** null = not yet checked against storage. */
  hasOnboarded: boolean | null;
  loading: boolean;
  error: string | null;
  /** Reads the persisted flag and resolves hasOnboarded. */
  checkOnboarded: () => Promise<void>;
  /** Persists the flag and marks onboarding complete. */
  completeOnboarding: () => Promise<void>;
}

/**
 * Onboarding store. Screens read only from here, never touching
 * AsyncStorage directly — keeps the persistence seam swappable later.
 */
export const useOnboardingStore = create<OnboardingState>((set) => ({
  hasOnboarded: null,
  loading: false,
  error: null,
  checkOnboarded: async (): Promise<void> => {
    set({ loading: true, error: null });
    try {
      const value = await AsyncStorage.getItem(HAS_ONBOARDED_KEY);
      set({ hasOnboarded: value === "true", loading: false });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Failed to check onboarding.";
      set({ error: message, loading: false });
    }
  },
  completeOnboarding: async (): Promise<void> => {
    set({ loading: true, error: null });
    try {
      await AsyncStorage.setItem(HAS_ONBOARDED_KEY, "true");
      set({ hasOnboarded: true, loading: false });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Failed to complete onboarding.";
      set({ error: message, loading: false });
    }
  },
}));
