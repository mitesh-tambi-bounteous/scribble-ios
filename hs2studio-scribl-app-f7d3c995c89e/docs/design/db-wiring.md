# RFC: Postgres DB wiring for the Scribl POC

**Status:** Proposed
**Date:** 2026-07-02
**Related:** [../../decisions/0004-dynamodb-single-table.md](../../decisions/0004-dynamodb-single-table.md), [../../decisions/0007-submit-to-unlock-data-layer.md](../../decisions/0007-submit-to-unlock-data-layer.md)

## 1. Summary & goal

The backend's `MOCK_MODE` DynamoDB layer (`backend/lambda/data/dynamodb-client.ts`) throws on its live branch — there is no real store. This RFC wires an external, swappable **Postgres** database (Neon for the POC; Aurora Serverless v2 for prod, per [ADR 0004](../../decisions/0004-dynamodb-single-table.md)) behind the existing `src/data/` seam so the app demo has a real, multi-user, persistent store instead of mock JSON. Goal: `DATABASE_URL`-driven Postgres, reachable by a local API runner and a deployable Lambda, with no change to the client-facing `DataClient` contract.

## 2. Connection architecture

**Option A — direct-from-app (Neon HTTP driver, `@neondatabase/serverless`, called from the RN app).**
- Pros: no extra process; fastest to wire.
- Cons: ships `DATABASE_URL` to the client bundle; AC2 (submit-to-unlock) and AC4 (channel isolation) would have to be re-implemented as client-trusted checks, which [ADR 0007](../../decisions/0007-submit-to-unlock-data-layer.md) explicitly rejects — "the mechanic must be an invariant of the system, not a property of the client." Not chosen.

**Option B — thin Lambda/API + Postgres (chosen).**
The RN app keeps calling the existing `http.ts` `DataClient` adapter over HTTP. A Node process — either the deployed Lambda or a local API runner during development — owns the `DATABASE_URL` connection and evaluates AC2/AC4 server-side before ever touching a query. The client never sees, stores, or could exfiltrate the connection string.

Because:
- Preserves AC2/AC4 as server invariants, unchanged from the current architecture and from ADR 0007.
- The client already only knows the `DataClient` interface (`src/data/client.ts`); swapping the mock/DynamoDB backend for Postgres behind `http.ts` is a data-layer-only change, not a seam change.
- One code path serves both environments: for the demo, run the app plus a local API runner pointed at the **same shared Neon `DATABASE_URL`**; the same handlers, unmodified, are what `backend/cdk` deploys to Lambda for a real environment. No demo-only branch to keep in sync.

## 3. Schema

`backend/db/schema.sql` (new) defines the relational shape implied by ADR 0004 and the current handler set:

| Table | Purpose | AC mapping |
| --- | --- | --- |
| `users` | id, email (unique), display_name, created_at | identity (§5) |
| `families` | id, name — the household/group a channel belongs to | scoping for `channels` |
| `channels` | id, family_id, name — the fixed set a prompt response can go to | AC4 boundary |
| `channel_members` | channel_id, user_id (composite PK) | **AC4**: a `getChannelResponses` read is only valid if `(channel_id, caller_user_id)` exists here |
| `prompts` | id, prompt_date (unique), text | the daily unlock unit |
| `submissions` | id, user_id, prompt_id, created_at; unique `(user_id, prompt_id)` | **AC2**: `SELECT EXISTS(...)` on this table, keyed by caller + prompt, is the submit-to-unlock gate — a direct implementation of the transactional `EXISTS` check ADR 0007 specifies |
| `responses` | id, submission_id, channel_id, content | what a channel read returns once AC2/AC4 pass |
| `reactions` | id, response_id, user_id, emoji | POC-only append; no new invariant |

`submissions` and `channel_members` are the only tables a security-relevant query touches: submit-to-unlock is one `EXISTS` on `submissions`, channel isolation is one `EXISTS` (or `JOIN`) on `channel_members`. Both stay server-side, inside the handler, never relaxed to a client-supplied flag.

## 4. Env config & DATABASE_URL swap

