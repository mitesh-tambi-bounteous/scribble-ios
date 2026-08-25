/**
 * Journey seed: deterministic demo data for the full user journey (family
 * wall, personal archives, reactions, a challenge) so downstream QA/screenshot
 * passes have real content to render. Idempotent — every INSERT uses
 * ON CONFLICT DO NOTHING, so re-running is a no-op after the first run.
 *
 * Does NOT touch prompts (see `npm run db:prompts`) and does NOT reset the
 * schema (see `npm run db:reset`). Run: `npm run db:seed-journey` (from
 * backend/), after `npm run db:bootstrap` and `npm run db:prompts`.
 */
import * as path from "node:path";
import dotenv from "dotenv";
import { makeSql } from "../lambda/data/sql-driver";
import { assertDatabaseUrl } from "./schema-runner";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

/** Formats a Date as YYYY-MM-DD in UTC (stable, no local-timezone drift). */
function toIsoDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

interface DemoUserSpec {
  readonly seedId: string;
  readonly email: string;
  readonly displayName: string;
}

interface ResolvedUser {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
}

const DEMO_USER_SPECS: readonly DemoUserSpec[] = [
  { seedId: "user-rob-demo-seed", email: "rob.demo@scribl.co", displayName: "Rob" },
  { seedId: "user-alice-seed", email: "alice.demo@scribl.co", displayName: "Alice" },
  { seedId: "user-sam-seed", email: "sam.demo@scribl.co", displayName: "Sam" },
];

const FAMILY_ID = "family-demo-seed";
const FAMILY_WALL_ID = "channel-family-demo-seed-wall";
const CHALLENGE_ID = "challenge-demo-seed-1";
const CHALLENGE_CHANNEL_ID = `${CHALLENGE_ID}-channel`;

/** channel-<userId>-archive mirrors auth-signup.ts's personalChannelSpecs. */
function archiveChannelId(userId: string): string {
  return `channel-${userId}-archive`;
}

const CAPTIONS: readonly string[] = [
  "Sketching the sunrise over the backyard fence.",
  "A quick doodle of the family dog mid-nap.",
  "Trying out a new shading technique today.",
  "Kitchen table still life: coffee mug + toast.",
  "Fast 5-minute warmup before the real drawing.",
];

const MAX_PAST_DAYS = 60; // bounded loop guard
const PAST_DAYS = 5;

/**
 * Inserts each demo user (idempotent on EMAIL, not just id): a prior
 * signup/harness run may already own this email under a different id (e.g.
 * the real /auth/signup flow's timestamp-suffixed id). ON CONFLICT (email)
 * resolves to that existing row instead of erroring, and the real id is read
 * back so every downstream insert references the row that truly exists.
 */
async function upsertUsers(
  sql: ReturnType<typeof makeSql>,
  specs: readonly DemoUserSpec[],
): Promise<ResolvedUser[]> {
  const resolved: ResolvedUser[] = [];
  for (const spec of specs) {
    // eslint-disable-next-line no-await-in-loop
    await sql`
      INSERT INTO users (id, email, display_name)
      VALUES (${spec.seedId}, ${spec.email}, ${spec.displayName})
      ON CONFLICT (email) DO NOTHING
    `;
    // eslint-disable-next-line no-await-in-loop
    const rows = (await sql`SELECT id, display_name FROM users WHERE email = ${spec.email}`) as {
      id: string;
      display_name: string;
    }[];
    const row = rows[0];
    if (!row) {
      throw new Error(`seed-journey: failed to resolve user id for ${spec.email}`);
    }
    resolved.push({ id: row.id, email: spec.email, displayName: row.display_name });
  }
  return resolved;
}

