import { cn } from "@/lib/utils";
import { LinearGradient } from "expo-linear-gradient";
import * as React from "react";
import { Image, Text, View } from "react-native";

/**
 * Avatar component that displays an initial letter in a circular container.
 *
 * The circular shape is enforced by a clipped wrapper (borderRadius: size/2, overflow: hidden)
 * to fix a square LinearGradient bug. A solid backgroundColor is used when color is provided;
 * otherwise, a gradient (orange → pink) fills the wrapper.
 *
 * @component
 * @example
 * ```tsx
 * <Avatar name="Alice" color="#FF5A5F" size={50} />
 * <Avatar name="Bob" size={40} />  // uses gradient
 * ```
 *
 * @param {string} name - User name; extracts the first letter (uppercase).
 * @param {string} [color] - Optional hex color; solid fill when provided, gradient fallback otherwise.
 * @param {string} [imageUri] - Optional hand-drawn avatar (data-URI/URL); when set it fills the
 *   circle (clipped by the wrapper) and takes precedence over color/gradient+initial. If the
 *   image fails to load (e.g. a corrupt/truncated data-URI), the component falls back to the
 *   same color/gradient+initial rendering used when no image is set at all, rather than
 *   rendering a blank circle (QA: "avatar renders blank in family tiles").
 * @param {number} [size=40] - Avatar diameter in pixels.
 * @param {string} [testID] - Optional test ID for testing.
 */
interface AvatarProps {
  name: string;
  color?: string;
  imageUri?: string;
  size?: number;
  testID?: string;
}

function Avatar({ name, color, imageUri, size = 40, testID }: AvatarProps) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const fontSize = size * 0.42;
  const borderRadius = size / 2;
  const [imageFailed, setImageFailed] = React.useState(false);
  const [lastImageUri, setLastImageUri] = React.useState(imageUri);
  // Reset the failure flag when the image source itself changes (e.g. the
  // user re-draws their avatar), so a stale failure doesn't stick forever.
  // Adjusted during render (React's documented pattern for resetting state
  // on a prop change) rather than an effect, to avoid an extra commit.
  if (imageUri !== lastImageUri) {
    setLastImageUri(imageUri);
    if (imageFailed) setImageFailed(false);
  }
  const hasImage = typeof imageUri === "string" && imageUri.length > 0 && !imageFailed;

  // Circular wrapper with clipping to fix gradient square bug (and to mask a
  // hand-drawn avatar image into a circle).
  const wrapperStyle = {
    width: size,
    height: size,
    borderRadius,
    overflow: "hidden" as const,
    backgroundColor: hasImage ? "#FFFFFF" : color,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };

  const textStyle = {
    fontSize,
    fontWeight: "bold" as const,
    color: "white",
    fontFamily: "Fredoka", // font-display
  };

  if (hasImage) {
    return (
      <View testID={testID} style={wrapperStyle}>
        <Image
          testID={testID ? `${testID}-image` : undefined}
          source={{ uri: imageUri }}
          style={{ width: size, height: size }}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          onError={() => setImageFailed(true)}
        />
      </View>
    );
  }

  return (
    <View testID={testID} style={wrapperStyle}>
      {!color && (
        <LinearGradient
          colors={["#FF9F45", "#FF3D9A"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            flex: 1,
            width: "100%",
            height: "100%",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={textStyle}>{initial}</Text>
        </LinearGradient>
      )}
      {color && <Text style={textStyle}>{initial}</Text>}
    </View>
  );
}

export { Avatar };
export type { AvatarProps };
