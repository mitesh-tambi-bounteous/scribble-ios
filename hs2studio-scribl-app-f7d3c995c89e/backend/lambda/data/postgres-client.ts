/**
 * Postgres (Neon serverless) data-access layer for the Scribl POC backend.
 *
 * Mirrors the function surface of dynamodb-client.ts (same signatures) plus
 * the extra user/channel/wall functions the new routes need. Selected at
 * runtime by data/index.ts when SCRIBL_DATA_MODE=postgres.
 *
 * Testability: the sql executor is injected via `__setSqlForTests` so root
 * jest (which runs the mock-mode handler tests) never needs a real network
 * connection or the @neondatabase/serverless native bits. Production code
 * calls `getSql()`, which lazily constructs the real neon client from
 * DATABASE_URL on first use.
 */
import type {
  Challenge,
  ChallengeEntry,
  ChallengeToolset,
  Channel,
  ChannelMember,
  ChannelResponse,
  Prompt,
  Reaction,
  Submission,
  User,
} from "@scribl/shared/domain";
import type { RosterMember } from "@scribl/shared/api";
import type { SqlExecutor } from "./sql-driver";

export type { SqlExecutor } from "./sql-driver";

let _sql: SqlExecutor | undefined;

/**
 * Lazily constructs the sql executor from DATABASE_URL via the sql-driver
 * seam: production (Neon) gets the real HTTP driver unchanged; a local
 * Postgres URL (or SCRIBL_PG_DRIVER=node) gets a pg-backed adapter instead.
 * The driver module is required here (not top-level import) so this module
 * can be loaded (and its functions unit-tested via `__setSqlForTests`)
 * without any DB package needing to be installed, e.g. in the root jest run
 * that only exercises mock mode.
 */
function getSql(): SqlExecutor {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set (required for SCRIBL_DATA_MODE=postgres)");
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { makeSql } = require("./sql-driver") as { makeSql: (url: string) => SqlExecutor };
    _sql = makeSql(url);
  }
  return _sql;
}

/** Test-only: inject a fake sql executor so tests never touch a real DB. */
export function __setSqlForTests(fn: SqlExecutor | undefined): void {
  _sql = fn;
}

interface PromptRow {
  id: string;
  prompt_date: string;
  title: string | null;
  body: string | null;
  created_at: string;
}

function rowToPrompt(row: PromptRow): Prompt {
  return {
    id: row.id,
    date: row.prompt_date,
    text: row.body ?? row.title ?? "",
    createdAt: row.created_at,
  };
}

export async function getPromptForDate(date: string): Promise<Prompt> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, prompt_date, title, body, created_at
    FROM prompts
    WHERE prompt_date = ${date}
    LIMIT 1
  `) as PromptRow[];
  const row = rows[0];
  if (!row) {
    throw new Error(`no prompt seeded for date ${date}`);
  }
  return rowToPrompt(row);
}

/**
 * Looks up a prompt by id (enhance/setting derivation path). Returns
 * undefined rather than throwing so callers can degrade gracefully.
 */
export async function getPromptById(promptId: string): Promise<Prompt | undefined> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, prompt_date, title, body, created_at
    FROM prompts
    WHERE id = ${promptId}
    LIMIT 1
  `) as PromptRow[];
  const row = rows[0];
  return row ? rowToPrompt(row) : undefined;
}

interface SubmissionRow {
  id: string;
  user_id: string;
  prompt_id: string;
  created_at: string;
}

export async function getSubmission(
  userId: string,
  promptId: string,
): Promise<Submission | undefined> {
  const sql = getSql();
  const rows = (await sql`
    SELECT s.id, s.user_id, s.prompt_id, s.created_at
    FROM submissions s
    WHERE s.user_id = ${userId} AND s.prompt_id = ${promptId}
    LIMIT 1
  `) as SubmissionRow[];
  const row = rows[0];
  if (!row) {
    return undefined;
  }
  const channelRows = (await sql`
    SELECT DISTINCT channel_id
    FROM responses
    WHERE user_id = ${userId} AND prompt_id = ${promptId}
  `) as Array<{ channel_id: string }>;
  return {
    id: row.id,
    userId: row.user_id,
    promptId: row.prompt_id,
    channelIds: channelRows.map((r) => r.channel_id),
    createdAt: row.created_at,
  };
}

/** Is this a Personal Archive channel (task #6: unlimited, no-gate draws)? */
function isArchiveChannel(channelId: string): boolean {
  return channelId.endsWith("-archive");
}

