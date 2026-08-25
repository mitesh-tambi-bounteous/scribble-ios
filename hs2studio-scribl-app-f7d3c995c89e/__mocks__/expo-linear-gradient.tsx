/**
 * Jest mock for expo-linear-gradient.
 *
 * Root cause: react-native 0.85.3's bundled ReactNativeRenderer hardcodes an
 * internal version check against the installed `react` package version.
 * This repo pins react/react-dom to 19.2.7 (react-native's peerDep wants
 * ^19.2.3), so the check throws "Incompatible React versions". The check
 * only runs inside expo-modules-core's NativeViewManagerAdapter
 * componentDidMount, which fires when a native-module-backed view (like
 * LinearGradient) actually mounts. Plain RN Views/Text never hit it.
 *
 * This mock renders LinearGradient as a plain passthrough View so gradient
 * branches can be rendered in jest without mounting the native view manager.
 */
import * as React from "react";
import { View, type ViewProps } from "react-native";

type LinearGradientProps = ViewProps & {
  colors?: readonly (string | number)[];
  locations?: readonly number[] | null;
  start?: { x: number; y: number } | null;
  end?: { x: number; y: number } | null;
};

function LinearGradient({ colors, locations, start, end, ...rest }: LinearGradientProps) {
  return <View {...rest} />;
}

export { LinearGradient };
export default { LinearGradient };
