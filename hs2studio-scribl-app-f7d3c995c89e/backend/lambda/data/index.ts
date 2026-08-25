/**
 * Data-layer selector. Handlers import from here (not dynamodb-client.ts or
 * postgres-client.ts directly) so the store can be swapped via
 * SCRIBL_DATA_MODE without touching handler code.
 *
 * - unset / "mock": in-memory seed-backed mock (dynamodb-client.ts). This is
 *   the path the root jest suite (submit-to-unlock.test.ts,
 *   channel-isolation.test.ts) exercises; it must keep working with zero
 *   network / native deps.
 * - "postgres": Neon serverless Postgres (postgres-client.ts).
 *
 * The existing handlers (today-prompt.ts, submit.ts, channel-responses.ts)
 * already import directly from dynamodb-client.ts for the shared surface;
 * this module exists for the NEW routes (auth/users/walls/members) and can
 * also be adopted by the existing handlers without changing their gate
 * logic, since the exported function names/signatures match.
 */
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
import * as dynamo from "./dynamodb-client";
import * as postgres from "./postgres-client";

const DATA_MODE = process.env.SCRIBL_DATA_MODE ?? "mock";

function usePostgres(): boolean {
  return DATA_MODE === "postgres";
}

function mockOnlyPostgresFn(name: string): never {
  throw new Error(`${name} requires SCRIBL_DATA_MODE=postgres (mock mode has no fixture)`);
}

export function getPromptForDate(date: string): Promise<Prompt> {
  return usePostgres() ? postgres.getPromptForDate(date) : dynamo.getPromptForDate(date);
}

export function getSubmission(userId: string, promptId: string): Promise<Submission | undefined> {
  return usePostgres() ? postgres.getSubmission(userId, promptId) : dynamo.getSubmission(userId, promptId);
}

/**
 * Looks up a prompt by id, for the enhance pipeline (T3/T4) to ground the
 * generated background in the day's actual prompt text. Best-effort by
 * design: returns undefined rather than throwing so a lookup miss never
 * blocks or fails submit (enhancement stays fire-and-forget).
 */
export function getPromptById(promptId: string): Promise<Prompt | undefined> {
  return usePostgres() ? postgres.getPromptById(promptId) : dynamo.getPromptById(promptId);
}

export function putSubmission(submission: Submission): Promise<string[]> {
  return usePostgres() ? postgres.putSubmission(submission) : dynamo.putSubmission(submission);
}

export function setEnhancementResult(
  responseId: string,
  enhancedImageRef: string | null,
  status: "ready" | "failed",
): Promise<void> {
  return usePostgres()
    ? postgres.setEnhancementResult(responseId, enhancedImageRef, status)
    : dynamo.setEnhancementResult(responseId, enhancedImageRef, status);
}

/**
 * Flips a response's enhancement status to "pending" WITHOUT touching its
 * enhanced_image_ref, so the previous background stays visible until the
 * async regenerate settles via setEnhancementResult. Used by the
 * creator-only regenerate branch (response-update.ts) before firing
 * triggerEnhancement.
 */
export function markEnhancementPending(responseId: string): Promise<void> {
  return usePostgres()
    ? postgres.markEnhancementPending(responseId)
    : dynamo.markEnhancementPending(responseId);
}

export function getMembership(channelId: string, userId: string): Promise<boolean> {
  return usePostgres()
    ? postgres.getMembership(channelId, userId)
    : dynamo.getMembership(channelId, userId);
}

export function putMembership(channelId: string, userId: string): Promise<void> {
  return usePostgres()
    ? postgres.putMembership(channelId, userId)
    : dynamo.putMembership(channelId, userId);
}

/** BF-15: removes the caller's own membership from a channel (self-leave). */
export function deleteMembership(channelId: string, userId: string): Promise<void> {
  return usePostgres()
    ? postgres.deleteMembership(channelId, userId)
    : dynamo.deleteMembership(channelId, userId);
}

export function listChannelResponses(
  channelId: string,
  promptId: string,
): Promise<readonly ChannelResponse[]> {
  return usePostgres()
    ? postgres.listChannelResponses(channelId, promptId)
    : dynamo.listChannelResponses(channelId, promptId);
}

/**
 * Looks up a single response by id, for the PATCH response-update handler.
 * Read-only. Returns null if no matching response exists.
 */
export function getResponseById(responseId: string): Promise<ChannelResponse | null> {
  return usePostgres() ? postgres.getResponseById(responseId) : dynamo.getResponseById(responseId);
}

/**
 * Partial update for a response's caption text and/or background prompt
 * (PATCH response-update handler). Does NOT touch enhanced_image_ref /
 * enhancement_status — reuse setEnhancementResult for that.
 */
export function updateResponse(
  responseId: string,
  patch: { text?: string; backgroundPrompt?: string },
): Promise<ChannelResponse> {
  return usePostgres()
    ? postgres.updateResponse(responseId, patch)
    : dynamo.updateResponse(responseId, patch);
}

export interface ChannelDay {
  promptId: string;
  isoDate: string;
  responseCount: number;
}

/**
 * Distinct days (by promptId) with at least one response in this channel,
 * newest-first, each with a response count. Read-only, date-metadata-only —
 * no art/response content. Callers (handlers) authorize via getMembership
 * before calling this; this function only reads.
 */
export function listChannelDays(channelId: string): Promise<readonly ChannelDay[]> {
  return usePostgres() ? postgres.listChannelDays(channelId) : dynamo.listChannelDays(channelId);
}

export function listChannels(): Promise<readonly Channel[]> {
  return usePostgres() ? postgres.listChannels() : dynamo.listChannels();
}

