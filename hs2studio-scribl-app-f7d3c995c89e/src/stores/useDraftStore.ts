import { create } from "zustand";

interface DraftState {
  imageRef: string | null;
  promptId: string | null;
  channelId: string | null;
  /** The caption text (and voice→text fallback) typed on app/write.tsx,
   * carried forward to app/choose-channels.tsx's submit call. */
  caption: string | null;
  /** Stashes the not-yet-submitted drawing so app/write.tsx (and later
   * app/choose-channels.tsx) can render/submit the real image (a data URI
   * is too large/unreliable to pass via router params). channelId is
   * optional here: draw.tsx no longer knows the destination channel(s) —
   * that choice happens after caption entry, in choose-channels.tsx. */
  setDraft: (draft: { imageRef: string; promptId: string; channelId?: string }) => void;
  /** Updates only the caption, preserving the rest of the draft. */
  setCaption: (caption: string) => void;
  /** Clears the draft once submission is done (or abandoned). */
  clearDraft: () => void;
}

/**
 * Small draft store bridging app/draw.tsx -> app/write.tsx ->
 * app/choose-channels.tsx. Holds only the current in-progress
 * submission's data; not a general-purpose cache.
 */
export const useDraftStore = create<DraftState>((set) => ({
  imageRef: null,
  promptId: null,
  channelId: null,
  caption: null,
  setDraft: (draft): void => set({ channelId: null, ...draft }),
  setCaption: (caption): void => set({ caption }),
  clearDraft: (): void => set({ imageRef: null, promptId: null, channelId: null, caption: null }),
}));
