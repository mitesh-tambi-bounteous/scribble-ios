# @scribl/provider — Claude provider-abstraction seam

Foundation package for S-008. Defines the ONE internal seam all Claude
access goes through (ADR 0009). Feature code (prompt generation, drawing
vision, moderation) imports only from `index.ts` (or the `@scribl/provider/*`
path alias) — never an adapter file, never `@anthropic-ai/sdk` directly.

## The seam

Three operations, one interface (`ProviderAdapter` in `types.ts`):

- `generate(req)` — text generation (the daily prompt).
- `describeImage(req)` — vision caption of a drawing.
- `moderate(req)` — content moderation classification.

Every adapter call returns `usage: TokenUsage` (input / output / cache-read /
cache-write tokens) and is logged via the `TokenLogger` seam (`logger.ts`) —
one home for per-call cost visibility (ADR 0009).

## Swapping providers — config only (AC8)

```ts
import { createProviderAdapter, providerConfigFromEnv } from "@scribl/provider";

const adapter = createProviderAdapter(providerConfigFromEnv());
const result = await adapter.generate({ prompt: "..." });
```

`providerConfigFromEnv()` reads `CLAUDE_PROVIDER` (default `"stub"`),
`ANTHROPIC_API_KEY`, and `AWS_REGION` from the environment.
`createProviderAdapter` is the ONLY place that branches on provider kind:

| `CLAUDE_PROVIDER` | Adapter                | Status                                                                 |
|--------------------|-------------------------|-------------------------------------------------------------------------|
| `stub` (default)   | `adapters/stub.ts`     | Deterministic mock responses, no network. Boot default.                |
| `direct`           | `adapters/direct.ts`   | **Live.** Official `@anthropic-ai/sdk`, authenticates via `ANTHROPIC_API_KEY`. |
| `claude`           | `adapters/direct.ts`   | Alias of `direct` — same adapter, same behavior.                        |
| `bedrock`          | `adapters/bedrock.ts`  | **Live.** `AnthropicBedrockMantle` (`@anthropic-ai/bedrock-sdk`), SigV4 via the AWS credential chain, `anthropic.`-prefixed model ids. |
| `platform`         | —                       | Reserved seam (ADR 0009); throws, not implemented in POC.               |

Flipping `CLAUDE_PROVIDER` requires zero changes to call sites — that's the
AC8 contract this package exists to prove.

`stub` stays the boot default so the app starts with zero external deps and
no key/creds required. Live providers are opt-in via `CLAUDE_PROVIDER`.

## Model tiering (ADR 0011)

One mapping, in `model-tiers.ts`, swappable in one place:

| Operation        | Tier          | Declared model id   |
|-------------------|---------------|-----------------------|
| `generate`        | Opus          | `claude-opus-4-8`    |
| `describeImage`   | Sonnet vision | `claude-sonnet-5`     |
| `moderate`        | Haiku         | `claude-haiku-4-5`   |

Confirmed current Anthropic model catalog ids (ADR 0011 tiers: Opus 4.8,
Sonnet 5 vision, Haiku 4.5). These are bare first-party ids — the Bedrock
adapter prepends `anthropic.` itself; nothing else needs to change.

Call sites never hardcode a model id. They call an operation; the seam
resolves the tier via `modelForOperation(operation)`.

## Enabling a live provider

Copy the repo-root `.env.example` to `.env` (git-ignored, never commit real
secrets) and set:

- `CLAUDE_PROVIDER=direct` (or `claude`) + `ANTHROPIC_API_KEY=<your key>` for
  the Direct Anthropic API.
- `CLAUDE_PROVIDER=bedrock` + `AWS_REGION=<region>` (plus AWS creds via the
  standard chain — env vars, profile, or IAM role) for Bedrock. No Anthropic
  API key is used on this path.

Both live adapters are **server-side only** — never construct them in
client/browser code, and never let `ANTHROPIC_API_KEY` or AWS credentials
reach the Expo bundle. Each SDK (`@anthropic-ai/sdk`, `@anthropic-ai/bedrock-sdk`)
is imported lazily and only from its own adapter file
(`adapters/direct.ts`, `adapters/bedrock.ts`), so nothing heavy is statically
reachable from `@scribl/provider`'s public surface.

`stub` remains the boot default — the app always starts with zero external
deps and no key/creds required; live providers are strictly opt-in via
`CLAUDE_PROVIDER`.

## Async / submit-path note (ADR 0010)

This package only defines the seam. Callers (drawing interpretation,
moderation) MUST invoke it off the async queue, never on the submit
critical path — that wiring lives in the backend/AI-service layer, not here.

## Layout

```
types.ts            ProviderAdapter interface + request/response shapes
model-tiers.ts       operation -> tier -> model id (ADR 0011), modelForOperation()
logger.ts            TokenLogger seam (console + no-op implementations)
factory.ts            createProviderAdapter(config), providerConfigFromEnv()
adapters/stub.ts      deterministic mock adapter (POC/boot default)
adapters/direct.ts    Direct Anthropic API adapter (live, official SDK)
adapters/bedrock.ts   AWS Bedrock adapter (live, AnthropicBedrockMantle)
adapters/_messages.ts shared content/usage/moderation-verdict helpers (no SDK import)
index.ts              public surface — import only from here
```
