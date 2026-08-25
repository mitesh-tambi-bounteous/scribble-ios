import { PaintBucket, Trash2, Undo2 } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Image, Pressable, ScrollView, View } from "react-native";

import { PaperSurface } from "@/components/art/PaperSurface";
import DrawingCanvas, { type BrushStyle, type SkiaCanvasRef } from "@/components/canvas/DrawingCanvas";
import { StyleGlyph } from "@/components/canvas/StyleGlyph";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { PALETTE } from "@/lib/palette";

// Six brush sizes (doubled from three): finer 2, the original 3/5/8, thicker 12/18.
const BRUSH_SIZES = [2, 3, 5, 8, 12, 18];
// Default stroke stays the original 3 (index 1) so first-draw feel is unchanged.
const DEFAULT_BRUSH = BRUSH_SIZES[1];

// The extended, stylized brushes — a second bubble beside the six size dots.
const BRUSH_STYLES: readonly { style: BrushStyle; label: string }[] = [
  { style: "basic", label: "Pen brush" },
  { style: "fork", label: "Fork brush" },
  { style: "dotted", label: "Dotted brush" },
  { style: "neon", label: "Neon brush" },
];

export interface DrawPadProps {
  /** Called with the exported PNG data URI when the user taps Done and export succeeds. */
  onDone: (imageDataUri: string) => void;
  /** Done button label (default "Done"). */
  doneLabel?: string;
  /** Label shown (and disabled state forced) while the parent is busy handling Done. */
  busy?: boolean;
  busyLabel?: string;
  /** testID for the Done button, so callers keep their existing hooks (e.g. "challenge-done"). */
  doneTestID?: string;
  /** Shows the small exported-PNG thumbnail after Done (the Today draw flow uses this). */
  showPreview?: boolean;
  /** Overlays a dashed circle guide on the canvas (the avatar flow: "what fits in the circle"). */
  showCircleGuide?: boolean;
  /**
   * Restricts the brush-style row to this subset (creator-defined challenge
   * toolset). Undefined shows all styles (today's behavior). Initial selection
   * is the first allowed style.
   */
  allowedBrushStyles?: BrushStyle[];
  /**
   * Restricts the color palette to this subset (creator-defined challenge
   * toolset), preserving palette order. Undefined shows the full palette
   * (today's behavior). Initial selection is the first allowed color.
   */
  allowedColors?: string[];
  /** Optional shared background (PNG data URI) drawn by a challenge creator. */
  backgroundImage?: string;
  /**
   * Per-drawing countdown in seconds. Undefined disables the timer entirely
   * (today's behavior). On expiry, auto-invokes the same Done path exactly
   * once (guarded by `busy`).
   */
  timerSeconds?: number;
}

