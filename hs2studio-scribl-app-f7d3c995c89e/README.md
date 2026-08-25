# MobileApp - Scribl D2C POC

Greenfield repo for **Scribl**, a daily-creative-practice app - a roughly one-week
clickable POC on the Expo OSS stack that runs on device (iOS/Android) **and** exports
to web from a single codebase.

This repo is built by AI agents (Claude Code) behind a generated harness. Read
[`CLAUDE.md`](CLAUDE.md) first (golden rules + locked stack), then [`AGENTS.md`](AGENTS.md).
Architecture decisions live in [`decisions/`](decisions/) - see [`decisions/README.md`](decisions/README.md).

## Issue tracking

Stories and issues for Scribl live on the Jira board
[**CMPSR** (Composer)](https://bounteous.jira.com/jira/software/projects/CMPSR/boards/13809/backlog) -
project key `CMPSR`. File and track work there, not in this repo.

## The daily loop

Scribl is one habit loop, repeated daily:

```
prompt of the day  ->  draw on the canvas  ->  submit to unlock  ->  community wall + reactions  ->  streak
```

The **submit-to-unlock** invariant is core: you can't see the community wall for a
given day's prompt until you've submitted your own drawing. It is enforced at the data
layer, not just the UI - see [`decisions/0007-submit-to-unlock-data-layer.md`](decisions/0007-submit-to-unlock-data-layer.md)
and the `submit-to-unlock-invariant` skill.

## Stack (locked)

| Layer | Choice | ADR |
|-------|--------|-----|
| App | Expo ~56 · React Native 0.85 · React 19 · expo-router | [0001](decisions/0001-react-native-primary.md) |
| Drawing | `@shopify/react-native-skia` | [0006](decisions/0006-drawing-canvas-skia.md) |
| Styling | NativeWind (Tailwind) | - |
| State | Zustand | - |
| Backend | AWS serverless (Lambda + API Gateway), AWS CDK IaC for this POC slice | [0002](decisions/0002-serverless-first-backend.md) · [0005](decisions/0005-aws-cdk-iac.md) |
| Production IaC (target, not this POC) | Terraform, EKS + Bedrock | [0012](decisions/0012-terraform-iac.md) (proposed, pending sign-off) |
| Data | DynamoDB single-table | [0004](decisions/0004-dynamodb-single-table.md) |
| AI | Separate async pipeline behind a provider adapter | [0003](decisions/0003-ai-pipeline-separate-service.md) · [0009](decisions/0009-claude-provider-abstraction.md) · [0010](decisions/0010-async-ai-pipeline.md) · [0011](decisions/0011-model-tiering.md) |

## Repo layout

```
app/                       expo-router screens (Today screen entry)
components/
  canvas/                  Skia drawing canvas (DrawingCanvas, SkiaCanvas)
  ui/                      base UI primitives (button, icon, text)
src/
  data/                    data client - mock + http adapters (submit-to-unlock aware)
  stores/                  Zustand stores (usePromptStore)
  theme/                   design tokens
lib/                       theme + shared utils
packages/
  shared-types/            cross-package type contract (@scribl/shared/*)
  claude-provider-adapter/ AI provider seam (direct + stub adapters, model tiering)
backend/
  cdk/                     CDK app + Scribl stack
  lambda/                  handlers (today-prompt, submit, channel-responses, identity) + data layer
  seeds/                   seed data
tests/                     jest specs (data-client, submit-to-unlock, channel-isolation, provider-adapter)
decisions/                 architecture decision records (ADRs)
docs/                      supporting docs (incl. app-store compliance draft)
.claude/                   generated Claude Code harness (see below)
```

## Run the app (one command)

```bash
# one-time setup
cp .env.example .env
npm install
cd backend && npm install && cd ..

# run everything
npm run dev
```

`npm run dev` starts the local Postgres, the API on `:8787`, and the web app on
`:8081` together. It:

1. brings up local Postgres via **docker-compose** (`npm run db:up`, blocks until healthy),
2. seeds the DB (`db:bootstrap` + `db:prompts`, both idempotent - safe to re-run),
3. runs the API and web dev server concurrently.

The app **requires** the API: it talks to the live API over HTTP
(`EXPO_PUBLIC_API_MODE=http` against the local Postgres-backed API). Without the API
running, the UI shows a connection error. `npm run dev` handles all of this; run it
and open the web app.

Docker is required for the local database (`postgres:15` on host port `5433`).

```bash
# quality gates
npm run typecheck  # tsc --noEmit
npm run lint       # expo lint
npm test           # jest
```

### Native device feel

```bash
npm run ios        # iOS simulator
npm run android    # Android emulator
```

These start the Expo app only - start the API separately (`cd backend && npm run api`)
and point the device at your host's `:8787`.

### AWS deploy path (not local dev)

The production backend deploys to AWS serverless (Lambda + API Gateway) via AWS CDK.
This is the deploy path, not local dev:

```bash
cd backend
npm install
npx cdk synth      # synthesize the CloudFormation template
npx cdk deploy     # deploy (requires AWS creds)
```

The backend exposes the daily-loop API (`GET /prompt/today`, submit, channel-responses,
identity) over a DynamoDB single-table design. See [`backend/README.md`](backend/README.md)
for both the local Postgres flow and the AWS path.

## The harness (`.claude/`)

The harness under [`.claude/`](.claude/) - skills, agents, hooks, settings, and LSP
config - was **generated by HarnessBuilder, not hand-written**. It encodes this
project's conventions so agents build consistently:

- **agents/** - specialized builders (`rn-builder`, `backend-builder`, `ai-service-builder`, `test-author`, `adr-author`, `code-reviewer`).
- **skills/** - project capabilities (`skia-native-module`, `claude-provider-adapter`, `submit-to-unlock-invariant`, `channel-isolation-testing`, `async-ai-pipeline`, `app-store-compliance`).
- **hooks/** - guardrails (invariant-guard, secrets-scan, worktree-guard, advisory-checks, verify-reminder).

Rationale: [`decisions/PADR-0001-vibe-code-behind-generated-harness.md`](decisions/PADR-0001-vibe-code-behind-generated-harness.md).

## Status

**POC - foundation (B2 base scaffold).** The monorepo, data seam, canvas seam, backend
skeleton, provider adapter, and test wiring are in place. The daily-loop user stories
(S-001..S-008: prompt, canvas, submit-to-unlock, wall + reactions, streak, web/device
parity, live provider) build on top of this foundation.
