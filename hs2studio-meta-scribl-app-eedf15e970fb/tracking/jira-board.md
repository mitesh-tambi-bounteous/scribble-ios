---
title: "Jira board (CMPSR)"
project: scribl
type: reference
updated: 2026-07-27
---

# Jira board (CMPSR)

scribl production stories live on the CMPSR Jira board (project key CMPSR,
board 13809):
https://bounteous.jira.com/jira/software/projects/CMPSR/boards/13809/backlog

This hub repo is the planning source and the backlog import source: the
epic/feature dataset in `tracking/expo-rebuild-epics.md` and the sprint-planned
view in `tracking/production-sprint-backlog.md` are what gets imported.

## Mapping conventions

- Each RE-xx MVP epic -> one CMPSR Epic named `RE-xx <epic name>`. Future
  epics (RE-F1..F9) -> CMPSR Epics labeled `future`, created at triage time,
  not before.
- Each story `P<s>-<nn>` -> one CMPSR Story under its epic; summary = story
  title; description = intent + acceptance sketch.
- Labels: `sprint-1`..`sprint-4` for the MVP sprints, plus `mvp`, and a role
  label `role-ios` / `role-backend` / `role-qa` / `role-pm`; future work gets
  `future`.
- Every story carries an owning role (assignee = the owning role's person), so
  per-sprint capacity by role is visible on the board.
- Story points = the Fibonacci placeholders from the sprint backlog (team
  sizing inputs, not commitments).

## Sync-back rule

Once CMPSR keys exist, record CMPSR-nnn back into
`tracking/expo-rebuild-epics.md` and the sprint backlog so hub docs and Jira
never drift.

## Scope notes

- POC stories S-001..S-023 are POC-only and are NOT imported to CMPSR; they
  stay on the hub board.
- The scribl-app code repo is being wired to CMPSR separately.