/**
 * Writes a submission + grants channel membership for each target channel +
 * inserts the response row(s), atomically (ADR 0007). Uses the neon driver's
 * transaction API so a failure anywhere rolls back the whole write — the AC2
 * EXISTS check must never observe a partial write.
 *
 * Personal Archive (task #6): archive-channel responses get a unique id per
 * draw (timestamp-suffixed) instead of the deterministic `${id}-${channelId}`
 * scheme, so the partial unique index (schema.sql, scoped to non-archive
 * channels) never dedupes them away — the owner can deposit unlimited
 * drawings for the same prompt into their own archive. Group-channel
 * responses are completely unchanged: same id scheme, same one-per-
 * (user,channel,prompt) dedupe as before.
 */
export async function putSubmission(submission: Submission): Promise<string[]> {
  const sql = getSql();
  const { id, userId, promptId, channelIds } = submission;
  if (channelIds.length === 0) {
    throw new Error("putSubmission requires at least one channelId");
  }
  const text = (submission as { text?: string }).text ?? null;
  const imageRef = (submission as { imageRef?: string }).imageRef ?? null;

  // enhancement_status is only meaningful when an image is present AND
  // enhancement is actually enabled — otherwise no trigger will ever run to
  // resolve it out of "pending", and the client would spin forever (BF-6).
  const enhancementStatus = imageRef !== null && process.env.ENHANCE_ENABLED ? "pending" : null;

  // Archive draws must not require submit-to-unlock (they're never gated by
  // AC2 on read — see channel-responses.ts's archive exemption), so they must
  // also never depend on the `submissions` row existing. The submissions
  // INSERT below still runs (harmless / idempotent) for a mixed-channel
  // submit, but a pure archive-only draw has no daily-gate side effect to
  // rely on either way.
  const responseIds = channelIds.map((channelId) =>
    isArchiveChannel(channelId) ? `${id}-${channelId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` : `${id}-${channelId}`,
  );

  const statements = [
    sql`
      INSERT INTO submissions (id, user_id, prompt_id)
      VALUES (${id}, ${userId}, ${promptId})
      ON CONFLICT (user_id, prompt_id) DO NOTHING
    `,
    ...channelIds.map(
      (channelId) => sql`
        INSERT INTO channel_members (channel_id, user_id)
        VALUES (${channelId}, ${userId})
        ON CONFLICT (channel_id, user_id) DO NOTHING
      `,
    ),
    ...channelIds.map(
      (channelId, index) => sql`
        INSERT INTO responses (id, channel_id, prompt_id, user_id, author_name, body, image_ref, enhancement_status)
        VALUES (
          ${responseIds[index]},
          ${channelId},
          ${promptId},
          ${userId},
          (SELECT display_name FROM users WHERE id = ${userId}),
          ${text},
          ${imageRef},
          ${enhancementStatus}
        )
        ON CONFLICT DO NOTHING
      `,
    ),
  ];

  await sql.transaction(statements);

  // Per-channel response ids: submitting today's prompt to a second channel
  // creates that channel's response instead of colliding on the old
  // `${id}-${index}` scheme. For non-archive channels the bare ON CONFLICT DO
  // NOTHING dedupes against BOTH the `id` primary key AND the
  // responses_user_channel_prompt_key composite unique index (now partial —
  // see schema.sql), so a repeat submit to the SAME group channel is a no-op.
  // Archive channels get a fresh id every call (no dedupe key applies), so
  // repeated draws all land as distinct rows.
  return responseIds;
}

export async function getMembership(channelId: string, userId: string): Promise<boolean> {
  const sql = getSql();
  const rows = (await sql`
    SELECT 1
    FROM channel_members
    WHERE channel_id = ${channelId} AND user_id = ${userId}
    LIMIT 1
  `) as unknown[];
  return rows.length > 0;
}

