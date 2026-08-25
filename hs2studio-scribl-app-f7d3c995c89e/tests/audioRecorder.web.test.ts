/**
 * S-013 web audio capture — start/stop returns a playable object URL.
 *
 * Mocks navigator.mediaDevices.getUserMedia, MediaRecorder, and
 * URL.createObjectURL (jsdom-style browser globals; jest-expo's default
 * environment is node, so these are stubbed directly on globalThis, mirroring
 * the fetch-mocking convention in tests/http-client.test.ts).
 *
 * Loads the web module via require() from its concrete file path (rather
 * than the extensionless "@/src/services/audioRecorder") because jest-expo's
 * default haste/module resolution favors the .native.ts sibling for RN-style
 * platform extensions, even outside a real React Native runtime. A type-only
 * import keeps the call sites below fully typed without tripping
 * TS5097 (explicit .ts extensions aren't importable under this tsconfig).
 */

import type { startRecording as StartRecording, stopRecording as StopRecording } from "@/src/services/audioRecorder";

const { startRecording, stopRecording }: { startRecording: typeof StartRecording; stopRecording: typeof StopRecording } =
  jest.requireActual("../src/services/audioRecorder.ts");

class FakeMediaRecorder {
  public ondataavailable: ((event: { data: Blob }) => void) | null = null;
  public onstop: (() => void) | null = null;

  start(): void {
    this.ondataavailable?.({ data: new Blob(["chunk"]) } as unknown as { data: Blob });
  }

  stop(): void {
    this.onstop?.();
  }
}

describe("audioRecorder.web (S-013)", () => {
  const originalMediaRecorder = (globalThis as { MediaRecorder?: unknown }).MediaRecorder;
  const originalNavigator = globalThis.navigator;
  const originalCreateObjectURL = (globalThis.URL as unknown as { createObjectURL?: unknown })
    .createObjectURL;

  afterEach(() => {
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = originalMediaRecorder;
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
    (globalThis.URL as unknown as { createObjectURL?: unknown }).createObjectURL =
      originalCreateObjectURL;
  });

  it("startRecording then stopRecording resolves with a uri", async () => {
    const getUserMedia = jest.fn().mockResolvedValue({} as MediaStream);
    Object.defineProperty(globalThis, "navigator", {
      value: { mediaDevices: { getUserMedia } },
      writable: true,
      configurable: true,
    });
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = FakeMediaRecorder as unknown;
    globalThis.URL.createObjectURL = jest.fn().mockReturnValue("blob:mock-uri");

    await startRecording();
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });

    const result = await stopRecording();
    expect(result).toEqual({ uri: "blob:mock-uri" });
  });

  it("stopRecording rejects when no recording is in progress", async () => {
    await expect(stopRecording()).rejects.toThrow("No active recording to stop.");
  });
});
