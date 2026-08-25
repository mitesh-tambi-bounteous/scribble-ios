import { WithSkiaWeb } from "@shopify/react-native-skia/lib/module/web";
import React, { useSyncExternalStore } from "react";
import { Text, View } from "react-native";

// TYPE-ONLY import: erased at build time, so it does NOT statically evaluate
// SkiaCanvas (and therefore the @shopify/react-native-skia main module). That
// matters on web — see the note on WebDrawingCanvas below.
import type { BrushStyle, SkiaCanvasRef } from "./SkiaCanvas";

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
   * Prop-based imperative handle (not a React ref). WithSkiaWeb lazy-loads
   * SkiaCanvas on web and does not forward refs, so both platforms use this
   * mutable ref object passed as a normal prop instead.
   */
  apiRef?: React.MutableRefObject<SkiaCanvasRef | null>;
}

/** Stable no-op subscribe for the client-detection useSyncExternalStore. */
const subscribeNoop = (): (() => void) => () => {};

function CanvasFallback({ label }: { label: string }): React.JSX.Element {
  return (
    <View className="flex-1 items-center justify-center bg-scribl-paper">
      <Text>{label}</Text>
    </View>
  );
}

/**
 * Contains a Skia/CanvasKit load or render failure to the canvas surface.
 * If the CanvasKit wasm is missing or fails to load, Skia throws
 * "Cannot read properties of undefined (reading 'PathBuilder')"; without a
 * boundary that unmounts the whole navigator. This keeps the blast radius to
 * the canvas and shows an inline, recoverable message instead.
 */
class SkiaErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  render(): React.ReactNode {
    if (this.state.failed) {
      return (
        <View className="flex-1 items-center justify-center gap-2 bg-scribl-paper p-6">
          <Text className="text-center text-scribl-ink">Couldn&apos;t load the drawing canvas.</Text>
          <Text className="text-center text-xs text-scribl-ink/60">
            Run `npm run setup-skia-web` to fetch canvaskit.wasm, then reload.
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

/**
 * Web drawing canvas. CanvasKit only exists in the browser, and — critically —
 * `@shopify/react-native-skia`'s web entry binds its `Skia` API to
 * `global.CanvasKit` AT MODULE-LOAD time (`Skia.web.js`:
 * `export const Skia = JsiSkApi(global.CanvasKit)`). So SkiaCanvas (which
 * imports that module) must be evaluated ONLY after `LoadSkiaWeb` has set
 * `global.CanvasKit` — i.e. exclusively through `WithSkiaWeb`'s dynamic
 * `import()`. If it were imported statically anywhere on web, `Skia` would bind
 * to `undefined` and every `Skia.Path.Make()` would throw PathBuilder. Hence:
 *   - a type-only import of SkiaCanvasRef above (no runtime evaluation), and
 *   - the native static import lives in DrawingCanvas.native.tsx (Skia is ready
 *     immediately on native, so there is no load ordering problem there).
 *
 * Additionally, expo web uses static rendering (SSR); `WithSkiaWeb` would run
 * `LoadSkiaWeb()` in Node and crash the server pass. The client-only mount gate
 * renders the fallback during SSR + first client render (hydration-safe), then
 * swaps in the loader in the browser where the wasm (guaranteed by the
 * preweb/prestart hook) can load.
 */
function WebDrawingCanvas({
  onClear,
  color,
  strokeWidth,
  tool,
  brushStyle,
  hideInternalClear,
  backgroundImage,
  apiRef,
}: DrawingCanvasProps): React.JSX.Element {
  // Client-only gate WITHOUT setState-in-an-effect: getServerSnapshot returns
  // false so SSR and the hydration pass render the fallback (no mismatch, and
  // WithSkiaWeb's LoadSkiaWeb never runs in Node); getSnapshot returns true so
  // the browser then swaps in the real loader.
  const isClient = useSyncExternalStore(subscribeNoop, () => true, () => false);

  if (!isClient) return <CanvasFallback label="Loading canvas..." />;

  return (
    <SkiaErrorBoundary>
      <WithSkiaWeb
        getComponent={() => import("./SkiaCanvas")}
        // LoadSkiaWeb otherwise resolves canvaskit.wasm relative to the
        // current route (e.g. /challenge/canvaskit.wasm on a nested route,
        // which 404s to the HTML fallback and throws a WebAssembly
        // CompileError). Force it to resolve from the site root, where
        // `npm run setup-skia-web` places the wasm file (public/canvaskit.wasm).
        opts={{ locateFile: (file: string) => `/${file}` }}
        componentProps={{
          onClear,
          color,
          strokeWidth,
          tool,
          brushStyle,
          hideInternalClear,
          backgroundImage,
          apiRef,
        }}
        fallback={<CanvasFallback label="Loading canvas..." />}
      />
    </SkiaErrorBoundary>
  );
}

/**
 * Platform wrapper around the Skia drawing surface (web resolution). Native
 * platforms resolve DrawingCanvas.native.tsx instead. Same SkiaCanvas renders
 * on every platform (AC7 parity) — only the load path differs.
 */
export default function DrawingCanvas(props: DrawingCanvasProps): React.JSX.Element {
  return <WebDrawingCanvas {...props} />;
}
