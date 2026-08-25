import type {
  Challenge,
  ChallengeDetail,
  ChallengeEntry,
  ChallengeSummary,
  ChallengeToolset,
  Channel,
  ChannelMember,
  ChannelResponse,
  ChannelResponsesResponse,
  ChannelRosterResponse,
  CreateWallRequest,
  IsoDate,
  MyStats,
  Prompt,
  Streak,
  SubmitRequest,
  SubmitResponse,
  TodayPromptResponse,
  UpdateUserRequest,
  User,
} from "@scribl/shared/index";

/**
 * Thrown when a channel-scoped read is attempted before the caller has
 * submitted for the given prompt (AC2). Server-enforced (403); the client
 * only relays this as a locked state, never gates locally.
 */
export class NotSubmittedError extends Error {
  constructor(message = "submit your response to unlock this channel") {
    super(message);
    this.name = "NotSubmittedError";
  }
}

/**
 * Thrown by login() when no account matches BOTH the given email and
 * displayName (server 404 "user_not_found"). Login validates both credentials
 * (case-insensitive, trimmed); a wrong email OR a wrong name is a miss. Lets
 * the UI distinguish "no such account" (offer sign-up) from a generic failure.
 */
export class UserNotFoundError extends Error {
  constructor(message = "no account matches that email and name") {
    super(message);
    this.name = "UserNotFoundError";
  }
}

/**
 * Thrown when the underlying fetch() call itself fails (offline, DNS
 * failure, CORS, etc.) rather than the server returning a non-ok status.
 * Normalizes the raw "Failed to fetch" / "Network request failed" browser
 * messages into one human-readable message the UI can show directly.
 */
export class NetworkError extends Error {
  constructor(cause?: unknown) {
    super("Can't reach the server. Check your connection and try again.");
    this.name = "NetworkError";
    if (cause !== undefined) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}

/**
 * Request shape for creating a challenge (mirrors CreateChallengeRequest,
 * minus the channel id which is a separate positional arg on the client
 * methods). drawSeconds is the per-drawing timer given to each participant;
 * challenges are open-ended (no deadline/duration).
 */
export interface CreateChallengeInput {
  word: string;
  drawSeconds: number;
  toolset: ChallengeToolset;
  backgroundRef?: string;
}

/**
 * The single seam the app reads through. No screen, store, or component may
 * hard-code prompt/channel data - it always goes through a DataClient
 * implementation (mock today, http once the backend is live).
 *
 * Server invariants (submit-to-unlock / channel membership, AC2 + AC4) are
 * NEVER re-implemented here or in the client at large. The client calls the
 * API and renders whatever it returns (including 403s); it does not gate
 * locally.
 */
export interface DataClient {
  /** GET /prompt/today - the one LIVE foundation endpoint. */
  getTodayPrompt(): Promise<TodayPromptResponse>;

  /**
   * GET /prompt/:date - a single day's prompt (YYYY-MM-DD). Returns null
   * when no prompt exists for that date. Authed like getTodayPrompt but
   * carries no per-user submissionStatus/participants.
   */
  getPromptByDate(date: string): Promise<Prompt | null>;

  /** Client-derived streak view for the POC (no new server invariant). */
  getStreak(): Promise<Streak>;

  /**
   * Records a submission date into the client-side streak history (S-006).
   * Purely a client-side derivation for the POC; does not call a real
   * backend endpoint (there is no server-side streak invariant yet).
   */
  recordSubmission(date: IsoDate): Promise<void>;

  /**
   * POST /submit - records a submission and unlocks the caller's channel
   * feed for today's prompt. Server-enforced; client only calls + reacts.
   */
  submit(request: SubmitRequest): Promise<SubmitResponse>;

  /**
   * GET /channels/{id}/responses?promptId= - 403 until submitted (AC2) and
   * unless the caller is a channel member (AC4). Client renders the 403 as a
   * locked state; it never substitutes a client-side gate.
   */
  getChannelResponses(channelId: string, promptId: string): Promise<ChannelResponsesResponse>;

  /**
   * Fetches a single response's detail (S-017). Reuses the same AC2/AC4-gated
   * list read as getChannelResponses - there is no separate backend endpoint.
   * Propagates NotSubmittedError (AC2) / channel-membership 403s (AC4) the
   * same way; the client never substitutes a local gate.
   */
  getResponse(channelId: string, promptId: string, responseId: string): Promise<ChannelResponse>;

  /**
   * PATCH /channels/{id}/responses/{rid}?promptId= - creator edits their own
   * response (text/backgroundPrompt) and/or requests an AI re-enhancement.
   * Server-enforced ownership check; the client only calls + relays.
   */
  updateResponse(
    channelId: string,
    promptId: string,
    responseId: string,
    patch: { text?: string; backgroundPrompt?: string; regenerate?: boolean },
  ): Promise<ChannelResponse>;

