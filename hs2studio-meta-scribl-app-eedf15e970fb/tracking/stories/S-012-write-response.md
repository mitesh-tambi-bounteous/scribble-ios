---
id: S-012
title: Write response (140-char caption)
status: next
owner: unassigned
stage: B2
phase: B
project: scribl
labels: [nav, response-capture]
---

# S-012 -- Write response (140-char caption)

The write-response screen is one of the two response modalities reached from the
Draw canvas. The user captions their drawing with a short 140-character caption
and shares it into the loop.

## AC

- [ ] The screen provides a 140-character caption input with a visible character
  count/limit.
- [ ] A large "T" affordance is present per the design.
- [ ] The screen is reachable from the Draw canvas (`app/draw.tsx`) Write action.
- [ ] A named "Share" button navigates to Home (S-014).
- [ ] The screen ships first as a skeleton with working navigation, then design
  fidelity follows in a later pass.
- [ ] The screen renders and behaves identically on the web export and on an
  iOS/Android device or simulator from the single Expo/React Native codebase.
