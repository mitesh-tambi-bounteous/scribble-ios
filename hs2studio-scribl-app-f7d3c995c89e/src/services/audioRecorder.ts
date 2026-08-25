/**
 * Web audio capture (S-013) — wraps the browser MediaRecorder API.
 *
 * Small, testable module: the MediaRecorder instance is held in module state
 * between start/stop calls since the exported API is intentionally minimal
 * (no recorder handle threaded through the caller). This mirrors the
 * record.tsx screen's simple start/stop toggle.
 */

let activeRecorder: MediaRecorder | null = null;
let recordedChunks: BlobPart[] = [];

/**
 * Requests mic access and begins recording. Throws if getUserMedia is
 * unavailable or permission is denied — callers should surface the error.
 */
export async function startRecording(): Promise<void> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  recordedChunks = [];
  activeRecorder = new MediaRecorder(stream);
  activeRecorder.ondataavailable = (event: BlobEvent) => {
    if (event.data.size > 0) recordedChunks.push(event.data);
  };
  activeRecorder.start();
}

/**
 * Stops the active recording and resolves with an object URL for playback.
 * Throws if no recording is in progress.
 */
export function stopRecording(): Promise<{ uri: string }> {
  return new Promise((resolve, reject) => {
    const recorder = activeRecorder;
    if (!recorder) {
      reject(new Error("No active recording to stop."));
      return;
    }

    recorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: "audio/webm" });
      const uri = URL.createObjectURL(blob);
      activeRecorder = null;
      recordedChunks = [];
      resolve({ uri });
    };

    recorder.stop();
  });
}
