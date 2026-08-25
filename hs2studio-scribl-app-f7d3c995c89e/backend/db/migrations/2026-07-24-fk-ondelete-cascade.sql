-- FK ON DELETE re-engineering for existing DBs.
--
-- All 20 FKs shipped as ON DELETE NO ACTION, which made deleting a user,
-- channel, challenge or response impossible without hand-deleting every child
-- row first. This migration switches ownership/containment FKs to CASCADE, the
-- family link to SET NULL, and intentionally leaves the two shared-reference
-- FKs to `prompts` as NO ACTION (we never delete prompts).
--
-- Idempotent: each FK is DROP CONSTRAINT IF EXISTS + re-ADD, so re-running
-- re-asserts the intended rule. Safe to apply repeatedly.
--
-- Mirrors the inline ON DELETE clauses now in backend/db/schema.sql (which only
-- take effect on a fresh CREATE TABLE); this file is what upgrades an already
-- provisioned database.

-- ── FKs referencing users(id) → CASCADE (a user owns their content) ──────────
ALTER TABLE channels DROP CONSTRAINT IF EXISTS channels_created_by_fkey;
ALTER TABLE channels ADD CONSTRAINT channels_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE channel_members DROP CONSTRAINT IF EXISTS channel_members_user_id_fkey;
ALTER TABLE channel_members ADD CONSTRAINT channel_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_user_id_fkey;
ALTER TABLE submissions ADD CONSTRAINT submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE responses DROP CONSTRAINT IF EXISTS responses_user_id_fkey;
ALTER TABLE responses ADD CONSTRAINT responses_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE reactions DROP CONSTRAINT IF EXISTS reactions_user_id_fkey;
ALTER TABLE reactions ADD CONSTRAINT reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_user_id_fkey;
ALTER TABLE comments ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE challenges DROP CONSTRAINT IF EXISTS challenges_creator_id_fkey;
ALTER TABLE challenges ADD CONSTRAINT challenges_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE challenge_entries DROP CONSTRAINT IF EXISTS challenge_entries_user_id_fkey;
ALTER TABLE challenge_entries ADD CONSTRAINT challenge_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE challenge_ratings DROP CONSTRAINT IF EXISTS challenge_ratings_rater_id_fkey;
ALTER TABLE challenge_ratings ADD CONSTRAINT challenge_ratings_rater_id_fkey FOREIGN KEY (rater_id) REFERENCES users(id) ON DELETE CASCADE;

-- ── FKs referencing channels(id) → CASCADE (content lives in the channel) ────
ALTER TABLE channel_members DROP CONSTRAINT IF EXISTS channel_members_channel_id_fkey;
ALTER TABLE channel_members ADD CONSTRAINT channel_members_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE;

ALTER TABLE responses DROP CONSTRAINT IF EXISTS responses_channel_id_fkey;
ALTER TABLE responses ADD CONSTRAINT responses_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE;

ALTER TABLE challenges DROP CONSTRAINT IF EXISTS challenges_channel_id_fkey;
ALTER TABLE challenges ADD CONSTRAINT challenges_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE;

-- ── FKs referencing responses(id) → CASCADE ──────────────────────────────────
ALTER TABLE reactions DROP CONSTRAINT IF EXISTS reactions_response_id_fkey;
ALTER TABLE reactions ADD CONSTRAINT reactions_response_id_fkey FOREIGN KEY (response_id) REFERENCES responses(id) ON DELETE CASCADE;

ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_response_id_fkey;
ALTER TABLE comments ADD CONSTRAINT comments_response_id_fkey FOREIGN KEY (response_id) REFERENCES responses(id) ON DELETE CASCADE;

-- ── FKs referencing challenges(id) → CASCADE ─────────────────────────────────
ALTER TABLE challenge_entries DROP CONSTRAINT IF EXISTS challenge_entries_challenge_id_fkey;
ALTER TABLE challenge_entries ADD CONSTRAINT challenge_entries_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE;

ALTER TABLE challenge_ratings DROP CONSTRAINT IF EXISTS challenge_ratings_challenge_id_fkey;
ALTER TABLE challenge_ratings ADD CONSTRAINT challenge_ratings_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE;

-- ── FK referencing challenge_entries(id) → CASCADE ───────────────────────────
ALTER TABLE challenge_ratings DROP CONSTRAINT IF EXISTS challenge_ratings_entry_id_fkey;
ALTER TABLE challenge_ratings ADD CONSTRAINT challenge_ratings_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES challenge_entries(id) ON DELETE CASCADE;

-- ── FK referencing families(id) → SET NULL (unlink, don't destroy channels) ──
ALTER TABLE channels DROP CONSTRAINT IF EXISTS channels_family_id_fkey;
ALTER TABLE channels ADD CONSTRAINT channels_family_id_fkey FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE SET NULL;

-- ── Intentionally UNCHANGED (left ON DELETE NO ACTION): ──────────────────────
--   responses.prompt_id   -> prompts(id)
--   submissions.prompt_id -> prompts(id)
-- Prompts are shared, admin-provisioned reference content that we never delete,
-- so a prompt delete must never cascade into user submissions/responses.
