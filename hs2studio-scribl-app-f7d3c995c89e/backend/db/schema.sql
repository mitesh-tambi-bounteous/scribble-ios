-- Scribl POC — Postgres schema (Neon serverless), idempotent.
--
-- Mirrors backend/lambda/data/schema.ts (DynamoDB key design) conceptually,
-- but this is the relational system-of-record path (ADR 0004: production
-- target is Aurora/Postgres; Neon stands in for the POC). Safe to re-run —
-- every DDL is CREATE ... IF NOT EXISTS and every seed INSERT uses
-- ON CONFLICT DO NOTHING.
--
-- This schema is an EMPTY slate: no demo users, families, or channels are
-- seeded here. The AC2 / AC4 fixtures used to be seeded here — those are now
-- built in-test instead.
--
-- Prompts are NOT seeded here. They are external/admin-provisioned content,
-- keyed by the real calendar date, and are inserted via `npm run db:prompts`
-- (see backend/scripts/prompts.ts + backend/seeds/prompts.ts).

-- ─── Tables ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  email text UNIQUE NOT NULL,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_color text;
-- Hand-drawn avatar as a (downscaled ~256px) PNG data-URI. Nullable; falls back
-- to avatar_color / gradient when absent. Additive, never wipes existing data.
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_image text;

CREATE TABLE IF NOT EXISTS families (
  id text PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS channels (
  id text PRIMARY KEY,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('group', 'challenge')),
  is_public boolean NOT NULL DEFAULT false,
  -- ON DELETE SET NULL: a family is a lightweight grouping label; deleting it
  -- unlinks its channels rather than destroying the contained art.
  family_id text REFERENCES families(id) ON DELETE SET NULL,
  -- ON DELETE CASCADE: a user owns the channels they created.
  created_by text REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ON DELETE CASCADE both ways: a membership row is meaningless once either its
-- channel or its user is gone.
CREATE TABLE IF NOT EXISTS channel_members (
  channel_id text REFERENCES channels(id) ON DELETE CASCADE,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS prompts (
  id text PRIMARY KEY,
  prompt_date date UNIQUE NOT NULL,
  title text,
  body text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS submissions (
  id text PRIMARY KEY,
  -- ON DELETE CASCADE: a submission is owned by its user.
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  -- NO ACTION (intentional): prompts are shared reference content we never
  -- delete, so a submission must never disappear because of a prompt delete.
  prompt_id text REFERENCES prompts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, prompt_id)
);

CREATE TABLE IF NOT EXISTS responses (
  id text PRIMARY KEY,
  -- ON DELETE CASCADE: a response lives inside its channel.
  channel_id text REFERENCES channels(id) ON DELETE CASCADE,
  -- NO ACTION (intentional): prompts are shared reference content we never delete.
  prompt_id text REFERENCES prompts(id),
  -- ON DELETE CASCADE: a response is owned by its author.
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  body text,
  image_ref text,
  enhanced_image_ref text,
  enhancement_status text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Migration safety for DBs provisioned before these columns existed (idempotent).
ALTER TABLE responses ADD COLUMN IF NOT EXISTS enhanced_image_ref text;
ALTER TABLE responses ADD COLUMN IF NOT EXISTS enhancement_status text;
ALTER TABLE responses ADD COLUMN IF NOT EXISTS background_prompt text;

-- Dedupe guarantee across both response-id schemes (legacy `${id}-${index}`
-- and current `${id}-${channelId}`): one response per (user, channel, prompt)
-- regardless of the id string a row was created under. putSubmission's
-- responses INSERT relies on this via a bare ON CONFLICT DO NOTHING so a
-- resubmit against an old-format row is a no-op, not a duplicate.
--
-- PARTIAL (task #6): scoped to NON-archive channels only. Personal Archive
-- channels (id LIKE '%-archive') are a single owner's unlimited drawing
-- history — the same user may deposit many drawings for the same prompt
-- there, so the one-per-(user,channel,prompt) dedupe must NOT apply to them.
-- Every group channel keeps the exact same dedupe guarantee as before.
--
-- Migration safety: a DB provisioned before this index was made partial has
-- the old non-partial index under the same name; DROP + CREATE (rather than
-- CREATE ... IF NOT EXISTS) makes this re-runnable AND upgrades old schemas.
DROP INDEX IF EXISTS responses_user_channel_prompt_key;
CREATE UNIQUE INDEX responses_user_channel_prompt_key
  ON responses (user_id, channel_id, prompt_id)
  WHERE channel_id NOT LIKE '%-archive';

-- ON DELETE CASCADE both ways: a reaction is owned by its user and attached to
-- a response; it should vanish with either.
CREATE TABLE IF NOT EXISTS reactions (
  id text PRIMARY KEY,
  response_id text REFERENCES responses(id) ON DELETE CASCADE,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (response_id, user_id, emoji)
);

-- Comments on a response. ON DELETE CASCADE both ways: a comment is owned by
-- its user and attached to a response; it should vanish with either.
CREATE TABLE IF NOT EXISTS comments (
  id text PRIMARY KEY,
  response_id text REFERENCES responses(id) ON DELETE CASCADE,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Challenges are open-ended (no expiry); draw_seconds is the PER-DRAWING
-- timer given to each participant, not a challenge deadline. toolset is a
-- JSON-encoded ChallengeToolset (NULL means unrestricted).
CREATE TABLE IF NOT EXISTS challenges (
  id text PRIMARY KEY,
  -- ON DELETE CASCADE: a challenge lives inside its channel and is owned by its creator.
  channel_id text REFERENCES channels(id) ON DELETE CASCADE,
  creator_id text REFERENCES users(id) ON DELETE CASCADE,
  word text NOT NULL,
  draw_seconds integer NOT NULL DEFAULT 300,
  toolset text,
  background_ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ON DELETE CASCADE: an entry belongs to its challenge and its author.
CREATE TABLE IF NOT EXISTS challenge_entries (
  id text PRIMARY KEY,
  challenge_id text REFERENCES challenges(id) ON DELETE CASCADE,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  image_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id)
);

-- ON DELETE CASCADE on all three: a rating is meaningless once its challenge,
-- the entry it scores, or the rater is gone.
CREATE TABLE IF NOT EXISTS challenge_ratings (
  challenge_id text REFERENCES challenges(id) ON DELETE CASCADE,
  entry_id text REFERENCES challenge_entries(id) ON DELETE CASCADE,
  rater_id text REFERENCES users(id) ON DELETE CASCADE,
  stars integer NOT NULL CHECK (stars >= 1 AND stars <= 5),
  PRIMARY KEY (entry_id, rater_id)
);