/**
 * Adds an emoji reaction to a response (S-007 reactions write). Available in
 * both modes, like putMembership, so the reaction-add handler's gates are
 * exercisable by the root mock-mode jest suite.
 */
export function putReaction(responseId: string, userId: string, emoji: string): Promise<void> {
  return usePostgres()
    ? postgres.putReaction(responseId, userId, emoji)
    : dynamo.putReaction(responseId, userId, emoji);
}

// createUser / getUserByEmail: available in both modes (mock mode has a
// minimal in-memory user store) so the member-add invite-by-email handler is
// testable by the root mock-mode jest suite.

export function createUser(email: string, displayName: string): Promise<User> {
  return usePostgres() ? postgres.createUser(email, displayName) : dynamo.createUser(email, displayName);
}

export function getUserByEmail(email: string): Promise<User | undefined> {
  return usePostgres() ? postgres.getUserByEmail(email) : dynamo.getUserByEmail(email);
}

export function updateUser(
  id: string,
  patch: { displayName?: string; email?: string; avatarColor?: string; avatarImage?: string },
): Promise<User> {
  return usePostgres() ? postgres.updateUser(id, patch) : dynamo.updateUser(id, patch);
}

export function listUsers(): Promise<readonly User[]> {
  if (!usePostgres()) {
    return mockOnlyPostgresFn("listUsers");
  }
  return postgres.listUsers();
}

export function createChannel(
  name: string,
  kind: "group" | "challenge",
  isPublic: boolean,
  createdBy: string,
  familyId?: string,
  id?: string,
): Promise<Channel> {
  return usePostgres()
    ? postgres.createChannel(name, kind, isPublic, createdBy, familyId, id)
    : dynamo.createChannel(name, kind, isPublic, createdBy, familyId, id);
}

export function listWallsForUser(userId: string): Promise<readonly Channel[]> {
  return usePostgres() ? postgres.listWallsForUser(userId) : dynamo.listWallsForUser(userId);
}

/** Looks up the userId that created a channel, if any. */
export function getChannelCreator(channelId: string): Promise<string | undefined> {
  return usePostgres() ? postgres.getChannelCreator(channelId) : dynamo.getChannelCreator(channelId);
}

/**
 * Identity-only channel roster (userId/displayName/email/avatarColor). No
 * prompt, no drawn-today status, no response — see channel-roster.ts for why
 * this has no AC2 gate.
 */
export function listChannelRoster(channelId: string): Promise<readonly RosterMember[]> {
  return usePostgres()
    ? postgres.listChannelRoster(channelId)
    : dynamo.listChannelRoster(channelId);
}

export function listChannelMembers(
  channelId: string,
  promptId: string,
): Promise<readonly ChannelMember[]> {
  return usePostgres()
    ? postgres.listChannelMembers(channelId, promptId)
    : dynamo.listChannelMembers(channelId, promptId);
}

/** WS4a: distinct calendar dates (YYYY-MM-DD) with a recorded submission. */
export function getUserSubmissionDates(userId: string): Promise<string[]> {
  return usePostgres()
    ? postgres.getUserSubmissionDates(userId)
    : dynamo.getUserSubmissionDates(userId);
}

/** WS4a: total count of this user's submissions. */
export function countUserSubmissions(userId: string): Promise<number> {
  return usePostgres()
    ? postgres.countUserSubmissions(userId)
    : dynamo.countUserSubmissions(userId);
}

export interface PromptParticipants {
  count: number;
  participants: { displayName: string }[];
}

/** WS4a: distinct participants (count + up to 5 names) for a prompt. */
export function getPromptParticipants(promptId: string): Promise<PromptParticipants> {
  return usePostgres()
    ? postgres.getPromptParticipants(promptId)
    : dynamo.getPromptParticipants(promptId);
}

// Family Challenges: available in both modes (mock: Task 2, postgres: Task 3).

export function createChallenge(input: {
  channelId: string;
  creatorId: string;
  word: string;
  drawSeconds: number;
  toolset?: ChallengeToolset;
  backgroundRef?: string;
}): Promise<Challenge> {
  return usePostgres() ? postgres.createChallenge(input) : dynamo.createChallenge(input);
}

export function getChallenge(challengeId: string): Promise<Challenge | undefined> {
  return usePostgres() ? postgres.getChallenge(challengeId) : dynamo.getChallenge(challengeId);
}

export function listChallengesForChannel(channelId: string): Promise<readonly Challenge[]> {
  return usePostgres()
    ? postgres.listChallengesForChannel(channelId)
    : dynamo.listChallengesForChannel(channelId);
}

export function putChallengeEntry(entry: {
  id: string;
  challengeId: string;
  userId: string;
  imageRef?: string;
}): Promise<void> {
  return usePostgres() ? postgres.putChallengeEntry(entry) : dynamo.putChallengeEntry(entry);
}

export function getChallengeEntryForUser(
  challengeId: string,
  userId: string,
): Promise<ChallengeEntry | undefined> {
  return usePostgres()
    ? postgres.getChallengeEntryForUser(challengeId, userId)
    : dynamo.getChallengeEntryForUser(challengeId, userId);
}

export function listChallengeEntries(
  challengeId: string,
  forUserId?: string,
): Promise<readonly ChallengeEntry[]> {
  return usePostgres()
    ? postgres.listChallengeEntries(challengeId, forUserId)
    : dynamo.listChallengeEntries(challengeId, forUserId);
}

export function countChannelMembers(channelId: string): Promise<number> {
  return usePostgres()
    ? postgres.countChannelMembers(channelId)
    : dynamo.countChannelMembers(channelId);
}

export function putRating(input: {
  challengeId: string;
  entryId: string;
  raterId: string;
  stars: number;
}): Promise<void> {
  return usePostgres() ? postgres.putRating(input) : dynamo.putRating(input);
}
