import type { Challenge, ChallengeSummary } from "@scribl/shared/index";
import { create } from "zustand";

import type { CreateChallengeInput } from "@/src/data/client";
import { dataClient } from "@/src/data";

interface ChallengesState {
  challenges: ChallengeSummary[];
  loading: boolean;
  error: string | null;
  /** Loads the challenge list for a channel via the data client seam. */
  load: (channelId: string) => Promise<void>;
  /**
   * Creates a challenge via the data client and returns it so the screen can
   * navigate straight to the new challenge's detail. Rethrows on failure
   * (after recording the error) so the caller can react.
   */
  create: (channelId: string, input: CreateChallengeInput) => Promise<Challenge>;
}

/**
 * Per-channel challenges list store. The channel-challenges screen reads
 * only from here, never calling the data client directly.
 */
export const useChallengesStore = create<ChallengesState>((set) => ({
  challenges: [],
  loading: false,
  error: null,
  load: async (channelId: string): Promise<void> => {
    set({ loading: true, error: null });
    try {
      const challenges = await dataClient.listChallenges(channelId);
      set({ challenges, loading: false });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Failed to load challenges.";
      set({ error: message, loading: false });
    }
  },
  create: async (channelId: string, input: CreateChallengeInput): Promise<Challenge> => {
    try {
      const challenge = await dataClient.createChallenge(channelId, input);
      set({ error: null });
      return challenge;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Failed to create challenge.";
      set({ error: message });
      throw caught;
    }
  },
}));
