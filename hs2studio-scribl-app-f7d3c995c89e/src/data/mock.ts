import type {
  Challenge,
  ChallengeDetail,
  ChallengeEntry,
  ChallengeState,
  ChallengeSummary,
  Channel,
  ChannelMember,
  ChannelResponse,
  ChannelResponsesResponse,
  ChannelRosterResponse,
  CreateWallRequest,
  IsoDate,
  LeaderboardRow,
  MilestoneBadge,
  MyStats,
  Prompt,
  Reaction,
  Streak,
  SubmitRequest,
  SubmitResponse,
  TodayPromptResponse,
  UpdateUserRequest,
  User,
} from "@scribl/shared/index";

import { getActiveUserId } from "./active-user";
import { NotSubmittedError, UserNotFoundError } from "./client";
import type { CreateChallengeInput, DataClient } from "./client";

/** Trim + lowercase for case-insensitive credential matching (login). */
function normalize(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * backgroundPrompt is the creator's PRIVATE AI background-steering prompt
 * (see domain.ts ChannelResponse.backgroundPrompt doc). Mirrors the server's
 * masking (backend/lambda/handlers/channel-response-privacy.ts): visible to
 * the response's own author only, stripped for every other channel member.
 */
function maskBackgroundPromptIfForeign(
  response: ChannelResponse,
  callerId: string,
): ChannelResponse {
  if (response.authorId === callerId) {
    return response;
  }
  const { backgroundPrompt: _backgroundPrompt, ...rest } = response;
  return rest;
}

/**
 * Mock adapter — the DEFAULT data client so the app boots with zero AWS.
 * Returns one seeded prompt with submissionStatus.submitted = false.
 */
const SEEDED_PROMPT: TodayPromptResponse = {
  prompt: {
    id: "prompt-2026-07-01",
    date: "2026-07-01",
    text: "Draw the first thing that made you smile today.",
    createdAt: "2026-07-01T08:00:00.000Z",
  },
  submissionStatus: {
    submitted: false,
  },
  participantCount: 0,
  participants: [],
};

/**
 * Overlay state simulating the backend for this POC. Mutable at module
 * scope; resets only on process restart — acceptable for the mock adapter.
 */
const submittedPromptIds = new Set<string>();
/**
 * Clean slate: no seeded channel responses. Channels are group-only now
 * (no always-present Public wall), so there is no shared demo channel to
 * seed a response into. getTodayPrompt derives participantCount/participants
 * from this list, so it correctly starts at 0.
 */
const extraResponses: ChannelResponse[] = [];
const reactionsByResponseId = new Map<string, Reaction[]>();

/** Seeded users — clean slate, populated only by signUp. */
const SEEDED_USERS: User[] = [];

/** In-memory user store, seeded then appended to by signUp. */
const usersById = new Map<string, User>(SEEDED_USERS.map((user) => [user.id, user]));

/** Seeded walls (channels). Clean slate — none; users get Personal Archive on signup. */
const SEEDED_WALLS: Channel[] = [];

/** In-memory wall store, seeded then appended to by createWall. */
const wallsById = new Map<string, Channel>(SEEDED_WALLS.map((wall) => [wall.id, wall]));

/** Which users belong to which channel (drives getChannelMembers). Clean slate. */
const channelMembers: Record<string, string[]> = {};

/** Which user created each channel (drives roster's creator-only Remove UI). Clean slate. */
const channelCreators: Record<string, string> = {};

/**
 * Auto-provisions the Personal Archive channel on signup, mirroring the
 * server (backend/lambda/handlers/auth-signup.ts): deterministic id of the
 * form `channel-{userId}-{suffix}`, kind 'group', only the owner is a
 * member. New users start with exactly Personal Archive — no
 * Family/Friends/Co-Workers pre-seed, no always-present Public wall.
 * Idempotent — safe to call again for the same userId.
 */
function provisionPersonalChannels(userId: string): void {
  const specs: { suffix: string; name: string }[] = [
    { suffix: "archive", name: "Personal Archive" },
  ];
  for (const spec of specs) {
    const id = `channel-${userId}-${spec.suffix}`;
    if (!wallsById.has(id)) {
      wallsById.set(id, { id, name: spec.name, kind: "group", isPublic: false });
    }
    const members = channelMembers[id] ?? [];
    if (!members.includes(userId)) {
      channelMembers[id] = [...members, userId];
    }
    if (!channelCreators[id]) {
      channelCreators[id] = userId;
    }
  }
}

let nextUserSeq = 1;
let nextWallSeq = 1;
let nextChallengeSeq = 1;

/** In-memory challenge store, keyed by challenge id. Clean slate. */
const challengesById = new Map<string, Challenge>();

/** In-memory challenge entries, keyed by challenge id then user id. */
const challengeEntriesByChallengeId = new Map<string, Map<string, ChallengeEntry>>();

/** In-memory ratings: challengeId -> entryId -> raterId -> stars. */
const ratingsByChallengeId = new Map<string, Map<string, Map<string, number>>>();

function getChallengeOrThrow(challengeId: string): Challenge {
  const challenge = challengesById.get(challengeId);
  if (!challenge) {
    throw new Error(`challenge not found: ${challengeId}`);
  }
  return challenge;
}

/** Mirrors backend/lambda/handlers/challenge-shared.ts viewerState. */
function computeChallengeState(iSubmitted: boolean): ChallengeState {
  return iSubmitted ? "revealed" : "open";
}

/** Rebuilds one entry's averageStars/ratingCount/myStars from the ratings map. */
function hydrateEntry(challengeId: string, entry: ChallengeEntry, callerId?: string): ChallengeEntry {
  const ratings = ratingsByChallengeId.get(challengeId)?.get(entry.id);
  const stars = ratings ? Array.from(ratings.values()) : [];
  const ratingCount = stars.length;
  const averageStars = ratingCount > 0 ? stars.reduce((sum, s) => sum + s, 0) / ratingCount : 0;
  const myStars = callerId ? ratings?.get(callerId) : undefined;
  return { ...entry, averageStars, ratingCount, myStars };
}

function listMockChallengeEntries(challengeId: string, callerId?: string): ChallengeEntry[] {
  const entries = challengeEntriesByChallengeId.get(challengeId) ?? new Map();
  return Array.from(entries.values()).map((entry) => hydrateEntry(challengeId, entry, callerId));
}

/** Mirrors backend/lambda/handlers/challenge-shared.ts buildLeaderboard. */
function buildMockLeaderboard(entries: readonly ChallengeEntry[]): LeaderboardRow[] {
  const sorted = [...entries].sort((a, b) => {
    if (a.averageStars !== b.averageStars) {
      return b.averageStars - a.averageStars;
    }
    if (a.ratingCount !== b.ratingCount) {
      return b.ratingCount - a.ratingCount;
    }
    return Date.parse(a.createdAt) - Date.parse(b.createdAt);
  });
  return sorted.map((entry, index) => ({
    entryId: entry.id,
    userId: entry.userId,
    authorName: entry.authorName,
    averageStars: entry.averageStars,
    ratingCount: entry.ratingCount,
    rank: index + 1,
  }));
}

function buildChallengeSummary(challenge: Challenge, callerId?: string): ChallengeSummary {
  const entries = listMockChallengeEntries(challenge.id);
  const submittedCount = entries.length;
  const participantCount = (channelMembers[challenge.channelId] ?? []).length;
  const iSubmitted = callerId ? entries.some((e) => e.userId === callerId) : false;
  const state = computeChallengeState(iSubmitted);
  let winnerEntryId: string | undefined;
  if (state === "revealed") {
    const top = buildMockLeaderboard(entries)[0];
    if (top && top.ratingCount > 0) {
      winnerEntryId = top.entryId;
    }
  }
  return { challenge, state, participantCount, submittedCount, iSubmitted, winnerEntryId };
}

/**
 * Looks up a single response by id across all channels/prompts, for the
 * upcoming PATCH response-update flow (edit caption / regenerate background).
 * Mirrors backend/lambda/data getResponseById. Read-only.
 */
export function getResponseById(responseId: string): ChannelResponse | null {
  const found = extraResponses.find((response) => response.id === responseId);
  if (!found) {
    return null;
  }
  return {
    ...found,
    reactions: [...found.reactions, ...(reactionsByResponseId.get(found.id) ?? [])],
  };
}

/**
 * Partial update for a response's caption text and/or background prompt.
 * Mirrors backend/lambda/data updateResponse. Absent fields are left
 * untouched. Mutates the in-memory response in place and returns it. Does
 * NOT touch enhancedImageRef/enhancementStatus.
 */
export function updateResponse(
  responseId: string,
  patch: { text?: string; backgroundPrompt?: string },
): ChannelResponse {
  const index = extraResponses.findIndex((response) => response.id === responseId);
  if (index === -1) {
    throw new Error(`updateResponse: no response found for id ${responseId}`);
  }
  const existing = extraResponses[index];
  if (!existing) {
    throw new Error(`updateResponse: no response found for id ${responseId}`);
  }
  const updated: ChannelResponse = {
    ...existing,
    text: patch.text ?? existing.text,
    backgroundPrompt: patch.backgroundPrompt ?? existing.backgroundPrompt,
  };
  extraResponses[index] = updated;
  return {
    ...updated,
    reactions: [...updated.reactions, ...(reactionsByResponseId.get(updated.id) ?? [])],
  };
}

function buildChannelResponsesResponse(
  channelId: string,
  promptId: string,
): ChannelResponsesResponse {
  if (!submittedPromptIds.has(promptId)) {
    throw new NotSubmittedError();
  }
  const matchingExtra = extraResponses.filter(
    (response) => response.channelId === channelId && response.promptId === promptId,
  );
  const responses = matchingExtra.map((response) => ({
    ...response,
    reactions: [...response.reactions, ...(reactionsByResponseId.get(response.id) ?? [])],
  }));
  return { channelId, promptId, responses };
}

/** Fixed "today" for the POC — matches SEEDED_PROMPT.prompt.date. */
const SEEDED_TODAY: IsoDate = SEEDED_PROMPT.prompt.date;

/**
 * Streak history starts empty on a clean slate. `recordSubmission` (wired
 * from the Draw submit success path) is what pushes each day's date on.
 */
const INITIAL_STREAK_HISTORY: IsoDate[] = [];

/**
 * In-memory submission-date history backing the mock streak (S-006). Purely
 * client-side derivation for the POC — mirrors the backend's mockSubmissions
 * overlay pattern but has no server invariant behind it.
 */
let streakHistory: IsoDate[] = [...INITIAL_STREAK_HISTORY];

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(a: IsoDate, b: IsoDate): number {
  const msA = new Date(`${a}T00:00:00.000Z`).getTime();
  const msB = new Date(`${b}T00:00:00.000Z`).getTime();
  return Math.round((msB - msA) / ONE_DAY_MS);
}

/**
 * Pure derivation of a Streak from a submission-date history and "today".
 * Sorts/dedupes history, then counts consecutive calendar days walking
 * backward from the most recent submission on or before today.
 */
export function computeStreak(history: IsoDate[], today: IsoDate): Streak {
  const sorted = Array.from(new Set(history)).sort();
  if (sorted.length === 0) {
    return { current: 0, lastSubmittedDate: undefined };
  }

  const lastSubmittedDate = sorted[sorted.length - 1];

  let current = 1;
  let cursor = lastSubmittedDate;
  for (let index = sorted.length - 2; index >= 0; index -= 1) {
    const candidate = sorted[index];
    if (daysBetween(candidate, cursor) === 1) {
      current += 1;
      cursor = candidate;
    } else {
      break;
    }
  }

  // `today` anchors the derivation conceptually (streak is "as of today");
  // the fixed POC seed always has history entries on or before today.
  void today;

  return { current, lastSubmittedDate };
}

/** Resets the mock streak history to its seeded state (test isolation). */
export function resetStreakHistoryForTests(): void {
  streakHistory = [...INITIAL_STREAK_HISTORY];
}

const WEEK_LENGTH = 7;

/**
 * Mirrors backend/lambda/data/stats.ts computeWeeklyCompletion for the mock
 * adapter (kept as a small local duplicate rather than a cross-package
 * import, since this module has no backend dependency otherwise). Always
 * returns exactly WEEK_LENGTH entries, oldest first, ending `today`.
 */
function computeWeeklyCompletion(history: IsoDate[], today: IsoDate): { date: IsoDate; done: boolean }[] {
  const dateSet = new Set(history);
  const entries: { date: IsoDate; done: boolean }[] = [];
  for (let offset = WEEK_LENGTH - 1; offset >= 0; offset -= 1) {
    const ms = new Date(`${today}T00:00:00.000Z`).getTime() - offset * ONE_DAY_MS;
    const date = new Date(ms).toISOString().slice(0, 10);
    entries.push({ date, done: dateSet.has(date) });
  }
  return entries;
}

export const mockDataClient: DataClient = {
  async getTodayPrompt(): Promise<TodayPromptResponse> {
    const promptId = SEEDED_PROMPT.prompt.id;
    const participantAuthorIds = new Set(
      extraResponses.filter((r) => r.promptId === promptId).map((r) => r.authorId),
    );
    const participants = Array.from(participantAuthorIds)
      .slice(0, 5)
      .map((authorId) => {
        const response = extraResponses.find((r) => r.authorId === authorId && r.promptId === promptId);
        return { displayName: response?.authorName ?? "Someone" };
      });
    return {
      ...SEEDED_PROMPT,
      submissionStatus: {
        ...SEEDED_PROMPT.submissionStatus,
        submitted: submittedPromptIds.has(promptId),
      },
      participantCount: participantAuthorIds.size,
      participants,
    };
  },

  async getPromptByDate(date: string): Promise<Prompt | null> {
    if (date === SEEDED_PROMPT.prompt.date) {
      return SEEDED_PROMPT.prompt;
    }
    return null;
  },

  async getStreak(): Promise<Streak> {
    return computeStreak(streakHistory, SEEDED_TODAY);
  },

  async recordSubmission(date: IsoDate): Promise<void> {
    streakHistory.push(date);
  },

  async submit(request: SubmitRequest): Promise<SubmitResponse> {
    submittedPromptIds.add(request.promptId);
    const userId = getActiveUserId() ?? "user-unknown";
    const user = usersById.get(userId);
    const submission = {
      id: `submission-${userId}-${request.promptId}`,
      userId,
      promptId: request.promptId,
      channelIds: request.channelIds,
      createdAt: new Date().toISOString(),
    };
    for (const channelId of request.channelIds) {
      extraResponses.push({
        id: `response-${userId}-${request.promptId}-${channelId}`,
        promptId: request.promptId,
        channelId,
        authorId: userId,
        authorName: user?.displayName ?? "You",
        imageRef: request.imageRef,
        text: request.text,
        createdAt: new Date().toISOString(),
        reactions: [],
      });
    }
    return { submission };
  },

  async getChannelResponses(
    channelId: string,
    promptId: string,
  ): Promise<ChannelResponsesResponse> {
    const built = buildChannelResponsesResponse(channelId, promptId);
    const callerId = getActiveUserId() ?? "user-unknown";
    return {
      ...built,
      responses: built.responses.map((response) =>
        maskBackgroundPromptIfForeign(response, callerId),
      ),
    };
  },

  async getResponse(
    channelId: string,
    promptId: string,
    responseId: string,
  ): Promise<ChannelResponse> {
    const { responses } = buildChannelResponsesResponse(channelId, promptId);
    const response = responses.find((candidate) => candidate.id === responseId);
    if (!response) {
      throw new Error("Response not found");
    }
    return response;
  },

  async updateResponse(
    _channelId: string,
    _promptId: string,
    responseId: string,
    patch: { text?: string; backgroundPrompt?: string; regenerate?: boolean },
  ): Promise<ChannelResponse> {
    const updated = updateResponse(responseId, {
      text: patch.text,
      backgroundPrompt: patch.backgroundPrompt,
    });
    if (!patch.regenerate) {
      return updated;
    }
    // Simulate the enhancement lifecycle: kick off as "pending", then flip to
    // "ready" reusing the existing enhancedImageRef (POC has no real image
    // pipeline to regenerate against).
    const index = extraResponses.findIndex((response) => response.id === responseId);
    if (index !== -1) {
      const existing = extraResponses[index];
      if (existing) {
        extraResponses[index] = { ...existing, enhancementStatus: "pending" };
      }
    }
    if (index !== -1) {
      const pending = extraResponses[index];
      if (pending) {
        extraResponses[index] = { ...pending, enhancementStatus: "ready" };
      }
    }
    const final = getResponseById(responseId);
    if (!final) {
      throw new Error(`updateResponse: no response found for id ${responseId}`);
    }
    return final;
  },

  async addReaction(
    channelId: string,
    promptId: string,
    responseId: string,
    emoji: string,
  ): Promise<ChannelResponse> {
    const existing = reactionsByResponseId.get(responseId) ?? [];
    const userId = getActiveUserId() ?? "user-unknown";
    reactionsByResponseId.set(responseId, [...existing, { emoji, userId }]);
    const { responses } = buildChannelResponsesResponse(channelId, promptId);
    const response = responses.find((candidate) => candidate.id === responseId);
    if (!response) {
      throw new Error(`addReaction: no response with id ${responseId} in channel ${channelId}`);
    }
    return response;
  },

  async signUp(email: string, displayName: string): Promise<User> {
    const existing = Array.from(usersById.values()).find((user) => user.email === email);
    if (existing) {
      return existing;
    }
    const user: User = {
      id: `user-${nextUserSeq++}`,
      email,
      displayName,
      createdAt: new Date().toISOString(),
    };
    usersById.set(user.id, user);
    provisionPersonalChannels(user.id);
    return user;
  },

  async login(email: string, displayName: string): Promise<User> {
    const user = Array.from(usersById.values()).find(
      (candidate) =>
        normalize(candidate.email) === normalize(email) &&
        normalize(candidate.displayName) === normalize(displayName),
    );
    if (!user) {
      throw new UserNotFoundError(`no account matches ${email} and ${displayName}`);
    }
    return user;
  },

  async listUsers(): Promise<User[]> {
    return Array.from(usersById.values());
  },

  async updateUser(id: string, patch: UpdateUserRequest): Promise<User> {
    const existing = usersById.get(id);
    if (!existing) {
      throw new Error(`user not found: ${id}`);
    }
    const updated: User = { ...existing, ...patch };
    usersById.set(id, updated);
    return updated;
  },

  async listWalls(userId: string): Promise<Channel[]> {
    return Array.from(wallsById.values()).filter((wall) =>
      (channelMembers[wall.id] ?? []).includes(userId),
    );
  },

  async createWall(input: CreateWallRequest): Promise<Channel> {
    const wall: Channel = {
      id: `wall-${nextWallSeq++}`,
      name: input.name,
      kind: input.kind,
      isPublic: input.isPublic,
      familyId: input.familyId,
    };
    wallsById.set(wall.id, wall);
    const creatorId = getActiveUserId();
    channelMembers[wall.id] = creatorId ? [creatorId] : [];
    channelCreators[wall.id] = creatorId ?? "";
    return wall;
  },

  async getMyStats(): Promise<MyStats> {
    const today = new Date().toISOString().slice(0, 10);
    const drawingsCount = streakHistory.length;
    const weeklyCompletion = computeWeeklyCompletion(streakHistory, today);
    const streak = computeStreak(streakHistory, today);
    const mockBestStreak = streak.current;
    const badges: MilestoneBadge[] = [7, 30, 100].map((day) => ({
      day: day as MilestoneBadge["day"],
      earned: mockBestStreak >= day,
    }));
    return {
      drawingsCount,
      weeklyCompletion,
      currentStreak: streak.current,
      bestStreak: mockBestStreak,
      badges,
    };
  },

  async inviteMember(channelId: string, email: string, displayName?: string): Promise<ChannelMember> {
    let user = Array.from(usersById.values()).find((candidate) => candidate.email === email);
    if (!user) {
      user = {
        id: `user-${nextUserSeq++}`,
        email,
        displayName: displayName ?? email,
        createdAt: new Date().toISOString(),
      };
      usersById.set(user.id, user);
    }
    const existingMembers = channelMembers[channelId] ?? [];
    if (!existingMembers.includes(user.id)) {
      channelMembers[channelId] = [...existingMembers, user.id];
    }
    return {
      userId: user.id,
      displayName: user.displayName,
      email: user.email,
      hasDrawnToday: false,
    };
  },

  async leaveWall(channelId: string): Promise<void> {
    const userId = getActiveUserId();
    if (!userId) {
      return;
    }
    const existingMembers = channelMembers[channelId] ?? [];
    channelMembers[channelId] = existingMembers.filter((memberId) => memberId !== userId);
  },

  async getChannelMembers(channelId: string, promptId: string): Promise<ChannelMember[]> {
    if (!submittedPromptIds.has(promptId)) {
      throw new NotSubmittedError();
    }
    const memberIds = channelMembers[channelId] ?? [];
    // Channel-scoped: a member has drawn today iff they authored a response in
    // THIS channel for THIS prompt. The old `submittedPromptIds.has(promptId)`
    // reported every member as drawn once anyone had submitted anywhere.
    const channelResponses = extraResponses.filter(
      (response) => response.channelId === channelId && response.promptId === promptId,
    );
    const callerId = getActiveUserId() ?? "user-unknown";
    return memberIds.map((userId): ChannelMember => {
      const user = usersById.get(userId);
      const own = channelResponses.find((response) => response.authorId === userId);
      const member: ChannelMember = {
        userId,
        displayName: user?.displayName ?? userId,
        email: user?.email ?? "",
        hasDrawnToday: own !== undefined,
        avatarColor: user?.avatarColor,
        avatarImage: user?.avatarImage,
      };
      if (own) {
        member.response = maskBackgroundPromptIfForeign(
          {
            ...own,
            authorAvatarColor: user?.avatarColor,
            authorAvatarImage: user?.avatarImage,
          },
          callerId,
        );
      }
      return member;
    });
  },

  async getChannelRoster(channelId: string): Promise<ChannelRosterResponse> {
    const memberIds = channelMembers[channelId] ?? [];
    const members = memberIds.map((userId) => {
      const user = usersById.get(userId);
      return {
        userId,
        displayName: user?.displayName ?? userId,
        email: user?.email ?? "",
        avatarColor: user?.avatarColor,
        avatarImage: user?.avatarImage,
      };
    });
    return { createdBy: channelCreators[channelId] ?? "", members };
  },

  async listChannelDays(
    channelId: string,
  ): Promise<{ promptId: string; isoDate: string; responseCount: number }[]> {
    const byPromptId = new Map<string, { count: number; lastCreatedAt: string }>();
    for (const response of extraResponses) {
      if (response.channelId !== channelId) {
        continue;
      }
      const existing = byPromptId.get(response.promptId);
      if (!existing) {
        byPromptId.set(response.promptId, { count: 1, lastCreatedAt: response.createdAt });
        continue;
      }
      existing.count += 1;
      if (response.createdAt > existing.lastCreatedAt) {
        existing.lastCreatedAt = response.createdAt;
      }
    }
    return Array.from(byPromptId.entries())
      .map(([promptId, { count, lastCreatedAt }]) => {
        const match = /^prompt-(\d{4}-\d{2}-\d{2})$/.exec(promptId);
        const isoDate = match?.[1] ?? lastCreatedAt.slice(0, 10);
        return { promptId, isoDate, responseCount: count, lastCreatedAt };
      })
      .sort((a, b) => (a.lastCreatedAt < b.lastCreatedAt ? 1 : -1))
      .map(({ promptId, isoDate, responseCount }) => ({ promptId, isoDate, responseCount }));
  },

  async removeMember(channelId: string, userId: string): Promise<void> {
    const existingMembers = channelMembers[channelId] ?? [];
    channelMembers[channelId] = existingMembers.filter((memberId) => memberId !== userId);
  },

  async createChallenge(channelId: string, input: CreateChallengeInput): Promise<Challenge> {
    const creatorId = getActiveUserId() ?? "user-unknown";
    const challenge: Challenge = {
      id: `challenge-${nextChallengeSeq++}`,
      channelId,
      creatorId,
      word: input.word,
      drawSeconds: input.drawSeconds,
      toolset: input.toolset,
      backgroundRef: input.backgroundRef,
      createdAt: new Date().toISOString(),
    };
    challengesById.set(challenge.id, challenge);
    challengeEntriesByChallengeId.set(challenge.id, new Map());
    ratingsByChallengeId.set(challenge.id, new Map());
    return challenge;
  },

  async listChallenges(channelId: string): Promise<ChallengeSummary[]> {
    const callerId = getActiveUserId() ?? undefined;
    return Array.from(challengesById.values())
      .filter((challenge) => challenge.channelId === channelId)
      .map((challenge) => buildChallengeSummary(challenge, callerId));
  },

  async getChallengeDetail(challengeId: string): Promise<ChallengeDetail> {
    const challenge = getChallengeOrThrow(challengeId);
    const callerId = getActiveUserId() ?? "user-unknown";
    const blindEntries = listMockChallengeEntries(challengeId);
    const submittedCount = blindEntries.length;
    const participantCount = (channelMembers[challenge.channelId] ?? []).length;
    const iSubmitted = blindEntries.some((e) => e.userId === callerId);
    const state = computeChallengeState(iSubmitted);

    if (state === "open") {
      return {
        challenge,
        state,
        participantCount,
        submittedCount,
        iSubmitted,
        entries: [],
        leaderboard: [],
      };
    }

    const entries = listMockChallengeEntries(challengeId, callerId);
    const leaderboard = buildMockLeaderboard(entries);
    const top = leaderboard[0];
    const winnerEntryId = top && top.ratingCount > 0 ? top.entryId : undefined;

    return {
      challenge,
      state,
      participantCount,
      submittedCount,
      iSubmitted,
      entries,
      leaderboard,
      winnerEntryId,
    };
  },

  async submitChallengeEntry(challengeId: string, imageRef?: string): Promise<ChallengeEntry> {
    getChallengeOrThrow(challengeId);
    const userId = getActiveUserId() ?? "user-unknown";

    const entries = challengeEntriesByChallengeId.get(challengeId) ?? new Map();
    if (entries.has(userId)) {
      throw new Error("you already submitted an entry");
    }

    const user = usersById.get(userId);
    const entry: ChallengeEntry = {
      id: `entry-${challengeId}-${userId}`,
      challengeId,
      userId,
      authorName: user?.displayName ?? "You",
      imageRef,
      createdAt: new Date().toISOString(),
      averageStars: 0,
      ratingCount: 0,
    };
    entries.set(userId, entry);
    challengeEntriesByChallengeId.set(challengeId, entries);
    return hydrateEntry(challengeId, entry, userId);
  },

  async rateChallengeEntry(
    challengeId: string,
    entryId: string,
    stars: number,
  ): Promise<ChallengeEntry> {
    getChallengeOrThrow(challengeId);
    const callerId = getActiveUserId() ?? "user-unknown";

    const entries = listMockChallengeEntries(challengeId, callerId);
    const iSubmitted = entries.some((e) => e.userId === callerId);
    const state = computeChallengeState(iSubmitted);
    if (state !== "revealed") {
      throw new NotSubmittedError("submit an entry before rating others");
    }

    const targetEntry = entries.find((e) => e.id === entryId);
    if (!targetEntry) {
      throw new Error("entry not found");
    }
    if (targetEntry.userId === callerId) {
      throw new Error("you cannot rate your own entry");
    }

    const ratingsForChallenge = ratingsByChallengeId.get(challengeId) ?? new Map();
    const ratingsForEntry = ratingsForChallenge.get(entryId) ?? new Map();
    ratingsForEntry.set(callerId, stars);
    ratingsForChallenge.set(entryId, ratingsForEntry);
    ratingsByChallengeId.set(challengeId, ratingsForChallenge);

    const rawEntry = challengeEntriesByChallengeId.get(challengeId)?.get(targetEntry.userId);
    if (!rawEntry) {
      throw new Error("entry not found");
    }
    return hydrateEntry(challengeId, rawEntry, callerId);
  },
};
