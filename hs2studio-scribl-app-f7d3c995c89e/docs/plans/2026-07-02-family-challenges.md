# Family Challenges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add family-scoped blind draw-off "challenges" (custom word + deadline, blind until all-submitted-or-expired, then 1-5 star rating with a leaderboard).

**Architecture:** Extend the thin backend (API Gateway + Lambda handlers, `SCRIBL_DATA_MODE` mock/postgres data seam) and the Expo/Zustand/Skia client. Every visibility rule (blindness, reveal, who-can-rate) is computed server-side, reusing the submit-to-unlock (AC2) and channel-membership (AC4) gating patterns. The client never decides visibility.

**Tech Stack:** TypeScript, Node http Lambda handlers, Postgres (Neon serverless in prod, local pg for dev) via a `sql` tagged-template executor, in-memory mock client for the jest suite, Expo Router + Zustand + @shopify/react-native-skia, Jest + Playwright.

## Global Constraints

- Design doc: `docs/design/family-challenges.md` (source of truth for behavior).
- Every gated route resolves identity via `getCallerUserId(event)` and returns the `ApiError = {error, message}` envelope; never trust client-supplied visibility/membership/state claims.
- Reveal state is ALWAYS recomputed server-side per read: `revealed` iff `now >= deadline_at` OR distinct-entry-authors >= channel member count.
- Only participants who submitted may read entries or rate after reveal; non-submitters get 403 `not_submitted`. Non-members get 403 `not_a_member`. You cannot rate your own entry (403 `cannot_rate_own`). One entry per user (409 `already_submitted`). Stars are integers 1..5.
- Winner = highest average stars; tie-break by rating count desc, then entry `created_at` asc.
- New data functions live in BOTH `backend/lambda/data/dynamodb-client.ts` (mock) and `backend/lambda/data/postgres-client.ts`, wired through `backend/lambda/data/index.ts`, so the root jest suite exercises handlers in mock mode.
- Committed files must be grep-clean: NO em-dashes, NO unicode arrows (ASCII `->` only), NO smart quotes, NO absolute machine paths. Verify per task: `grep -rnP "[\x{2010}-\x{2015}\x{2192}\x{2190}\x{21d2}\x{2018}\x{2019}\x{201c}\x{201d}]|/Users/" <changed files>`.
- NASA power-of-10 in spirit: small functions, bound loops, check returns, validate inputs.
- TDD: write the failing test, watch it fail, implement minimally, watch it pass, commit. Frequent commits.
- Native push / real-time is out of scope; the client polls + refreshes on focus.

---

### Task 1: Schema + shared types

**Files:**
- Modify: `backend/db/schema.sql` (append the three tables)
- Modify: `packages/shared-types/domain.ts` (challenge domain types)
- Modify: `packages/shared-types/api.ts` (request/response envelopes)
- Test: `tests/challenge-types.test.ts` (compile-time shape guard + a tiny runtime assertion)

**Interfaces:**
- Produces (domain.ts):
  ```ts
  export type ChallengeState = "open" | "revealed";
  export interface Challenge {
    id: string;
    channelId: string;
    creatorId: string;
    word: string;
    deadlineAt: IsoTimestamp;
    createdAt: IsoTimestamp;
  }
  export interface ChallengeEntry {
    id: string;
    challengeId: string;
    userId: string;
    authorName: string;
    imageRef?: string;
    createdAt: IsoTimestamp;
    averageStars: number;   // 0 when unrated
    ratingCount: number;
    myStars?: number;       // caller's rating for this entry, if any
  }
  export interface ChallengeSummary {
    challenge: Challenge;
    state: ChallengeState;
    participantCount: number;
    submittedCount: number;
    iSubmitted: boolean;
    winnerEntryId?: string; // set only when revealed and rated
  }
  export interface ChallengeDetail extends ChallengeSummary {
    entries: ChallengeEntry[];      // empty/hidden while open
    leaderboard: LeaderboardRow[];  // empty while open
  }
  export interface LeaderboardRow {
    entryId: string;
    userId: string;
    authorName: string;
    averageStars: number;
    ratingCount: number;
    rank: number;   // 1-based
  }
  ```
