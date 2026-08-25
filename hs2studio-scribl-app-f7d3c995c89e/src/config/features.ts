/**
 * Single frontend kill-switch for the AI enhancement/background UI.
 *
 * Default OFF: the app behaves as a pure hand-drawing app with zero AI/
 * generative UI (no toggle pill, no pending/failed chrome, no background
 * prompt field, no regenerate button). Set EXPO_PUBLIC_AI_ENABLED=1 to
 * restore full AI behavior. Read at module scope to match the existing
 * EXPO_PUBLIC_* config convention (see src/data/index.ts); note that
 * EXPO_PUBLIC_* vars are inlined at build time by Expo/Metro.
 */
export const AI_ENABLED: boolean = process.env.EXPO_PUBLIC_AI_ENABLED === "1";
