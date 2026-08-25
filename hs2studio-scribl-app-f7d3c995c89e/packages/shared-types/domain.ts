/**
 * Scribl POC — core domain types (type-only, no runtime).
 *
 * Single source of truth for the shapes that cross the app <-> backend <->
 * provider-adapter boundary. Kept deliberately thin for the POC; the daily-loop
 * stories (S-001..S-008) extend these as features land.
 */

import type { BrushStyle } from "./tools";

/** An ISO-8601 date string, e.g. "2026-06-30" (calendar day, no time). */
export type IsoDate = string;

/** An ISO-8601 timestamp, e.g. "2026-06-30T15:58:08.000Z". */
export type IsoTimestamp = string;

/** The single daily creative prompt. One per calendar day (S-001). */
export interface Prompt {
  id: string;
  /** Calendar day this prompt is active for. */
  date: IsoDate;
  /** The prompt text shown to the user. */
  text: string;
  createdAt: IsoTimestamp;
}

/**
 * A user's submission for a given prompt. Existence of this record is the
 * submit-to-unlock gate (S-003 / AC2) — enforced server-side, never client-only.
 */
export interface Submission {
  id: string;
  userId: string;
  promptId: string;
  /** Channels this submission was posted to (channel isolation — S-004 / AC4). */
  channelIds: string[];
  createdAt: IsoTimestamp;
}

/** A channel (group/wall) a response can belong to. */
export interface Channel {
  id: string;
  name: string;
  /** "group" walls are family-scoped; "challenge" walls are themed. */
  kind: "group" | "challenge";
  isPublic: boolean;
  /** Set only for "group" kind walls (family-scoped). */
  familyId?: string;
}

/** A registered user of the POC (stubbed auth). */
export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: IsoTimestamp;
  /** Hex color, e.g. "#FF9F45". Absent/null falls back to a gradient. */
  avatarColor?: string;
  /** Hand-drawn avatar as a PNG data-URI. When set, it overrides avatarColor. */
  avatarImage?: string;
}

/** A family grouping that scopes "group" kind channels/walls. */
export interface Family {
  id: string;
  name: string;
  createdAt: IsoTimestamp;
}

/**
 * A member of a channel as shown on the family screen: who has submitted
 * today's prompt among this channel's members (AC2/AC4-adjacent read).
 */
export interface ChannelMember {
  userId: string;
  displayName: string;
  email: string;
  /**
   * Channel-scoped: true iff this member has a response in THIS channel for
   * the requested prompt (not a global submission across any channel).
   */
  hasDrawnToday: boolean;
  /** Hex avatar color for the member, when set. */
  avatarColor?: string;
  /** Hand-drawn avatar (PNG data-URI) for the member, when set. Overrides color. */
  avatarImage?: string;
  /** That member's response in THIS channel for THIS prompt, when present. */
  response?: ChannelResponse;
}

/** An emoji reaction on a channel response (post-unlock only — S-005). */
export interface Reaction {
  emoji: string;
  userId: string;
}

/**
 * Another user's response as it appears on a channel wall. Scoped to exactly
 * one channel (channel isolation — S-004 / AC4).
 */
export interface ChannelResponse {
  id: string;
  promptId: string;
  channelId: string;
  authorId: string;
  authorName: string;
  /** Hex avatar color for the author, when set. */
  authorAvatarColor?: string;
  /** Hand-drawn avatar (PNG data-URI) for the author, when set. Overrides color. */
  authorAvatarImage?: string;
  /** Reference to the drawing image (e.g. S3 key / data URI). Optional for text. */
  imageRef?: string;
  /** AI-enhanced composite (data URI). Optional; absent until enhancement completes. */
  enhancedImageRef?: string;
  /** Async enhancement lifecycle. */
  enhancementStatus?: "pending" | "ready" | "failed";
  /** Optional text response. */
  text?: string;
  /**
   * Creator's private AI background-steering prompt. Saved and returned to
   * the creator for edit pre-fill only — NEVER rendered as the caption.
   */
  backgroundPrompt?: string;
  createdAt: IsoTimestamp;
  reactions: Reaction[];
}

/** Whether the caller has submitted for a given prompt. */
export interface SubmissionStatus {
  submitted: boolean;
  submittedAt?: IsoTimestamp;
}

/** A user's streak state (S-006). */
export interface Streak {
  current: number;
  lastSubmittedDate?: IsoDate;
}

/** One day's worth of the weekly-completion strip (WS4a GET /me/stats). */
export interface WeeklyCompletionEntry {
  date: IsoDate;
  done: boolean;
}

/**
 * Real server-derived aggregates for the current user (WS4a GET /me/stats).
 * Identity-gated: the caller only ever sees their own stats.
 */
/**
 * A milestone streak badge (spec 4.5). Earned when the caller's best streak
 * reaches the given day threshold.
 */
export interface MilestoneBadge {
  day: 7 | 30 | 100;
  earned: boolean;
}

export interface MyStats {
  drawingsCount: number;
  weeklyCompletion: WeeklyCompletionEntry[];
  currentStreak: number;
  bestStreak: number;
  /** Milestone streak badges (spec 4.5): 7/30/100-day thresholds. */
  badges: MilestoneBadge[];
}

/** A distinct participant on today's prompt, for the avatar stack (WS4a). */
export interface Participant {
  displayName: string;
}

/**
 * Challenge state, computed PER VIEWER (submit-to-unlock, not a global
 * deadline): "open" until the caller has submitted their own entry, then
 * "revealed". See challenge-shared.ts `viewerState`.
 */
export type ChallengeState = "open" | "revealed";

/** The set of tools (brush styles + colors) a challenge's creator allows. */
export interface ChallengeToolset {
  brushes: BrushStyle[];
  colors: string[];
}

/**
 * A blind draw-off challenge. Open-ended (no expiry) — `drawSeconds` is the
 * PER-DRAWING timer each participant gets, not a challenge deadline.
 */
export interface Challenge {
  id: string;
  channelId: string;
  creatorId: string;
  word: string;
  /** Per-drawing timer, in seconds, given to each participant. */
  drawSeconds: number;
  /** Allowed brush styles + colors; undefined means unrestricted (back-compat with old rows). */
  toolset?: ChallengeToolset;
  /** Shared background (PNG data URI) drawn by the creator; every participant's canvas starts with it. */
  backgroundRef?: string;
  createdAt: IsoTimestamp;
}

/** One entry (submission) in a challenge. */
export interface ChallengeEntry {
  id: string;
  challengeId: string;
  userId: string;
  authorName: string;
  imageRef?: string;
  createdAt: IsoTimestamp;
  averageStars: number;
  ratingCount: number;
  myStars?: number;
}

/** Summary view of a challenge (metadata + submission counts). */
export interface ChallengeSummary {
  challenge: Challenge;
  state: ChallengeState;
  participantCount: number;
  submittedCount: number;
  iSubmitted: boolean;
  winnerEntryId?: string;
}

/** Full detail view of a challenge (summary + all entries + leaderboard). */
export interface ChallengeDetail extends ChallengeSummary {
  entries: ChallengeEntry[];
  leaderboard: LeaderboardRow[];
}

/** One row in a challenge's leaderboard (sorted by stars). */
export interface LeaderboardRow {
  entryId: string;
  userId: string;
  authorName: string;
  averageStars: number;
  ratingCount: number;
  rank: number;
}
