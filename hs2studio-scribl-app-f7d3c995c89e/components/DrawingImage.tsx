import type { ReactNode } from "react";
import { Image, StyleSheet } from "react-native";

interface DrawingImageProps {
  /** Data-URI (or remote URL) reference to a stored drawing, if any. */
  imageRef?: string;
  /** Rendered when `imageRef` is absent or empty. */
  fallback: ReactNode;
  /** Optional testID applied to the rendered <Image>. */
  testID?: string;
}

/**
 * Renders a stored drawing (`imageRef`, typically a base64 data-URI) as an
 * <Image>, falling back to synthetic art when no real drawing was captured.
 * Kept tiny and reused across wall/family/response/share/challenge screens.
 *
 * Sizing: fills its parent via `StyleSheet.absoluteFill` (position: absolute,
 * inset: 0) rather than `height: "100%"`. On React Native Web a percentage
 * height only resolves against a parent that exposes a CSS `height`; the flex
 * containers these images live in size via flexbox and expose none, so a
 * percentage-height <Image> collapses to 0px and renders blank. absoluteFill
 * fills the nearest sized, relatively-positioned ancestor on web AND native.
 * Every consumer wraps this in a definite-size box (aspect-square / h-[320px]).
 */
export function DrawingImage({ imageRef, fallback, testID }: DrawingImageProps): React.JSX.Element {
  if (!imageRef) {
    return <>{fallback}</>;
  }

  return (
    <Image
      testID={testID}
      source={{ uri: imageRef }}
      style={StyleSheet.absoluteFill}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
      onError={(event) => {
        // Defense-in-depth: a web <Image> that fails to decode a data-URI/URL
        // renders silently blank. Surface it in dev so a load failure is never
        // mistaken for the (now-fixed) sizing collapse.
        if (__DEV__) {
          console.warn("DrawingImage: image failed to load", {
            testID,
            refPrefix: imageRef.slice(0, 32),
            error: event.nativeEvent,
          });
        }
      }}
    />
  );
}
