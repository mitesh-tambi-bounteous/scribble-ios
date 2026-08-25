---
id: S-023
title: Recreate team Confluence process pages in the handbook wiki
status: done
owner: unassigned
stage: H1
phase: H
project: scribl
labels: [docs, handbook, process, wiki, handoff]
---

# S-023 -- Recreate team Confluence process pages in the handbook wiki

Process / knowledge-base work, not app build. The goal is for this VitePress
brain to become the delivery team's process reference so a separate Confluence
space is not needed once the team spins up. Bring the useful agile-delivery
process content over as local handbook pages under `s2d/handbook/`, then
re-render with `npm run docs:sync`.

Seed source: the Bounteous "Agile Delivery" Confluence page
(https://bounteous.jira.com/wiki/spaces/PD/pages/146014500/Agile+Delivery).
Do a deliberate pass ("double take") over that page and its children and decide
what is worth recreating here versus leaving behind.

Already done this session (starting point, enhance as needed):
[Definition of Ready](/handbook/definition-of-ready) and
[Definition of Done](/handbook/definition-of-done) were expanded with fuller,
team-charter-grade criteria.

## AC

- [x] Review the Agile Delivery Confluence page and its child pages; list which
  topics to recreate locally (e.g. ceremonies/cadence, estimation, backlog
  refinement, sprint flow, roles and responsibilities, team chartering, working
  agreements, RACI).
- [x] Create one handbook page per selected topic under `s2d/handbook/`, adapted
  to scribl (mobile iOS/Android plus web export, AI-assisted SDLC) rather than
  copied verbatim.
- [x] Wire the new pages into the Build & Delivery / Handbook sidebar section
  (static links in `docs/.vitepress/config.ts`, or a handbook sidebar builder if
  the set grows large).
- [x] Keep everything prose-lint / ASCII house-style clean; do not name the
  legacy consulting firm; re-run `npm run docs:sync` and confirm
  `npm run docs:build` stays clean with dead-link checking on.
- [x] Confirm the handbook now stands on its own as the team's process reference
  (no external Confluence needed to onboard a new team member).

## Done this round

Curated handbook built from the Agile Delivery space (space PD, root 146014500):
`ceremonies`, `roles-and-raci`, `estimation`, `backlog-and-workflow`,
`story-and-ac-templates`, `team-chartering`, `glossary`, `release-management`,
plus reconciled `definition-of-ready` / `definition-of-done`. Skip list and
provenance recorded on the handbook index. Wired into the Build & Delivery
sidebar. `docs:build` green with dead-link checking on. Landed in PR #14 (commit
`108d7b9`, merged 2026-07-10). Status flipped to done.