export async function putMembership(channelId: string, userId: string): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO channel_members (channel_id, user_id)
    VALUES (${channelId}, ${userId})
    ON CONFLICT (channel_id, user_id) DO NOTHING
  `;
}

/**
 * Removes a membership grant (BF-15 self-leave). No-op if no matching row.
 */
export async function deleteMembership(channelId: string, userId: string): Promise<void> {
  const sql = getSql();
  await sql`
    DELETE FROM channel_members WHERE channel_id = ${channelId} AND user_id = ${userId}
  `;
}

interface ResponseRow {
  id: string;
  prompt_id: string;
  channel_id: string;
  user_id: string;
  author_name: string;
  author_avatar_color?: string | null;
  author_avatar_image?: string | null;
  image_ref: string | null;
  body: string | null;
  background_prompt?: string | null;
  created_at: string;
  enhanced_image_ref: string | null;
  enhancement_status: "pending" | "ready" | "failed" | null;
}

interface ReactionRow {
  response_id: string;
  user_id: string;
  emoji: string;
}

/**
 * Batch-loads reactions for a set of response ids into a per-response map.
 * Empty ids short-circuits to an empty map (no query issued).
 */
async function reactionsByResponse(
  sql: SqlExecutor,
  responseIds: readonly string[],
): Promise<Map<string, Reaction[]>> {
  const map = new Map<string, Reaction[]>();
  if (responseIds.length === 0) {
    return map;
  }
  const rows = (await sql`
    SELECT response_id, user_id, emoji
    FROM reactions
    WHERE response_id = ANY(${responseIds})
  `) as ReactionRow[];
  for (const r of rows) {
    const list = map.get(r.response_id) ?? [];
    list.push({ emoji: r.emoji, userId: r.user_id });
    map.set(r.response_id, list);
  }
  return map;
}

function rowToResponse(
  row: ResponseRow,
  reactions: Reaction[],
): ChannelResponse {
  return {
    id: row.id,
    promptId: row.prompt_id,
    channelId: row.channel_id,
    authorId: row.user_id,
    authorName: row.author_name,
    authorAvatarColor: row.author_avatar_color ?? undefined,
    authorAvatarImage: row.author_avatar_image ?? undefined,
    imageRef: row.image_ref ?? undefined,
    text: row.body ?? undefined,
    backgroundPrompt: row.background_prompt ?? undefined,
    createdAt: row.created_at,
    enhancedImageRef: row.enhanced_image_ref ?? undefined,
    enhancementStatus: row.enhancement_status ?? undefined,
    reactions,
  };
}

export async function listChannelResponses(
  channelId: string,
  promptId: string,
): Promise<readonly ChannelResponse[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT r.id, r.prompt_id, r.channel_id, r.user_id, r.author_name, u.avatar_color AS author_avatar_color, u.avatar_image AS author_avatar_image, r.image_ref, r.body, r.background_prompt, r.created_at, r.enhanced_image_ref, r.enhancement_status
    FROM responses r
    JOIN users u ON u.id = r.user_id
    WHERE r.channel_id = ${channelId} AND r.prompt_id = ${promptId}
    ORDER BY r.created_at ASC
  `) as ResponseRow[];

  if (rows.length === 0) {
    return [];
  }

  const responseIds = rows.map((r) => r.id);
  const reactions = await reactionsByResponse(sql, responseIds);

  return rows.map((row) => rowToResponse(row, reactions.get(row.id) ?? []));
}

/**
 * Looks up a single response by id, for the PATCH response-update handler
 * (edit caption / regenerate-background flow). SELECT-only. Returns null if
 * no row matches. Hydrates reactions the same way listChannelResponses does
 * so callers get a consistent ChannelResponse shape.
 */
export async function getResponseById(responseId: string): Promise<ChannelResponse | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT r.id, r.prompt_id, r.channel_id, r.user_id, r.author_name, u.avatar_color AS author_avatar_color, u.avatar_image AS author_avatar_image, r.image_ref, r.body, r.background_prompt, r.created_at, r.enhanced_image_ref, r.enhancement_status
    FROM responses r
    JOIN users u ON u.id = r.user_id
    WHERE r.id = ${responseId}
    LIMIT 1
  `) as ResponseRow[];
  const row = rows[0];
  if (!row) {
    return null;
  }
  const reactions = await reactionsByResponse(sql, [row.id]);
  return rowToResponse(row, reactions.get(row.id) ?? []);
}

/**
 * Partial update for a response's caption text and/or background prompt
 * (PATCH response-update handler). Absent fields are left untouched via
 * COALESCE, mirroring updateUser above. Does NOT touch enhanced_image_ref /
 * enhancement_status — the handler reuses setEnhancementResult for that.
 */
export async function updateResponse(
  responseId: string,
  patch: { text?: string; backgroundPrompt?: string },
): Promise<ChannelResponse> {
  const sql = getSql();
  const rows = (await sql`
    UPDATE responses r
    SET
      body = COALESCE(${patch.text ?? null}, body),
      background_prompt = COALESCE(${patch.backgroundPrompt ?? null}, background_prompt)
    FROM users u
    WHERE r.id = ${responseId} AND u.id = r.user_id
    RETURNING r.id, r.prompt_id, r.channel_id, r.user_id, r.author_name, u.avatar_color AS author_avatar_color, u.avatar_image AS author_avatar_image, r.image_ref, r.body, r.background_prompt, r.created_at, r.enhanced_image_ref, r.enhancement_status
  `) as ResponseRow[];
  const row = rows[0];
  if (!row) {
    throw new Error(`updateResponse: no response found for id ${responseId}`);
  }
  const reactions = await reactionsByResponse(sql, [row.id]);
  return rowToResponse(row, reactions.get(row.id) ?? []);
}

interface ChannelDayRow {
  prompt_id: string;
  response_count: string | number;
  last_created_at: string;
}

/**
 * Distinct days (by promptId) with at least one response in this channel,
 * newest-first, each with a response count. Read-only, SELECT-only — date
 * metadata + counts only, never response content. isoDate is derived from
 * promptId (form `prompt-YYYY-MM-DD`) when possible, falling back to the
 * calendar date of the latest response's created_at.
 */
export async function listChannelDays(channelId: string): Promise<readonly {
  promptId: string;
  isoDate: string;
  responseCount: number;
}[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT r.prompt_id, COUNT(*) AS response_count, MAX(r.created_at) AS last_created_at
    FROM responses r
    WHERE r.channel_id = ${channelId}
    GROUP BY r.prompt_id
    ORDER BY MAX(r.created_at) DESC
  `) as ChannelDayRow[];

  return rows.map((row) => ({
    promptId: row.prompt_id,
    isoDate: isoDateFromPromptId(row.prompt_id) ?? new Date(row.last_created_at).toISOString().slice(0, 10),
    responseCount: Number(row.response_count),
  }));
}

