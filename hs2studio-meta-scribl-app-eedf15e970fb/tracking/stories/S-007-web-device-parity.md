---
id: S-007
title: Web + device parity
status: done
owner: unassigned
stage: B3
phase: B
project: scribl
labels: [parity, invariant, launch-blocking]
---

# S-007 -- Web + device parity

One Expo / React Native codebase; web is an export target, not a separate app.
No web-to-native split. Verified on web and at least one device/simulator.

## AC

- [x] The full daily loop (prompt -> draw/text -> submit-to-unlock -> wall +
  reactions -> streak) runs on web via `npx expo export -p web`.
- [x] The same loop runs on at least one device or simulator via
  `npx expo run:ios` or `run:android`.
- [x] There is no web-only or native-only fork of the loop screens; routes are
  shared Expo Router file-based routes.
- [x] No EAS config, `eas.json`, or remote Expo MCP is introduced.

Scope note: parity is claimed for the shipped daily-loop surfaces; native voice
capture is not yet at parity and is tracked in S-013.

Closeout note (2026-07-27 review): story was moved to Done when the work
merged to MobileApp main; AC boxes ticked retroactively per the board record.
