import type React from "react";

import SkiaCanvasNative, { type BrushStyle, type SkiaCanvasRef } from "./SkiaCanvas";

export type { BrushStyle, SkiaCanvasRef };

interface DrawingCanvasProps {
  onClear?: () => void;
  /** Stroke color for new strokes. Overrides SkiaCanvas's default. */
  color?: string;
  /** Stroke width for new strokes. Overrides SkiaCanvas's default. */
  strokeWidth?: number;
  /** Active tool: "brush" (draw) or "fill" (paint bucket). Defaults to brush. */
  tool?: "brush" | "fill";
  /** Brush style for new strokes: "basic", "fork", "dotted", or "neon". */
  brushStyle?: BrushStyle;
  /** Hides SkiaCanvas's internal Clear button (screen supplies its own via apiRef). */
  hideInternalClear?: boolean;
  /** Optional shared background (PNG data URI) rendered beneath all strokes. */
  backgroundImage?: string;
  /**
   * Prop-based imperative handle (not a React ref). Kept identical to the web
   * variant so screens use one API across platforms.
   */
  apiRef?: React.MutableRefObject<SkiaCanvasRef | null>;
}

/**
 * Platform wrapper around the Skia drawing surface (native resolution). Native
 * Skia is available synchronously, so SkiaCanvas is imported statically and
 * rendered directly — no CanvasKit load ordering to worry about (that concern
 * is web-only; see DrawingCanvas.tsx). Same SkiaCanvas as web (AC7 parity).
 */
export default function DrawingCanvas(props: DrawingCanvasProps): React.JSX.Element {
  return <SkiaCanvasNative {...props} />;
}
