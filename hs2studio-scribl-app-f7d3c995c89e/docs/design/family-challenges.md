# Design: Family Challenges (blind draw-off + star rating)

Status: approved design (2026-07-02). Feature branch: `family-challenges`.
Ships as its own PR, separate from the dev-experience work.

## Context and purpose

Today the app has one shared daily loop: a single prompt, submit-to-unlock, a
public wall, and family (group) channels. There is no way for a family to run
its own timed, competitive draw. Families want a lightweight game: one member
picks a word, everyone draws it against a clock, nobody peeks until all entries
are in, then the group scores them and crowns a winner.

This feature adds "challenges" scoped to a family channel. It reuses the
existing Skia drawing canvas, the channel/membership model, and the server-side
submit-to-unlock gating pattern (AC2/AC4) rather than inventing a parallel
system. The competitive twist is a stronger reveal gate: a challenge stays blind
until every participant has submitted OR the deadline passes, whichever comes
first.

## Core mechanics

1. Any member of a family channel creates a challenge: a `word` (the thing to
   draw) plus a `durationMinutes` time limit. The deadline is computed once at
   creation (`deadline_at = now + durationMinutes`).
2. Participants are exactly the family channel's current members at creation
   time. No separate invite step (they were already invited to the family).
3. Each participant draws the word on the Skia canvas and submits one entry
   before the deadline.
4. The challenge is BLIND: no participant can see any entry (their own aside)
   until reveal.
5. Reveal fires when either condition is met, whichever is first:
   - every participant has submitted an entry, or
   - the deadline passes (`now >= deadline_at`).
   Participants who did not submit before reveal simply miss out.
6. After reveal, each participant who submitted rates every other entry 1..5
   stars (one rating per entry per rater; you cannot rate your own entry).
7. Ratings average per entry into a leaderboard. Winner = highest average
   stars; tie-break by more ratings, then earliest entry `created_at`.

## Locked decisions

- Any family member can create a challenge (not owner-only).
- Only participants who submitted can view or rate after reveal; non-submitters
  miss out entirely (consistent with submit-to-unlock).
- You cannot rate your own entry.
- Winner = highest average stars, tie-break (rating count, then earliest entry).
- Native push notifications are out of scope for this POC.

## Data model

New tables, following the existing `backend/db/schema.sql` conventions
(`text` ids, `timestamptz` created_at, explicit FKs, idempotent seed) and
mirrored in both the Postgres client and the in-memory mock client.

```sql
CREATE TABLE IF NOT EXISTS challenges (
  id text PRIMARY KEY,
  channel_id text NOT NULL REFERENCES channels(id),
  creator_id text NOT NULL REFERENCES users(id),
  word text NOT NULL,
  deadline_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS challenge_entries (
  id text PRIMARY KEY,
  challenge_id text NOT NULL REFERENCES challenges(id),
  user_id text NOT NULL REFERENCES users(id),
  image_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id)
);

CREATE TABLE IF NOT EXISTS challenge_ratings (
  challenge_id text NOT NULL REFERENCES challenges(id),
  entry_id text NOT NULL REFERENCES challenge_entries(id),
  rater_id text NOT NULL REFERENCES users(id),
  stars smallint NOT NULL CHECK (stars BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entry_id, rater_id)
);
```

Participant set is derived (not stored): the members of `channel_id` in
`channel_members` at read time. A member who joins the family after a challenge
starts is a participant for reveal purposes only if they submit before the
deadline; the reveal "all submitted" check compares distinct entry authors
against current channel membership, so late joiners never block reveal because
the deadline path always resolves it.

## Reveal state (server-derived, never client-trusted)

A challenge is in exactly one state, computed server-side on every read:

- `open`: `now < deadline_at` AND not all participants have submitted. Entries
  are hidden. The caller sees only their own submission status and a countdown.
- `revealed`: `now >= deadline_at` OR every participant has submitted. Entries
  and ratings are visible to participants who submitted.

`all_submitted` = count(distinct challenge_entries.user_id for this challenge)
>= count(channel_members for the channel). This is evaluated in SQL, not passed
by the client.

## API (thin backend, mirrors existing handlers)

Every handler follows the existing pattern: `getCallerUserId(event)` for
identity, `ApiError = {error, message}` envelope, `jsonResponse` helper, gates
resolved server-side. Routes registered in `backend/local-server.ts` and CDK.

- `POST /channels/:id/challenges`
  Body `{ word, durationMinutes }`. Caller must be a member of the channel
  (403 `not_a_member`). Validates non-empty word and a positive, bounded
  duration. Creates the challenge; returns `{ challenge }`.

