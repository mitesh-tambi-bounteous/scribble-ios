# Scribl POC backend

Thin AWS backend for the Scribl POC: API Gateway (HTTP API) + Lambda
(Node/TypeScript) + DynamoDB, defined with AWS CDK (TypeScript, ADR 0005).

This is the **foundation slice** (S-001/S-002-adjacent). It stands up the
infrastructure and the one live endpoint; it deliberately does NOT implement
the two launch-blocking invariants (AC2 submit-to-unlock, AC4 channel
isolation) — those land in stories S-003 and S-004, against the seams already
declared here.

## Why DynamoDB for this slice (and not Aurora)

ADR 0004 was revised to Aurora Serverless v2 (Postgres) as production's
system of record. This POC slice intentionally still uses DynamoDB because
it's cheap to stand up with CDK and demonstrate the access patterns and
invariants (AC1/AC2/AC4) without provisioning a database fleet. See the
divergence comment at the table definition in `cdk/scribl-stack.ts` and the
access-pattern catalog in `lambda/data/schema.ts`. The data-access layer
(`lambda/data/dynamodb-client.ts`) is kept thin specifically so the store can
be swapped for Aurora later without touching handler code.

## Layout

```
backend/
  cdk/
    app.ts              CDK app entry point
    scribl-stack.ts      One stack: DynamoDB table + HTTP API + 3 Lambdas
  lambda/
    handlers/
      today-prompt.ts    LIVE: GET /prompt/today
      submit.ts           SEAM: POST /submit (501, S-003)
      channel-responses.ts  SEAM: GET /channels/{id}/responses (501, S-004)
      identity.ts          Stubbed caller identity (x-user-id header)
    data/
      schema.ts            Single-table PK/SK key builders + access-pattern docs
      dynamodb-client.ts    Thin data-access layer (mock mode reads seeds)
  seeds/
    seed-data.ts          Deterministic seed fixtures (prompt, users,
                            channels, memberships, submissions, responses)
```

## Endpoints

- `GET /prompt/today` — **live**. Returns `TodayPromptResponse` (today's
  seeded prompt + the caller's submission status), from
  `@scribl/shared-types`.
- `POST /submit` — **seam**. Always returns HTTP 501. Implementation lands in
  S-003 (writes the submission item that AC2 depends on).
- `GET /channels/{id}/responses?promptId=` — **seam**. Always returns HTTP
  501. Implementation lands in S-003 (AC2 EXISTS check) + S-004 (AC4
  membership check) — see the comments in `channel-responses.ts` for the
  exact gate shape these stories must fill in.

## Stubbed auth

No Cognito. The caller's identity is read from the `x-user-id` request
header (`lambda/handlers/identity.ts`); if absent, the seeded demo user
(`user-demo`) is used. Production replaces this with Cognito.

## Seed data / mock mode

`lambda/data/dynamodb-client.ts` defaults to **mock mode**
(`SCRIBL_DATA_MODE` unset or not `"live"`): reads are served from the
deterministic fixtures in `seeds/seed-data.ts` instead of a live table. This
is what lets `GET /prompt/today` work without a deploy, and gives a
test-author fixed identities to assert against later:

- `user-demo` — default caller, **no submission** for today's prompt (the
  AC2 "before submit" fixture).
- `user-alice` — already submitted today's prompt to `channel-1` only.
- `user-bob` — already submitted today's prompt to `channel-2` only.
- Memberships: `user-demo` and `user-alice` are members of `channel-1`;
  `user-bob` is a member of `channel-2`. `user-demo` is deliberately **not**
  a member of `channel-2` (the AC4 "non-member" fixture).
- The prompt id is derived from the calendar date
  (`promptIdForDate`), so two callers on the same day always resolve to the
  same prompt (AC1).

## Local dev setup (Postgres/Neon)

The current dev flow no longer runs against DynamoDB mock mode by default —
it wires a real, external Postgres store (Neon for the POC) behind the same
`DataClient` seam. See [`docs/design/db-wiring.md`](../docs/design/db-wiring.md)
for the full RFC.

1. Copy the repo-root `.env.example` to a repo-root `.env` and fill in:
   - `DATABASE_URL` — your Neon Postgres connection string
   - `TEST_DATABASE_URL` — a separate Neon branch/db for tests
   - `SCRIBL_DATA_MODE=postgres`
   - `PORT=8787`
   - `EXPO_PUBLIC_API_MODE` / `EXPO_PUBLIC_API_BASE_URL` — for the Expo client
2. `cd backend && npm install`
3. `npm run db:bootstrap` — creates the schema and seeds it against Neon;
   idempotent, safe to re-run.
4. `npm run api` — starts the local API server in Postgres mode, reading
   `PORT`/`DATABASE_URL` from the root `.env`.

Both `backend/scripts/bootstrap.ts` and `backend/local-server.ts` auto-load
the repo-root `.env` via `dotenv` (falling back to `backend/.env` if the root
file isn't present), so no env vars need to be exported into the shell
manually.

## Local verification

```bash
cd backend
npm install
npx tsc --noEmit     # type-check, no emit
npx cdk synth        # green; no deploy
```

No `cdk deploy` is performed or required for this slice.