/** Formats whole seconds as "M:SS". */
function formatTimer(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * The shared drawing pad: the Skia canvas plus the full toolbar (double-stacked
 * 16-color palette, six brush sizes, fill/undo/clear) and a Done button. Owns
 * the color/brush/tool state and the export handoff so every screen that lets a
 * user draw — the daily prompt (app/draw.tsx) and the blind draw-off challenge
 * (app/challenge/[id].tsx) — gets the identical canvas experience. Submission,
 * navigation, and prompt/challenge context stay with the parent via onDone.
 */
export function DrawPad({
  onDone,
  doneLabel = "Done",
  busy = false,
  busyLabel = "Submitting...",
  doneTestID,
  showPreview = false,
  showCircleGuide = false,
  allowedBrushStyles,
  allowedColors,
  backgroundImage,
  timerSeconds,
}: DrawPadProps): React.JSX.Element {
  const apiRef = useRef<SkiaCanvasRef | null>(null);
  const palette = allowedColors && allowedColors.length > 0 ? allowedColors : PALETTE;
  const brushStyles =
    allowedBrushStyles && allowedBrushStyles.length > 0
      ? BRUSH_STYLES.filter((entry) => allowedBrushStyles.includes(entry.style))
      : BRUSH_STYLES;
  const [canvasColor, setCanvasColor] = useState<string>(palette[0]);
  const [brush, setBrush] = useState<number>(DEFAULT_BRUSH);
  const [brushStyle, setBrushStyle] = useState<BrushStyle>(brushStyles[0]?.style ?? "basic");
  const [fillMode, setFillMode] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | undefined>(timerSeconds);
  const autoDoneRef = useRef(false);

  function handleClear(): void {
    apiRef.current?.clear();
    setPreviewUri(null);
    setExportError(null);
  }

  function handleUndo(): void {
    apiRef.current?.undo();
    setPreviewUri(null);
    setExportError(null);
  }

  function handleDone(): void {
    setExportError(null);
    let imageDataUri: string;
    try {
      const image = apiRef.current?.exportToImage();
      if (!image) return;
      const base64 = image.encodeToBase64();
      imageDataUri = `data:image/png;base64,${base64}`;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not export your drawing.";
      setExportError(message);
      return;
    }
    if (showPreview) setPreviewUri(imageDataUri);
    onDone(imageDataUri);
  }

  // Per-drawing countdown (challenge timer): ticks once a second, bounded to
  // >= 0, and on expiry auto-invokes the same Done path exactly once — guarded
  // by autoDoneRef (fires even if the parent hasn't flipped `busy` yet) AND
  // `busy` (never re-fire while the parent is mid-submit). Cleared on unmount.
  useEffect(() => {
    if (timerSeconds === undefined) return;
    // Resetting the countdown to a new timerSeconds prop (e.g. a fresh
    // challenge) is synchronizing with that external prop, not derivable
    // during render — the interval below is the actual "external system".
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRemainingSeconds(timerSeconds);
    autoDoneRef.current = false;
    const intervalId = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev === undefined) return prev;
        const next = prev - 1;
        return next < 0 ? 0 : next;
      });
    }, 1000);
    return () => clearInterval(intervalId);
  }, [timerSeconds]);

  useEffect(() => {
    if (timerSeconds === undefined) return;
    if (remainingSeconds !== 0) return;
    if (autoDoneRef.current || busy) return;
    autoDoneRef.current = true;
    handleDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSeconds, timerSeconds, busy]);

  return (
    <View className="flex-1">
      <PaperSurface className="flex-1 mx-[18px]">
        <View className="flex-1">
          <DrawingCanvas
            apiRef={apiRef}
            onClear={() => setPreviewUri(null)}
            color={canvasColor}
            strokeWidth={brush}
            brushStyle={brushStyle}
            tool={fillMode ? "fill" : "brush"}
            hideInternalClear
            backgroundImage={backgroundImage}
          />
        </View>
        {timerSeconds !== undefined && (
          <Text
            testID="drawpad-timer"
            className="text-muted absolute right-4 top-3.5 text-xs font-bold"
          >
            {formatTimer(remainingSeconds ?? timerSeconds)}
          </Text>
        )}
        {showCircleGuide && (
          <View
            pointerEvents="none"
            className="absolute inset-0 items-center justify-center"
          >
            <View className="aspect-square w-[82%] rounded-full border-2 border-dashed border-muted opacity-60" />
          </View>
        )}
        <Text className="text-muted absolute left-4 top-3.5 text-xs font-bold opacity-70">
          {showCircleGuide
            ? "draw inside the circle"
            : fillMode
              ? "tap a region to fill"
              : "tap + drag to draw"}
        </Text>
      </PaperSurface>

      {showPreview && previewUri && (
        <View className="items-center px-4 pt-2">
          <Image
            testID="export-preview"
            source={{ uri: previewUri }}
            style={{ width: 64, height: 64, borderRadius: 8 }}
            resizeMode="contain"
          />
        </View>
      )}

      {exportError && (
        <View className="px-4 pt-2">
          <Text className="text-center text-foreground">{exportError}</Text>
        </View>
      )}

      <View className="px-[18px] pt-4">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-col gap-[8px] p-1">
            {[palette.slice(0, 8), palette.slice(8)].map((row, rowIndex) => (
              <View key={rowIndex} className="flex-row gap-[8px]">
                {row.length === 0 ? (
                  // Invariant: the background canvas (always full palette, two
                  // rows) is composited fit="fill" behind the entry canvas
                  // (components/canvas/SkiaCanvas.tsx:374-381), so toolbar
                  // height must never vary with the toolset — a restricted
                  // palette (<=8 colors) needs this invisible placeholder to
                  // keep the second row's height/gap identical to the full
                  // palette, or the background gets vertically stretched.
                  <View
                    testID="palette-row-spacer"
                    style={{ opacity: 0 }}
                    pointerEvents="none"
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    className="h-[30px] w-[30px] rounded-full"
                  />
                ) : (
                  row.map((swatch) => {
                    const selected = swatch === canvasColor;
                    return (
                      <Pressable
                        key={swatch}
                        accessibilityRole="button"
                        accessibilityLabel={`Choose color ${swatch}`}
                        onPress={() => setCanvasColor(swatch)}
                        style={{ backgroundColor: swatch }}
                        className={`h-[30px] w-[30px] rounded-full ${
                          selected ? "border-[3px] border-foreground scale-110" : ""
                        }`}
                      />
                    );
                  })
                )}
              </View>
            ))}
          </View>
        </ScrollView>

        <View className="flex-row items-center gap-3 mt-[12px]">
          <View className="flex-row items-center gap-2 rounded-full bg-surface border-line border px-[10px] py-[6px]">
            {BRUSH_SIZES.map((size) => {
              const selected = size === brush;
              return (
                <Pressable
                  key={size}
                  accessibilityRole="button"
                  accessibilityLabel={`Brush size ${size}`}
                  accessibilityState={{ selected }}
                  onPress={() => setBrush(size)}
                  className="h-6 w-6 items-center justify-center"
                >
                  <View
                    style={{ width: size + 2, height: size + 2, borderRadius: 999 }}
                    className={selected ? "bg-foreground" : "bg-muted"}
                  />
                </Pressable>
              );
            })}
          </View>

          {/* Extended stylized brushes — a second, bigger bubble to the right. */}
          <View className="flex-row items-center gap-2 rounded-full bg-surface border-line border px-3 py-2">
            {brushStyles.map(({ style, label }) => {
              const selected = brushStyle === style;
              return (
                <Pressable
                  key={style}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ selected }}
                  onPress={() => setBrushStyle(style)}
                  className={`h-8 w-8 items-center justify-center rounded-full ${
                    selected ? "bg-foreground" : ""
                  }`}
                >
                  <StyleGlyph style={style} active={selected} />
                </Pressable>
              );
            })}
          </View>
        </View>

        <View className="flex-row items-center gap-3 mt-[12px]">
          <Pressable
            onPress={() => setFillMode((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel="Fill tool"
            accessibilityState={{ selected: fillMode }}
            className={`h-[42px] w-[42px] items-center justify-center rounded-full border ${
              fillMode ? "bg-foreground border-foreground" : "bg-surface border-line"
            }`}
          >
            <Icon
              as={PaintBucket}
              className={fillMode ? "text-background" : "text-foreground"}
              size={18}
            />
          </Pressable>

          <Pressable
            onPress={handleUndo}
            accessibilityRole="button"
            accessibilityLabel="Undo"
            className="h-[42px] w-[42px] items-center justify-center rounded-full bg-surface border-line border"
          >
            <Icon as={Undo2} className="text-foreground" size={19} />
          </Pressable>

          <Pressable
            onPress={handleClear}
            accessibilityRole="button"
            accessibilityLabel="Clear canvas"
            className="h-[42px] w-[42px] items-center justify-center rounded-full bg-surface border-line border"
          >
            <Icon as={Trash2} className="text-foreground" size={18} />
          </Pressable>

          <Button
            className="flex-1"
            testID={doneTestID}
            disabled={busy}
            onPress={handleDone}
          >
            <Text>{busy ? busyLabel : doneLabel}</Text>
          </Button>
        </View>
      </View>
    </View>
  );
}