/** Extracts the YYYY-MM-DD suffix from a promptId of the form `prompt-YYYY-MM-DD`. */
function isoDateFromPromptId(promptId: string): string | undefined {
  const match = /^prompt-(\d{4}-\d{2}-\d{2})$/.exec(promptId);
  return match?.[1];
}

/**
 * Persists the async enhancement result (T4) for a single response row.
 * "failed" sets enhanced_image_ref back to null; "ready" sets it to the
 * provided ref. Fire-and-forget caller (enhance/trigger.ts) — never on the
 * submit request path.
 */
export async function setEnhancementResult(
  responseId: string,
  enhancedImageRef: string | null,
  status: "ready" | "failed",
): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE responses
    SET enhanced_image_ref = ${enhancedImageRef}, enhancement_status = ${status}
    WHERE id = ${responseId}
  `;
}

/**
 * Flips a response's enhancement_status to "pending" WITHOUT touching
 * enhanced_image_ref, so the previously-enhanced background stays visible
 * (no flash-to-blank) while the client polls/spinners until the async
 * regenerate settles via setEnhancementResult. Called from the
 * creator-only regenerate branch (response-update.ts) before firing
 * triggerEnhancement.
 */
export async function markEnhancementPending(responseId: string): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE responses
    SET enhancement_status = 'pending'
    WHERE id = ${responseId}
  `;
}

/**
 * Toggles an emoji reaction on a response: a repeat reaction from the same
 * user on the same emoji removes it, otherwise it's added. Keyed on
 * (response_id, user_id, emoji) via the UNIQUE constraint in schema.sql.
 */
export async function putReaction(
  responseId: string,
  userId: string,
  emoji: string,
): Promise<void> {
  const sql = getSql();
  const existing = (await sql`
    SELECT id FROM reactions
    WHERE response_id = ${responseId} AND user_id = ${userId} AND emoji = ${emoji}
  `) as { id: string }[];

  if (existing.length > 0) {
    await sql`DELETE FROM reactions WHERE response_id = ${responseId} AND user_id = ${userId} AND emoji = ${emoji}`;
    return;
  }

  const id = `reaction-${responseId}-${userId}-${emoji}`;
  await sql`
    INSERT INTO reactions (id, response_id, user_id, emoji)
    VALUES (${id}, ${responseId}, ${userId}, ${emoji})
    ON CONFLICT (response_id, user_id, emoji) DO NOTHING
  `;
}

interface ChannelRow {
  id: string;
  name: string;
  kind: "group" | "challenge";
  is_public: boolean;
  family_id: string | null;
}

function rowToChannel(row: ChannelRow): Channel {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    isPublic: row.is_public,
    familyId: row.family_id ?? undefined,
  };
}

