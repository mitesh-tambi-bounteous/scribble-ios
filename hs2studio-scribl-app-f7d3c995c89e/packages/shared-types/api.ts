/**
 * Scribl POC - API contracts (type-only).
 *
 * Request/response shapes for the thin backend. Only the foundation endpoint
 * (GET /prompt/today) is live; the rest are declared as the seams the stories
 * (S-002..S-008) fill in.
 */

import type {
  Challenge,
  ChallengeDetail,
  ChallengeEntry,
  Channel,
  ChannelMember,
  ChannelResponse,
  ChallengeSummary,
  ChallengeToolset,
  MyStats,
  Participant,
  Prompt,
  Submission,
  SubmissionStatus,
  User,
} from "./domain";

/**
 * GET /prompt/today - the one LIVE foundation endpoint.
 * participantCount/participants (WS4a) are additive fields; existing
 * consumers reading only `prompt`/`submissionStatus` are unaffected.
 */
export interface TodayPromptResponse {
  prompt: Prompt;
  submissionStatus: SubmissionStatus;
  participantCount: number;
  /** Up to 5 distinct participants, newest first, for the avatar stack. */
  participants: Participant[];
}

/** GET /me/stats - identity-gated real aggregates for the caller (WS4a). */
export type MeStatsResponse = MyStats;

/** GET /prompt/:date - a single day's prompt (authed; no per-user status). */
export interface PromptByDateResponse {
  prompt: Prompt;
}

/** POST /transcribe - request body; audio is base64-encoded to fit the string-body http shim. */
export interface TranscribeRequest {
  audioBase64: string;
  mimeType: string;
}

/** POST /transcribe - response. */
export interface TranscribeResponse {
  transcript: string;
}

/** POST /submit - request body (SEAM; implemented by S-003). */
export interface SubmitRequest {
  promptId: string;
  channelIds: string[];
  imageRef?: string;
  text?: string;
  audioRef?: string;
}

/** POST /submit - response (SEAM; implemented by S-003). */
export interface SubmitResponse {
  submission: Submission;
}

/** PATCH /responses/:id - request body for creator edits to their own response. */
export interface UpdateResponseRequest {
  text?: string;
  backgroundPrompt?: string;
  regenerate?: boolean;
}

/**
 * GET /channels/{id}/responses?promptId= - response (SEAM).
 * Returns 403 unless the caller has submitted for the prompt (AC2) and is a
 * member of the channel (AC4). Implemented by S-003 / S-004.
 */
export interface ChannelResponsesResponse {
  channelId: string;
  promptId: string;
  responses: ChannelResponse[];
}

/**
 * A single day's metadata for a channel: date, prompt id, and how many
 * responses were posted that day. Never carries art/response content.
 */
export interface ChannelDay {
  promptId: string;
  isoDate: string;
  responseCount: number;
}

/**
 * GET /channels/{id}/days - response (caller identified via x-user-id).
 * AC4-gated (membership) but NOT AC2-gated: returns only date metadata +
 * counts, never peer art/response content, so submit-to-unlock does not
 * apply. Newest day first.
 */
export interface ChannelDaysResponse {
  days: ChannelDay[];
}

/** Uniform API error envelope. */
export interface ApiError {
  error: string;
  message: string;
}

/** POST /auth/signup - request body (unauthenticated). */
export interface SignUpRequest {
  email: string;
  displayName: string;
}

/** POST /auth/signup - response. */
export interface SignUpResponse {
  user: User;
}

/** PATCH /users/{id} - request body (self-only; caller via x-user-id). */
export interface UpdateUserRequest {
  displayName?: string;
  email?: string;
  avatarColor?: string;
  /** Hand-drawn avatar as a PNG data-URI. When set, overrides avatarColor. */
  avatarImage?: string;
}

/** PATCH /users/{id} - response. */
export interface UpdateUserResponse {
  user: User;
}

/** POST /auth/login - request body (unauthenticated). */
export interface LoginRequest {
  email: string;
  displayName: string;
}

/** POST /auth/login - response. */
export interface LoginResponse {
  user: User;
}

/** GET /users - response (unauthenticated; POC user picker). */
export interface ListUsersResponse {
  users: User[];
}

/** GET /walls - response (caller identified via x-user-id). */
export interface ListWallsResponse {
  walls: Channel[];
}

/** POST /walls - request body (caller identified via x-user-id). */
export interface CreateWallRequest {
  name: string;
  kind: "group" | "challenge";
  isPublic: boolean;
  familyId?: string;
}

/** POST /walls - response. */
export interface CreateWallResponse {
  wall: Channel;
}

/**
 * GET /channels/{id}/members?promptId= - response (caller identified via
 * x-user-id). Shows which channel members have submitted today's prompt.
 */
export interface ChannelMembersResponse {
  members: ChannelMember[];
}

/**
 * POST /channels/{id}/responses/{responseId}/reactions?promptId= - request
 * body (caller identified via x-user-id). Gated by AC2 + AC4, same as the
 * channel-responses read.
 */
export interface AddReactionRequest {
  emoji: string;
}

/** POST /channels/{id}/responses/{responseId}/reactions - response. */
export interface AddReactionResponse {
  response: ChannelResponse;
}

/**
 * POST /channels/{id}/members - request body (caller identified via
 * x-user-id). Invites a user (by email) into the channel; the caller must
 * already be a member.
 */
export interface InviteMemberRequest {
  email: string;
  displayName?: string;
}

/** POST /channels/{id}/members - response. */
export interface InviteMemberResponse {
  member: ChannelMember;
}

/** Identity-only member record for the management roster (no peer content:
 *  no response, no drawn-today status). */
export interface RosterMember {
  userId: string;
  displayName: string;
  email: string;
  avatarColor?: string;
  /** Hand-drawn avatar (PNG data-URI) for the member, when set. Overrides color. */
  avatarImage?: string;
}

/** GET /channels/{id}/roster — AC4-gated (membership) but NOT AC2-gated:
 *  it returns only membership identity + the channel creator, never peer art
 *  or drawn-today status, so submit-to-unlock does not apply. */
export interface ChannelRosterResponse {
  createdBy: string;
  members: RosterMember[];
}

/** POST /challenges - request body. */
export interface CreateChallengeRequest {
  word: string;
  /** Per-drawing timer, in seconds, given to each participant (10..3600). */
  drawSeconds: number;
  /** Allowed brush styles + colors for this challenge's participants. */
  toolset: ChallengeToolset;
  /** Optional shared background (PNG data URI) drawn by the creator. */
  backgroundRef?: string;
}

/** POST /challenges - response. */
export interface CreateChallengeResponse {
  challenge: Challenge;
}

/** GET /challenges - response (caller identified via x-user-id). */
export interface ListChallengesResponse {
  challenges: ChallengeSummary[];
}

/** POST /challenges/{id}/entries - request body. */
export interface SubmitChallengeEntryRequest {
  imageRef?: string;
}

/** POST /challenges/{id}/entries - response. */
export interface SubmitChallengeEntryResponse {
  entry: ChallengeEntry;
}

/** GET /challenges/{id} - response (caller identified via x-user-id). */
export interface ChallengeDetailResponse {
  detail: ChallengeDetail;
}

/** POST /challenges/{id}/entries/{entryId}/ratings - request body. */
export interface RateEntryRequest {
  stars: number;
}

/** POST /challenges/{id}/entries/{entryId}/ratings - response. */
export interface RateEntryResponse {
  entry: ChallengeEntry;
}
