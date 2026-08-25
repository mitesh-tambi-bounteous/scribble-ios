/**
 * Thin data-access layer for the Scribl POC backend.
 *
 * This module is the ONLY place handlers should reach for stored data. It is
 * intentionally small so the store can change later (ADR 0004: production
 * moves to Aurora Serverless v2 / Postgres) without handler rewrites.
 *
 * Mock mode (default for the POC, no live table required): reads come from
 * the deterministic seed fixtures in backend/seeds/. A real DynamoDB
 * DocumentClient is wired below so a future change can flip `MOCK_MODE` off
 * and route the same function signatures at the real table — the GetItem /
 * Query shapes already match the schema in schema.ts.
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type {
  Challenge,
  ChallengeEntry,
  ChallengeToolset,
  Channel,
  ChannelMember,
  ChannelResponse,
  Prompt,
  Submission,
  User,
} from "@scribl/shared/domain";
import type { RosterMember } from "@scribl/shared/api";
import {
  buildTodayPrompt,
  SEED_CHANNELS,
  SEED_USER_DISPLAY_NAMES,
} from "../../seeds/seed-data";

/**
 * Mock mode reads from the seed fixtures instead of a live table. This is
 * what lets `GET /prompt/today` work pre-deploy and keeps `cdk synth` green
 * without provisioning data. Flip via env var once a real table is wired.
 */
const MOCK_MODE = process.env.SCRIBL_DATA_MODE !== "live";

export const TABLE_NAME = process.env.SCRIBL_TABLE_NAME ?? "scribl-poc-table";

let documentClient: DynamoDBDocumentClient | undefined;

/**
 * In-memory overlay for submissions written via POST /submit in mock mode
 * (S-003). Seed submissions remain the fallback for prompts/users that never
 * called submit; writes here take priority. Keyed by `${userId}#${promptId}`.
 */
const mockSubmissions = new Map<string, Submission>();

function submissionKey(userId: string, promptId: string): string {
  return `${userId}#${promptId}`;
}

/**
 * In-memory overlay for memberships granted via POST /submit in mock mode
 * (S-004). Submitting to a channel grants membership to it. Keyed by
 * `${channelId}#${userId}`.
 */
const mockMemberships = new Set<string>();

function membershipKey(channelId: string, userId: string): string {
  return `${channelId}#${userId}`;
}

/** Lazily-constructed real DynamoDB client, used only when MOCK_MODE is false. */
function getDocumentClient(): DynamoDBDocumentClient {
  if (!documentClient) {
    documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  }
  return documentClient;
}

/**
 * Reads today's prompt for the given calendar date. Same date always
 * resolves to the same Prompt id (AC1).
 */
export async function getPromptForDate(date: string): Promise<Prompt> {
  if (MOCK_MODE) {
    return buildTodayPrompt(date);
  }
  // Live-mode wiring point: GetItem on schema.promptKey(date) against
  // TABLE_NAME via getDocumentClient(). Left unimplemented for the POC —
  // mock mode is the supported path until a real table is deployed.
  throw new Error("live DynamoDB mode is not implemented in the POC slice");
}

/**
 * Looks up a prompt by its id (e.g. for enhancement/setting derivation, which
 * only has promptId off the submission, not the calendar date). Mock-mode ids
 * are deterministically `prompt-<date>` (see seed-data.ts promptIdForDate),
 * so we recover the date and delegate to getPromptForDate. Returns undefined
 * (never throws) if the id doesn't parse or no prompt exists for that date —
 * callers on the enhance path treat this as best-effort.
 */
