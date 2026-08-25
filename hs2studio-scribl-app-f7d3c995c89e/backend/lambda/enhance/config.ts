/**
 * Scribl POC — AI-enhance seam config.
 *
 * Externalized tuning knobs for the drawing-enhancement pipeline, mirroring
 * the partner POC's config.json intent: tuning the enhancement (prompt
 * wording, negatives, canvas size, shadow toggle) should never require
 * touching handler logic. Keep this module pure (no I/O, no side effects).
 *
 * North Star: the generated background must never out-detail the user's
 * hand-drawn subject. It exists to give the drawing a home, not to compete
 * with it. The background must also MATCH the drawing's subject and
 * perspective/composition (e.g. a top-down drawing gets a top-down-viewed
 * surface, not an unrelated eye-level scene) — mismatched perspective is
 * as much a bug as a duplicated subject.
 */

/** Tuning config for the drawing-enhancement pipeline. */
export interface EnhanceConfig {
  /** Fallback context appended when describing the drawing, if no day's prompt is available. */
  describePromptContext: string;
  /** Positive style directive for the background image model. */
  backgroundStylePrompt: string;
  /** Hard negatives: keep the background simple and out of the drawing's way. */
  backgroundNegatives: string[];
  /** Output canvas size for the composed image. */
  canvas: { width: number; height: number };
  /** Drop-shadow toggle for the drawing-over-background compose step. */
  shadow: boolean;
  /**
   * Neutral, subject-free scenery used when Claude's setting derivation
   * (buildSettingPrompt via generate) returns empty or fails. Must be safe to
   * feed straight into buildBackgroundPrompt so a derivation miss degrades to a
   * plain backdrop instead of failing the enhance (durability). Subject-free.
   * Written to read naturally regardless of perspective.
   */
  fallbackSetting: string;
}

/**
 * Single source of truth for the AI-enhance kill-switch. Every seam that
 * needs to know whether the enhancement pipeline is allowed to run (the
 * fire-and-forget trigger, the regenerate handler's mark-pending gate, etc.)
 * must call this instead of re-deriving `Boolean(env.ENHANCE_ENABLED)`
 * inline, so flipping the flag off/on has exactly one code path to reason
 * about.
 */
export function isEnhanceEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.ENHANCE_ENABLED);
}

export const ENHANCE_CONFIG: EnhanceConfig = {
  describePromptContext:
    "This is a hand-drawn sketch responding to a daily creative prompt.",
  backgroundStylePrompt:
    "A simple, deliberately hand-drawn, sketch-style, muted, minimal background backdrop meant to sit behind a subject.",
  backgroundNegatives: [
    "no photorealism",
    "people-free, no people",
    "no text",
    "not busy",
    "muted colors",
    "hand-drawn only",
    "background scenery only",
    "no central subject or focal object",
    "leave the center open and empty",
  ],
  canvas: { width: 1024, height: 1024 },
  shadow: false,
  fallbackSetting: "a soft, open, muted backdrop with gentle empty space",
};

/**
 * Structured result parsed out of the describe-image caption. `subject` and
 * `perspective` are the load-bearing fields for setting derivation;
 * `surfaceHint` is optional extra grounding (what the subject would
 * naturally rest/sit on) that Claude may or may not supply.
 */
export interface DescribedDrawing {
  subject: string;
  perspective: string;
  surfaceHint: string;
}

const DEFAULT_PERSPECTIVE = "eye-level";

/**
 * Build the context string passed to describeImage (Claude vision). Asks for
 * a small structured response (SUBJECT / PERSPECTIVE / SURFACE lines) instead
 * of free text, so the perspective/composition of the drawing — not just its
 * subject — survives into the setting-derivation step. This is what fixes
 * the "top-down shoes get a beach" bug: without an explicit perspective read,
 * the pipeline had no signal to ground the background's viewing angle in.
 *
 * `promptContext` is the day's prompt text (best-effort, may be undefined);
 * when present it's included so Claude's read of the sketch is grounded in
 * what the user was actually asked to draw.
 */
export function buildDescribeContext(promptContext?: string): string {
  const dayPrompt =
    promptContext && promptContext.trim().length > 0
      ? `The day's creative prompt was: "${promptContext.trim()}". `
      : "";
  return (
    `This is a hand-drawn sketch responding to a daily creative prompt. ${dayPrompt}` +
    `Respond with EXACTLY three lines, no extra commentary:\n` +
    `SUBJECT: <the subject drawn, a few words>\n` +
    `PERSPECTIVE: <the drawing's viewing angle/composition — e.g. "top-down / straight-down view", ` +
    `"side / profile view", "eye-level", or "three-quarter view">\n` +
    `SURFACE: <the ground/surface the subject would naturally rest on, a few words, e.g. "floor", ` +
    `"pavement", "grass", "tabletop">`
  );
}

/**
 * Parses the (best-effort) structured SUBJECT/PERSPECTIVE/SURFACE caption
 * produced via buildDescribeContext. Tolerant of a model that ignores the
 * format: falls back to treating the whole caption as the subject with a
 * neutral eye-level perspective and no surface hint, so a parse miss can
 * never throw or strand the enhance.
 */
