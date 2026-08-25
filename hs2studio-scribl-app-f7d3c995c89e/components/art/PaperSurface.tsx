import { cn } from "@/lib/utils";
import * as React from "react";
import { Platform, View, type StyleProp, type ViewStyle } from "react-native";

export interface PaperSurfaceProps {
  children?: React.ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
  /** Dot-grid cell size in px. Defaults to 22. */
  dotSize?: number;
}

/**
 * "Paper" surface used behind canvas art, wall tiles, detail art, and share
 * art: a `bg-paper` card with a faint dot-grid overlay. On web the overlay
 * is a CSS radial-gradient background-image; on native it's a plain tinted
 * View (a full dot-grid canvas isn't worth the per-frame cost here — this is
 * a decorative surface, not the drawing canvas).
 */
export function PaperSurface({
  children,
  className,
  style,
  dotSize = 22,
}: PaperSurfaceProps): React.JSX.Element {
  // Web: a real dot-grid via CSS background-image (uses the themed --border
  // var directly, so it recolors with the active theme). Native: NativeWind
  // resolves `border-line`'s var(--border) at style time, so a thin tinted
  // View using that same token approximates the grid without a per-frame
  // canvas draw.
  const overlayStyle: StyleProp<ViewStyle> = Platform.select({
    web: {
      backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)",
      backgroundSize: `${dotSize}px ${dotSize}px`,
      opacity: 0.4,
    } as unknown as ViewStyle,
    default: undefined,
  });

  return (
    <View className={cn("bg-paper rounded-card overflow-hidden", className)} style={style}>
      <View
        pointerEvents="none"
        className={cn(
          "absolute inset-0",
          Platform.OS !== "web" && "border-line border opacity-[0.06]",
        )}
        style={overlayStyle}
      />
      {children}
    </View>
  );
}
