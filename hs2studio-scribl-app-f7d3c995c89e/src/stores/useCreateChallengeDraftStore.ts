import { create } from "zustand";

import { BRUSH_STYLE_IDS, PALETTE, type BrushStyle } from "@scribl/shared/tools";

export const DEFAULT_DRAW_SECONDS = 120;

interface CreateChallengeDraftState {
  word: string;
  drawSeconds: number;
  selectedBrushes: BrushStyle[];
  selectedColors: string[];
  backgroundRef: string | undefined;
  setWord: (word: string) => void;
  setDrawSeconds: (drawSeconds: number) => void;
  setSelectedBrushes: (selectedBrushes: BrushStyle[]) => void;
  setSelectedColors: (selectedColors: string[]) => void;
  setBackgroundRef: (backgroundRef: string | undefined) => void;
  reset: () => void;
}

function initialFields(): Pick<
  CreateChallengeDraftState,
  "word" | "drawSeconds" | "selectedBrushes" | "selectedColors" | "backgroundRef"
> {
  return {
    word: "",
    drawSeconds: DEFAULT_DRAW_SECONDS,
    selectedBrushes: [...BRUSH_STYLE_IDS],
    selectedColors: [...PALETTE],
    backgroundRef: undefined,
  };
}

/**
 * Holds app/create-challenge.tsx's in-progress form so it survives the
 * round trip to app/create-challenge-background.tsx and back (a stack
 * push, not a modal) — mirrors useDraftStore's rationale for the
 * daily-entry flow.
 */
export const useCreateChallengeDraftStore = create<CreateChallengeDraftState>((set) => ({
  ...initialFields(),
  setWord: (word): void => set({ word }),
  setDrawSeconds: (drawSeconds): void => set({ drawSeconds }),
  setSelectedBrushes: (selectedBrushes): void => set({ selectedBrushes }),
  setSelectedColors: (selectedColors): void => set({ selectedColors }),
  setBackgroundRef: (backgroundRef): void => set({ backgroundRef }),
  reset: (): void => set(initialFields()),
}));