export async function listChannels(): Promise<readonly Channel[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, name, kind, is_public, family_id FROM channels ORDER BY created_at ASC
  `) as ChannelRow[];
  return rows.map(rowToChannel);
}

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  avatar_color?: string | null;
  avatar_image?: string | null;
  created_at: string;
}

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarColor: row.avatar_color ?? undefined,
    avatarImage: row.avatar_image ?? undefined,
    createdAt: row.created_at,
  };
}

/**
 * Creates a user (idempotent on email). Returns the existing row on conflict.
 *
 * Emails must resolve case-insensitively (an invite to "Bob@X.com" must find
 * the same person as "bob@x.com"), but users.email is a plain `text UNIQUE`
 * column (case-sensitive index) and existing rows must never be rewritten
 * just to match a differently-cased lookup. So: first look up
 * case-insensitively and return the existing row untouched if found; only
 * fall through to the INSERT for a genuinely new email. The ON CONFLICT
 * clause stays as a race-safety net for the gap between the SELECT and the
 * INSERT (two concurrent invites of the same new email).
 */
export async function createUser(email: string, displayName: string): Promise<User> {
  const sql = getSql();
  const existingRows = (await sql`
    SELECT id, email, display_name, avatar_color, avatar_image, created_at
    FROM users
    WHERE lower(email) = lower(${email})
    LIMIT 1
  `) as UserRow[];
  const existing = existingRows[0];
  if (existing) {
    return rowToUser(existing);
  }

  const id = `user-${email.split("@")[0]?.toLowerCase() ?? Date.now()}-${Date.now()}`;
  const rows = (await sql`
    INSERT INTO users (id, email, display_name)
    VALUES (${id}, ${email}, ${displayName})
    ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
    RETURNING id, email, display_name, avatar_color, avatar_image, created_at
  `) as UserRow[];
  const row = rows[0];
  if (!row) {
    throw new Error("createUser: insert returned no row");
  }
  return rowToUser(row);
}

/**
 * Updates only the provided fields on a user (S-Settings). Absent fields are
 * left untouched via COALESCE against the current row so a single tagged
 * template can express a partial update without string concatenation.
 * Unknown id (no matching row) throws, mirroring this file's not-found
 * convention (see createChannel/createChallenge "insert returned no row").
 */
export async function updateUser(
  id: string,
  patch: { displayName?: string; email?: string; avatarColor?: string; avatarImage?: string },
): Promise<User> {
  const sql = getSql();
  const rows = (await sql`
    UPDATE users
    SET
      display_name = COALESCE(${patch.displayName ?? null}, display_name),
      email = COALESCE(${patch.email ?? null}, email),
      avatar_color = COALESCE(${patch.avatarColor ?? null}, avatar_color),
      avatar_image = COALESCE(${patch.avatarImage ?? null}, avatar_image)
    WHERE id = ${id}
    RETURNING id, email, display_name, avatar_color, avatar_image, created_at
  `) as UserRow[];
  const row = rows[0];
  if (!row) {
    throw new Error(`updateUser: no user found for id ${id}`);
  }
  return rowToUser(row);
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, email, display_name, avatar_color, avatar_image, created_at FROM users WHERE email = ${email} LIMIT 1
  `) as UserRow[];
  const row = rows[0];
  return row ? rowToUser(row) : undefined;
}

export async function listUsers(): Promise<readonly User[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, email, display_name, avatar_color, avatar_image, created_at FROM users ORDER BY created_at ASC
  `) as UserRow[];
  return rows.map(rowToUser);
}

/**
 * Creates a channel. When `id` is supplied (auth-signup's deterministic
 * per-user channel ids), the insert is idempotent on that id — a re-signup
 * (idempotent on email) must not error or duplicate the row. Always grants
 * `createdBy` membership, whether the row was just inserted or already
 * existed.
 */
export async function createChannel(
  name: string,
  kind: "group" | "challenge",
  isPublic: boolean,
  createdBy: string,
  familyId?: string,
  id?: string,
): Promise<Channel> {
  const sql = getSql();
  const channelId = id ?? `channel-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
  const rows = (await sql`
    INSERT INTO channels (id, name, kind, is_public, family_id, created_by)
    VALUES (${channelId}, ${name}, ${kind}, ${isPublic}, ${familyId ?? null}, ${createdBy})
    ON CONFLICT (id) DO UPDATE SET id = channels.id
    RETURNING id, name, kind, is_public, family_id
  `) as ChannelRow[];
  const row = rows[0];
  if (!row) {
    throw new Error("createChannel: insert returned no row");
  }
  await sql`
    INSERT INTO channel_members (channel_id, user_id)
    VALUES (${row.id}, ${createdBy})
    ON CONFLICT (channel_id, user_id) DO NOTHING
  `;
  return rowToChannel(row);
}

/** Looks up the userId that created a channel, if any. */
export async function getChannelCreator(channelId: string): Promise<string | undefined> {
  const sql = getSql();
  const rows = (await sql`
    SELECT created_by FROM channels WHERE id = ${channelId} LIMIT 1
  `) as Array<{ created_by: string | null }>;
  return rows[0]?.created_by ?? undefined;
}