- Produces (api.ts):
  ```ts
  export interface CreateChallengeRequest { word: string; durationMinutes: number; }
  export interface CreateChallengeResponse { challenge: Challenge; }
  export interface ListChallengesResponse { challenges: ChallengeSummary[]; }
  export interface SubmitChallengeEntryRequest { imageRef?: string; }
  export interface SubmitChallengeEntryResponse { entry: ChallengeEntry; }
  export interface ChallengeDetailResponse { detail: ChallengeDetail; }
  export interface RateEntryRequest { stars: number; }
  export interface RateEntryResponse { entry: ChallengeEntry; }
  ```

- [ ] **Step 1: Append schema tables.** Add to `backend/db/schema.sql` (verbatim from the design doc): the `challenges`, `challenge_entries` (UNIQUE `(challenge_id, user_id)`), and `challenge_ratings` (PK `(entry_id, rater_id)`, CHECK stars 1..5) `CREATE TABLE IF NOT EXISTS` statements.

- [ ] **Step 2: Add domain + api types.** Paste the Interfaces blocks above into `domain.ts` and `api.ts`; re-export from `packages/shared-types/index.ts` if that file enumerates exports (match the existing export style used by `ChannelResponse`).

- [ ] **Step 3: Write the failing test** `tests/challenge-types.test.ts`:
```ts
import type { ChallengeDetail } from "@scribl/shared/domain";
test("ChallengeDetail composes summary + entries", () => {
  const d: ChallengeDetail = {
    challenge: { id: "c1", channelId: "ch1", creatorId: "u1", word: "cat", deadlineAt: "2026-07-02T00:00:00.000Z", createdAt: "2026-07-02T00:00:00.000Z" },
    state: "open", participantCount: 3, submittedCount: 1, iSubmitted: true,
    entries: [], leaderboard: [],
  };
  expect(d.state).toBe("open");
});
```

- [ ] **Step 4: Run** `npx jest tests/challenge-types.test.ts -v` - expected PASS (types compile). If it fails to compile, fix the type exports.

- [ ] **Step 5: Verify grep-clean** on the three changed files, then commit:
```bash
git add backend/db/schema.sql packages/shared-types/*.ts tests/challenge-types.test.ts
git commit -m "feat(challenges): schema + shared types"
```

---

### Task 2: Mock data functions (dynamodb-client.ts) + selector wiring

**Files:**
- Modify: `backend/lambda/data/dynamodb-client.ts` (in-memory challenge store)
- Modify: `backend/lambda/data/index.ts` (route the new functions in both modes)
- Test: `tests/challenge-data-mock.test.ts`

**Interfaces:**
- Produces (exported from `data/index.ts`, implemented in both clients):
  ```ts
  createChallenge(input: { channelId: string; creatorId: string; word: string; deadlineAt: string }): Promise<Challenge>;
  getChallenge(challengeId: string): Promise<Challenge | undefined>;
  listChallengesForChannel(channelId: string): Promise<readonly Challenge[]>;
  putChallengeEntry(entry: { id: string; challengeId: string; userId: string; imageRef?: string }): Promise<void>;
  getChallengeEntryForUser(challengeId: string, userId: string): Promise<ChallengeEntry | undefined>;
  listChallengeEntries(challengeId: string, forUserId?: string): Promise<readonly ChallengeEntry[]>;
  countChannelMembers(channelId: string): Promise<number>;
  putRating(input: { challengeId: string; entryId: string; raterId: string; stars: number }): Promise<void>;
  ```
  `ChallengeEntry` returned by the data layer carries `averageStars`/`ratingCount` aggregated from ratings. When `forUserId` is passed, the data layer also populates each entry's `myStars` from that user's rating (undefined if none). This single signature is used by both mock (Task 2) and postgres (Task 3) and by the detail handler (Task 5); there is no separate handler-side myStars pass.
- Consumes: existing `putMembership` behavior (submitting to a channel already grants membership); `countChannelMembers` counts rows in `channel_members` for the channel.

