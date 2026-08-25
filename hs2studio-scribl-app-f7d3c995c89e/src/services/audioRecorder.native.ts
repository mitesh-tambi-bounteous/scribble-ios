/**
 * Native audio capture (S-013) — deferred to iOS/Android bring-up.
 *
 * Same exported shape as the default/web module (audioRecorder.ts) so
 * callers import from the extensionless path and Metro resolves
 * per-platform (same convention as DrawingCanvas.tsx / .native.tsx).
 */

export async function startRecording(): Promise<void> {
  throw new Error("Native audio capture deferred to iOS/Android bring-up");
}

export async function stopRecording(): Promise<{ uri: string }> {
  throw new Error("Native audio capture deferred to iOS/Android bring-up");
}
