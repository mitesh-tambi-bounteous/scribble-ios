---
id: S-002
title: On-device drawing canvas (Skia)
status: done
owner: unassigned
stage: B2
phase: B
project: scribl
labels: [daily-loop, canvas]
---

# S-002 -- On-device drawing canvas (Skia)

Finger-on-glass drawing canvas built on @shopify/react-native-skia, the point of
the POC. Must feel smooth on a real device; web uses CanvasKit, native uses Skia,
one codebase.

## AC

- [x] The user can draw freehand strokes on the canvas with a finger on a device
  (iOS or Android simulator/device) and with a pointer on web.
- [x] The canvas is implemented with @shopify/react-native-skia (no web-only or
  native-only fork).
- [x] Drawing remains responsive on-device (no dropped-stroke lag under a quick
  scribble), profiled on a real device or simulator.
- [x] The drawn artwork can be captured/serialized so it can be submitted by S-003.

Closeout note (2026-07-27 review): story was moved to Done when the work
merged to MobileApp main; AC boxes ticked retroactively per the board record.
