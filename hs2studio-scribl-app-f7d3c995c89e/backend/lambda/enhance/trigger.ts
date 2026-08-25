/**
 * T4 — in-process, fire-and-forget submit-side enhancement trigger.
 *
 * Called from submit.ts AFTER putSubmission() succeeds, once per created
 * response id. Never awaited by the caller: submit must return its
 * unchanged { submission } body with unchanged latency, regardless of how
 * long (or whether) enhancement succeeds. Deliberately does not touch the
 * AC2 submit-to-unlock or AC4 channel-isolation gates — persistence-only.
 */
import { createEnhanceDeps, enhanceDrawing } from "./service";
import { isEnhanceEnabled } from "./config";
import { getPromptById, setEnhancementResult } from "../data";

export interface TriggerEnhancementArgs {
  responseId: string;
  imageDataUri?: string;
  /** The day's prompt id, used to look up prompt text (best-effort, off the queue). */
  promptId?: string;
  /** Explicit prompt text override — if set, skips the promptId lookup. */
  promptContext?: string;
  /**
   * User-supplied background steering (from the creator-only edit/regenerate
   * handler). AUGMENTS the auto-derived setting — never replaces the
   * perspective/subject-matching derivation. Optional; a miss/empty value
   * leaves behavior unchanged.
   */
  backgroundPrompt?: string;
}

/**
 * No-ops unless ENHANCE_ENABLED is truthy and an imageDataUri is present
 * (text-only submissions have nothing to enhance). Otherwise builds deps,
 * runs the enhancement pipeline, and persists the result — all without
 * blocking the caller. Any error anywhere in the async body is caught and
 * recorded as "failed"; nothing ever throws back to submit.ts.
 */
export function triggerEnhancement(
  args: TriggerEnhancementArgs,
  env: Record<string, string | undefined> = process.env,
): void {
  const enabled = isEnhanceEnabled(env);
  const hasImage = Boolean(args.imageDataUri);
  const willFire = enabled && hasImage;
  // eslint-disable-next-line no-console
  console.log("enhance: triggerEnhancement", {
    responseId: args.responseId,
    willFire,
    ENHANCE_ENABLED: enabled,
    hasImageDataUri: hasImage,
    reason: willFire
      ? "enabled + imageDataUri present"
      : !enabled
        ? "no-op: ENHANCE_ENABLED is falsy"
        : "no-op: no imageDataUri (text-only submission)",
  });

  if (!willFire) {
    return;
  }

  const { responseId, imageDataUri, promptId, backgroundPrompt } = args;
  let { promptContext } = args;
  // willFire already guarantees imageDataUri is present; this re-narrows for TS.
  if (!imageDataUri) {
    return;
  }

  void (async (): Promise<void> => {
    try {
      // Best-effort prompt-text lookup, off the queue: a miss/failure here
      // must never block or fail enhancement — it just falls back to
      // whatever caption/setting derivation can do without prompt grounding.
      if (!promptContext && promptId) {
        try {
          const prompt = await getPromptById(promptId);
          promptContext = prompt?.text;
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn("enhance: getPromptById failed, continuing without promptContext", {
            responseId,
            promptId,
            err,
          });
        }
      }

      const deps = createEnhanceDeps(env);
      const result = await enhanceDrawing({ imageDataUri, promptContext, backgroundPrompt }, deps);
      await setEnhancementResult(responseId, result.enhancedImageDataUri, "ready");
      // eslint-disable-next-line no-console
      console.log("enhance: triggerEnhancement succeeded", { responseId });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("enhance: triggerEnhancement failed", { responseId, err });
      try {
        await setEnhancementResult(responseId, null, "failed");
      } catch (persistErr) {
        // eslint-disable-next-line no-console
        console.error("enhance: triggerEnhancement failed to persist failure status", {
          responseId,
          persistErr,
        });
      }
    }
  })();
}
