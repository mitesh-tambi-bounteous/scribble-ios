/**
 * Scribl POC — drawing-enhancement service (T3).
 *
 * Orchestrates: describe (Claude vision) -> generate background (text-only
 * image seam) -> compose (sharp) -> return a single enhanced PNG data URI.
 *
 * North Star / data boundary: the user's drawing image bytes are NEVER sent
 * to the background image provider. Only the Claude-produced text caption
 * (via buildBackgroundPrompt) crosses that seam. The original drawing bytes
 * are never regenerated — they are composited, unchanged, onto the
 * generated background.
 *
 * Pure orchestration: no env reads here. `createEnhanceDeps` (below) is the
 * only place that reads env, and it exists purely as wiring for callers
 * (T4 handlers), not for this module's own logic.
 */
import sharp from "sharp";
import type { ProviderAdapter } from "../../../packages/claude-provider-adapter/types";
import { createProviderAdapter, providerConfigFromEnv } from "../../../packages/claude-provider-adapter/factory";
import { createImageProvider, imageConfigFromEnv } from "./image/factory";
import type { ImageProvider } from "./image/types";
import {
  ENHANCE_CONFIG,
  buildBackgroundPrompt,
  buildDescribeContext,
  buildSettingPrompt,
  parseDescribedDrawing,
} from "./config";
import type { EnhanceConfig } from "./config";

export interface EnhanceInput {
  /** Full data URI of the user's drawing, e.g. "data:image/png;base64,...". */
  imageDataUri: string;
  /**
   * Best-effort text of the day's prompt (e.g. "Draw your favorite shoe").
   * Threaded through to both the describe-image context and the setting
   * derivation so the generated background is grounded in what the user was
   * actually asked to draw, not just a generic caption. Optional — a miss
   * degrades to the neutral describe/setting defaults, never fails enhance.
   */
  promptContext?: string;
  /**
   * User-supplied background steering (creator-only edit/regenerate seam).
   * AUGMENTS the auto-derived setting/background prompt — never replaces the
   * perspective/subject-matching derivation in buildSettingPrompt /
   * buildBackgroundPrompt. Optional; empty/undefined leaves today's behavior
   * unchanged.
   */
  backgroundPrompt?: string;
}

export interface EnhanceDeps {
  claude: Pick<ProviderAdapter, "describeImage" | "generate">;
  image: ImageProvider;
  config?: EnhanceConfig;
}

export interface EnhanceResult {
  enhancedImageDataUri: string;
  caption: string;
}

const SUPPORTED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
type SupportedMimeType = (typeof SUPPORTED_MIME_TYPES)[number];

interface ParsedDataUri {
  mimeType: SupportedMimeType;
  base64: string;
}

/**
 * Parses a `data:<mime>;base64,<payload>` URI into mime type + raw base64.
 * Defaults to image/png if the mime type is missing or unrecognized.
 * Throws on malformed input (no comma separator, empty payload).
 */
export function parseDataUri(dataUri: string): ParsedDataUri {
  assertNonEmpty(dataUri, "imageDataUri");

  const commaIndex = dataUri.indexOf(",");
  if (!dataUri.startsWith("data:") || commaIndex === -1) {
    throw new Error("parseDataUri: malformed data URI (expected data:<mime>;base64,<payload>)");
  }

  const header = dataUri.slice(5, commaIndex); // strip "data:"
  const base64 = dataUri.slice(commaIndex + 1);
  assertNonEmpty(base64, "data URI payload");

  const mimeMatch = header.split(";")[0];
  const mimeType = SUPPORTED_MIME_TYPES.includes(mimeMatch as SupportedMimeType)
    ? (mimeMatch as SupportedMimeType)
    : "image/png";

  return { mimeType, base64 };
}

function assertNonEmpty(value: string | undefined | null, label: string): void {
  if (!value || value.trim().length === 0) {
    throw new Error(`enhanceDrawing: ${label} must be a non-empty string`);
  }
}

/**
 * Composes the original drawing (unchanged) centered over a resized
 * background, fit within ~80% of the canvas, preserving aspect ratio.
 * Returns the composed PNG as a Buffer.
 */
