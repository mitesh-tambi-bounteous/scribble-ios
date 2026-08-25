---
title: Roadmap
project: scribl
type: mobile-app-poc
target: POC
current_phase: B2
updated: 2026-07-27
---

# Roadmap -- scribl

The route from front-end intake through a demo-able POC of the Scribl
daily-creative-practice app. The POC is a thin slice of the production target
(single Expo / React Native codebase, thin AWS API Gateway + Lambda + DynamoDB
via CDK, web via expo export to S3/CloudFront). It seeds production; it is not a
throwaway. Milestone status is tracked in the table below and on the board.

## Where we stand

Architecture is locked at Gate 2, the brain is emitted, and the daily loop is
shipped and merged to MobileApp main. The project is now at the **M4.5
screen-buildout** milestone: full screen and navigation buildout per the design
flow.

## Phase A: front-end intake (Gate 2)

Presales through ratified architecture. Closes when the architecture and
machine-checkable AC are approved and locked.

- [x] M1 -- Intake complete. Presales -> sales -> intake -> deep research. Scope,
  MVP/MLP, and the research dossier captured.
- [x] M2 -- Architecture locked (Gate 2). Ratified ADRs, architecture spec, and
  machine-checkable AC for both the POC thin slice and the production target it
  seeds; provider-abstraction layer and model tiering recorded.

## Phase B: POC factory (Gate 3)

Stand up the harness, build the daily loop, verify, optionally deploy, and demo.
The POC build is run from the board.

- [x] M3 -- Harness ready. POC harness generated: CLAUDE.md guardrails, agents,
  Expo OSS knowledge skills (no EAS), and the locked stack pinned; Plan Mode and
  the OSS-only / no-Expo-cloud rules enforced.
- [x] M4 -- Loop built. Prompt-of-the-day -> draw/text -> submit-to-unlock ->
  channel wall + reactions -> streak, on a single codebase with web + device
  parity and a Claude provider adapter. The daily loop shipped and merged to
  MobileApp main.
- [ ] M4.5 -- Screens built. Full screen + navigation buildout per the design flow:
  every screen exists as a route, nav connects the flow end to end on web, hero
  screens (splash, family grid, response detail) design faithful. Current milestone.
- [ ] M5 -- POC verified. Runs on web AND at least one device/simulator; drawing
  smooth on-device; submit-to-unlock actually gates the feed.
- [ ] M6 -- POC deployed (optional). Web export hosted on S3/CloudFront; native
  prebuild built in our own CI (no EAS). In progress: local iOS Simulator build
  verified and Android debug APK produced; CI automation and web deploy not
  started.
- [ ] M7 -- POC demo (Gate 3). Clickable demo plus user-feedback loop. Closes the
  route to POC.

## Phase H: handoff

Carry POC learnings into the production backlog and dev harness. Out of the POC
critical path; listed for continuity.

- [ ] M8 -- POC to backlog. POC learnings and gaps captured as a production
  backlog. In progress: production backlog produced as a 4-sprint plan
  (`tracking/production-sprint-backlog.md` plus the `expo-rebuild-epics.md`
  dataset); CMPSR Jira import pending.
- [ ] M9 -- Dev-harness handoff. Dev-harness generated and handed to the delivery
  team.

## Milestones

| Milestone | Phase | Status |
|-----------|-------|--------|
| M1 Intake complete | A | Done |
| M2 Architecture locked | A (Gate 2) | Done |
| M3 Harness ready | B | Done |
| M4 Loop built | B | Done |
| M4.5 Screens built | B | In progress |
| M5 POC verified | B | Not started |
| M6 POC deployed (optional) | B | In progress (local iOS Simulator build verified and Android debug APK produced; CI automation and web deploy not started) |
| M7 POC demo | B (Gate 3) | Not started |
| M8 POC to production backlog | H | In progress (production backlog produced as a 4-sprint plan: tracking/production-sprint-backlog.md plus the expo-rebuild-epics dataset; CMPSR Jira import pending) |
| M9 Dev-harness handoff | H | Not started |
