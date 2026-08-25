---
name: skia-native-module
description: Use when building or reviewing the React Native Skia drawing canvas; de-risks it early with a cheap real-device performance spike on low-end Android before committing the week to it.
metadata:
  type: skill
---

# skia-native-module

The drawing canvas is the highest-risk component of the POC. Canvas behavior
diverges between iOS and Android in ways emulators do not surface, and low-end
Android is the worst case. De-risk it with an early, cheap performance spike on
a real low-end Android device before sinking the week into canvas features.

Traces to AC3 (on-device drawing, canvas stays responsive, low-end-Android
risk) and ADR 0006 (drawing canvas via React Native Skia).

## What this skill enforces

1. Skia is the canvas. Use @shopify/react-native-skia (native via Skia, web via
   CanvasKit) so there is one canvas codebase, no per-platform native code.
2. Spike first, early. Before building real drawing UX, stand up a minimal
   Skia draw surface and measure responsiveness on a real low-end Android
   device. Emulators and web do not count for this check.
3. Cheap and bounded. The spike is a throwaway-grade smoke: finger-track a
   path, render strokes, watch for input lag and dropped frames. One device,
   short session. Do not gold-plate the spike.
4. Know the fallback trigger. If Skia misses the responsiveness bar, the ADR
   0006 fallback is native canvas modules per platform plus a second mobile
   engineer. Surface this early so the trigger is a decision, not a surprise in
   week 6.

## Concrete steps

- Add @shopify/react-native-skia to the Expo OSS app (no EAS; native via
  expo prebuild in the team's CI).
- Build a one-screen draw spike: capture touch, append points to a path,
  render with Skia, support clear. No persistence, no channels.
- Run it on a real low-end Android device. Observe stroke latency, frame
  pacing under continuous drawing, and memory over a sustained scribble.
- Record the result (responsive / borderline / misses bar). If it misses,
  flag the native-canvas fallback per ADR 0006.

## Test shape

- Device smoke: drawing capture works on a real device, not web-only. Verified
  manually on at least one low-end Android device (AC3 is a device-verified
  check, not a unit assertion).
- Export sanity: the canvas can export to an image (Skia supports this), since
  submissions carry the drawing.

## Done when

A minimal Skia canvas captures and renders strokes responsively on a real
low-end Android device, the drawing exports to an image, and the
responsiveness result is recorded with the native-canvas fallback trigger
noted if the bar is missed.