async function composeOnBackground(
  backgroundBase64: string,
  drawingBase64: string,
  canvas: { width: number; height: number },
  shadow: boolean,
): Promise<Buffer> {
  const backgroundBuffer = Buffer.from(backgroundBase64, "base64");
  const drawingBuffer = Buffer.from(drawingBase64, "base64");

  const resizedBackground = await sharp(backgroundBuffer)
    .resize(canvas.width, canvas.height, { fit: "cover" })
    .png()
    .toBuffer();

  const maxOverlayWidth = Math.round(canvas.width * 0.8);
  const maxOverlayHeight = Math.round(canvas.height * 0.8);

  const resizedDrawing = await sharp(drawingBuffer)
    .resize(maxOverlayWidth, maxOverlayHeight, { fit: "inside" })
    .png()
    .toBuffer();

  const drawingMeta = await sharp(resizedDrawing).metadata();
  const drawingWidth = drawingMeta.width ?? maxOverlayWidth;
  const drawingHeight = drawingMeta.height ?? maxOverlayHeight;

  const left = Math.round((canvas.width - drawingWidth) / 2);
  const top = Math.round((canvas.height - drawingHeight) / 2);

  // Optional drop shadow: a soft, blurred, darkened silhouette of the
  // drawing offset slightly, placed underneath the drawing itself.
  const composites: sharp.OverlayOptions[] = [];
  if (shadow) {
    const shadowLayer = await sharp(resizedDrawing)
      .flatten({ background: { r: 0, g: 0, b: 0 } })
      .blur(8)
      .toBuffer();
    composites.push({ input: shadowLayer, left: left + 6, top: top + 6 });
  }
  composites.push({ input: resizedDrawing, left, top });

  return sharp(resizedBackground).composite(composites).png().toBuffer();
}

/**
 * Runs the full enhancement pipeline for a single drawing submission.
 * Returns a data URI ready to persist/serve; never blocks the submit path
 * itself (callers invoke this off the async queue, per ADR 0010).
 */
export async function enhanceDrawing(input: EnhanceInput, deps: EnhanceDeps): Promise<EnhanceResult> {
  assertNonEmpty(input.imageDataUri, "imageDataUri");

  const config = deps.config ?? ENHANCE_CONFIG;
  const { mimeType, base64: drawingBase64 } = parseDataUri(input.imageDataUri);

  const describeResult = await deps.claude.describeImage({
    imageBase64: drawingBase64,
    mimeType,
    context: buildDescribeContext(input.promptContext) || config.describePromptContext,
  });
  const caption = describeResult.caption;
  const described = parseDescribedDrawing(caption);

  // Convert the subject + perspective into subject-free, perspective-matched
  // scenery BEFORE it can reach the image model. Feeding the subject noun to
  // a text-to-image model makes it redraw the subject, which then appears
  // twice once the real drawing is composited on top (the duplicate-subject
  // bug); ignoring perspective produces a background at the wrong viewing
  // angle (e.g. a top-down drawing getting an eye-level beach horizon). See
  // buildSettingPrompt.
  let setting = config.fallbackSetting;
  try {
    const settingResult = await deps.claude.generate({
      prompt: buildSettingPrompt(described, input.promptContext, input.backgroundPrompt),
      maxOutputTokens: 60,
    });
    const derived = settingResult.text.trim();
    if (derived.length > 0) setting = derived; // empty → keep neutral fallback
  } catch (err) {
    // Best-effort derivation: a failure must degrade to the neutral fallback,
    // never fail the enhance and strand the row as pending (durability bug).
    console.warn("enhance: setting derivation failed, using fallback", { err });
  }
  assertNonEmpty(setting, "background setting"); // invariant before prompt build

  const backgroundPrompt = buildBackgroundPrompt(setting);
  const backgroundResult = await deps.image.generateBackground({
    prompt: backgroundPrompt,
    size: `${config.canvas.width}x${config.canvas.height}`,
  });

  const composedPng = await composeOnBackground(
    backgroundResult.imageBase64,
    drawingBase64,
    config.canvas,
    config.shadow,
  );

  return {
    enhancedImageDataUri: `data:image/png;base64,${composedPng.toString("base64")}`,
    caption,
  };
}

/**
 * Default wiring: builds real EnhanceDeps from env. The ONLY place in this
 * module that reads process.env — callers (T4 handlers) use this so the
 * pure `enhanceDrawing` above stays testable and adapter-agnostic.
 */
export function createEnhanceDeps(env: Record<string, string | undefined> = process.env): EnhanceDeps {
  return {
    claude: createProviderAdapter(providerConfigFromEnv(env)),
    image: createImageProvider(imageConfigFromEnv(env)),
    config: ENHANCE_CONFIG,
  };
}