export async function getPromptById(promptId: string): Promise<Prompt | undefined> {
  if (MOCK_MODE) {
    const match = /^prompt-(.+)$/.exec(promptId);
    const date = match?.[1];
    if (!date) {
      return undefined;
    }
    try {
      return await buildTodayPrompt(date);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * Point lookup: does this user have a recorded submission for this prompt?
 * This is the EXISTS check the AC2 gate (S-003) will call before returning
 * any peer content. Returns the Submission record (or undefined).
 */
export async function getSubmission(
  userId: string,
  promptId: string,
): Promise<Submission | undefined> {
  if (MOCK_MODE) {
    return mockSubmissions.get(submissionKey(userId, promptId));
  }
  throw new Error("live DynamoDB mode is not implemented in the POC slice");
}

/**
 * Writes a submission item keyed by (userId, promptId) (S-003). This is the
 * only write path that creates the item the AC2 EXISTS check depends on.
 */
/** Is this a Personal Archive channel (task #6: unlimited, no-gate draws)? */
function isArchiveChannel(channelId: string): boolean {
  return channelId.endsWith("-archive");
}

export async function putSubmission(submission: Submission): Promise<string[]> {
  if (MOCK_MODE) {
    mockSubmissions.set(submissionKey(submission.userId, submission.promptId), submission);
    const extra = submission as Submission & { text?: string; imageRef?: string };
    const responseIds: string[] = [];
    for (const channelId of submission.channelIds) {
      await putMembership(channelId, submission.userId);
      // Archive channels get a unique id per draw so putResponse's dedupe
      // (below) never collapses repeated same-day drawings into one row —
      // mirrors the Postgres path's timestamp-suffixed archive response id.
      const responseId = isArchiveChannel(channelId)
        ? `${submission.id}-${channelId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        : `${submission.id}-${channelId}`;
      responseIds.push(responseId);
      // Mirrors the live-mode `responses` row insert in postgres-client.ts:
      // a submission also creates the peer-visible response item that the
      // AC2 read-after-submit path (channel-responses.ts) lists.
      await putResponse({
        id: responseId,
        promptId: submission.promptId,
        channelId,
        authorId: submission.userId,
        authorName: SEED_USER_DISPLAY_NAMES[submission.userId] ?? submission.userId,
        imageRef: extra.imageRef,
        text: extra.text,
        createdAt: submission.createdAt,
        reactions: [],
        // enhancement_status is only meaningful when there's an image to
        // enhance AND enhancement is actually enabled — otherwise nothing
        // will ever resolve it out of "pending" (BF-6 forever-spinner).
        enhancementStatus: extra.imageRef && process.env.ENHANCE_ENABLED ? "pending" : undefined,
      });
    }
    return responseIds;
  }
  throw new Error("live DynamoDB mode is not implemented in the POC slice");
}

/** Test-only: clears the in-memory submission overlay for test isolation. */
export function resetMockSubmissions(): void {
  mockSubmissions.clear();
}

/**
 * Point lookup: is this user a member of this channel? This is the AC4
 * membership gate (S-004) called before returning any channel responses.
 * MOCK_MODE checks the write overlay first, then falls back to seed data.
 */
export async function getMembership(
  channelId: string,
  userId: string,
): Promise<boolean> {
  if (MOCK_MODE) {
    return mockMemberships.has(membershipKey(channelId, userId));
  }
  throw new Error("live DynamoDB mode is not implemented in the POC slice");
}

/**
 * Writes a membership grant (S-004). Submitting to a channel grants
 * membership to that channel.
 */
export async function putMembership(channelId: string, userId: string): Promise<void> {
  if (MOCK_MODE) {
    mockMemberships.add(membershipKey(channelId, userId));
    return;
  }
  throw new Error("live DynamoDB mode is not implemented in the POC slice");
}

/** Test-only: clears the in-memory membership overlay for test isolation. */
export function resetMockMemberships(): void {
  mockMemberships.clear();
}

/**
 * Removes a membership grant (BF-15 self-leave). No-op if the user was never
 * a member of the channel.
 */
export async function deleteMembership(channelId: string, userId: string): Promise<void> {
  if (MOCK_MODE) {
    mockMemberships.delete(membershipKey(channelId, userId));
    return;
  }
  throw new Error("live DynamoDB mode is not implemented in the POC slice");
}

/**
 * In-memory overlay for responses written via POST /submit in mock mode.
 * Keyed by `${channelId}#${promptId}`; each channel+prompt maps to the list
 * of responses posted there. This is what makes a submitted response show up
 * on the channel wall (AC2 read-after-submit) instead of listChannelResponses
 * always returning an empty array.
 */
const mockResponses = new Map<string, ChannelResponse[]>();

function responseListKey(channelId: string, promptId: string): string {
  return `${channelId}#${promptId}`;
}

/**
 * Writes a response item so it appears on that channel's wall for that
 * prompt. Dedupes on (authorId, channelId, promptId) — mirrors the Postgres
 * path's `responses_user_channel_prompt_key` unique index, so a resubmit to
 * the same channel for the same prompt (even under a different response id,
 * e.g. the legacy `${id}-${index}` scheme vs `${id}-${channelId}`) updates
 * the existing entry in place instead of appending a duplicate.
 *
 * EXCEPTION (task #6): archive channels are exempt from this dedupe — the
 * partial unique index in schema.sql scopes the same guarantee to non-archive
 * channels only, so this mirrors that: every archive draw appends as a new
 * entry instead of overwriting the prior one.
 */
export async function putResponse(response: ChannelResponse): Promise<void> {
  if (MOCK_MODE) {
    const key = responseListKey(response.channelId, response.promptId);
    const existing = mockResponses.get(key) ?? [];
    if (isArchiveChannel(response.channelId)) {
      mockResponses.set(key, [...existing, response]);
      return;
    }
    const dupeIndex = existing.findIndex(
      (r) => r.authorId === response.authorId && r.promptId === response.promptId,
    );
    if (dupeIndex >= 0) {
      const next = [...existing];
      next[dupeIndex] = response;
      mockResponses.set(key, next);
      return;
    }
    mockResponses.set(key, [...existing, response]);
    return;
  }
  throw new Error("live DynamoDB mode is not implemented in the POC slice");
}

/** Test-only: clears the in-memory response overlay for test isolation. */
export function resetMockResponses(): void {
  mockResponses.clear();
}

function isoDateFromPromptId(promptId: string): string | undefined {
  const match = /^prompt-(\d{4}-\d{2}-\d{2})$/.exec(promptId);
  return match?.[1];
}

/**
 * Mock-mode counterpart to postgres-client's listChannelDays. Scans the
 * in-memory response overlay (keyed `${channelId}#${promptId}`) for distinct
 * promptIds in this channel, newest-first, with per-day response counts.
 * Read-only — date metadata + counts only, never response content.
 */
export async function listChannelDays(channelId: string): Promise<readonly {
  promptId: string;
  isoDate: string;
  responseCount: number;
}[]> {
  const prefix = `${channelId}#`;
  const byPromptId = new Map<string, { count: number; lastCreatedAt: string }>();
  for (const [key, responses] of mockResponses.entries()) {
    if (!key.startsWith(prefix) || responses.length === 0) {
      continue;
    }
    const promptId = key.slice(prefix.length);
    const lastCreatedAt = responses.reduce(
      (latest, r) => (r.createdAt > latest ? r.createdAt : latest),
      responses[0]?.createdAt ?? "",
    );
    byPromptId.set(promptId, { count: responses.length, lastCreatedAt });
  }
  return Array.from(byPromptId.entries())
    .map(([promptId, { count, lastCreatedAt }]) => ({
      promptId,
      isoDate: isoDateFromPromptId(promptId) ?? lastCreatedAt.slice(0, 10),
      responseCount: count,
      lastCreatedAt,
    }))
    .sort((a, b) => (a.lastCreatedAt < b.lastCreatedAt ? 1 : -1))
    .map(({ promptId, isoDate, responseCount }) => ({ promptId, isoDate, responseCount }));
}

/** Mock-mode counterpart to postgres-client's setEnhancementResult (T4). */
export async function setEnhancementResult(
  responseId: string,
  enhancedImageRef: string | null,
  status: "ready" | "failed",
): Promise<void> {
  if (MOCK_MODE) {
    for (const [key, responses] of mockResponses.entries()) {
      const index = responses.findIndex((r) => r.id === responseId);
      if (index === -1) {
        continue;
      }
      const existing = responses[index];
      if (!existing) {
        continue;
      }
      const updated = [...responses];
      updated[index] = {
        ...existing,
        enhancedImageRef: enhancedImageRef ?? undefined,
        enhancementStatus: status,
      };
      mockResponses.set(key, updated);
      return;
    }
    return;
  }
  throw new Error("live DynamoDB mode is not implemented in the POC slice");
}

/**
 * Mock-mode counterpart to postgres-client's markEnhancementPending. Sets
 * enhancementStatus = "pending" on the in-memory response WITHOUT touching
 * enhancedImageRef, so the previous background stays visible until the
 * async regenerate settles.
 */
export async function markEnhancementPending(responseId: string): Promise<void> {
  if (MOCK_MODE) {
    for (const [key, responses] of mockResponses.entries()) {
      const index = responses.findIndex((r) => r.id === responseId);
      if (index === -1) {
        continue;
      }
      const existing = responses[index];
      if (!existing) {
        continue;
      }
      const updated = [...responses];
      updated[index] = {
        ...existing,
        enhancementStatus: "pending",
      };
      mockResponses.set(key, updated);
      return;
    }
    return;
  }
  throw new Error("live DynamoDB mode is not implemented in the POC slice");
}

/**
 * Mock-mode counterpart to postgres-client's getResponseById. Scans the
 * in-memory response overlay (keyed `${channelId}#${promptId}`) for a
 * response matching the given id. Read-only.
 */
export async function getResponseById(responseId: string): Promise<ChannelResponse | null> {
  if (MOCK_MODE) {
    for (const responses of mockResponses.values()) {
      const found = responses.find((r) => r.id === responseId);
      if (found) {
        return found;
      }
    }
    return null;
  }
  throw new Error("live DynamoDB mode is not implemented in the POC slice");
}

/**
 * Mock-mode counterpart to postgres-client's updateResponse. Mutates the
 * in-memory response's text/backgroundPrompt in place (absent fields left
 * untouched) and returns the updated response. Does NOT touch
 * enhancedImageRef/enhancementStatus — callers reuse setEnhancementResult.
 */
export async function updateResponse(
  responseId: string,
  patch: { text?: string; backgroundPrompt?: string },
): Promise<ChannelResponse> {
  if (MOCK_MODE) {
    for (const [key, responses] of mockResponses.entries()) {
      const index = responses.findIndex((r) => r.id === responseId);
      if (index === -1) {
        continue;
      }
      const existing = responses[index];
      if (!existing) {
        continue;
      }
      const updated: ChannelResponse = {
        ...existing,
        text: patch.text ?? existing.text,
        backgroundPrompt: patch.backgroundPrompt ?? existing.backgroundPrompt,
      };
      const next = [...responses];
      next[index] = updated;
      mockResponses.set(key, next);
      return updated;
    }
    throw new Error(`updateResponse: no response found for id ${responseId}`);
  }
  throw new Error("live DynamoDB mode is not implemented in the POC slice");
}

/**
 * Lists a channel's responses for a given prompt, scoped to exactly one
 * channel (AC4 isolation). Not authorized here — callers (handlers) must
 * check getMembership + getSubmission first; this function only reads.
 */
export async function listChannelResponses(
  channelId: string,
  promptId: string,
): Promise<readonly ChannelResponse[]> {
  if (MOCK_MODE) {
    return mockResponses.get(responseListKey(channelId, promptId)) ?? [];
  }
  throw new Error("live DynamoDB mode is not implemented in the POC slice");
}

/**
 * Adds an emoji reaction to a response (mock mode). Idempotent on
 * (responseId, userId, emoji), mirroring the Postgres UNIQUE constraint.
 * Searches all response lists since the mock store is keyed by
 * channel+prompt, not by response id.
 */
export async function putReaction(
  responseId: string,
  userId: string,
  emoji: string,
): Promise<void> {
  if (MOCK_MODE) {
    for (const [key, list] of mockResponses) {
      const index = list.findIndex((r) => r.id === responseId);
      if (index === -1) {
        continue;
      }
      const target = list[index];
      if (!target) {
        continue;
      }
      const alreadyReacted = target.reactions.some(
        (r) => r.userId === userId && r.emoji === emoji,
      );
      const updated: ChannelResponse = {
        ...target,
        reactions: alreadyReacted
          ? target.reactions.filter((r) => !(r.userId === userId && r.emoji === emoji))
          : [...target.reactions, { emoji, userId }],
      };
      const nextList = [...list];
      nextList[index] = updated;
      mockResponses.set(key, nextList);
      return;
    }
    return;
  }
  throw new Error("live DynamoDB mode is not implemented in the POC slice");
}

/**
 * In-memory user store for mock mode (S-007 invite-by-email). Idempotent on
 * email, mirroring the Postgres users.email UNIQUE constraint.
 */
const mockUsersByEmail = new Map<string, User>();

/** Resolves a display name for a user id (mock user store, then seed names). */
function displayNameForUserId(userId: string): string {
  for (const user of mockUsersByEmail.values()) {
    if (user.id === userId) {
      return user.displayName;
    }
  }
  return SEED_USER_DISPLAY_NAMES[userId] ?? userId;
}

/** Resolves the avatar color for a user id from the mock user store, if any. */
function avatarColorForUserId(userId: string): string | undefined {
  for (const user of mockUsersByEmail.values()) {
    if (user.id === userId) {
      return user.avatarColor;
    }
  }
  return undefined;
}

/** Creates (or returns the existing) mock user for `email`. */
export async function createUser(email: string, displayName: string): Promise<User> {
  if (MOCK_MODE) {
    const existing = mockUsersByEmail.get(email);
    if (existing) {
      return existing;
    }
    const user: User = {
      id: `user-${email.split("@")[0]?.toLowerCase() ?? email}`,
      email,
      displayName,
      createdAt: new Date().toISOString(),
    };
    mockUsersByEmail.set(email, user);
    return user;
  }
  throw new Error("live DynamoDB mode is not implemented in the POC slice");
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  if (MOCK_MODE) {
    return mockUsersByEmail.get(email);
  }
  throw new Error("live DynamoDB mode is not implemented in the POC slice");
}

/**
 * Updates only the provided fields on a user (S-Settings, mock mode). The
 * store is keyed by email, so lookup-by-id iterates the map values; unknown
 * id throws, mirroring postgres-client's not-found convention.
 */
export async function updateUser(
  id: string,
  patch: { displayName?: string; email?: string; avatarColor?: string; avatarImage?: string },
): Promise<User> {
  if (MOCK_MODE) {
    let found: User | undefined;
    for (const user of mockUsersByEmail.values()) {
      if (user.id === id) {
        found = user;
        break;
      }
    }
    if (!found) {
      throw new Error(`updateUser: no user found for id ${id}`);
    }
    const updated: User = {
      ...found,
      displayName: patch.displayName ?? found.displayName,
      email: patch.email ?? found.email,
      avatarColor: patch.avatarColor ?? found.avatarColor,
      avatarImage: patch.avatarImage ?? found.avatarImage,
    };
    // Re-key the map if email changed (email is the map key).
    if (updated.email !== found.email) {
      mockUsersByEmail.delete(found.email);
    }
    mockUsersByEmail.set(updated.email, updated);
    return updated;
  }
  throw new Error("live DynamoDB mode is not implemented in the POC slice");
}

/** Test-only: clears the in-memory mock user store for test isolation. */
export function resetMockUsers(): void {
  mockUsersByEmail.clear();
}

/** Lists seeded channels (used for membership listings in later stories). */
export async function listChannels(): Promise<readonly Channel[]> {
  if (MOCK_MODE) {
    return [...SEED_CHANNELS, ...mockCreatedChannels.values()];
  }
  throw new Error("live DynamoDB mode is not implemented in the POC slice");
}

/**
 * In-memory channel store for mock mode (per-user auto-provisioned channels,
 * e.g. Personal Archive/Family/Friends/Co-Workers, plus any user-created
 * groups). Keyed by channel id. Idempotent: createChannel with an id that
 * already exists returns the existing row instead of erroring.
 */
const mockCreatedChannels = new Map<string, Channel>();

/** Test-only: clears the in-memory created-channel store for test isolation. */
export function resetMockCreatedChannels(): void {
  mockCreatedChannels.clear();
}

/**
 * In-memory creator map for mock mode: channelId -> the userId that created
 * it (set inside createChannel). Backs getChannelCreator, which member-remove
 * uses to authorize non-self removals (only the creator may remove others).
 */
const channelCreators = new Map<string, string>();

/** Test-only: clears the in-memory channel-creator map for test isolation. */
export function resetMockChannels(): void {
  mockCreatedChannels.clear();
  channelCreators.clear();
}

/** Looks up the userId that created a channel, if known (mock mode). */
export async function getChannelCreator(channelId: string): Promise<string | undefined> {
  if (MOCK_MODE) {
    return channelCreators.get(channelId);
  }
  throw new Error("live DynamoDB mode is not implemented in the POC slice");
}

/**
 * Creates a channel (mock mode). When `id` is supplied (auth-signup calls
 * this with deterministic per-user channel ids), the call is idempotent on
 * that id — signup itself is idempotent on email, so a re-signup must not
 * error or duplicate. Also grants the creator membership, mirroring the
 * Postgres INSERT ... channel_members.
 */
export async function createChannel(
  name: string,
  kind: "group" | "challenge",
  isPublic: boolean,
  createdBy: string,
  familyId?: string,
  id?: string,
): Promise<Channel> {
  if (MOCK_MODE) {
    const channelId = id ?? `channel-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
    const existing = mockCreatedChannels.get(channelId);
    if (existing) {
      channelCreators.set(channelId, createdBy);
      await putMembership(channelId, createdBy);
      return existing;
    }
    const channel: Channel = { id: channelId, name, kind, isPublic, familyId };
    mockCreatedChannels.set(channelId, channel);
    channelCreators.set(channelId, createdBy);
    await putMembership(channelId, createdBy);
    return channel;
  }
  throw new Error("live DynamoDB mode is not implemented in the POC slice");
}

/**
 * Channels the user is a member of (mock mode). Mirrors postgres-client.ts's
 * listWallsForUser shape.
 */
export async function listWallsForUser(userId: string): Promise<readonly Channel[]> {
  if (MOCK_MODE) {
    const all = [...SEED_CHANNELS, ...mockCreatedChannels.values()];
    return all.filter((c) => mockMemberships.has(membershipKey(c.id, userId)));
  }
  throw new Error("live DynamoDB mode is not implemented in the POC slice");
}

/**
 * Resolves an email for a user id (mock mode). Prefers the real email from
 * the mock user store (created via createUser/invite); falls back to a
 * deterministic placeholder for seed users that were never created through
 * that path.
 */
function emailForUserId(userId: string): string {
  for (const user of mockUsersByEmail.values()) {
    if (user.id === userId) {
      return user.email;
    }
  }
  return `${userId}@example.com`;
}

/**
 * Channel members (mock mode) joined against seed submissions to derive
 * hasDrawnToday for the given prompt. Mirrors the same peer-content shape
 * the Postgres path returns, so channel-members.ts's AC4/AC2 gates behave
 * identically in both modes.
 */
export async function listChannelMembers(
  channelId: string,
  promptId: string,
): Promise<readonly ChannelMember[]> {
  if (MOCK_MODE) {
    // Channel-scoped: a member's response and hasDrawnToday are derived from
    // responses in THIS channel for THIS prompt only (AC4). A submission to a
    // different channel does not count here.
    const channelResponses = mockResponses.get(responseListKey(channelId, promptId)) ?? [];
    const responseByAuthor = new Map<string, ChannelResponse>();
    for (const response of channelResponses) {
      responseByAuthor.set(response.authorId, response);
    }

    const memberUserIds = new Set<string>();
    for (const key of mockMemberships) {
      const [memberChannelId, userId] = key.split("#");
      if (memberChannelId === channelId && userId) {
        memberUserIds.add(userId);
      }
    }

    return [...memberUserIds].map((userId): ChannelMember => {
      const stored = responseByAuthor.get(userId);
      const avatarColor = avatarColorForUserId(userId);
      const member: ChannelMember = {
        userId,
        email: emailForUserId(userId),
        displayName: displayNameForUserId(userId),
        hasDrawnToday: stored !== undefined,
        avatarColor,
      };
      if (stored) {
        member.response = { ...stored, authorAvatarColor: avatarColor };
      }
      return member;
    });
  }
  throw new Error("live DynamoDB mode is not implemented in the POC slice");
}

/**
 * Identity-only channel roster (mock mode): no prompt, no drawn-today status,
 * no response — just the member's identity, reusing the same user lookups
 * listChannelMembers uses (displayNameForUserId / emailForUserId /
 * avatarColorForUserId).
 */
export async function listChannelRoster(channelId: string): Promise<readonly RosterMember[]> {
  if (MOCK_MODE) {
    const memberUserIds = new Set<string>();
    for (const key of mockMemberships) {
      const [memberChannelId, userId] = key.split("#");
      if (memberChannelId === channelId && userId) {
        memberUserIds.add(userId);
      }
    }
    return [...memberUserIds].map(
      (userId): RosterMember => ({
        userId,
        displayName: displayNameForUserId(userId),
        email: emailForUserId(userId),
        avatarColor: avatarColorForUserId(userId),
      }),
    );
  }
  throw new Error("live DynamoDB mode is not implemented in the POC slice");
}

/** Exposed for tests / future write paths (S-003 submit handler). */
export function isMockMode(): boolean {
  return MOCK_MODE;
}

/**
 * WS4a: distinct calendar dates (YYYY-MM-DD) this user has a recorded
 * submission for, derived from submission createdAt. Feeds the /me/stats
 * streak + weekly-completion pure helpers (backend/lambda/data/stats.ts).
 */
export async function getUserSubmissionDates(userId: string): Promise<string[]> {
  if (MOCK_MODE) {
    const dates: string[] = [];
    for (const [key, submission] of mockSubmissions) {
      const [submissionUserId] = key.split("#");
      if (submissionUserId === userId) {
        dates.push(submission.createdAt.slice(0, 10));
      }
    }
    return dates;
  }
  throw new Error("live DynamoDB mode is not implemented in the POC slice");
}

/** WS4a: total count of this user's submissions (across all prompts). */
export async function countUserSubmissions(userId: string): Promise<number> {
  if (MOCK_MODE) {
    let count = 0;
    for (const [key] of mockSubmissions) {
      const [submissionUserId] = key.split("#");
      if (submissionUserId === userId) {
        count += 1;
      }
    }
    return count;
  }
  throw new Error("live DynamoDB mode is not implemented in the POC slice");
}

/**
 * In-memory challenge store (Family Challenges, mock mode).
 *
 * `mockChallenges` is keyed by challenge id. `mockChallengeCounts` tracks a
 * per-channel counter so ids stay deterministic
 * (`challenge-${channelId}-${count}`). Entries are keyed by entry id;
 * `mockRatings` is keyed by entryId and holds every rater's stars so
 * averageStars/ratingCount/myStars can always be recomputed from source.
 */
const mockChallenges = new Map<string, Challenge>();
const mockChallengeCountsByChannel = new Map<string, number>();

/** Stored entry shape without the derived rating fields (recomputed on read). */
interface StoredChallengeEntry {
  id: string;
  challengeId: string;
  userId: string;
  authorName: string;
  imageRef?: string;
  createdAt: string;
}
const mockChallengeEntries = new Map<string, StoredChallengeEntry>();

/** Ratings keyed by entryId -> (raterId -> stars). */
const mockRatings = new Map<string, Map<string, number>>();

function entryKey(challengeId: string, userId: string): string {
  return `${challengeId}#${userId}`;
}

/** Test-only: clears all in-memory challenge state for test isolation. */
export function resetMockChallenges(): void {
  mockChallenges.clear();
  mockChallengeCountsByChannel.clear();
  mockChallengeEntries.clear();
  mockRatings.clear();
}

/** Creates a challenge with a deterministic id (S-C01). Open-ended (no deadline). */
export async function createChallenge(input: {
  channelId: string;
  creatorId: string;
  word: string;
  drawSeconds: number;
  toolset?: ChallengeToolset;
  backgroundRef?: string;
}): Promise<Challenge> {
  if (MOCK_MODE) {
    const nextCount = (mockChallengeCountsByChannel.get(input.channelId) ?? 0) + 1;
    mockChallengeCountsByChannel.set(input.channelId, nextCount);
    const challenge: Challenge = {
      id: `challenge-${input.channelId}-${nextCount}`,
      channelId: input.channelId,
      creatorId: input.creatorId,
      word: input.word,
      drawSeconds: input.drawSeconds,
      toolset: input.toolset,
      backgroundRef: input.backgroundRef,
      createdAt: new Date().toISOString(),
    };
    mockChallenges.set(challenge.id, challenge);
    return challenge;
  }
  throw new Error("live DynamoDB mode is not implemented in the POC slice");
}

/** Point lookup of a challenge by id. */
export async function getChallenge(challengeId: string): Promise<Challenge | undefined> {
  if (MOCK_MODE) {
    return mockChallenges.get(challengeId);
  }
  throw new Error("live DynamoDB mode is not implemented in the POC slice");
}

/** Lists all challenges created for a given channel. */
export async function listChallengesForChannel(
  channelId: string,
): Promise<readonly Challenge[]> {
  if (MOCK_MODE) {
    const result: Challenge[] = [];
    for (const challenge of mockChallenges.values()) {
      if (challenge.channelId === channelId) {
        result.push(challenge);
      }
    }
    return result;
  }
  throw new Error("live DynamoDB mode is not implemented in the POC slice");
}

/** Writes (or overwrites) a user's entry for a challenge. */
export async function putChallengeEntry(entry: {
  id: string;
  challengeId: string;
  userId: string;
  imageRef?: string;
}): Promise<void> {
  if (MOCK_MODE) {
    mockChallengeEntries.set(entryKey(entry.challengeId, entry.userId), {
      id: entry.id,
      challengeId: entry.challengeId,
      userId: entry.userId,
      authorName: SEED_USER_DISPLAY_NAMES[entry.userId] ?? entry.userId,
      imageRef: entry.imageRef,
      createdAt: new Date().toISOString(),
    });
    return;
  }
  throw new Error("live DynamoDB mode is not implemented in the POC slice");
}

/** Aggregates the ratings stored for a given entry into avg/count. */
function aggregateRatings(entryId: string): { averageStars: number; ratingCount: number } {
  const raterStars = mockRatings.get(entryId);
  if (!raterStars || raterStars.size === 0) {
    return { averageStars: 0, ratingCount: 0 };
  }
  let sum = 0;
  for (const stars of raterStars.values()) {
    sum += stars;
  }
  return { averageStars: sum / raterStars.size, ratingCount: raterStars.size };
}

function toChallengeEntry(stored: StoredChallengeEntry, forUserId?: string): ChallengeEntry {
  const { averageStars, ratingCount } = aggregateRatings(stored.id);
  const myStars = forUserId ? mockRatings.get(stored.id)?.get(forUserId) : undefined;
  return {
    id: stored.id,
    challengeId: stored.challengeId,
    userId: stored.userId,
    authorName: stored.authorName,
    imageRef: stored.imageRef,
    createdAt: stored.createdAt,
    averageStars,
    ratingCount,
    myStars,
  };
}

/** Point lookup: this user's entry for this challenge, if any. */
export async function getChallengeEntryForUser(
  challengeId: string,
  userId: string,
): Promise<ChallengeEntry | undefined> {
  if (MOCK_MODE) {
    const stored = mockChallengeEntries.get(entryKey(challengeId, userId));
    return stored ? toChallengeEntry(stored) : undefined;
  }
  throw new Error("live DynamoDB mode is not implemented in the POC slice");
}

/**
 * Lists all entries for a challenge. averageStars/ratingCount are always
 * aggregated from stored ratings; when `forUserId` is passed, each entry's
 * myStars is populated from that user's own rating (undefined if none).
 */
export async function listChallengeEntries(
  challengeId: string,
  forUserId?: string,
): Promise<readonly ChallengeEntry[]> {
  if (MOCK_MODE) {
    const result: ChallengeEntry[] = [];
    for (const stored of mockChallengeEntries.values()) {
      if (stored.challengeId === challengeId) {
        result.push(toChallengeEntry(stored, forUserId));
      }
    }
    return result;
  }
  throw new Error("live DynamoDB mode is not implemented in the POC slice");
}

/** Counts current members of a channel, reusing the membership overlay. */
export async function countChannelMembers(channelId: string): Promise<number> {
  if (MOCK_MODE) {
    let count = 0;
    for (const key of mockMemberships) {
      const [memberChannelId] = key.split("#");
      if (memberChannelId === channelId) {
        count += 1;
      }
    }
    return count;
  }
  throw new Error("live DynamoDB mode is not implemented in the POC slice");
}

/** Records (or overwrites) one rater's stars for an entry. */
export async function putRating(input: {
  challengeId: string;
  entryId: string;
  raterId: string;
  stars: number;
}): Promise<void> {
  if (MOCK_MODE) {
    const raterStars = mockRatings.get(input.entryId) ?? new Map<string, number>();
    raterStars.set(input.raterId, input.stars);
    mockRatings.set(input.entryId, raterStars);
    return;
  }
  throw new Error("live DynamoDB mode is not implemented in the POC slice");
}

/** A single distinct participant on a prompt (WS4a today-prompt avatar stack). */
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
  if (MOCK_MODE) {
    const byUser = new Map<string, string>(); // userId -> latest createdAt
    for (const [key, submission] of mockSubmissions) {
      const [userId, keyPromptId] = key.split("#");
      if (keyPromptId === promptId && userId) {
        const existing = byUser.get(userId);
        if (!existing || submission.createdAt > existing) {
          byUser.set(userId, submission.createdAt);
        }
      }
    }
    const ordered = [...byUser.entries()].sort((a, b) => (a[1] < b[1] ? 1 : -1));
    const participants: { displayName: string }[] = [];
    for (let i = 0; i < ordered.length && i < MAX_PROMPT_PARTICIPANTS; i += 1) {
      const entry = ordered[i];
      if (!entry) {
        break;
      }
      const [userId] = entry;
      participants.push({ displayName: SEED_USER_DISPLAY_NAMES[userId] ?? userId });
    }
    return { count: byUser.size, participants };
  }
  throw new Error("live DynamoDB mode is not implemented in the POC slice");
}
