import {
  AlphaType,
  Canvas,
  ColorType,
  DashPathEffect,
  Image as SkiaImage,
  Path,
  Skia,
  useCanvasRef,
  type SkImage,
  type SkPath,
} from "@shopify/react-native-skia";
import { useEffect, useMemo, useRef, useState } from "react";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { runOnJS, useSharedValue } from "react-native-reanimated";
import { View, type LayoutChangeEvent } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { floodFill, hexToRgba } from "@/lib/floodFill";
import type { BrushStyle } from "@scribl/shared/tools";

export type { BrushStyle };

/**
 * Color tolerance for the paint bucket (max per-channel abs difference, 0-255).
 * See lib/floodFill.ts for the full rationale: 32 lets true (near-transparent)
 * background pixels flood while anti-aliased stroke fringe (alpha >= ~33) bounds
 * the fill without leaks or halos.
 */
const FILL_TOLERANCE = 32;

/**
 * Imperative handle exposed by SkiaCanvas. The export seam every submission
 * flow (S-002+) needs: a single image snapshot of whatever is on the surface.
 */
export interface SkiaCanvasRef {
  /** Renders the current surface to an in-memory SkImage, or null if empty. */
  exportToImage: () => SkImage | null;
  /** Clears all strokes and fills. */
  clear: () => void;
  /** Removes the most recently committed op (stroke or fill). */
  undo: () => void;
}

/** The `path` prop type Skia's <Path> accepts (an SkPath or a reanimated SharedValue of one). */
type PathProp = React.ComponentProps<typeof Path>["path"];

/**
 * Renders one stroke as one-or-more <Path> nodes according to its brush style.
 * Shared by committed strokes (SkPath) and the live stroke (SharedValue<SkPath>),
 * so both preview identically while drawing and after commit.
 */
function strokeElements(
  keyBase: string,
  path: PathProp,
  color: string,
  strokeWidth: number,
  style: BrushStyle,
): React.JSX.Element[] {
  const common = { style: "stroke" as const, strokeJoin: "round" as const, strokeCap: "round" as const };
  if (style === "dotted") {
    return [
      <Path key={`${keyBase}-dot`} path={path} color={color} strokeWidth={strokeWidth} {...common}>
        <DashPathEffect intervals={[1, Math.max(6, strokeWidth * 2.2)]} />
      </Path>,
    ];
  }
  if (style === "neon") {
    return [
      <Path
        key={`${keyBase}-halo`}
        path={path}
        color={color}
        strokeWidth={strokeWidth * 2.6}
        opacity={0.4}
        {...common}
      />,
    ];
  }
  return [<Path key={`${keyBase}-basic`} path={path} color={color} strokeWidth={strokeWidth} {...common} />];
}

/** Fork line spacing (half-distance between the outer combs) for a given stroke width. */
function forkOffset(strokeWidth: number): number {
  return strokeWidth * 1.5 + 6;
}

/**
 * Builds the three parallel polylines of a "fork" (comb) stroke: the original
 * center line plus two copies offset by ±`offset` along the per-vertex normal
 * (perpendicular to the local direction), so the tines stay parallel and
 * visible whatever direction the stroke runs. Needs the committed SkPath's
 * points, so it only applies to committed strokes (the live preview draws as a
 * single line until release).
 */
function buildForkPaths(src: SkPath, offset: number): SkPath[] {
  const count = src.countPoints();
  if (count < 2) return [src];
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i += 1) {
    const p = src.getPoint(i);
    pts.push({ x: p.x, y: p.y });
  }
  const result: SkPath[] = [src];
  for (const off of [-offset, offset]) {
    const path = Skia.Path.Make();
    for (let i = 0; i < pts.length; i += 1) {
      const prev = pts[Math.max(0, i - 1)];
      const next = pts[Math.min(pts.length - 1, i + 1)];
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const len = Math.hypot(dx, dy) || 1;
      const x = pts[i].x + (-dy / len) * off;
      const y = pts[i].y + (dx / len) * off;
      if (i === 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    }
    result.push(path);
  }
  return result;
}

/** A single committed freehand stroke with the color/width/style it was drawn with. */
interface StrokeOp {
  kind: "stroke";
  path: SkPath;
  color: string;
  strokeWidth: number;
  style: BrushStyle;
}

/**
 * A committed paint-bucket fill: a full-canvas image, transparent except the
 * flooded region. Rendered beneath later ops so subsequent strokes sit on top,
 * and popped like any op by undo.
 */
interface FillOp {
  kind: "fill";
  image: SkImage;
}

type CanvasOp = StrokeOp | FillOp;

