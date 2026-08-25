import * as React from "react";
import { Path, Svg } from "react-native-svg";

export type DoodleKind =
  | "cat"
  | "coffee"
  | "monster"
  | "taco"
  | "dog"
  | "plant"
  | "rocket"
  | "ghost"
  | "sun"
  | "crayon"
  | "hairbrush"
  | "toothbrush";

/** Single-path line-art doodles, ported verbatim from the design spec. */
export const DOODLE_PATHS: Record<DoodleKind, string> = {
  cat: "M30 72 Q30 42 50 42 Q70 42 70 72 M35 42 L27 24 L43 39 M65 42 L73 24 L57 39 M43 56 h.6 M57 56 h.6 M45 63 Q50 68 55 63 M50 60 v4",
  coffee:
    "M26 40 h42 v20 a17 17 0 0 1 -17 17 h-8 a17 17 0 0 1 -17 -17 z M68 44 h7 a8 8 0 0 1 0 16 h-7 M39 30 q5 -7 0 -14 M51 30 q5 -7 0 -14",
  monster:
    "M30 80 v-26 a20 20 0 0 1 40 0 v26 M35 80 v6 M45 80 v6 M55 80 v6 M65 80 v6 M50 46 a6 6 0 1 0 0.1 0 M38 30 l5 9 M62 30 l-5 9 M42 62 q8 6 16 0",
  taco: "M20 64 a30 30 0 0 1 60 0 z M20 64 q30 -16 60 0 M40 55 h.6 M56 53 h.6 M46 61 q4 3 8 0",
  dog: "M32 70 v-18 a18 18 0 0 1 36 0 v18 M30 48 q-7 3 -7 15 M70 48 q7 3 7 15 M44 57 h.6 M56 57 h.6 M47 64 q3 3 6 0 M50 64 v6",
  plant:
    "M41 84 h18 l-2 -20 h-14 z M50 64 v-22 M50 52 q-15 -2 -17 -19 q15 2 17 19 M50 48 q15 -2 17 -17 q-15 0 -17 17",
  rocket:
    "M50 18 q15 15 15 36 l-6 11 h-18 l-6 -11 q0 -21 15 -36z M50 44 a5 5 0 1 0 0.1 0 M35 62 l-8 15 l13 -6 M65 62 l8 15 l-13 -6",
  ghost:
    "M31 80 v-28 a19 19 0 0 1 38 0 v28 l-6 -6 l-6 6 l-7 -6 l-6 6 l-7 -6z M43 49 h.6 M57 49 h.6 M46 59 q4 4 8 0",
  sun: "M50 34 a16 16 0 1 0 0.1 0 M50 12 v10 M50 78 v10 M12 50 h10 M78 50 h10 M23 23 l7 7 M70 70 l7 7 M77 23 l-7 7 M30 70 l-7 7",
  crayon:
    "M38 26 L50 8 L62 26 M38 26 L38 84 Q38 90 44 90 L56 90 Q62 90 62 84 L62 26 M38 44 L62 44 M38 52 L62 52",
  hairbrush:
    "M32 18 Q50 8 68 18 Q72 40 50 52 Q28 40 32 18 Z M50 52 L50 86 M43 90 Q50 94 57 90 M40 24 h.4 M50 22 h.4 M60 24 h.4 M40 34 h.4 M50 32 h.4 M60 34 h.4 M45 44 h.4 M55 44 h.4",
  toothbrush:
    "M14 52 h44 a5 5 0 0 1 0 10 h-44 a5 5 0 0 1 0 -10 Z M58 52 h22 a4 4 0 0 1 4 4 v2 a4 4 0 0 1 -4 4 h-22 M62 52 v-9 M68 51 v-10 M74 51 v-10 M80 52 v-9",
};

export interface DoodleProps {
  kind: DoodleKind;
  color: string;
  strokeWidth?: number;
}

/** A single-stroke line-art icon rendered as one Skia-free SVG path. */
export function Doodle({ kind, color, strokeWidth = 4 }: DoodleProps): React.JSX.Element {
  return (
    <Svg viewBox="0 0 100 100" width="100%" height="100%">
      <Path
        d={DOODLE_PATHS[kind]}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