- `DATABASE_URL=postgresql://<user>:<pw>@<host>.neon.tech/<db>?sslmode=require` — the live connection, read only by the Lambda/local-API process.
- `TEST_DATABASE_URL` — same shape, a separate Neon branch/db for tests, so integration tests never touch demo data.
- `.env` is gitignored; `.env.example` is committed with both keys blank/placeholder, matching the Composer-repo convention.
- Both `backend/scripts/bootstrap.ts` and `backend/local-server.ts` load env vars via `dotenv` at startup, reading a repo-root `.env` (falling back to `backend/.env` if the root file is absent). No manual `export`/shell-sourcing step is required — running `npm run db:bootstrap` or `npm run api` from `backend/` picks up `DATABASE_URL`, `TEST_DATABASE_URL`, `PORT`, etc. automatically.
- Swapping databases (e.g., a fresh Neon project, or Aurora in prod) is a one-line env change; no code change, because the API layer only ever reads `process.env.DATABASE_URL` through one connection module.
- The RN app's own env (`EXPO_PUBLIC_API_MODE=http`, plus the API base URL) is unrelated and unchanged — it still only knows the `DataClient` HTTP seam, never the DB URL.

## 5. Auth model

Locked: **email + display name, no password.**
- `POST /signup` — insert into `users` (email unique); returns the new user.
- `POST /login` — lookup by email; 404 if not found (no password check — POC only).
- `GET /users` — list all users, backing a **multi-user switcher** in the app (tap a user to "sign in as" them).
- Identity propagates via the existing `x-user-id` header (`backend/lambda/handlers/identity.ts`), which today falls back to a seeded demo user; once real users exist, the switcher sets this header to the selected user's real id and every handler's AC2/AC4 checks run against that id. No change to the identity mechanism itself, only to what populates it.

## 6. Idempotent bootstrap / migration

A `db:bootstrap` script runs raw SQL: `CREATE TABLE IF NOT EXISTS` for every table in §3, plus `INSERT ... ON CONFLICT DO NOTHING` for seed rows (demo user, a default family/channel set, today's prompt). Idempotent by construction — safe to run against a fresh Neon db or repeatedly against a shared one during the demo. Prisma Migrate is noted as the scale-up path once the schema stabilizes past the POC; not adopted now to avoid a second toolchain (this repo is TypeScript, not Composer's Python+Prisma stack) for a schema that is still one migration.

## 7. AC2/AC4 preservation

No behavior changes from today's contract, only the store underneath it:
- AC2 (submit-to-unlock): the channel-responses read handler still 403s (`NotSubmittedError`) unless the caller has a submission for the requested prompt — now a Postgres `EXISTS` on `submissions`, per [ADR 0007](../../decisions/0007-submit-to-unlock-data-layer.md), instead of a DynamoDB conditional check. Evaluated per request, server-side, never cached into a client-trusted flag.
- AC4 (channel isolation): the same handler also checks `channel_members` for the caller before returning any response rows. A user who is not a member of a channel gets a 403 regardless of submission status.
- The client (`src/data/http.ts`) is unchanged: it still just calls the endpoint and renders whatever comes back, including 403s, per the `DataClient` contract in `src/data/client.ts`.

## 8. Open decisions

1. **Neon (POC) vs Aurora Serverless v2 (prod, [ADR 0004](../../decisions/0004-dynamodb-single-table.md)).** Neon is used now for its branching/HTTP-friendly driver and zero setup; Aurora remains the named production target. Cutover is an env-var swap plus a schema replay, not a rewrite.
2. **Actual `cdk deploy` vs local-runner-only for this wiring task.** The CDK stack (`backend/cdk`) stays deployable; whether we exercise a real `cdk deploy` now or keep the demo to the local API runner against shared Neon is a scoping call, not an architecture one.
3. **Auto-join rules on signup.** Whether a new user is auto-added to a default channel/family or joins explicitly is undecided; affects `channel_members` seeding in `db:bootstrap` and the signup handler.
4. **`@neondatabase/serverless` vs `pg` Pool.** Neon-native driver is the initial choice (serverless-friendly, avoids the Lambda connection-exhaustion risk [ADR 0004](../../decisions/0004-dynamodb-single-table.md) flags, works in both deployed Lambda and the local runner); `pg` Pool (the Archon in-house TS precedent) is the documented fallback if Neon-specific behavior becomes a blocker.