- [ ] **Step 1: Write the failing test** `tests/challenge-data-mock.test.ts` (mock mode). Cover: createChallenge returns an id + echoes fields; putChallengeEntry then getChallengeEntryForUser round-trips; listChallengeEntries aggregates ratings (two raters give 4 and 2 -> averageStars 3, ratingCount 2); countChannelMembers reflects putMembership calls. Reset mock state in `beforeEach` (use the existing mock-reset export pattern, e.g. add `resetMockChallenges()` alongside `resetMockUsers()`).

- [ ] **Step 2: Run** `npx jest tests/challenge-data-mock.test.ts -v` - expected FAIL (functions undefined).

- [ ] **Step 3: Implement mock store** in `dynamodb-client.ts`: module-scope `Map`s keyed by id / composite keys; deterministic ids (`challenge-${channelId}-${count}`, `entry-${challengeId}-${userId}`). Aggregate ratings in `listChallengeEntries`. Add `resetMockChallenges()`. Fetch `authorName` from the existing mock users map (fall back to userId).

- [ ] **Step 4: Wire `data/index.ts`** - add the eight functions following the existing `usePostgres() ? postgres.fn(...) : dynamo.fn(...)` pattern. These are available in BOTH modes (like `putMembership`), not postgres-only.

- [ ] **Step 5: Run** `npx jest tests/challenge-data-mock.test.ts -v` - expected PASS.

- [ ] **Step 6: grep-clean + commit:**
```bash
git add backend/lambda/data/dynamodb-client.ts backend/lambda/data/index.ts tests/challenge-data-mock.test.ts
git commit -m "feat(challenges): mock data layer + selector wiring"
```

---

### Task 3: Postgres data functions (postgres-client.ts)

**Files:**
- Modify: `backend/lambda/data/postgres-client.ts`
- Test: `tests/challenge-data-postgres.test.ts` (fake-`sql` pattern, per `tests/postgres-client.test.ts`)

**Interfaces:** same eight signatures as Task 2 (Postgres implementations).

- [ ] **Step 1: Write the failing test** using `__setSqlForTests(fn)` with a fake `sql` template + `fn.transaction` jest mock (copy the harness shape from `tests/postgres-client.test.ts`). Assert: `putChallengeEntry` issues the INSERT with `ON CONFLICT (challenge_id, user_id) DO NOTHING`; `putRating` issues INSERT with `ON CONFLICT (entry_id, rater_id) DO UPDATE SET stars = EXCLUDED.stars`; `listChallengeEntries` runs the entries select + the ratings-aggregate select and maps `averageStars`/`ratingCount`.

- [ ] **Step 2: Run** `npx jest tests/challenge-data-postgres.test.ts -v` - expected FAIL.

- [ ] **Step 3: Implement** with `sql` tagged templates. Key queries:
```ts
// createChallenge
await sql`INSERT INTO challenges (id, channel_id, creator_id, word, deadline_at)
  VALUES (${id}, ${channelId}, ${creatorId}, ${word}, ${deadlineAt})`;
// putChallengeEntry
await sql`INSERT INTO challenge_entries (id, challenge_id, user_id, image_ref)
  VALUES (${id}, ${challengeId}, ${userId}, ${imageRef ?? null})
  ON CONFLICT (challenge_id, user_id) DO NOTHING`;
// putRating (idempotent per rater/entry, last write wins)
await sql`INSERT INTO challenge_ratings (challenge_id, entry_id, rater_id, stars)
  VALUES (${challengeId}, ${entryId}, ${raterId}, ${stars})
  ON CONFLICT (entry_id, rater_id) DO UPDATE SET stars = EXCLUDED.stars`;
// countChannelMembers
const rows = await sql`SELECT count(*)::int AS n FROM channel_members WHERE channel_id = ${channelId}`;
// listChallengeEntries: fetch entries joined to users for author_name, then
// aggregate ratings: SELECT entry_id, avg(stars)::float AS avg, count(*)::int AS n
//   FROM challenge_ratings WHERE challenge_id = ${challengeId} GROUP BY entry_id
```
Map DB rows to the `ChallengeEntry`/`Challenge` shapes (camelCase, ISO timestamps). `putChallengeEntry` re-check-then-insert is fine; the UNIQUE + `DO NOTHING` plus the handler's `already_submitted` check enforce one-per-user.

