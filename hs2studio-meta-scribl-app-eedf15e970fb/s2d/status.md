---
title: "scribl -- status"
project: scribl
updated: 2026-07-27
---

# scribl -- status

**Overall status:** phase B2, milestone M4.5 (screens built) in progress

Front-end intake is complete and the architecture is locked: the ADRs,
architecture spec, and machine-checkable acceptance criteria are ratified for
both the POC thin slice and the production target it seeds. The POC harness is
generated, and the daily loop -- prompt-of-the-day, draw / write / speak,
submit-to-unlock, channel wall and reactions, streak -- has shipped and merged
to MobileApp main with web and device parity.

The current focus is milestone M4.5: full screen and navigation buildout per the
design flow, so every screen exists as a route, navigation connects the flow end
to end on web, and the hero screens (splash, family grid, response detail) are
design-faithful. Verification, optional deployment, demo, and handoff follow.

## Milestone status

Derived from the [Roadmap](/roadmap). Day-to-day movement is on the [Board](/board).

| Milestone | Description | Status |
|-----------|-------------|--------|
| M1 | Intake complete | Done |
| M2 | Architecture locked (Gate 2) | Done |
| M3 | Harness ready | Done |
| M4 | Daily loop built | Done |
| M4.5 | Screens built | In progress (current) |
| M5 | POC verified | Not started |
| M6 | POC deployed (optional) | In progress (local iOS Simulator build verified and Android debug APK produced; CI automation and web deploy not started) |
| M7 | POC demo (Gate 3) | Not started |
| M8 | POC to production backlog | Not started |
| M9 | Dev-harness handoff | Not started |
