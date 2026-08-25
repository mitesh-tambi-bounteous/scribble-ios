---
id: S-020
title: Family challenges (blind draw-off + star rating)
status: blocked
owner: unassigned
stage: B2
phase: B
project: scribl
labels: [challenges, daily-loop, feature]
---

# S-020 -- Family challenges (blind draw-off + star rating)

A member of a family (group channel) starts a challenge: a custom word to draw
plus a time limit. Every family member draws it BLIND -- no one sees any entry
until reveal. Reveal fires when every participant has submitted OR the deadline
passes, whichever is first; non-submitters miss out. After reveal, members who
submitted rate each other's entries 1-5 stars; averages produce a leaderboard
with one winner.

Stub for tracking. Implemented (pending review) in rforsh/MobileApp PR #24
(branch `family-challenges`). Design + plan:
`vendor/mobileapp/docs/design/family-challenges.md` and
`vendor/mobileapp/docs/plans/2026-07-02-family-challenges.md`.

## AC

- [ ] Any family member can create a challenge (word + duration); participants
  are that channel's current members.
- [ ] Blind until reveal: no participant (including one who has submitted) can
  see another entry while the challenge is open. Enforced server-side.
- [ ] Reveal on all-submitted OR deadline-passed (whichever first), recomputed
  server-side on every read; non-submitters are excluded from viewing/rating.
- [ ] After reveal, a submitter rates each other entry 1-5 stars; cannot rate
  their own; re-rating updates in place.
- [ ] Leaderboard ranks by average stars (tie-break: rating count, then earliest
  entry); a single winner is shown.
- [ ] Reactions/rating and blindness proven by an e2e that drives the real UI +
  API + Postgres (blind while open, reveal after both submit, DB-verified
  rating row).

## Notes

Reuses the submit-to-unlock (S-003) and channel-isolation (S-004) server-side
gating patterns rather than a parallel system. Out of scope: push
notifications, multiple entries per user, cross-family challenges.