- [ ] **Step 4: Run** `npx jest tests/challenge-data-postgres.test.ts -v` - expected PASS. Also run `cd backend && npm run build` (tsc) clean.

- [ ] **Step 5: grep-clean + commit:**
```bash
git add backend/lambda/data/postgres-client.ts tests/challenge-data-postgres.test.ts
git commit -m "feat(challenges): postgres data layer"
```

---

### Task 4: Reveal helper + create/list handlers + routes

**Files:**
- Create: `backend/lambda/handlers/challenge-shared.ts` (reveal + leaderboard helpers, DRY)
- Create: `backend/lambda/handlers/challenge-create.ts`
- Create: `backend/lambda/handlers/challenge-list.ts`
- Modify: `backend/local-server.ts` (register routes)
- Test: `tests/challenge-create.test.ts`, `tests/challenge-list.test.ts`

**Interfaces:**
- Produces (`challenge-shared.ts`):
  ```ts
  // Pure. now is passed in (ISO) so tests are deterministic.
  export function computeState(deadlineAt: string, submittedCount: number, participantCount: number, now: string): ChallengeState;
  export function buildLeaderboard(entries: readonly ChallengeEntry[]): LeaderboardRow[]; // sorted, ranked, tie-break rules
  export function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResultV2;
  ```
- Consumes: `getMembership`, `createChallenge`, `listChallengesForChannel`, `getChallengeEntryForUser`, `countChannelMembers`, `listChallengeEntries` from `../data`.

- [ ] **Step 1: Write failing tests for `computeState` + `buildLeaderboard`** in `tests/challenge-create.test.ts` (or a dedicated `tests/challenge-shared.test.ts`): revealed when `now >= deadline`; revealed when submitted>=participants; open otherwise. Leaderboard: highest avg first; tie on avg broken by higher ratingCount; further tie broken by earlier createdAt; ranks are 1-based and dense.

- [ ] **Step 2: Run** - expected FAIL.

- [ ] **Step 3: Implement `challenge-shared.ts`** (pure functions + shared `jsonResponse`).
```ts
export function computeState(deadlineAt, submittedCount, participantCount, now) {
  const expired = Date.parse(now) >= Date.parse(deadlineAt);
  const allIn = participantCount > 0 && submittedCount >= participantCount;
  return expired || allIn ? "revealed" : "open";
}
```
`buildLeaderboard`: sort a copy by `(averageStars desc, ratingCount desc, createdAt asc)`, assign `rank = index + 1`.

- [ ] **Step 4: Implement `challenge-create.ts`.** POST. `getCallerUserId`. `channelId` from `event.pathParameters?.id`. Body `{word, durationMinutes}`; validate `word` non-empty and `durationMinutes` an integer in `[1, 1440]` else 400 `invalid_request`. Gate: `getMembership(channelId, callerId)` false -> 403 `not_a_member`. Compute `deadlineAt = new Date(Date.now() + durationMinutes*60000).toISOString()`. `createChallenge(...)`; return 200 `{challenge}`.

- [ ] **Step 5: Implement `challenge-list.ts`.** GET. Gate membership. For each challenge: `submittedCount = listChallengeEntries(id).length`, `participantCount = countChannelMembers(channelId)`, `iSubmitted = !!getChallengeEntryForUser(id, callerId)`, `state = computeState(...)`, and `winnerEntryId` only when revealed and rated (`buildLeaderboard(entries)[0]?.entryId` when top row `ratingCount > 0`). Return `{challenges: ChallengeSummary[]}` (no images).

- [ ] **Step 6: Register routes** in `backend/local-server.ts`:
```
route("POST", "/channels/:id/challenges", challengeCreateHandler)
route("GET",  "/channels/:id/challenges", challengeListHandler)
```

- [ ] **Step 7: Write handler tests** (mock mode): create requires membership (non-member 403 `not_a_member`); create rejects empty word / bad duration (400); list returns `open` with correct counts and `iSubmitted`. Run both, expected PASS.