interface SkiaCanvasProps {
  /** Called when the user taps Clear. Purely informational; canvas clears itself. */
  onClear?: () => void;
  /** Stroke width in px for both active and committed strokes. Defaults to 4. */
  strokeWidth?: number;
  /** Stroke color for both active and committed strokes. Defaults to #1A1A1A. */
  color?: string;
  /**
   * Active tool. "brush" (default) draws freehand strokes on drag; "fill" floods
   * the tapped region with the current `color` (MS-Paint paint bucket).
   */
  tool?: "brush" | "fill";
  /** Brush style for new strokes: "basic" (default), "fork", "dotted", or "neon". */
  brushStyle?: BrushStyle;
  /** Hides the internal "Clear" button when the screen provides its own (via apiRef.clear()). */
  hideInternalClear?: boolean;
  /**
   * Optional shared background (PNG data URI) rendered full-canvas BENEATH all
   * committed ops, so `exportToImage` snapshots include it (challenge
   * creator-drawn backgrounds).
   */
  backgroundImage?: string;
  /**
   * Prop-based imperative handle. NOT a React ref: SkiaCanvas is lazy-loaded
   * on web via WithSkiaWeb, which does not forward refs, so the handle is
   * assigned onto this mutable ref object as a normal prop instead.
   */
  apiRef?: React.MutableRefObject<SkiaCanvasRef | null>;
}

/**
 * Blank Skia drawing surface. Captures finger/mouse strokes as paths and
 * renders them, and supports an MS-Paint-style paint-bucket fill (tap while the
 * "fill" tool is active).
 *
 * Perf-critical detail (AC3 / ADR 0006): the in-progress stroke is held in a
 * reanimated SharedValue<SkPath> and mutated inside the Gesture.Pan()
 * worklet, entirely on the UI thread. No setState, no path.copy() per finger
 * move. Skia's <Path> component accepts a SharedValue directly (its `path`
 * prop type is `PathDef | { value: PathDef }`), so the live stroke renders
 * reactively without a JS round-trip per frame. Only on stroke completion do
 * we cross to the JS thread (via runOnJS) to commit the finished path into
 * the React-rendered op list.
 *
 * Fill is inherently raster: on a tap we snapshot the surface to pixels
 * (readPixels), scanline flood-fill the tapped region (a pure function, see
 * lib/floodFill.ts), then composite the result back as a transparent-except-
 * the-region <Image> op. It participates in undo/clear/export for free because
 * those all key off the op list / the Skia surface.
 */