/** Channels the user is a member of. */
export async function listWallsForUser(userId: string): Promise<readonly Channel[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT DISTINCT c.id, c.name, c.kind, c.is_public, c.family_id
    FROM channels c
    JOIN channel_members cm ON cm.channel_id = c.id AND cm.user_id = ${userId}
    ORDER BY c.id ASC
  `) as ChannelRow[];
  return rows.map(rowToChannel);
}

/**
 * WS4a: distinct calendar dates (YYYY-MM-DD) this user has a recorded
 * submission for, derived from submission created_at. Feeds the /me/stats
 * streak + weekly-completion pure helpers (backend/lambda/data/stats.ts).
 */
export async function getUserSubmissionDates(userId: string): Promise<string[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT DISTINCT to_char(created_at, 'YYYY-MM-DD') AS d
    FROM submissions
    WHERE user_id = ${userId}
  `) as Array<{ d: string }>;
  return rows.map((r) => r.d);
}

/** WS4a: total count of this user's submissions (across all prompts). */
export async function countUserSubmissions(userId: string): Promise<number> {
  const sql = getSql();
  const rows = (await sql`
    SELECT COUNT(*)::int AS c FROM submissions WHERE user_id = ${userId}
  `) as Array<{ c: number }>;
  return rows[0]?.c ?? 0;
}

export interface PromptParticipants {
  count: number;
  /** Up to 5 distinct participants, newest submission first. */
  participants: { displayName: string }[];
}

const MAX_PROMPT_PARTICIPANTS = 5;

/**
 * WS4a: distinct users who submitted for `promptId`, for the today-prompt
 * participant count + avatar stack. Bounded to MAX_PROMPT_PARTICIPANTS.
 */
export async function getPromptParticipants(promptId: string): Promise<PromptParticipants> {
  const sql = getSql();
  const countRows = (await sql`
    SELECT COUNT(DISTINCT user_id)::int AS c FROM submissions WHERE prompt_id = ${promptId}
  `) as Array<{ c: number }>;
  const nameRows = (await sql`
    SELECT u.display_name AS display_name, MAX(s.created_at) AS latest
    FROM submissions s
    JOIN users u ON u.id = s.user_id
    WHERE s.prompt_id = ${promptId}
    GROUP BY u.display_name
    ORDER BY latest DESC
    LIMIT ${MAX_PROMPT_PARTICIPANTS}
  `) as Array<{ display_name: string }>;
  return {
    count: countRows[0]?.c ?? 0,
    participants: nameRows.map((r) => ({ displayName: r.display_name })),
  };
}

interface MemberRow {
  user_id: string;
  email: string;
  display_name: string;
  avatar_color?: string | null;
  avatar_image?: string | null;
  has_drawn_today: boolean;
  // Per-channel response for this prompt (LEFT JOIN; all null when absent).
  resp_id?: string | null;
  resp_prompt_id?: string | null;
  resp_channel_id?: string | null;
  resp_author_name?: string | null;
  resp_image_ref?: string | null;
  resp_body?: string | null;
  resp_created_at?: string | null;
  resp_enhanced_image_ref?: string | null;
  resp_enhancement_status?: "pending" | "ready" | "failed" | null;
}

/**
 * Channel members joined to users, with channel-scoped hasDrawnToday and the
 * member's response IN THIS channel for the prompt. The LEFT JOIN on
 * responses means hasDrawnToday = r.id IS NOT NULL: a submission to a
 * DIFFERENT channel does not count here (AC4-scoped). Each present response
 * is hydrated with the same reactions as listChannelResponses.
 */
