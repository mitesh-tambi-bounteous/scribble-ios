-- Additive migration for existing DBs: challenges move from a global
-- deadline to a per-drawing timer (draw_seconds) + optional creator-defined
-- toolset/background. NEVER run this against the shared/Neon DB from this
-- session — file only, for a human/CI to apply.
--
-- Safe to run multiple times (IF NOT EXISTS / idempotent CHECK rebuild).

ALTER TABLE challenges ADD COLUMN IF NOT EXISTS draw_seconds integer NOT NULL DEFAULT 300;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS toolset text;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS background_ref text;
ALTER TABLE challenges ALTER COLUMN deadline_at DROP NOT NULL;

-- Fix a pre-existing bug: challenge walls (channels.kind = 'challenge')
-- violated the original CHECK, which only allowed 'group'.
ALTER TABLE channels DROP CONSTRAINT IF EXISTS channels_kind_check;
ALTER TABLE channels ADD CONSTRAINT channels_kind_check CHECK (kind IN ('group', 'challenge'));
