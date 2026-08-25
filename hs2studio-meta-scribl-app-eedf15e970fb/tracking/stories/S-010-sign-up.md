---
id: S-010
title: Sign-up screen
status: now
owner: unassigned
stage: B2
phase: B
project: scribl
labels: [nav, onboarding]
---

# S-010 -- Sign-up screen

The sign-up screen is the entry point of the flow. In the POC it is a skeleton
form only, with no real authentication behind it; its job is to establish the
first step of onboarding and hand off to the tutorial.

## AC

- [ ] A named "Continue"/"Sign-up" button navigates to the Tutorial (S-011).
- [ ] The screen shows skeleton form fields only; there is no real auth in the
  POC.
- [ ] Design fidelity is deferred: the screen ships as a skeleton first and the
  fidelity pass follows later.
- [ ] The screen ships first as a skeleton with working navigation, then
  fidelity follows.
- [ ] The screen renders and behaves identically on the web export and on an
  iOS/Android device or simulator from the single Expo/React Native codebase.