export async function listChannelMembers(
  channelId: string,
  promptId: string,
): Promise<readonly ChannelMember[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      u.id AS user_id,
      u.email AS email,
      u.display_name,
      u.avatar_color AS avatar_color,
      u.avatar_image AS avatar_image,
      (r.id IS NOT NULL) AS has_drawn_today,
      r.id AS resp_id,
      r.prompt_id AS resp_prompt_id,
      r.channel_id AS resp_channel_id,
      r.author_name AS resp_author_name,
      r.image_ref AS resp_image_ref,
      r.body AS resp_body,
      r.created_at AS resp_created_at,
      r.enhanced_image_ref AS resp_enhanced_image_ref,
      r.enhancement_status AS resp_enhancement_status
    FROM channel_members cm
    JOIN users u ON u.id = cm.user_id
    LEFT JOIN responses r
      ON r.user_id = u.id AND r.channel_id = ${channelId} AND r.prompt_id = ${promptId}
    WHERE cm.channel_id = ${channelId}
    ORDER BY u.id ASC
  `) as MemberRow[];

  const responseIds = rows
    .map((row) => row.resp_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  const reactions = await reactionsByResponse(sql, responseIds);

  return rows.map((row) => {
    const member: ChannelMember = {
      userId: row.user_id,
      email: row.email,
      displayName: row.display_name,
      hasDrawnToday: row.has_drawn_today,
      avatarColor: row.avatar_color ?? undefined,
      avatarImage: row.avatar_image ?? undefined,
    };
    if (typeof row.resp_id === "string" && row.resp_id.length > 0) {
      member.response = rowToResponse(
        {
          id: row.resp_id,
          prompt_id: row.resp_prompt_id ?? promptId,
          channel_id: row.resp_channel_id ?? channelId,
          user_id: row.user_id,
          author_name: row.resp_author_name ?? row.display_name,
          author_avatar_color: row.avatar_color ?? null,
          author_avatar_image: row.avatar_image ?? null,
          image_ref: row.resp_image_ref ?? null,
          body: row.resp_body ?? null,
          created_at: row.resp_created_at ?? "",
          enhanced_image_ref: row.resp_enhanced_image_ref ?? null,
          enhancement_status: row.resp_enhancement_status ?? null,
        },
        reactions.get(row.resp_id) ?? [],
      );
    }
    return member;
  });
}

interface RosterRow {
  user_id: string;
  display_name: string;
  email: string;
  avatar_color?: string | null;
  avatar_image?: string | null;
}

/**
 * Identity-only channel roster: joins channel_members -> users, no prompt, no
 * drawn-today status, no response. Mirrors listChannelMembers's join shape
 * minus the LEFT JOIN on responses.
 */
export async function listChannelRoster(channelId: string): Promise<readonly RosterMember[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT u.id AS user_id, u.display_name, u.email, u.avatar_color, u.avatar_image
    FROM channel_members cm
    JOIN users u ON u.id = cm.user_id
    WHERE cm.channel_id = ${channelId}
    ORDER BY u.id ASC
  `) as RosterRow[];
  return rows.map((row) => ({
    userId: row.user_id,
    displayName: row.display_name,
    email: row.email,
    avatarColor: row.avatar_color ?? undefined,
    avatarImage: row.avatar_image ?? undefined,
  }));
}

// Family Challenges (Task 3: real Postgres impl).

interface ChallengeRow {
  id: string;
  channel_id: string;
  creator_id: string;
  word: string;
  draw_seconds: number | null;
  toolset: string | null;
  background_ref: string | null;
  created_at: string;
}

/**
 * Maps a stored row to the domain shape. Back-compat with pre-migration
 * rows: NULL toolset -> undefined (unrestricted), NULL/missing draw_seconds
 * -> 300 (the old 5-minute default).
 */
function rowToChallenge(row: ChallengeRow): Challenge {
  let toolset: ChallengeToolset | undefined;
  if (row.toolset) {
    try {
      toolset = JSON.parse(row.toolset) as ChallengeToolset;
    } catch {
      toolset = undefined;
    }
  }
  return {
    id: row.id,
    channelId: row.channel_id,
    creatorId: row.creator_id,
    word: row.word,
    drawSeconds: row.draw_seconds ?? 300,
    toolset,
    backgroundRef: row.background_ref ?? undefined,
    createdAt: row.created_at,
  };
}

export async function createChallenge(input: {
  channelId: string;
  creatorId: string;
  word: string;
  drawSeconds: number;
  toolset?: ChallengeToolset;
  backgroundRef?: string;
}): Promise<Challenge> {
  const sql = getSql();
  const id = `challenge-${input.channelId}-${Date.now()}`;
  const toolsetJson = input.toolset ? JSON.stringify(input.toolset) : null;
  const rows = (await sql`
    INSERT INTO challenges (id, channel_id, creator_id, word, draw_seconds, toolset, background_ref)
    VALUES (
      ${id},
      ${input.channelId},
      ${input.creatorId},
      ${input.word},
      ${input.drawSeconds},
      ${toolsetJson},
      ${input.backgroundRef ?? null}
    )
    RETURNING id, channel_id, creator_id, word, draw_seconds, toolset, background_ref, created_at
  `) as ChallengeRow[];
  const row = rows[0];
  if (!row) {
    throw new Error("createChallenge: insert returned no row");
  }
  return rowToChallenge(row);
}

