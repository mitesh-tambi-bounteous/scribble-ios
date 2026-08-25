---
title: Board
project: scribl
columns: [Now, Next, Blocked, Done]
updated: 2026-07-27
---

# Board -- scribl

Kanban that drives the POC build. The POC build is run from here. Move cards as
state changes. Cards reference stories in `tracking/stories/` by id (for example
`S-001`). Phases and milestones are in `roadmap.md`.

## Now

_Work actively in progress. Keep this column small._

- S-019 CI Node 22 + safe dep bumps -- folded into the first build worker.
- S-010 sign-up -- first skeleton screen, entry of the flow.

## Next

_Ready to pull. Ordered by priority, top first._

- S-011 tutorial -- onboarding walkthrough screens after sign-up.
- S-009 splash/start (hero) -- design-faithful splash and start entry point.
- S-012 write response -- text-entry screen for responding to a prompt.
- S-013 record response -- voice-response screen; web audio capture wired,
  native still a stub and not yet connected to submit.
- S-014 home stats + walls carousel -- home screen with stats and the walls carousel.
- S-015 wall carousel swipe -- swipe interaction across the walls carousel.
- S-016 family wall grid (hero) -- design-faithful grid of the family wall.
- S-017 response detail (hero) -- design-faithful single-response detail view.
- S-018 share -- share a response out of the app.

## Blocked

_Waiting on a dependency, decision, or external input. Note the blocker._

- S-020 family challenges (blind draw-off + star rating) -- stub; implemented
  pending review in MobileApp PR #24 (branch `family-challenges`).
- S-021 one-command dev startup + two-server e2e harness -- stub; implemented
  pending review in MobileApp PR #23 (branch `scribl-devx-userwalk`).
- S-022 invite-by-email channel membership -- stub; implemented pending review
  in MobileApp PR #23 (branch `scribl-devx-userwalk`).

## Done

_Completed and verified against acceptance criteria._

- Architecture locked at Gate 2: ratified ADRs, architecture spec, and
  machine-checkable AC for the POC thin slice and the production target.
- Project brain and tracking board seeded; the daily-loop thin slice shipped and
  merged to MobileApp main.
- B1 harness generation -- locked stack pinned and OSS-only guardrails wired (no
  EAS, no Expo-cloud, no remote Expo MCP); Plan Mode and Expo knowledge skills in
  place (shipped, merged to MobileApp main).
- S-001 prompt-of-the-day -- daily prompt surfaced from the thin backend (shipped, merged to MobileApp main).
- S-002 on-device drawing canvas (Skia) -- finger-on-glass canvas, smooth on device (shipped, merged to MobileApp main).
- S-003 submit-to-unlock data-layer invariant -- the feed stays gated until submit (shipped, merged to MobileApp main).
- S-004 channel isolation -- responses scoped to their channel (shipped, merged to MobileApp main).
- S-005 post-unlock reactions -- react only after unlocking (shipped, merged to MobileApp main).
- S-006 streak rule -- streak increments and resets per the daily-loop rule (shipped, merged to MobileApp main).
- S-007 web + device parity -- one codebase, web is an export target (shipped, merged to MobileApp main).
- S-008 Claude provider adapter -- inference behind a provider abstraction (shipped, merged to MobileApp main).
- S-023 handbook from Confluence -- curated agile handbook built and wired into
  the site (landed in PR #14, commit `108d7b9`, merged 2026-07-10).
- iOS distribution -- local Simulator build verified; distribution doc on the
  site (merged PRs #3/#4, no story; see s2d/ios-distribution.md).
- Android distribution -- debug APK produced; output page on the site (no
  story; see s2d/android-distribution.md).
- Production sprint backlog -- ground-up production plan as 4 x 2-week sprints
  with CMPSR Jira wiring (no story; see tracking/production-sprint-backlog.md
  and tracking/jira-board.md).