- `GET /channels/:id/challenges`
  Caller must be a member. Returns `{ challenges }` with each challenge's state
  (`open` / `revealed`), deadline, participant + submitted counts, and whether
  the caller has submitted. No entry images in the list view.

- `POST /challenges/:cid/entries`
  Body `{ imageRef }`. Caller must be a member of the challenge's channel; the
  challenge must still be `open` (403 `challenge_closed` if past deadline);
  exactly one entry per user, enforced by the UNIQUE constraint: a second
  submit is rejected with 409 `already_submitted` (editing an entry after
  submit is out of scope). Returns `{ entry }`.

- `GET /challenges/:cid`
  Caller must be a member. If state is `open`, returns the countdown + the
  caller's own submission status only (403-style locked payload for others'
  entries, mirroring `not_submitted`). If `revealed`, the caller must have
  submitted (else 403 `not_submitted`); returns all entries, the caller's
  ratings, per-entry average stars, and the computed leaderboard/winner.

- `POST /challenges/:cid/entries/:eid/ratings`
  Body `{ stars }` (1..5). Only when `revealed`. Caller must have submitted an
  entry to this challenge. Caller cannot rate their own entry (403
  `cannot_rate_own`). Upserts one rating per (entry, rater). Returns the updated
  entry aggregate.

Shared types added to `packages/shared-types/`: `Challenge`, `ChallengeState`,
`ChallengeEntry`, `ChallengeSummary`, `ChallengeDetail`, `LeaderboardRow`, and
the request/response envelopes for the five routes.

## Frontend (Expo Router + Zustand + Skia)

- `app/family.tsx`: add a "Challenges" section listing the family's active and
  past challenges (state chip, countdown or winner), plus a "New challenge"
  button. Reuses the existing store/loading/error/retry pattern.
- `app/create-challenge.tsx`: word input + a time-limit picker (a few presets,
  e.g. 5 / 15 / 60 minutes). Calls create, routes to the challenge screen.
- `app/challenge/[id].tsx`:
  - `open` + caller has not submitted: the Skia canvas with the challenge word
    as the prompt; a live countdown; Done submits an entry (reuse the draw.tsx
    export-to-data-URI flow).
  - `open` + caller has submitted: a waiting state ("waiting for N of M") with
    the countdown; polls/refreshes for reveal.
  - `revealed`: an entry grid; a 1..5 star rating control per entry (disabled on
    the caller's own entry); a leaderboard with the winner highlighted.
- New Zustand stores: `useChallengesStore` (list per channel) and
  `useChallengeStore` (single challenge detail + rating actions), following the
  existing store conventions and the DataClient seam (`src/data/client.ts`,
  `http.ts`, `mock.ts`).

## Countdown and reveal timing

The countdown is a pure client-side display derived from `deadline_at`; it is
never authoritative. Reveal is always recomputed server-side on read. The
waiting screen refreshes on an interval (and on focus) so a client sees reveal
shortly after the deadline or the last submission without push. No server timer
or background job is needed for the POC.

## Invariants and reuse (do not regress)

- Blindness and reveal are enforced server-side, exactly like submit-to-unlock:
  the client never decides visibility. New isolation tests assert a participant
  cannot read others' entries while `open`, and a non-submitter cannot read or
  rate after reveal.
- Membership gating (AC4) applies to every challenge route: non-members get
  403 `not_a_member` with no leak.
- Star ratings reuse the same "server aggregates raw rows into a client shape"
  approach used by reactions.

## Testing (reproduce-first, script-asserted)

- Backend unit tests (mock mode, per existing `tests/` pattern): create gate,
  entry-before-deadline gate, reveal computation (all-submitted vs expired),
  blind read gate while open, non-submitter cannot rate, cannot-rate-own,
  rating average + leaderboard tie-break, membership isolation.
- Postgres client tests (fake-`sql` pattern): challenge/entry/rating writes and
  the reveal + leaderboard aggregate queries.
- Frontend unit tests: create-challenge flow, challenge screen state machine
  (open-draw / waiting / revealed), star rating control (own-entry disabled).
- Playwright e2e: two seeded users in a family run a full challenge to reveal
  and rating, asserting the blind gate (user A cannot see B's entry until
  reveal) and the DB rows, with console/pageerror listeners.

## Out of scope (POC)

- Push notifications / real-time sockets (polling + focus refresh only).
- More than one entry per user; editing an entry after submit.
- Challenge across multiple families or the public channel (family-scoped only).
- Rating categories/superlatives (1..5 stars only, per decision).