export async function getChallenge(challengeId: string): Promise<Challenge | undefined> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, channel_id, creator_id, word, draw_seconds, toolset, background_ref, created_at
    FROM challenges
    WHERE id = ${challengeId}
    LIMIT 1
  `) as ChallengeRow[];
  const row = rows[0];
  return row ? rowToChallenge(row) : undefined;
}

export async function listChallengesForChannel(
  channelId: string,
): Promise<readonly Challenge[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, channel_id, creator_id, word, draw_seconds, toolset, background_ref, created_at
    FROM challenges
    WHERE channel_id = ${channelId}
    ORDER BY created_at ASC
  `) as ChallengeRow[];
  return rows.map(rowToChallenge);
}

export async function putChallengeEntry(entry: {
  id: string;
  challengeId: string;
  userId: string;
  imageRef?: string;
}): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO challenge_entries (id, challenge_id, user_id, author_name, image_ref)
    VALUES (
      ${entry.id},
      ${entry.challengeId},
      ${entry.userId},
      (SELECT display_name FROM users WHERE id = ${entry.userId}),
      ${entry.imageRef ?? null}
    )
    ON CONFLICT (challenge_id, user_id) DO NOTHING
  `;
}

interface ChallengeEntryRow {
  id: string;
  challenge_id: string;
  user_id: string;
  author_name: string;
  image_ref: string | null;
  created_at: string;
}

interface RatingAggRow {
  entry_id: string;
  avg: number | string;
  n: number;
}

interface RaterRow {
  entry_id: string;
  stars: number;
}

function rowToChallengeEntry(
  row: ChallengeEntryRow,
  agg: RatingAggRow | undefined,
  myStars: number | undefined,
): ChallengeEntry {
  return {
    id: row.id,
    challengeId: row.challenge_id,
    userId: row.user_id,
    authorName: row.author_name,
    imageRef: row.image_ref ?? undefined,
    createdAt: row.created_at,
    averageStars: agg == null || agg.avg == null ? 0 : Number(agg.avg),
    ratingCount: agg?.n ?? 0,
    myStars,
  };
}

export async function getChallengeEntryForUser(
  challengeId: string,
  userId: string,
): Promise<ChallengeEntry | undefined> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, challenge_id, user_id, author_name, image_ref, created_at
    FROM challenge_entries
    WHERE challenge_id = ${challengeId} AND user_id = ${userId}
    LIMIT 1
  `) as ChallengeEntryRow[];
  const row = rows[0];
  if (!row) {
    return undefined;
  }
  const aggRows = (await sql`
    SELECT entry_id, avg(stars)::float AS avg, count(*)::int AS n
    FROM challenge_ratings
    WHERE challenge_id = ${challengeId}
    GROUP BY entry_id
  `) as RatingAggRow[];
  const agg = aggRows.find((r) => r.entry_id === row.id);
  return rowToChallengeEntry(row, agg, undefined);
}

export async function listChallengeEntries(
  challengeId: string,
  forUserId?: string,
): Promise<readonly ChallengeEntry[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, challenge_id, user_id, author_name, image_ref, created_at
    FROM challenge_entries
    WHERE challenge_id = ${challengeId}
    ORDER BY created_at ASC
  `) as ChallengeEntryRow[];

  if (rows.length === 0) {
    return [];
  }

  const aggRows = (await sql`
    SELECT entry_id, avg(stars)::float AS avg, count(*)::int AS n
    FROM challenge_ratings
    WHERE challenge_id = ${challengeId}
    GROUP BY entry_id
  `) as RatingAggRow[];

  let raterRows: RaterRow[] = [];
  if (forUserId) {
    raterRows = (await sql`
      SELECT entry_id, stars
      FROM challenge_ratings
      WHERE challenge_id = ${challengeId} AND rater_id = ${forUserId}
    `) as RaterRow[];
  }

  return rows.map((row) => {
    const agg = aggRows.find((r) => r.entry_id === row.id);
    const myStars = raterRows.find((r) => r.entry_id === row.id)?.stars;
    return rowToChallengeEntry(row, agg, myStars);
  });
}

export async function countChannelMembers(channelId: string): Promise<number> {
  const sql = getSql();
  const rows = (await sql`
    SELECT count(*)::int AS n FROM channel_members WHERE channel_id = ${channelId}
  `) as Array<{ n: number }>;
  return rows[0]?.n ?? 0;
}

export async function putRating(input: {
  challengeId: string;
  entryId: string;
  raterId: string;
  stars: number;
}): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO challenge_ratings (challenge_id, entry_id, rater_id, stars)
    VALUES (${input.challengeId}, ${input.entryId}, ${input.raterId}, ${input.stars})
    ON CONFLICT (entry_id, rater_id) DO UPDATE SET stars = EXCLUDED.stars
  `;
}
