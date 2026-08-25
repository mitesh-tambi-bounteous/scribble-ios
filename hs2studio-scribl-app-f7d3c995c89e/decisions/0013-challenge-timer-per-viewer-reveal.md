# ADR 0013: Challenges are open-ended; per-drawing timer, per-viewer submit-to-unlock reveal

**Status:** Accepted (implemented on branch `scribl-demo-rapid-ui`)
**Date:** 2026-07-23
**Deciders:** David Lawton, Rob Forshier II
**Related:** [0007](0007-submit-to-unlock-data-layer.md), [0004](0004-dynamodb-single-table.md)

## Context

Challenges originally carried a `deadlineAt` and a global reveal rule
(`deadline passed OR all submitted`) — entries/leaderboard were hidden from
everyone until the challenge closed. With open membership and no fixed
roster, "all submitted" may never trigger, and a hard deadline contradicts
the brief: challenges have no end date. Separately, the "time" an operator
picks at challenge creation (`drawSeconds`, 10-3600s, presets 1/2/5 min) was
being conflated with that expiry, when in practice it reads as — and is
implemented as — the per-drawing countdown each participant faces once they
open the canvas.

## Decision

Challenges are **open-ended**: `Challenge.deadlineAt` is removed,
`challenge_closed` no longer exists, and a challenge never closes.
`drawSeconds` is retained but scoped correctly as the **per-drawing timer** —
each participant gets that long to draw once they open the challenge; on
expiry the canvas auto-submits.

Reveal is **per-viewer**, matching the app-wide AC2 submit-to-unlock ethos
already locked by ADR 0007: a member sees entries/leaderboard iff they
themselves have submitted (`state = iSubmitted ? "revealed" : "open"`).
Blindness-until-you-submit is preserved per person; the leaderboard/winner
shown is the current leader and is explicitly provisional, since entries can
keep arriving after any one viewer unlocks.

Creators also choose a participant toolset (`toolset: {brushes, colors}` —
non-empty subsets of the canonical `BRUSH_STYLE_IDS`/`PALETTE`, now hoisted
to `packages/shared-types/tools.ts`) and may draw a shared `backgroundRef`
PNG every participant draws over. Absent `toolset` on pre-migration rows
means unrestricted (backward compatible).

Because: with open membership and no deadline, a global "everyone submitted
or time's up" reveal can wedge forever with no way to ever unlock; per-viewer
reveal is the only rule consistent with an app that has no challenge closing
event, and it is the same submit-to-unlock invariant already governing every
other channel read (ADR 0007).

Storage: `challenges.deadline_at` dropped from `schema.sql`;
`draw_seconds` / `toolset` / `background_ref` added. An additive migration,
`backend/db/migrations/2026-07-23-challenge-timer-toolset.sql`, is provided
for existing databases and has **not** been applied to any shared DB.
`channels.kind` CHECK constraint is fixed to include `'challenge'`
(pre-existing schema bug, unrelated but caught in the same pass).

## Alternatives considered

### Option A: Keep global reveal, gated on all-submitted
- Pros: simplest mental model — one reveal event for the whole channel.
- Cons: with open membership and no deadline, "all submitted" may never
  happen; reveal can wedge indefinitely for every participant.
- Why not chosen: it can produce a channel that never unlocks for anyone,
  which is worse than the mechanic it's meant to protect.

### Option B: Keep `deadlineAt` alongside the per-drawing timer
- Pros: preserves a familiar "challenge closes" moment; less change to
  existing UI copy.
- Cons: the brief states challenges have no end date; running two time
  semantics (a closing deadline and a per-drawing countdown) on the same
  entity confuses both the data model and the UI.
- Why not chosen: contradicts the product brief and adds a second clock for
  no behavioral gain once reveal is per-viewer.

## Consequences

### Positive
- Reveal can never wedge: each participant's unlock depends only on their
  own action, consistent with ADR 0007 everywhere else in the app.
- `drawSeconds` now models what it always behaviorally was — the per-drawing
  clock — removing a latent semantic bug.
- Toolset and shared-background options add creator expressiveness without
  touching the reveal/timer model.

### Negative
- Entries can stream into an already-revealed view; the leaderboard a viewer
  sees is provisional and can change after they've unlocked it, which is a
  new UX property to communicate (e.g., "current leader," not "final winner"
  language).
- Countdown UI moves from the challenge detail screen (was: deadline
  countdown) into the DrawPad (per-drawing countdown); any copy or tests
  assuming a challenge-level deadline must be updated.

### Risks to monitor
- `e2e/challenge.spec` and any UI copy referencing a challenge deadline or a
  global "challenge closed" state must be found and updated to the
  per-viewer/provisional-leaderboard model.
- The additive migration must be run against any existing environment DB
  before this ADR's schema is assumed present; it is not yet applied
  anywhere.

## Related
- [0007](0007-submit-to-unlock-data-layer.md) — same submit-to-unlock invariant, now applied per-viewer to challenges
- [0004](0004-dynamodb-single-table.md) — operational store this schema change lives in