- [ ] **Step 8: grep-clean + commit:**
```bash
git add backend/lambda/handlers/challenge-shared.ts backend/lambda/handlers/challenge-create.ts backend/lambda/handlers/challenge-list.ts backend/local-server.ts tests/challenge-create.test.ts tests/challenge-list.test.ts
git commit -m "feat(challenges): create + list handlers, reveal helper"
```

---

### Task 5: Submit-entry + get-detail (reveal gate) handlers + routes

**Files:**
- Create: `backend/lambda/handlers/challenge-entry.ts`
- Create: `backend/lambda/handlers/challenge-detail.ts`
- Modify: `backend/local-server.ts`
- Test: `tests/challenge-entry.test.ts`, `tests/challenge-detail-gate.test.ts`

**Interfaces:** consumes Task 2/3 data fns + Task 4 `computeState`, `buildLeaderboard`, `jsonResponse`.

- [ ] **Step 1: Write failing tests** `tests/challenge-detail-gate.test.ts` (the critical blindness proof):
  - user A creates a challenge in a family with members A + B; A submits an entry; while `open`, A GET detail sees own submission status but `entries` is empty/hidden; B (member, not submitted) GET detail while open also sees no entries.
  - After B submits (now all-in -> revealed), A GET detail sees BOTH entries + leaderboard.
  - A non-member C GET detail -> 403 `not_a_member`.
  - After reveal, a member who never submitted -> 403 `not_submitted` on detail read.
  And `tests/challenge-entry.test.ts`: submit requires membership (403 `not_a_member`); second submit by same user -> 409 `already_submitted`; submit after deadline -> 403 `challenge_closed` (construct a challenge with a past `deadlineAt` via a short duration + a `now` in the past is not possible through create, so seed the challenge directly via the data layer with a past deadline for this test).

- [ ] **Step 2: Run** - expected FAIL.

- [ ] **Step 3: Implement `challenge-entry.ts`.** POST `/challenges/:cid/entries`. `getCallerUserId`. Load `getChallenge(cid)` (404 `not_found` if missing). Gate `getMembership(challenge.channelId, callerId)` (403 `not_a_member`). If `Date.now() >= Date.parse(challenge.deadlineAt)` -> 403 `challenge_closed`. If `getChallengeEntryForUser(cid, callerId)` exists -> 409 `already_submitted`. `putChallengeEntry({id: entry-cid-userId, challengeId: cid, userId: callerId, imageRef})`. Also `putMembership` is already implied by family membership; do NOT auto-add. Return 200 `{entry}` (re-read via `getChallengeEntryForUser`).

- [ ] **Step 4: Implement `challenge-detail.ts`.** GET `/challenges/:cid`. Load challenge (404). Gate membership (403 `not_a_member`). Compute `entries = listChallengeEntries(cid)`, `participantCount = countChannelMembers(channelId)`, `submittedCount = entries.length`, `iSubmitted = entries.some(e => e.userId === callerId)`, `state = computeState(deadlineAt, submittedCount, participantCount, nowIso)`.
  - If `state === "open"`: return detail with `entries: []`, `leaderboard: []`, plus counts + `iSubmitted` (blind).
  - If `state === "revealed"`: require `iSubmitted` else 403 `not_submitted`. Call `listChallengeEntries(cid, callerId)` so each entry's `myStars` is populated by the data layer (Tasks 2/3 already accept `forUserId`). Build `leaderboard = buildLeaderboard(entries)`; `winnerEntryId` when top `ratingCount > 0`. Return `{detail}`.

- [ ] **Step 5: Register routes:**
```
route("POST", "/challenges/:cid/entries", challengeEntryHandler)
route("GET",  "/challenges/:cid", challengeDetailHandler)
```
(Confirm the local-server path matcher supports the `:cid` param name; reuse the existing `:id`/`:responseId` extraction style.)

- [ ] **Step 6: Run both test files** - expected PASS. This is the AC-critical blindness/reveal gate; do not weaken.

- [ ] **Step 7: grep-clean + commit:**
```bash
git add backend/lambda/handlers/challenge-entry.ts backend/lambda/handlers/challenge-detail.ts backend/local-server.ts tests/challenge-entry.test.ts tests/challenge-detail-gate.test.ts
git commit -m "feat(challenges): entry submit + reveal-gated detail"
```

