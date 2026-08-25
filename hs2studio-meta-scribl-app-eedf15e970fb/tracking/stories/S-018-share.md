---
id: S-018
title: Share screen
status: next
owner: unassigned
stage: B2
phase: B
project: scribl
labels: [nav, share]
---

# S-018 -- Share screen

The share screen is the terminal surface of the response and detail flows. In
the POC it is a skeleton share surface with no real share integration; its job
is to close the loop and return the user to the wall/Home.

## AC

- [ ] The screen shows a share surface with a named "Share"/"Done" affordance
  that returns to the wall/Home.
- [ ] The screen is skeleton only: there is no real share integration in the
  POC.
- [ ] The screen is reached from Response detail (S-017). Write (S-012) and
  Record (S-013) return to Home (S-014), not Share, per the design spec S3 flow.
- [ ] The screen ships first as a skeleton with working navigation, then design
  fidelity follows in a later pass.
- [ ] The screen renders and behaves identically on the web export and on an
  iOS/Android device or simulator from the single Expo/React Native codebase.
