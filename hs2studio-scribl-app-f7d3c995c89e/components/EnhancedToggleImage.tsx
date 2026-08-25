import { Sparkles } from "lucide-react-native";
import type { ReactNode } from "react";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { DrawingImage } from "@/components/DrawingImage";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { AI_ENABLED } from "@/src/config/features";

export interface EnhancedToggleImageProps {
  /** Data-URI reference to the original stored drawing, if any. */
  imageRef?: string;
  /** Data-URI reference to the AI-enhanced drawing, if ready. */
  enhancedImageRef?: string;
  /** Server-reported enhancement state; drives toggle availability + status chrome. */
  enhancementStatus?: "pending" | "ready" | "failed";
  /** Rendered when no `imageRef` is available at all. */
  fallback: ReactNode;
  testID?: string;
  /** Tile (compact, no status chrome) or detail (full status chrome + labeled toggle). */
  variant?: "tile" | "detail";
  /**
   * Controlled mode: when `onToggleOriginal` is provided, the parent owns the
   * original/enhanced state (e.g. to render the toggle pill *above* the image
   * frame) and this component renders NO internal pill. Otherwise the toggle is
   * uncontrolled and rendered as a top-right overlay pill (used by tiles).
   */
  showOriginal?: boolean;
  onToggleOriginal?: () => void;
}

/**
 * Wraps DrawingImage with a presentational original/enhanced toggle.
 * Purely presentational: reflects whatever enhancementStatus/enhancedImageRef
 * the caller passes, never polling or gating itself (that lives in the store
 * per AC2/AC4 conventions).
 */
export function EnhancedToggleImage({
  imageRef,
  enhancedImageRef,
  enhancementStatus,
  fallback,
  testID,
  variant = "tile",
  showOriginal: showOriginalProp,
  onToggleOriginal,
}: EnhancedToggleImageProps): React.JSX.Element {
  const [internalShowOriginal, setInternalShowOriginal] = useState(false);
  const isControlled = onToggleOriginal !== undefined;
  const showOriginal = isControlled ? Boolean(showOriginalProp) : internalShowOriginal;

  // Global AI kill-switch: when off, treat status as absent so no AI chrome
  // (pending/failed/toggle/badge) ever renders — plain image only.
  const effectiveStatus = AI_ENABLED ? enhancementStatus : undefined;
  const canToggle = effectiveStatus === "ready" && !!enhancedImageRef;
  const showEnhanced = canToggle && !showOriginal;
  // Defensive: a record with only an enhancedImageRef (no original) should
  // still show real art rather than the synthetic fallback — e.g. when AI is
  // off, or when toggled to "original" with no original stored.
  const displayedRef = showEnhanced ? enhancedImageRef : (imageRef ?? enhancedImageRef);

  const image = (
    <DrawingImage imageRef={displayedRef} testID={testID} fallback={fallback} />
  );

  return (
    // `flex-1` gives a definite height via flexbox; `w-full` is required because
    // parents use `items-center`, so without an explicit width this box shrinks
    // to its (absolutely-positioned, out-of-flow) content and collapses to 0px
    // wide, hiding the absolute-fill image.
    <View className="w-full flex-1 items-center justify-center">
      {showEnhanced ? (
        <View testID="enhanced-image" style={StyleSheet.absoluteFill}>
          {image}
        </View>
      ) : (
        image
      )}

      {variant === "detail" && effectiveStatus === "pending" && (
        <View testID="enhanced-pending" className="items-center gap-2 px-2">
          <ActivityIndicator />
          <Text className="text-muted text-center text-xs">Creating your enhanced version…</Text>
        </View>
      )}

      {variant === "detail" && effectiveStatus === "failed" && (
        <View testID="enhanced-failed" className="items-center gap-2 px-2">
          <Text className="text-muted text-center text-xs">Enhancement unavailable</Text>
        </View>
      )}

      {variant === "tile" && effectiveStatus === "pending" && (
        <View
          testID="enhanced-pending-badge"
          className="absolute bottom-1 right-1 h-5 w-5 items-center justify-center rounded-full bg-black/60"
        >
          <ActivityIndicator size="small" color="#FFFFFF" />
        </View>
      )}

      {/* Uncontrolled overlay pill (tiles). In controlled mode the parent renders
          the toggle above the frame, so we render nothing here. */}
      {canToggle && !isControlled && (
        <Pressable
          testID="enhance-toggle"
          accessibilityLabel={showOriginal ? "Show enhanced" : "Show original"}
          onPress={() => setInternalShowOriginal((prev) => !prev)}
          className={
            variant === "detail"
              ? "absolute top-2 right-2 h-8 flex-row items-center gap-1 rounded-full bg-black/60 px-3"
              : "absolute top-1 right-1 h-6 w-6 items-center justify-center rounded-full bg-black/60"
          }
        >
          <Icon as={Sparkles} className="text-white" size={variant === "detail" ? 16 : 14} />
          {variant === "detail" && (
            <Text className="text-xs font-semibold text-white">
              {showOriginal ? "AI" : "Original"}
            </Text>
          )}
        </Pressable>
      )}
    </View>
  );
}