export function parseDescribedDrawing(caption: string): DescribedDrawing {
  const subjectMatch = /SUBJECT:\s*(.+)/i.exec(caption);
  const perspectiveMatch = /PERSPECTIVE:\s*(.+)/i.exec(caption);
  const surfaceMatch = /SURFACE:\s*(.+)/i.exec(caption);

  const firstLine = (value: string): string => (value.trim().split("\n")[0] ?? "").trim();
  const subject = firstLine(subjectMatch?.[1] ?? caption);
  const perspective = firstLine(perspectiveMatch?.[1] ?? DEFAULT_PERSPECTIVE);
  const surfaceHint = firstLine(surfaceMatch?.[1] ?? "");

  return {
    subject: subject.length > 0 ? subject : caption.trim(),
    perspective: perspective.length > 0 ? perspective : DEFAULT_PERSPECTIVE,
    surfaceHint,
  };
}

/**
 * Build the Claude text-generation prompt that converts a SUBJECT + its
 * drawn PERSPECTIVE (what the user drew, and from what angle) into a
 * subject-free background SETTING (the scenery to paint behind it) that
 * matches BOTH the day's prompt and the drawing's viewing angle.
 *
 * This is the load-bearing anti-duplication AND anti-mismatch step.
 * Text-to-image models obey "don't draw X" poorly: if the subject noun
 * ("a shoe") reaches the image model at all, it tends to render it — and
 * since the user's real drawing is composited on top afterward
 * (service.ts composeOnBackground), the result shows the subject twice (the
 * duplicate-subject bug). So we never hand the image model the subject.
 * Separately, if the setting ignores perspective, a top-down sketch gets an
 * eye-level scene (e.g. a beach horizon) that reads as physically wrong
 * once composited — the perspective-mismatch bug this task exists to fix.
 * We ask Claude to reason from perspective -> viewing-angle-correct surface,
 * and feed THAT to the image model via buildBackgroundPrompt.
 */
export function buildSettingPrompt(
  described: DescribedDrawing,
  promptContext?: string,
  backgroundPrompt?: string,
): string {
  const dayPrompt =
    promptContext && promptContext.trim().length > 0
      ? ` responding to the daily prompt "${promptContext.trim()}"`
      : "";
  const surfaceHintClause =
    described.surfaceHint.length > 0 ? ` A likely surface for it is: ${described.surfaceHint}.` : "";
  // User steering (creator-only edit/regenerate seam): AUGMENTS the derived
  // setting, never replaces the perspective/subject-matching logic above —
  // it's appended as an additional clause the model should honor alongside
  // (not instead of) the viewing-angle-matching requirement. No-op when
  // absent/empty, so today's behavior is unchanged.
  const userPreferenceClause =
    backgroundPrompt && backgroundPrompt.trim().length > 0
      ? ` User preference: ${backgroundPrompt.trim()}.`
      : "";

  return (
    `A person drew "${described.subject}"${dayPrompt}, drawn from this perspective: ` +
    `${described.perspective}.${surfaceHintClause} In 15 words or fewer, name ONLY a simple ` +
    `background setting to place BEHIND that drawing, matching the SAME viewing angle as the ` +
    `drawing — for example a straight-down/top-down drawing needs a floor, pavement, or ground ` +
    `surface seen from directly above (a flat overhead view, no horizon or sky); a side/profile ` +
    `drawing needs ground or floor seen from the side at the same eye level (a horizon or ` +
    `flat-on wall/floor line is fine). Describe surrounding scenery, ground/surface, and mood ` +
    `only. Do NOT mention the subject itself, any central object, or more of the same kind of ` +
    `thing.${userPreferenceClause} Output only the phrase.`
  );
}

/**
 * Combine the backdrop style prompt, a subject-free, perspective-matched
 * SETTING (from buildSettingPrompt via Claude), and the hard negatives into a
 * single text prompt for the background image model. Pure and simple by
 * design — no logic changes should ever be needed to re-tune this; edit
 * ENHANCE_CONFIG instead.
 *
 * `setting` must be subject-free scenery, NOT the drawing's caption — see
 * buildSettingPrompt for why. We positively request an open/empty center
 * where the real drawing will be composited, and require the setting's
 * viewing angle to be honored verbatim (the caller already resolved it).
 */
export function buildBackgroundPrompt(setting: string): string {
  const negatives = ENHANCE_CONFIG.backgroundNegatives.join(", ");
  return (
    `${ENHANCE_CONFIG.backgroundStylePrompt} Paint ONLY this empty background ` +
    `setting, matching its described viewing angle exactly: ${setting}. Keep the entire CENTER ` +
    `of the frame open and empty — ambient scenery and negative space only, where a separate ` +
    `hand-drawn subject will be placed on top. Do NOT draw any central object or focal subject. ` +
    `Avoid: ${negatives}.`
  );
}
