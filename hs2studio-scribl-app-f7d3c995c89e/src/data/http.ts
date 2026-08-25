import type {
  AddReactionRequest,
  AddReactionResponse,
  ApiError,
  Challenge,
  ChallengeDetail,
  ChallengeDetailResponse,
  ChallengeEntry,
  ChallengeSummary,
  Channel,
  ChannelMember,
  ChannelDaysResponse,
  ChannelMembersResponse,
  ChannelResponse,
  ChannelResponsesResponse,
  ChannelRosterResponse,
  CreateChallengeRequest,
  CreateChallengeResponse,
  CreateWallRequest,
  CreateWallResponse,
  InviteMemberRequest,
  InviteMemberResponse,
  ListChallengesResponse,
  ListUsersResponse,
  ListWallsResponse,
  LoginRequest,
  LoginResponse,
  MeStatsResponse,
  MyStats,
  Prompt,
  PromptByDateResponse,
  RateEntryRequest,
  RateEntryResponse,
  SignUpRequest,
  SignUpResponse,
  Streak,
  SubmitChallengeEntryRequest,
  SubmitChallengeEntryResponse,
  SubmitRequest,
  SubmitResponse,
  TodayPromptResponse,
  UpdateResponseRequest,
  UpdateUserRequest,
  UpdateUserResponse,
  User,
} from "@scribl/shared/index";

import { getActiveUserId } from "./active-user";
import { NetworkError, NotSubmittedError, UserNotFoundError } from "./client";
import type { CreateChallengeInput, DataClient } from "./client";

/**
 * Fetch-based adapter hitting the thin AWS backend. Activated by setting
 * EXPO_PUBLIC_API_MODE=http (see ./index.ts). Never gates locally on 403s —
 * those are server invariants (AC2/AC4); this client just relays them.
 */
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error("EXPO_PUBLIC_API_BASE_URL is not set; cannot use the http data client.");
  }
  let response: Response;
  try {
    response = init
      ? await fetch(`${API_BASE_URL}${path}`, init)
      : await fetch(`${API_BASE_URL}${path}`);
  } catch (caught) {
    // fetch() itself throwing means the request never reached the server
    // (offline, DNS failure, CORS, etc.) - normalize into one human message
    // rather than propagating raw "Failed to fetch" / "Network request failed".
    throw new NetworkError(caught);
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiError | null;
    if (response.status === 403 && body?.error === "not_submitted") {
      throw new NotSubmittedError(body.message);
    }
    if (response.status === 404 && body?.error === "user_not_found") {
      throw new UserNotFoundError(body.message);
    }
    throw new Error(body?.message ?? `Request to ${path} failed with status ${response.status}`);
  }
  return (await response.json()) as T;
}

/** Builds an authenticated request init, attaching x-user-id when set. */
function authedInit(extra?: RequestInit): RequestInit {
  const userId = getActiveUserId();
  const headers: Record<string, string> = {};
  if (userId) {
    headers["x-user-id"] = userId;
  }
  Object.assign(headers, extra?.headers as Record<string, string> | undefined);
  return { ...extra, headers };
}

