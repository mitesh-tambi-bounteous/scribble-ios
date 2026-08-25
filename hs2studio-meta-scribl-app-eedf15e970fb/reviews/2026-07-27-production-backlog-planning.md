# Stage review -- production backlog planning (2026-07-27)

Scope: turn the Expo-rebuild epic dataset into a production-build backlog --
four 2-week sprints (MVP-first, iOS-first), resource-loaded by role, delivered
as a single reviewable HTML on the doc site, plus a single-region backend plan,
an explicit future-scale track, and CMPSR (Jira) wiring.

## What went well

- Building on the reviewed epic dataset (RE-01..14 + RE-F1..F9) meant sprint
  planning was assembly, not invention: every story traces to a dataset row,
  and the dataset stayed source of truth with the HTML as its view.
- Parallel agent teams worked cleanly: four read-only explorers (AWS design,
  client screens, backlog pattern, docs-sync mechanics) then three builders on
  disjoint files, with doc-site registration kept in the orchestrator to avoid
  shared-file races.
- A single canonical sprint spec in a scratch file, referenced by every
  builder, kept the HTML, the dataset and the Jira docs telling one story --
  including through a mid-flight requirements change.
- The trim-to-light-MVP directive was executed as flags, not silent cuts:
  T1-T12 judgment calls are visible in the dataset, the wrapper page and the
  HTML, each with the counter-evidence (for example the workshop's love of the
  fill bucket) attached.

## Friction and fixes

- Requirements changed mid-dispatch (role loading, QA test-infrastructure
  stream, PM stream). Fix that worked: revise the canonical spec to REV 2 and
  resume the same builders with a delta message rather than restarting them.
  Playbook note: expect at least one mid-flight scope addition in planning
  stages; keep specs in one mutable file the whole team re-reads.
- Angle-bracket placeholder notation (a story-id pattern written with literal
  angle brackets) leaked from the spec into two markdown sources and broke the
  VitePress build, because Vue parses raw angle-bracket text in markdown as
  tags. Fix: wrap such notation in backtick code spans. Playbook note: any
  placeholder written with angle brackets in synced markdown must be inside a
  code span; the prose normalizer does not catch this and the failure only
  surfaces at docs:build.
- The two-backends ambiguity (cloud VP's EKS/Bedrock multi-region target vs
  the TIP's serverless plan) had to be resolved editorially. Resolved as: MVP
  = serverless single-region cut of the same target, divergence flagged for
  sign-off rather than silently picking a winner.

## Judgment calls to challenge at team review

The T1-T12 trims and CAP1-CAP4 capacity flags on /production-sprint-backlog,
especially: voice cut from MVP (T1), moderation automation deferred against
the store-gate risk (T7), the public wall exclusion (T8), and the single
Backend Lead's Sprint 3 peak (CAP1).

## Durations (approx, wall clock)

Source sweep ~5 min; build fan-out ~10 min including the REV 2 rework; wiring,
verification and fixes ~10 min. The mid-flight rework cost roughly a third of
the build time -- acceptable given the resume-not-restart approach.