---

### Task 6: Rate-entry handler + route

**Files:**
- Create: `backend/lambda/handlers/challenge-rate.ts`
- Modify: `backend/local-server.ts`
- Test: `tests/challenge-rate.test.ts`

- [ ] **Step 1: Write failing test:** after reveal, a submitter rates another entry (stars 4) -> entry `averageStars` reflects it, `myStars === 4`; re-rating (stars 2) updates in place (no duplicate); rating your OWN entry -> 403 `cannot_rate_own`; rating while `open` -> 403 `not_submitted` or a dedicated `not_revealed` (choose `not_revealed`); stars outside 1..5 -> 400 `invalid_request`; a member who did not submit -> 403 `not_submitted`.

- [ ] **Step 2: Run** - expected FAIL.

- [ ] **Step 3: Implement `challenge-rate.ts`.** POST `/challenges/:cid/entries/:eid/ratings`. `getCallerUserId`. Load challenge (404). Gate membership (403 `not_a_member`). Recompute state; if `open` -> 403 `not_revealed`. Require caller `iSubmitted` (403 `not_submitted`). Body `{stars}`; validate integer 1..5 (400 `invalid_request`). Load target entry (404 `not_found` if not in this challenge); if `entry.userId === callerId` -> 403 `cannot_rate_own`. `putRating({challengeId: cid, entryId: eid, raterId: callerId, stars})`. Return 200 `{entry}` (re-read aggregate with `myStars`).

- [ ] **Step 4: Register route:**
```
route("POST", "/challenges/:cid/entries/:eid/ratings", challengeRateHandler)
```

- [ ] **Step 5: Run** `npx jest tests/challenge-rate.test.ts` - expected PASS. Then run the full backend gate suite to prove no regression: `npx jest tests/challenge tests/submit-to-unlock tests/channel-isolation`.

- [ ] **Step 6: grep-clean + commit:**
```bash
git add backend/lambda/handlers/challenge-rate.ts backend/local-server.ts tests/challenge-rate.test.ts
git commit -m "feat(challenges): star rating handler"
```

---

### Task 7: DataClient seam (client.ts + http.ts + mock.ts)

**Files:**
- Modify: `src/data/client.ts` (interface + new error class)
- Modify: `src/data/http.ts`
- Modify: `src/data/mock.ts`
- Test: `tests/challenge-http-client.test.ts`, `tests/challenge-mock-client.test.ts`

**Interfaces:**
- Produces (add to `DataClient`):
  ```ts
  createChallenge(channelId: string, word: string, durationMinutes: number): Promise<Challenge>;
  listChallenges(channelId: string): Promise<ChallengeSummary[]>;
  getChallengeDetail(challengeId: string): Promise<ChallengeDetail>;
  submitChallengeEntry(challengeId: string, imageRef?: string): Promise<ChallengeEntry>;
  rateChallengeEntry(challengeId: string, entryId: string, stars: number): Promise<ChallengeEntry>;
  ```
- Add `export class NotRevealedError extends Error` (name `NotRevealedError`) so the UI can distinguish the open-blind state; `http.ts` maps 403 `not_revealed` to it (alongside the existing `NotSubmittedError` mapping).

- [ ] **Step 1: Write failing http-client test** mocking `fetch`: `getChallengeDetail` calls `GET {BASE}/challenges/{id}` with `x-user-id`; `rateChallengeEntry` POSTs stars to the ratings path; a 403 `not_revealed` body throws `NotRevealedError`; a 403 `not_submitted` throws `NotSubmittedError`. Mirror `tests/http-client.test.ts` setup.

- [ ] **Step 2: Run** - expected FAIL.

- [ ] **Step 3: Implement in `http.ts`** using the existing `request<T>()` + `authedInit()` helpers and the Task 1 api types. Add the `not_revealed -> NotRevealedError` branch in `request()` alongside the existing 403 mapping.

- [ ] **Step 4: Implement in `mock.ts`** an in-memory challenge store mirroring the server rules (deadline, blindness, reveal, rating, leaderboard) so web mock-mode dev works without the API. Reuse `getActiveUserId()` for identity. Keep it minimal but honor blindness + cannot-rate-own.