export const httpDataClient: DataClient = {
  async getTodayPrompt(): Promise<TodayPromptResponse> {
    // Identity-gated: the handler derives the caller (for per-user
    // submissionStatus) from x-user-id and 401s/500s without it.
    return request<TodayPromptResponse>("/prompt/today", authedInit());
  },

  async getPromptByDate(date: string): Promise<Prompt | null> {
    if (!API_BASE_URL) {
      throw new Error("EXPO_PUBLIC_API_BASE_URL is not set; cannot use the http data client.");
    }
    let response: Response;
    try {
      response = await fetch(
        `${API_BASE_URL}/prompt/${encodeURIComponent(date)}`,
        authedInit(),
      );
    } catch (caught) {
      throw new NetworkError(caught);
    }
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as ApiError | null;
      throw new Error(body?.message ?? `Request to /prompt/${date} failed with status ${response.status}`);
    }
    const { prompt } = (await response.json()) as PromptByDateResponse;
    return prompt;
  },

  async getStreak(): Promise<Streak> {
    // No dedicated /streak route exists server-side; derive the current
    // streak from the server's own computeStreaks() output via /me/stats.
    const stats = await request<MeStatsResponse>("/me/stats", authedInit());
    return { current: stats.currentStreak };
  },

  async recordSubmission(): Promise<void> {
    // No separate server-side streak invariant exists yet (S-006 is a client
    // derivation only); submit() already records the submission server-side.
    // No-op against the live backend.
  },

  async submit(body: SubmitRequest): Promise<SubmitResponse> {
    return request<SubmitResponse>(
      "/submit",
      authedInit({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  },

  async getChannelResponses(channelId: string, promptId: string): Promise<ChannelResponsesResponse> {
    // Identity-gated (AC2 submit-to-unlock / AC4 membership are resolved from
    // the caller); the handler requires x-user-id.
    return request<ChannelResponsesResponse>(
      `/channels/${encodeURIComponent(channelId)}/responses?promptId=${encodeURIComponent(promptId)}`,
      authedInit(),
    );
  },

  async getResponse(
    channelId: string,
    promptId: string,
    responseId: string,
  ): Promise<ChannelResponse> {
    const { responses } = await request<ChannelResponsesResponse>(
      `/channels/${encodeURIComponent(channelId)}/responses?promptId=${encodeURIComponent(promptId)}`,
      authedInit(),
    );
    const response = responses.find((candidate) => candidate.id === responseId);
    if (!response) {
      throw new Error("Response not found");
    }
    return response;
  },

  async updateResponse(
    channelId: string,
    promptId: string,
    responseId: string,
    patch: { text?: string; backgroundPrompt?: string; regenerate?: boolean },
  ): Promise<ChannelResponse> {
    const body: UpdateResponseRequest = patch;
    // The handler returns a { response } envelope (mirrors addReaction) — unwrap it.
    const { response } = await request<{ response: ChannelResponse }>(
      `/channels/${encodeURIComponent(channelId)}/responses/${encodeURIComponent(responseId)}?promptId=${encodeURIComponent(promptId)}`,
      authedInit({
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    return response;
  },

  async addReaction(
    channelId: string,
    promptId: string,
    responseId: string,
    emoji: string,
  ): Promise<ChannelResponse> {
    const body: AddReactionRequest = { emoji };
    const { response } = await request<AddReactionResponse>(
      `/channels/${encodeURIComponent(channelId)}/responses/${encodeURIComponent(responseId)}/reactions?promptId=${encodeURIComponent(promptId)}`,
      authedInit({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    return response;
  },

  async signUp(email: string, displayName: string): Promise<User> {
    const body: SignUpRequest = { email, displayName };
    const { user } = await request<SignUpResponse>("/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return user;
  },

  async login(email: string, displayName: string): Promise<User> {
    const body: LoginRequest = { email, displayName };
    const { user } = await request<LoginResponse>("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return user;
  },

  async listUsers(): Promise<User[]> {
    const { users } = await request<ListUsersResponse>("/users");
    return users;
  },

  async updateUser(id: string, patch: UpdateUserRequest): Promise<User> {
    const body: UpdateUserRequest = patch;
    const { user } = await request<UpdateUserResponse>(
      `/users/${encodeURIComponent(id)}`,
      authedInit({
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    return user;
  },

  async listWalls(userId: string): Promise<Channel[]> {
    const { walls } = await request<ListWallsResponse>(
      "/walls",
      authedInit({ headers: { "x-user-id": userId } }),
    );
    return walls;
  },

  async createWall(input: CreateWallRequest): Promise<Channel> {
    const { wall } = await request<CreateWallResponse>(
      "/walls",
      authedInit({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      }),
    );
    return wall;
  },

  async getChannelMembers(channelId: string, promptId: string): Promise<ChannelMember[]> {
    const { members } = await request<ChannelMembersResponse>(
      `/channels/${encodeURIComponent(channelId)}/members?promptId=${encodeURIComponent(promptId)}`,
      authedInit(),
    );
    return members;
  },

  async getMyStats(): Promise<MyStats> {
    return request<MeStatsResponse>("/me/stats", authedInit());
  },

  async inviteMember(
    channelId: string,
    email: string,
    displayName?: string,
  ): Promise<ChannelMember> {
    const body: InviteMemberRequest = { email, displayName };
    const { member } = await request<InviteMemberResponse>(
      `/channels/${encodeURIComponent(channelId)}/members`,
      authedInit({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    return member;
  },

  async leaveWall(channelId: string): Promise<void> {
    if (!API_BASE_URL) {
      throw new Error("EXPO_PUBLIC_API_BASE_URL is not set; cannot use the http data client.");
    }
    const init = authedInit({ method: "DELETE" });
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}/channels/${encodeURIComponent(channelId)}/members`, init);
    } catch (caught) {
      throw new NetworkError(caught);
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as ApiError | null;
      throw new Error(body?.message ?? `Request to /channels/${channelId}/members failed with status ${response.status}`);
    }
  },

  async getChannelRoster(channelId: string): Promise<ChannelRosterResponse> {
    return request<ChannelRosterResponse>(
      `/channels/${encodeURIComponent(channelId)}/roster`,
      authedInit(),
    );
  },

  async listChannelDays(
    channelId: string,
  ): Promise<{ promptId: string; isoDate: string; responseCount: number }[]> {
    const { days } = await request<ChannelDaysResponse>(
      `/channels/${encodeURIComponent(channelId)}/days`,
      authedInit(),
    );
    return days;
  },

  async removeMember(channelId: string, userId: string): Promise<void> {
    if (!API_BASE_URL) {
      throw new Error("EXPO_PUBLIC_API_BASE_URL is not set; cannot use the http data client.");
    }
    const init = authedInit({ method: "DELETE" });
    let response: Response;
    try {
      response = await fetch(
        `${API_BASE_URL}/channels/${encodeURIComponent(channelId)}/members?userId=${encodeURIComponent(userId)}`,
        init,
      );
    } catch (caught) {
      throw new NetworkError(caught);
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as ApiError | null;
      throw new Error(body?.message ?? `Request to /channels/${channelId}/members failed with status ${response.status}`);
    }
  },

  async createChallenge(channelId: string, input: CreateChallengeInput): Promise<Challenge> {
    const body: CreateChallengeRequest = {
      word: input.word,
      drawSeconds: input.drawSeconds,
      toolset: input.toolset,
      backgroundRef: input.backgroundRef,
    };
    const { challenge } = await request<CreateChallengeResponse>(
      `/channels/${encodeURIComponent(channelId)}/challenges`,
      authedInit({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    return challenge;
  },

  async listChallenges(channelId: string): Promise<ChallengeSummary[]> {
    const { challenges } = await request<ListChallengesResponse>(
      `/channels/${encodeURIComponent(channelId)}/challenges`,
      authedInit(),
    );
    return challenges;
  },

  async getChallengeDetail(challengeId: string): Promise<ChallengeDetail> {
    const { detail } = await request<ChallengeDetailResponse>(
      `/challenges/${encodeURIComponent(challengeId)}`,
      authedInit(),
    );
    return detail;
  },

  async submitChallengeEntry(challengeId: string, imageRef?: string): Promise<ChallengeEntry> {
    const body: SubmitChallengeEntryRequest = { imageRef };
    const { entry } = await request<SubmitChallengeEntryResponse>(
      `/challenges/${encodeURIComponent(challengeId)}/entries`,
      authedInit({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    return entry;
  },

  async rateChallengeEntry(
    challengeId: string,
    entryId: string,
    stars: number,
  ): Promise<ChallengeEntry> {
    const body: RateEntryRequest = { stars };
    const { entry } = await request<RateEntryResponse>(
      `/challenges/${encodeURIComponent(challengeId)}/entries/${encodeURIComponent(entryId)}/ratings`,
      authedInit({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    return entry;
  },
};
