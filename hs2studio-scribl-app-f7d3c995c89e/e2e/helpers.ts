import { execFileSync } from "node:child_process";

import { expect, type Page } from "@playwright/test";

import { E2E_DB_NAME } from "./db-url";

/** Real local backend + Postgres coordinates (see repo root .env). */
export const API_BASE_URL = "http://localhost:8787";
export const PG_CONTAINER = process.env.PG_CONTAINER ?? "scribl-pg";

/**
 * The Public wall was removed: there is no shared, always-present channel
 * anymore. Every signed-up user DOES always get their own Personal Archive
 * channel (deterministic id, auth-signup.ts), so specs that need "some
 * channel this user is definitely a member of" without creating one
 * explicitly should use this instead of a removed PUBLIC_WALL_ID constant.
 */
export function archiveChannelId(userId: string): string {
  return `channel-${userId}-archive`;
}

/** AsyncStorage key the auth store persists the signed-in user under. */
const CURRENT_USER_KEY = "scribl:currentUser";

const MS_PER_DAY = 86_400_000;

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

/** UTC calendar date (YYYY-MM-DD) for `today + offsetDays`. */
export function isoDateForOffset(offsetDays: number): string {
  const date = new Date(Date.now() + offsetDays * MS_PER_DAY);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Prompt id for a day offset; matches backend prompts.ts (`prompt-YYYY-MM-DD`). */
export function promptIdForOffset(offsetDays: number): string {
  return `prompt-${isoDateForOffset(offsetDays)}`;
}

export const TODAY_ISO_DATE = isoDateForOffset(0);
export const TODAY_PROMPT_ID = promptIdForOffset(0);

/** Unique-per-run email so signup is deterministic across re-runs. */
export function uniqueEmail(tag: string): string {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  return `e2e+${tag}-${stamp}@test.dev`;
}

/** Creates a user directly via the real API (no email is ever sent). */
export async function signUpViaApi(email: string, displayName: string): Promise<SessionUser> {
  const res = await fetch(`${API_BASE_URL}/auth/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, displayName }),
  });
  if (!res.ok) {
    throw new Error(`signUpViaApi failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { user: SessionUser };
  return body.user;
}

/** Submits (draw) for a user via the real API, authenticated by x-user-id. */
export async function submitViaApi(
  userId: string,
  promptId: string,
  imageRef: string,
  channelIds: string[] = [archiveChannelId(userId)],
  text?: string,
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/submit`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-user-id": userId },
    body: JSON.stringify({ promptId, channelIds, imageRef, text }),
  });
  if (!res.ok) {
    throw new Error(`submitViaApi failed: ${res.status} ${await res.text()}`);
  }
}

/**
 * Creates a group channel via the real POST /walls API, authenticated by
 * x-user-id (the creator is auto-joined server-side). Returns the created
 * channel id (server-generated, non-deterministic).
 */
export async function createWallViaApi(
  userId: string,
  name: string,
  isPublic = false,
): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/walls`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-user-id": userId },
    body: JSON.stringify({ name, kind: "group", isPublic }),
  });
  if (!res.ok) {
    throw new Error(`createWallViaApi failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { wall: { id: string } };
  return body.wall.id;
}

/** Lists a user's walls/channels via the real GET /walls API. */
export async function listWallsViaApi(
  userId: string,
): Promise<{ id: string; name: string; kind: string; isPublic: boolean }[]> {
  const res = await fetch(`${API_BASE_URL}/walls`, {
    headers: { "x-user-id": userId },
  });
  if (!res.ok) {
    throw new Error(`listWallsViaApi failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as {
    walls: { id: string; name: string; kind: string; isPublic: boolean }[];
  };
  return body.walls;
}

/**
 * Invites a user (by email) into a channel via the real member-add API,
 * authenticated as an existing member. Idempotent: the invitee is
 * resolved-or-created by email server-side.
 */
export async function inviteMemberViaApi(
  callerId: string,
  channelId: string,
  email: string,
  displayName: string,
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/channels/${encodeURIComponent(channelId)}/members`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-user-id": callerId },
    body: JSON.stringify({ email, displayName }),
  });
  if (!res.ok) {
    throw new Error(`inviteMemberViaApi failed: ${res.status} ${await res.text()}`);
  }
}

/**
 * Creator-chosen participant toolset for a challenge. Values must be
 * non-empty subsets of the canonical BRUSH_STYLE_IDS / PALETTE
 * (packages/shared-types/tools.ts) — the API rejects anything else.
 */
export interface ChallengeToolset {
  brushes: string[];
  colors: string[];
}

/** The full canonical toolset (mirrors packages/shared-types/tools.ts). */
export const ALL_BRUSHES = ["basic", "fork", "dotted", "neon"];
export const ALL_COLORS = [
  "#000000",
  "#E23B3B",
  "#FF8A3D",
  "#F5C518",
  "#2FA84F",
  "#2F6BE2",
  "#7A4A28",
  "#D9CBB8",
  "#8E44AD",
  "#E84393",
  "#00B5AD",
  "#8BC34A",
  "#34B3F1",
  "#3F51B5",
  "#7F8C8D",
  "#CBD5E1",
];

/**
 * Creates a blind draw-off challenge via the real API, authenticated by
 * x-user-id. The caller must be a member of the channel (server-side gate).
 * Challenges are open-ended (no deadline, ADR 0013): drawSeconds is the
 * PER-DRAWING countdown each participant gets (10..3600), toolset the
 * creator-chosen brush/color subsets, backgroundRef an optional shared PNG.
 * Returns the created challenge id.
 */
export async function createChallengeViaApi(
  userId: string,
  channelId: string,
  word: string,
  options?: { drawSeconds?: number; toolset?: ChallengeToolset; backgroundRef?: string },
): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/channels/${encodeURIComponent(channelId)}/challenges`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-user-id": userId },
    body: JSON.stringify({
      word,
      drawSeconds: options?.drawSeconds ?? 120,
      toolset: options?.toolset ?? { brushes: ALL_BRUSHES, colors: ALL_COLORS },
      backgroundRef: options?.backgroundRef,
    }),
  });
  if (!res.ok) {
    throw new Error(`createChallengeViaApi failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { challenge: { id: string } };
  return body.challenge.id;
}

/**
 * Submits a challenge entry for a user via the real API, authenticated by
 * x-user-id. Returns the created entry id.
 */
export async function submitChallengeEntryViaApi(
  userId: string,
  challengeId: string,
  imageRef: string,
): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/challenges/${encodeURIComponent(challengeId)}/entries`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-user-id": userId },
    body: JSON.stringify({ imageRef }),
  });
  if (!res.ok) {
    throw new Error(`submitChallengeEntryViaApi failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { entry: { id: string } };
  return body.entry.id;
}

/** A tiny valid PNG data URI used as a stand-in image_ref for API submits. */
export const SAMPLE_IMAGE_REF =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

/**
 * Runs a scalar SQL query inside the Postgres container against the
 * disposable `scribl_e2e` database (never the shared dev `scribl` database);
 * returns trimmed text.
 */
export function queryPg(sql: string): string {
  const out = execFileSync(
    "docker",
    ["exec", PG_CONTAINER, "psql", "-U", "scribl", "-d", E2E_DB_NAME, "-tAc", sql],
    { encoding: "utf8" },
  );
  return out.trim();
}

/** Convenience: a single integer scalar from Postgres. */
export function queryPgInt(sql: string): number {
  return Number.parseInt(queryPg(sql), 10);
}

/**
 * Seeds a signed-in web session by writing the persisted user into
 * localStorage before any app script runs, so the auth store's hydrate()
 * restores the session (and sets the x-user-id seam) without the login UI.
 */
export async function seedSession(page: Page, user: SessionUser): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [CURRENT_USER_KEY, JSON.stringify(user)] as const,
  );
}

/**
 * Signs up through the REAL auth UI. Sign-up (and login) land on /splash —
 * the brand landing screen — not /home; this helper stops there so specs can
 * choose their next hop (splash-start -> "/" Today, or nav-home -> /home).
 * The caller must already be on /sign-up (e.g. after `page.goto("/")` while
 * logged out).
 */
export async function signUpThroughUi(
  page: Page,
  email: string,
  displayName: string,
): Promise<void> {
  await page.getByTestId("auth-mode-signup").click();
  await page.getByTestId("auth-email").fill(email);
  await page.getByTestId("auth-display-name").fill(displayName);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL(/\/splash/);
  await expect(page.getByTestId("splash-brand")).toBeVisible();
}

/** Reads the persisted session user out of the page's localStorage. */
export async function readSessionUser(page: Page): Promise<SessionUser | null> {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), CURRENT_USER_KEY);
  return raw ? (JSON.parse(raw) as SessionUser) : null;
}

/** Clears the persisted session (used to simulate logout - no logout UI exists). */
export async function clearSession(page: Page): Promise<void> {
  await page.evaluate((key) => window.localStorage.removeItem(key), CURRENT_USER_KEY);
}
