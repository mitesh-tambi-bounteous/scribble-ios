---
title: scribl POC Loom Loop Design
project: scribl
date: 2026-07-01
status: approved
increment: 1
---

Relocated from the doc-site tree during the 2026-07-27 review; this is the increment-1 loom-loop design spec.

# scribl POC Loom Loop Design (Increment 1)

This is the governing design spec for Increment 1 of the scribl POC "Loom
loop". S2D_MobleApp is the scribl project brain -- the cockpit emitted by
the methodology engine -- and it drives the code repo rforsh/MobileApp. The daily-loop
mechanics (stories S-001..S-008) are built and merged to MobileApp main. The
remaining Increment 1 work is the full screen plus navigation buildout per the
design flow, folded through a repeatable loop that produces stories, spawns
build work, verifies against acceptance criteria, and feeds friction back into
the engine.

## S1 Roles (three tiers)

- **The methodology engine**: the meta engine plus playbook. It receives
  back-flow fixes and propagates improvements to future projects.
- **This brain** (S2D_MobleApp): owns the contract -- the stories, briefs,
  acceptance criteria, verification gates, and the board. It runs the
  `/project-poc-*` commands.
- **MobileApp** (rforsh/MobileApp): the build, the thing being built.
- **HOP operator plus workers**: the muscle. The operator reads brain stories,
  spawns build workers into MobileApp worktrees, and keeps the board honest.

## S2 The loop

The loop cycles per screen-group: backlog -> build -> verify -> demo ->
review/back-flow.

1. A story-generation step, gated by an operator review, produces stories into
   `tracking/stories/`.
2. Per story, a HOP brief plus a build worker go into a MobileApp worktree.
   Skeleton plus nav come first, then design fidelity.
3. `project-poc-verify` checks web AND device against the acceptance criteria.
4. Friction is written to `reviews/` (engagement-specific) and `patterns/`
   (reusable) as it is discovered, not later.
5. `project-poc-demo` runs when the flow is clickable end to end.

## S3 Screen scope

The screen backlog lives under `tracking/stories/` as S-009..S-019. The flow:

Sign-up -> Tutorial -> Splash/Start -> Today's Prompt (built) -> Draw canvas
(built) -> Write or Record response -> Home (Your Stats plus Your Walls
carousel) -> swipe between walls -> Family wall grid (empty and filled) ->
Response detail -> Share.

The three hero (design-faithful) screens for Increment 1 are:

- Splash/Start (S-009)
- Family wall grid (S-016)
- Response detail (S-017)

All other new screens are skeleton plus nav only. Record (S-013) is a skeleton
with the voice scope flagged as an open operator decision (cut / iOS-only /
keep); there is no real audio capture in the POC.

## S4 Critical npm updates (folded into the first build worker)

The first build worker carries the dependency hygiene work:

- Bump CI Node to 22, which kills the EBADENGINE warning.
- Bump the safely-bumpable direct deps.
- Explicitly DEFER the transitive jest/jsdom deprecations (glob@7, inflight,
  abab, domexception, whatwg-encoding). These are tooling-dragged, low value,
  and high risk. Log what is deferred and why.

This mirrors story S-019.

## S5 First back-flow -- the multi-repo model

Extend the methodology engine so one brain can drive N roled repos. Today `project.json` has a
single `code_repo`. The proposed change:

- `repos: [{name, role: mobile|backend|ai|db|infra}]`.
- The `/project-*` commands gain a repo/role target.
- Stories and briefs tag their repo.

The change is made in the methodology engine and shipped as a back-flow PR
upstream -- but NOT in this increment. Increment 1 captures only the
proposal/sketch (see `reviews/backflow-multi-repo-model.md`).

## S6 Flywheel

Friction fixes edit the methodology engine (never a local patch) -> back-flow
PR upstream -> `reviews/` plus a final postmortem published to the engine's
learnings corpus. The multi-repo model is the first such PR.

## S7 Definition of Done (Increment 1)

- All screens exist as routes.
- Nav buttons connect the full flow.
- The flow is clickable end to end on web.
- Hero screens are design faithful.
- Each story is verified on web plus device per its acceptance criteria.
- The board reflects reality.
- Friction is captured.
- The multi-repo model spec plus its back-flow PR are opened.