async function main(): Promise<void> {
  const url = assertDatabaseUrl(process.env.DATABASE_URL);
  const sql = makeSql(url);

  const users = await upsertUsers(sql, DEMO_USER_SPECS);
  const rob = users[0];
  const alice = users[1];
  const sam = users[2];
  if (!rob || !alice || !sam) {
    throw new Error("seed-journey: expected exactly 3 resolved demo users");
  }
  console.log(`seed-journey: users ok (${users.length})`);

  // ─── Family + family wall channel ─────────────────────────────────────
  await sql`
    INSERT INTO families (id, name)
    VALUES (${FAMILY_ID}, 'Demo Family')
    ON CONFLICT (id) DO NOTHING
  `;
  await sql`
    INSERT INTO channels (id, name, kind, is_public, family_id, created_by)
    VALUES (${FAMILY_WALL_ID}, 'Family Wall', 'group', false, ${FAMILY_ID}, ${rob.id})
    ON CONFLICT (id) DO NOTHING
  `;
  for (const user of users) {
    // eslint-disable-next-line no-await-in-loop
    await sql`
      INSERT INTO channel_members (channel_id, user_id)
      VALUES (${FAMILY_WALL_ID}, ${user.id})
      ON CONFLICT DO NOTHING
    `;
  }
  console.log("seed-journey: family + family wall ok");

  // ─── Personal archive channel per user ────────────────────────────────
  const archiveIds: Record<string, string> = {};
  for (const user of users) {
    const archiveId = archiveChannelId(user.id);
    archiveIds[user.id] = archiveId;
    // eslint-disable-next-line no-await-in-loop
    await sql`
      INSERT INTO channels (id, name, kind, is_public, family_id, created_by)
      VALUES (${archiveId}, 'Personal Archive', 'group', false, NULL, ${user.id})
      ON CONFLICT (id) DO NOTHING
    `;
    // eslint-disable-next-line no-await-in-loop
    await sql`
      INSERT INTO channel_members (channel_id, user_id)
      VALUES (${archiveId}, ${user.id})
      ON CONFLICT DO NOTHING
    `;
  }
  console.log("seed-journey: archive channels ok");

  // ─── Multi-day prompts (past 5 days), submissions + responses ─────────
  if (PAST_DAYS > MAX_PAST_DAYS) {
    throw new Error("seed-journey: PAST_DAYS exceeds safety cap");
  }
  const today = new Date();
  const pastPromptIds: string[] = [];

  for (let offset = 1; offset <= PAST_DAYS; offset += 1) {
    const date = new Date(today.getTime() - offset * 86_400_000);
    const isoDate = toIsoDate(date);
    const promptId = `prompt-${isoDate}`;
    pastPromptIds.push(promptId);

    // eslint-disable-next-line no-await-in-loop
    await sql`
      INSERT INTO prompts (id, prompt_date, title, body)
      VALUES (${promptId}, ${isoDate}, NULL, ${`Draw something from day -${offset}`})
      ON CONFLICT (prompt_date) DO NOTHING
    `;

    for (let u = 0; u < users.length; u += 1) {
      const user = users[u];
      if (!user) {
        continue;
      }
      const caption = CAPTIONS[(offset + u) % CAPTIONS.length] ?? CAPTIONS[0];
      const submissionId = `submission-${user.id}-${promptId}`;
      const archiveId = archiveIds[user.id];
      if (!archiveId) {
        continue;
      }
      const familyResponseId = `response-${user.id}-${promptId}-${FAMILY_WALL_ID}`;
      const archiveResponseId = `response-${user.id}-${promptId}-${archiveId}`;

      // eslint-disable-next-line no-await-in-loop
      await sql`
        INSERT INTO submissions (id, user_id, prompt_id)
        VALUES (${submissionId}, ${user.id}, ${promptId})
        ON CONFLICT DO NOTHING
      `;

      // Family wall response — every user, every day.
      // eslint-disable-next-line no-await-in-loop
      await sql`
        INSERT INTO responses (id, channel_id, prompt_id, user_id, author_name, body)
        VALUES (${familyResponseId}, ${FAMILY_WALL_ID}, ${promptId}, ${user.id}, ${user.displayName}, ${caption})
        ON CONFLICT DO NOTHING
      `;

      // Personal archive response — same drawing, private history.
      // eslint-disable-next-line no-await-in-loop
      await sql`
        INSERT INTO responses (id, channel_id, prompt_id, user_id, author_name, body)
        VALUES (${archiveResponseId}, ${archiveId}, ${promptId}, ${user.id}, ${user.displayName}, ${caption})
        ON CONFLICT DO NOTHING
      `;
    }
  }
  console.log(`seed-journey: ${PAST_DAYS} day(s) of submissions + responses ok`);

  // ─── Reactions on a couple of family-wall responses ───────────────────
  const firstPromptId = pastPromptIds[0];
  if (firstPromptId) {
    const targetResponseId = `response-${rob.id}-${firstPromptId}-${FAMILY_WALL_ID}`;
    for (const reactor of [alice, sam]) {
      const reactionId = `reaction-${targetResponseId}-${reactor.id}-heart`;
      // eslint-disable-next-line no-await-in-loop
      await sql`
        INSERT INTO reactions (id, response_id, user_id, emoji)
        VALUES (${reactionId}, ${targetResponseId}, ${reactor.id}, '❤️')
        ON CONFLICT DO NOTHING
      `;
    }
    console.log("seed-journey: reactions ok");
  }

  // ─── A challenge + a few entries ───────────────────────────────────────
  await sql`
    INSERT INTO channels (id, name, kind, is_public, family_id, created_by)
    VALUES (${CHALLENGE_CHANNEL_ID}, 'Sketch Challenge', 'challenge', false, ${FAMILY_ID}, ${rob.id})
    ON CONFLICT (id) DO NOTHING
  `;
  for (const user of users) {
    // eslint-disable-next-line no-await-in-loop
    await sql`
      INSERT INTO channel_members (channel_id, user_id)
      VALUES (${CHALLENGE_CHANNEL_ID}, ${user.id})
      ON CONFLICT DO NOTHING
    `;
  }
  await sql`
    INSERT INTO challenges (id, channel_id, creator_id, word, draw_seconds, toolset)
    VALUES (${CHALLENGE_ID}, ${CHALLENGE_CHANNEL_ID}, ${rob.id}, 'lighthouse', 180, NULL)
    ON CONFLICT DO NOTHING
  `;
  for (const user of users) {
    const entryId = `entry-${CHALLENGE_ID}-${user.id}`;
    // eslint-disable-next-line no-await-in-loop
    await sql`
      INSERT INTO challenge_entries (id, challenge_id, user_id, author_name, image_ref)
      VALUES (${entryId}, ${CHALLENGE_ID}, ${user.id}, ${user.displayName}, NULL)
      ON CONFLICT DO NOTHING
    `;
  }
  console.log("seed-journey: challenge + entries ok");

  console.log("seed-journey: done");
  console.log(`seed-journey: family wall channel id = ${FAMILY_WALL_ID}`);
  for (const user of users) {
    console.log(`seed-journey: ${user.email} (${user.id}) archive = ${archiveIds[user.id]}`);
  }
  console.log(`seed-journey: challenge id = ${CHALLENGE_ID}`);
}

main().catch((err) => {
  console.error("seed-journey failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
