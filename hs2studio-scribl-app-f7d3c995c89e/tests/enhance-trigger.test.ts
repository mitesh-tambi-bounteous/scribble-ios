/**
 * T4 — triggerEnhancement: the in-process fire-and-forget submit-side hook.
 * Must never throw synchronously, must never block the caller (no await
 * inside the function body reaching setEnhancementResult before it
 * returns), and must be a hard no-op unless ENHANCE_ENABLED + an image are
 * both present — so unit/e2e submit tests stay deterministic.
 */
import { getPromptById, setEnhancementResult } from "@/backend/lambda/data";
import { createEnhanceDeps, enhanceDrawing } from "@/backend/lambda/enhance/service";

jest.mock("@/backend/lambda/data", () => ({
  setEnhancementResult: jest.fn().mockResolvedValue(undefined),
  getPromptById: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/backend/lambda/enhance/service", () => ({
  createEnhanceDeps: jest.fn().mockReturnValue({}),
  enhanceDrawing: jest.fn(),
}));

import { triggerEnhancement } from "@/backend/lambda/enhance/trigger";

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe("triggerEnhancement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("no-ops when ENHANCE_ENABLED is unset, even with an imageDataUri", async () => {
    triggerEnhancement(
      { responseId: "response-1", imageDataUri: "data:image/png;base64,AAA" },
      {},
    );
    await flushMicrotasks();

    expect(createEnhanceDeps).not.toHaveBeenCalled();
    expect(enhanceDrawing).not.toHaveBeenCalled();
    expect(setEnhancementResult).not.toHaveBeenCalled();
  });

  it("no-ops when ENHANCE_ENABLED is set but there is no imageDataUri (text-only submission)", async () => {
    triggerEnhancement({ responseId: "response-1" }, { ENHANCE_ENABLED: "1" });
    await flushMicrotasks();

    expect(createEnhanceDeps).not.toHaveBeenCalled();
    expect(setEnhancementResult).not.toHaveBeenCalled();
  });

  it("returns synchronously (does not block the caller) when enabled", () => {
    (enhanceDrawing as jest.Mock).mockReturnValue(
      new Promise(() => {
        /* never resolves within this test */
      }),
    );

    const start = Date.now();
    triggerEnhancement(
      { responseId: "response-1", imageDataUri: "data:image/png;base64,AAA" },
      { ENHANCE_ENABLED: "1" },
    );
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(50);
  });

  it("on success, calls enhanceDrawing then persists the result as 'ready'", async () => {
    (enhanceDrawing as jest.Mock).mockResolvedValue({
      enhancedImageDataUri: "data:image/png;base64,ENHANCED",
      caption: "a cat",
    });

    triggerEnhancement(
      { responseId: "response-1", imageDataUri: "data:image/png;base64,AAA" },
      { ENHANCE_ENABLED: "1" },
    );
    await flushMicrotasks();
    await flushMicrotasks();

    expect(createEnhanceDeps).toHaveBeenCalledTimes(1);
    expect(enhanceDrawing).toHaveBeenCalledWith(
      { imageDataUri: "data:image/png;base64,AAA", promptContext: undefined },
      {},
    );
    expect(setEnhancementResult).toHaveBeenCalledWith(
      "response-1",
      "data:image/png;base64,ENHANCED",
      "ready",
    );
  });

  it("resolves promptId to prompt text and threads it into enhanceDrawing as promptContext", async () => {
    (getPromptById as jest.Mock).mockResolvedValue({
      id: "prompt-2026-07-22",
      date: "2026-07-22",
      text: "Draw your favorite shoes",
      createdAt: "2026-07-22T00:00:00.000Z",
    });
    (enhanceDrawing as jest.Mock).mockResolvedValue({
      enhancedImageDataUri: "data:image/png;base64,ENHANCED",
      caption: "a shoe",
    });

    triggerEnhancement(
      {
        responseId: "response-1",
        imageDataUri: "data:image/png;base64,AAA",
        promptId: "prompt-2026-07-22",
      },
      { ENHANCE_ENABLED: "1" },
    );
    await flushMicrotasks();
    await flushMicrotasks();

    expect(getPromptById).toHaveBeenCalledWith("prompt-2026-07-22");
    expect(enhanceDrawing).toHaveBeenCalledWith(
      { imageDataUri: "data:image/png;base64,AAA", promptContext: "Draw your favorite shoes" },
      {},
    );
  });

  it("degrades to no promptContext when getPromptById fails, without throwing or blocking", async () => {
    (getPromptById as jest.Mock).mockRejectedValue(new Error("lookup failed"));
    (enhanceDrawing as jest.Mock).mockResolvedValue({
      enhancedImageDataUri: "data:image/png;base64,ENHANCED",
      caption: "a shoe",
    });
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    triggerEnhancement(
      {
        responseId: "response-1",
        imageDataUri: "data:image/png;base64,AAA",
        promptId: "prompt-2026-07-22",
      },
      { ENHANCE_ENABLED: "1" },
    );
    await flushMicrotasks();
    await flushMicrotasks();

    expect(enhanceDrawing).toHaveBeenCalledWith(
      { imageDataUri: "data:image/png;base64,AAA", promptContext: undefined },
      {},
    );
    expect(setEnhancementResult).toHaveBeenCalledWith(
      "response-1",
      "data:image/png;base64,ENHANCED",
      "ready",
    );
    warnSpy.mockRestore();
  });

  it("on failure, catches the error and persists 'failed' with a null ref, never throwing", async () => {
    (enhanceDrawing as jest.Mock).mockRejectedValue(new Error("provider exploded"));
    const errSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() =>
      triggerEnhancement(
        { responseId: "response-2", imageDataUri: "data:image/png;base64,AAA" },
        { ENHANCE_ENABLED: "1" },
      ),
    ).not.toThrow();

    await flushMicrotasks();
    await flushMicrotasks();

    expect(setEnhancementResult).toHaveBeenCalledWith("response-2", null, "failed");
    errSpy.mockRestore();
  });
});