- [ ] **Step 5: Add interface members to `client.ts`** (+ `NotRevealedError`). Run both new client tests - expected PASS. `npm run typecheck` clean.

- [ ] **Step 6: grep-clean + commit:**
```bash
git add src/data/client.ts src/data/http.ts src/data/mock.ts tests/challenge-*client.test.ts
git commit -m "feat(challenges): data client seam"
```

---

### Task 8: Zustand stores

**Files:**
- Create: `src/stores/useChallengesStore.ts` (list per channel)
- Create: `src/stores/useChallengeStore.ts` (single detail + actions)
- Test: `tests/useChallengesStore.test.ts`, `tests/useChallengeStore.test.ts`

**Interfaces:**
- `useChallengesStore`: `{ challenges: ChallengeSummary[]; loading: boolean; error: string | null; load(channelId): Promise<void>; create(channelId, word, durationMinutes): Promise<Challenge> }`.
- `useChallengeStore`: `{ detail: ChallengeDetail | null; loading: boolean; error: string | null; locked: boolean; load(challengeId): Promise<void>; submitEntry(challengeId, imageRef?): Promise<void>; rate(challengeId, entryId, stars): Promise<void> }`. `locked` true when the read threw `NotSubmittedError` (revealed-but-not-submitted); the open-blind state is a normal `detail.state === "open"`, not `locked`.

- [ ] **Step 1: Write failing store tests** following an existing store test (e.g. `tests/useWallStore.test.ts`): mock `dataClient`; `load` populates `detail`; a `NotSubmittedError` sets `locked = true`; `rate` calls the client then reloads.

- [ ] **Step 2: Run** - expected FAIL.

- [ ] **Step 3: Implement** both stores with the existing Zustand `create` + try/catch/error conventions. `create`/`submitEntry`/`rate` call `dataClient`, then refresh.

- [ ] **Step 4: Run** - expected PASS.

- [ ] **Step 5: commit:**
```bash
git add src/stores/useChallengesStore.ts src/stores/useChallengeStore.ts tests/useChallenge*Store.test.ts
git commit -m "feat(challenges): zustand stores"
```

---

### Task 9: Family section + create-challenge screen

**Files:**
- Modify: `app/family.tsx` (add a Challenges section + New challenge button)
- Create: `app/create-challenge.tsx`
- Test: `tests/family-challenges-section.test.tsx`, `tests/create-challenge-screen.test.tsx`

- [ ] **Step 1: Write failing screen tests** (`@testing-library/react-native`, mock the stores): family screen renders a challenge row (word + state chip + countdown/winner) from `useChallengesStore`, and a "New challenge" button (testID `new-challenge-button`) routes to `/create-challenge`. create-challenge renders a word input (testID `challenge-word-input`) + duration presets; submitting calls `useChallengesStore.create` and routes to `/challenge/{id}`.

- [ ] **Step 2: Run** - expected FAIL.

- [ ] **Step 3: Implement** the family Challenges section (reuse the existing list/loading/error/retry pattern already in `family.tsx`) and `app/create-challenge.tsx` (word `TextInput` + a small set of duration preset buttons: 5 / 15 / 60 minutes; on create route to the challenge screen). Read `channelId` from the family route params.

- [ ] **Step 4: Run** - expected PASS. `npm run typecheck` + `npm run lint` clean.

- [ ] **Step 5: grep-clean + commit:**
```bash
git add app/family.tsx app/create-challenge.tsx tests/family-challenges-section.test.tsx tests/create-challenge-screen.test.tsx
git commit -m "feat(challenges): family section + create screen"
```

---

### Task 10: Challenge screen (open-draw / waiting / revealed state machine)

**Files:**
- Create: `app/challenge/[id].tsx`
- Test: `tests/challenge-screen.test.tsx`

- [ ] **Step 1: Write failing test** (mock `useChallengeStore`): given `detail.state === "open"` and `iSubmitted === false`, renders the drawing canvas + a countdown (testID `challenge-countdown`) + Done; given `open` and `iSubmitted === true`, renders a waiting state (testID `challenge-waiting`) with "waiting for N of M"; given `revealed`, renders an entry grid + a star rating control per entry (testID `rate-entry-{id}`, own entry disabled) + a leaderboard with the winner marked (testID `challenge-winner`).