  /** No live backend endpoint yet (frontend-only constraint for S-005) - see http.ts. */
  addReaction(
    channelId: string,
    promptId: string,
    responseId: string,
    emoji: string,
  ): Promise<ChannelResponse>;

  /** POST /auth/signup - unauthenticated. */
  signUp(email: string, displayName: string): Promise<User>;

  /**
   * POST /auth/login - unauthenticated. Validates BOTH email and displayName
   * against the stored user (case-insensitive, trimmed); a mismatch on either
   * throws UserNotFoundError.
   */
  login(email: string, displayName: string): Promise<User>;

  /** GET /users - unauthenticated (POC user picker). */
  listUsers(): Promise<User[]>;

  /** PATCH /users/{id} - self-only; caller via x-user-id. */
  updateUser(id: string, patch: UpdateUserRequest): Promise<User>;

  /** GET /walls - caller identified via x-user-id. */
  listWalls(userId: string): Promise<Channel[]>;

  /** POST /walls - caller identified via x-user-id. */
  createWall(input: CreateWallRequest): Promise<Channel>;

  /**
   * GET /channels/{id}/members?promptId= - caller identified via x-user-id.
   * Shows which channel members have submitted today's prompt.
   */
  getChannelMembers(channelId: string, promptId: string): Promise<ChannelMember[]>;

  /**
   * GET /me/stats - identity-gated real aggregates for the caller (WS4a):
   * drawingsCount, weeklyCompletion, currentStreak, bestStreak.
   */
  getMyStats(): Promise<MyStats>;

  /**
   * POST /channels/{id}/members - invites a user (by email) into the
   * channel. Server-enforced: the caller must already be a member (403
   * not_a_member otherwise); the client only calls + relays.
   */
  inviteMember(channelId: string, email: string, displayName?: string): Promise<ChannelMember>;

  /**
   * DELETE /channels/{id}/members - self-leave for the authenticated caller.
   * The client only calls + relays.
   */
  leaveWall(channelId: string): Promise<void>;

  /**
   * GET /channels/{id}/roster - AC4-gated membership only, no
   * submit-to-unlock; identity + creator, no peer content.
   */
  getChannelRoster(channelId: string): Promise<ChannelRosterResponse>;

  /**
   * DELETE /channels/{id}/members?userId= - creator removes another member;
   * server-enforced creator check.
   */
  removeMember(channelId: string, userId: string): Promise<void>;

  /**
   * POST /channels/{id}/challenges - creates a blind draw-off challenge in
   * this channel. Server-enforced channel-membership gate (403 not_a_member).
   */
  createChallenge(channelId: string, input: CreateChallengeInput): Promise<Challenge>;

  /**
   * GET /channels/{id}/challenges - lists challenge summaries for a channel.
   * Server-enforced channel-membership gate (403 not_a_member).
   */
  listChallenges(channelId: string): Promise<ChallengeSummary[]>;

  /**
   * GET /challenges/{cid} - per-viewer submit-to-unlock detail read.
   * Challenges are open-ended (no deadline); reveal is PER-VIEWER: until the
   * caller has submitted their own entry the server returns state "open" with
   * empty entries/leaderboard (blind draw-off, never a client-side gate), and
   * once they have submitted the same read returns the full reveal. Server-
   * enforced channel-membership gate (403 not_a_member).
   */
  getChallengeDetail(challengeId: string): Promise<ChallengeDetail>;

  /**
   * POST /challenges/{cid}/entries - submits a blind draw-off entry. Server
   * gates on membership (403 not_a_member) and duplicate submission (409
   * already_submitted). Challenges are open-ended - there is no closed gate.
   */
  submitChallengeEntry(challengeId: string, imageRef?: string): Promise<ChallengeEntry>;

  /**
   * POST /challenges/{cid}/entries/{eid}/ratings - post-reveal star rating.
   * Server gates on membership (403 not_a_member), the caller having
   * submitted their own entry (403 not_submitted, the per-viewer reveal),
   * and rating one's own entry (403 cannot_rate_own).
   */
  rateChallengeEntry(challengeId: string, entryId: string, stars: number): Promise<ChallengeEntry>;

  /**
   * GET /channels/{id}/days - AC4-gated (membership) but NOT AC2-gated:
   * returns only date metadata + response counts, never peer art/response
   * content, so submit-to-unlock does not apply.
   */
  listChannelDays(
    channelId: string,
  ): Promise<{ promptId: string; isoDate: string; responseCount: number }[]>;
}