export default function SkiaCanvas({
  onClear,
  strokeWidth = 4,
  color = "#1A1A1A",
  tool = "brush",
  brushStyle = "basic",
  hideInternalClear = false,
  backgroundImage,
  apiRef,
}: SkiaCanvasProps): React.JSX.Element {
  const [committedOps, setCommittedOps] = useState<CanvasOp[]>([]);
  const [bgImage, setBgImage] = useState<SkImage | null>(null);
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const colorRef = useRef(color);
  const strokeWidthRef = useRef(strokeWidth);
  const brushStyleRef = useRef(brushStyle);
  useEffect(() => {
    colorRef.current = color;
    strokeWidthRef.current = strokeWidth;
    brushStyleRef.current = brushStyle;
  }, [color, strokeWidth, brushStyle]);
  // Built lazily in the component (not at module scope) so importing this file
  // never touches Skia. Route-tree validation / web SSR loads every route
  // module in Node where CanvasKit is undefined; a module-level Skia.Path.Make()
  // there throws "undefined (reading 'PathBuilder')" and 500s the whole app.
  // By render time Skia is ready: native has it, web only mounts this via
  // WithSkiaWeb after CanvasKit loads.
  const emptyPath = useMemo(() => Skia.Path.Make(), []);
  const activePath = useSharedValue<SkPath>(emptyPath);
  const canvasRef = useCanvasRef();

  // Decode the (optional) creator-drawn background data URI once per source
  // string change. Skia.Data.fromBase64 wants the raw base64 payload, not the
  // "data:image/...;base64," prefix.
  // Decoding a prop (the backgroundImage data URI) into a Skia surface object
  // is exactly the "synchronize with an external system" case the lint rule
  // exists for, not a derivable-during-render value.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!backgroundImage) {
      setBgImage(null);
      return;
    }
    const commaIndex = backgroundImage.indexOf(",");
    const base64 = commaIndex >= 0 ? backgroundImage.slice(commaIndex + 1) : backgroundImage;
    try {
      const data = Skia.Data.fromBase64(base64);
      const image = Skia.Image.MakeImageFromEncoded(data);
      setBgImage(image ?? null);
    } catch {
      setBgImage(null);
    }
  }, [backgroundImage]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function commitPath(path: SkPath): void {
    setCommittedOps((prev) => [
      ...prev,
      {
        kind: "stroke",
        path,
        color: colorRef.current,
        strokeWidth: strokeWidthRef.current,
        style: brushStyleRef.current,
      },
    ]);
  }

  // Paint bucket. Runs on the JS thread (via runOnJS) on a tap: snapshot the
  // surface, read its pixels, flood-fill the tapped region, and push the result
  // as a full-canvas <Image> op transparent everywhere except the fill.
  function handleFill(xDp: number, yDp: number): void {
    const image = canvasRef.current?.makeImageSnapshot();
    if (!image) return;
    const w = image.width();
    const h = image.height();
    const { width: layoutW, height: layoutH } = layout;
    if (w === 0 || h === 0 || layoutW === 0 || layoutH === 0) return;

    const pixels = image.readPixels(0, 0, {
      width: w,
      height: h,
      colorType: ColorType.RGBA_8888,
      alphaType: AlphaType.Unpremul,
    }) as Uint8Array | null;
    if (!pixels) return;

    // Map the tap (logical dp coords) to surface pixel coords (handles DPR /
    // CanvasKit device-pixel scaling), clamped inside the buffer.
    const sx = Math.min(w - 1, Math.max(0, Math.round((xDp / layoutW) * w)));
    const sy = Math.min(h - 1, Math.max(0, Math.round((yDp / layoutH) * h)));

    const { mask, filledCount } = floodFill(
      pixels,
      w,
      h,
      sx,
      sy,
      hexToRgba(colorRef.current),
      FILL_TOLERANCE,
    );
    if (filledCount === 0) return;

    const data = Skia.Data.fromBytes(mask);
    const fillImage = Skia.Image.MakeImage(
      { width: w, height: h, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul },
      data,
      w * 4,
    );
    if (!fillImage) return;

    setCommittedOps((prev) => [...prev, { kind: "fill", image: fillImage }]);
  }

  const pan = Gesture.Pan()
    .onStart((event) => {
      "worklet";
      const path = Skia.Path.Make();
      path.moveTo(event.x, event.y);
      activePath.value = path;
    })
    .onUpdate((event) => {
      "worklet";
      const path = activePath.value.copy();
      path.lineTo(event.x, event.y);
      activePath.value = path;
    })
    .onEnd(() => {
      "worklet";
      runOnJS(commitPath)(activePath.value);
      activePath.value = emptyPath;
    });

  // No shared-value access here, so this callback can run directly on the JS
  // thread (runOnJS(true)) instead of bridging out of a worklet.
  // react-hooks/refs can't see that gesture callbacks only ever fire
  // post-render (never during render itself), so it flags handleFill's
  // canvasRef.current read here as if it could happen during render.
  const tap = Gesture.Tap()
    .runOnJS(true)
    // eslint-disable-next-line react-hooks/refs
    .onEnd((event) => {
      handleFill(event.x, event.y);
    });

  // One tool at a time: a fill tap must never draw, and a brush drag must never
  // fill. Selecting the gesture by tool keeps them mutually exclusive.
  const gesture = tool === "fill" ? tap : pan;

  function handleClear(): void {
    setCommittedOps([]);
    activePath.value = emptyPath;
    onClear?.();
  }

  function undo(): void {
    setCommittedOps((prev) => prev.slice(0, -1));
  }

  function exportToImage(): SkImage | null {
    return canvasRef.current?.makeImageSnapshot() ?? null;
  }

  function handleLayout(event: LayoutChangeEvent): void {
    const { width, height } = event.nativeEvent.layout;
    setLayout((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  }

  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = { exportToImage, clear: handleClear, undo };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiRef, committedOps]);

  return (
    <View className="flex-1">
      <GestureDetector gesture={gesture}>
        <View className="flex-1 bg-scribl-paper" onLayout={handleLayout}>
          <Canvas style={{ flex: 1 }} ref={canvasRef}>
            {bgImage && (
              <SkiaImage
                image={bgImage}
                x={0}
                y={0}
                width={layout.width}
                height={layout.height}
                fit="fill"
              />
            )}
            {committedOps.map((op, index) => {
              if (op.kind !== "stroke") {
                return (
                  <SkiaImage
                    key={index}
                    image={op.image}
                    x={0}
                    y={0}
                    width={layout.width}
                    height={layout.height}
                    fit="fill"
                  />
                );
              }
              if (op.style === "fork") {
                return buildForkPaths(op.path, forkOffset(op.strokeWidth)).map((forkPath, tine) => (
                  <Path
                    key={`${index}-fork-${tine}`}
                    path={forkPath}
                    color={op.color}
                    style="stroke"
                    strokeWidth={Math.max(2, op.strokeWidth * 0.8)}
                    strokeJoin="round"
                    strokeCap="round"
                  />
                ));
              }
              return strokeElements(String(index), op.path, op.color, op.strokeWidth, op.style);
            })}
            {/* Live preview: fork snaps to three tines on release (needs the committed points),
                so while drawing it shows a single guide line; other styles preview as-is. */}
            {brushStyle === "fork" ? (
              <Path
                path={activePath}
                color={color}
                style="stroke"
                strokeWidth={Math.max(2, strokeWidth * 0.8)}
                strokeJoin="round"
                strokeCap="round"
              />
            ) : (
              strokeElements("active", activePath, color, strokeWidth, brushStyle)
            )}
          </Canvas>
        </View>
      </GestureDetector>
      {hideInternalClear ? null : (
        <Button variant="outline" onPress={handleClear} className="m-3 self-start">
          <Text>Clear</Text>
        </Button>
      )}
    </View>
  );
}