- [ ] **Step 2: Run** - expected FAIL.

- [ ] **Step 3: Implement** `app/challenge/[id].tsx`:
  - `useEffect` -> `useChallengeStore.load(id)`; refresh on focus (`useFocusEffect`) and on a bounded interval (e.g. every 15s while `state === "open"`; clear on unmount) so reveal appears without push.
  - open + not submitted: reuse the Skia canvas (import the same `DrawingCanvas` + ref used by `app/draw.tsx`); the challenge `word` is the prompt label; Done exports to a data URI (reuse the `exportToImage().encodeToBase64()` flow) and calls `submitEntry(id, dataUri)`.
  - open + submitted: the waiting card with `submittedCount`/`participantCount` + countdown derived from `detail.challenge.deadlineAt`.
  - revealed: map `detail.entries` into a grid; a 1..5 star control per entry calling `rate(id, entryId, stars)` (disabled when `entry.userId` is the active user); render `detail.leaderboard` with rank 1 highlighted.
  - respect `locked` (revealed-but-not-submitted): show a "you did not enter this one" message, no entries.

- [ ] **Step 4: Run** - expected PASS. `npm run typecheck` + `npm run lint` clean.

- [ ] **Step 5: grep-clean + commit:**
```bash
git add app/challenge/[id].tsx tests/challenge-screen.test.tsx
git commit -m "feat(challenges): challenge screen state machine"
```

---

### Task 11: End-to-end Playwright spec (blind reveal + rating)

**Files:**
- Create: `e2e/challenge.spec.ts`
- Modify: `e2e/helpers.ts` (add `createChallengeViaApi`, `submitChallengeEntryViaApi` if useful)
- Test: the spec itself

**Interfaces:** reuse `signUpViaApi`, `seedSession`, `submitViaApi`, `queryPg`, `SAMPLE_IMAGE_REF`, `PUBLIC_WALL_ID` from `e2e/helpers.ts`.

- [ ] **Step 1: Write the spec** (fails until the UI is wired, which Tasks 9-10 deliver): seed users A + B; A creates a family (group channel) and B is added (via the member-add endpoint or a direct membership seed); A creates a challenge through the UI; A draws + submits; assert A cannot see B's entry (grid hidden, waiting state) while `open`; B submits (via API or UI); reload -> revealed; A rates B's entry; assert the DB has a `challenge_ratings` row (`queryPg`) and the leaderboard/winner renders. Attach `page.on('console')` (error) + `page.on('pageerror')` and fail on any.

- [ ] **Step 2: Run** `npm run test:e2e -- challenge.spec.ts` - expected PASS end-to-end (requires the harness that boots both servers + local Postgres; see the dev-experience work). If the two-server harness is not yet merged to this branch, run against a manually started API + `npm run web` and note it.

- [ ] **Step 3: grep-clean + commit:**
```bash
git add e2e/challenge.spec.ts e2e/helpers.ts
git commit -m "test(challenges): e2e blind reveal + rating"
```

---

## Self-Review notes (for the executor)

- Spec coverage: create/list/submit/detail/rate all have handler tasks (4-6); blindness + reveal proven in Task 5; rating rules in Task 6; screens in 9-10; e2e in 11; data model + types in 1-3; client seam + stores in 7-8. Countdown is client-derived (Task 10); reveal always server-recomputed (Tasks 4-6).
- Cross-task type consistency: `ChallengeEntry` gains an optional `forUserId`-driven `myStars` in the data layer (flagged in Task 5 to backfill Tasks 2/3). Keep the `listChallengeEntries(challengeId, forUserId?)` signature identical across mock + postgres + `data/index.ts`.
- If the local-server route matcher does not support two path params for the ratings route, extend it the same way `:responseId` was added for reactions.
- Dependency note: the e2e task benefits from the dev-experience branch's two-server Playwright harness + docker-compose. If that has not merged to `main` when this executes, rebase this branch on it or run the e2e against a hand-started API.
