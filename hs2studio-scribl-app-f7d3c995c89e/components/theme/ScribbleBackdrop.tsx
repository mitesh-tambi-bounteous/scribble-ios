import * as React from "react";
import { StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Defs, G, Line, Path, Pattern, Polygon, Rect } from "react-native-svg";

import { DOODLE_PATHS } from "@/components/art/Doodle";
import { useThemeStore } from "@/src/stores/useThemeStore";

/**
 * Decorative page backdrop for the `scribble` and `notepad` themes. Renders
 * behind screen content (absolute fill, non-interactive):
 *  - scribble: a subtle dotted grid ("notebook dots") across the whole area,
 *    a two-tone pale-mint wavy banner along the top edge, and a couple of
 *    playful doodle accents (an amber triangle + a coral dot).
 *  - notepad: a yellow-legal-pad look — evenly spaced horizontal ruled lines
 *    down the whole page, a red vertical margin line near the left edge, and
 *    a few faint scattered outline doodles.
 *
 * Sizes itself to whatever it fills via onLayout, so when it's placed as the
 * first child INSIDE a ScrollView's content it spans the full scrollable height
 * and scrolls WITH the content (the wave/rules sit on the page and scroll away)
 * instead of staying pinned to the viewport and bleeding through translucent
 * cards. Falls back to the window size before first layout.
 *
 * Returns null for every other theme, so ink/studio keep their own flat
 * backgrounds. Web + native (Skia-free react-native-svg).
 */
const DOT_COLOR = "#2E1A5E";
const DOT_SPACING = 26;
const MINT_BACK = "#CDEEE8";
const MINT_FRONT = "#E2F5F1";
const TRIANGLE = "#F5A623";
const CORAL = "#F0736E";

const RULE_SPACING = 34;
const RULE_COLOR = "rgba(36, 48, 73, 0.18)";
const MARGIN_COLOR = "#E4322B";
const MARGIN_X = 14;
const NOTEPAD_DOODLE_COLOR = "rgba(36, 48, 73, 0.22)";

export function ScribbleBackdrop(): React.JSX.Element | null {
  const theme = useThemeStore((state) => state.theme);
  const win = useWindowDimensions();
  const [size, setSize] = React.useState<{ w: number; h: number }>({ w: 0, h: 0 });

  const onLayout = React.useCallback((e: LayoutChangeEvent): void => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
  }, []);

  if (theme !== "scribble" && theme !== "notepad") {
    return null;
  }

  const w = size.w > 0 ? size.w : win.width > 0 ? win.width : 390;
  const h = size.h > 0 ? size.h : win.height > 0 ? win.height : 844;

  if (theme === "notepad") {
    const ruleCount = Math.max(1, Math.ceil(h / RULE_SPACING));
    const rules = Array.from({ length: ruleCount }, (_, i) => (i + 1) * RULE_SPACING);

    return (
      <View
        pointerEvents="none"
        onLayout={onLayout}
        style={StyleSheet.absoluteFill}
        testID="notepad-backdrop"
      >
        <Svg width={w} height={h}>
          {/* Horizontal ruled lines down the whole page. */}
          {rules.map((y) => (
            <Line key={y} x1={0} y1={y} x2={w} y2={y} stroke={RULE_COLOR} strokeWidth={1} />
          ))}

          {/* Red vertical margin line near the left edge. */}
          <Line
            x1={MARGIN_X}
            y1={0}
            x2={MARGIN_X}
            y2={h}
            stroke={MARGIN_COLOR}
            strokeWidth={2}
            opacity={0.3}
          />

          {/* Faint scattered doodle scribbles. */}
          <G opacity={1}>
            <G transform="translate(6, 8) scale(0.34)">
              <Path
                d={DOODLE_PATHS.toothbrush}
                fill="none"
                stroke={NOTEPAD_DOODLE_COLOR}
                strokeWidth={4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </G>
            <G transform={`translate(${w - 66}, 10) scale(0.34)`}>
              <Path
                d={DOODLE_PATHS.crayon}
                fill="none"
                stroke={NOTEPAD_DOODLE_COLOR}
                strokeWidth={4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </G>
            <G transform={`translate(4, ${h * 0.45})`}>
              <G transform="scale(0.34)">
                <Path
                  d={DOODLE_PATHS.hairbrush}
                  fill="none"
                  stroke={NOTEPAD_DOODLE_COLOR}
                  strokeWidth={4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </G>
            </G>
            <G transform={`translate(${w - 62}, ${h - 92})`}>
              <G transform="scale(0.34)">
                <Path
                  d={DOODLE_PATHS.toothbrush}
                  fill="none"
                  stroke={NOTEPAD_DOODLE_COLOR}
                  strokeWidth={4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </G>
            </G>
          </G>
        </Svg>
      </View>
    );
  }

  return (
    <View
      pointerEvents="none"
      onLayout={onLayout}
      style={StyleSheet.absoluteFill}
      testID="scribble-backdrop"
    >
      <Svg width={w} height={h}>
        <Defs>
          <Pattern
            id="scribble-dots"
            x={0}
            y={0}
            width={DOT_SPACING}
            height={DOT_SPACING}
            patternUnits="userSpaceOnUse"
          >
            <Circle cx={1.5} cy={1.5} r={1.4} fill={DOT_COLOR} opacity={0.09} />
          </Pattern>
        </Defs>

        {/* Dotted sketchbook grid across the whole filled area. */}
        <Rect x={0} y={0} width={w} height={h} fill="url(#scribble-dots)" />

        {/* Two-tone mint wave banner along the top. */}
        <Path
          d={`M0 0 L${w} 0 L${w} 70 C ${w * 0.66} 96, ${w * 0.33} 60, 0 90 Z`}
          fill={MINT_BACK}
        />
        <Path
          d={`M0 0 L${w} 0 L${w} 58 C ${w * 0.66} 82, ${w * 0.33} 48, 0 70 Z`}
          fill={MINT_FRONT}
        />

        {/* Playful doodle accents just below the wave. */}
        <Polygon points={`2,166 16,166 9,146`} fill={TRIANGLE} />
        <Circle cx={w - 11} cy={128} r={7} fill={CORAL} />
      </Svg>
    </View>
  );
}
