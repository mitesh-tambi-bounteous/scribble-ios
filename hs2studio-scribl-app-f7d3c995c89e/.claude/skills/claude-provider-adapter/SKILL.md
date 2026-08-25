---
name: claude-provider-adapter
description: Use when integrating Claude for prompt generation, drawing vision, or moderation; routes all Claude access through one provider abstraction (generate / moderate / describe_image), Direct API default.
metadata:
  type: skill
---

# claude-provider-adapter

All Claude access goes through one internal provider-abstraction layer, never
through the SDK directly from feature code. The POC default is the Direct
Anthropic API. The host is a config value, not a code path.

Traces to AC8 (provider swappable by config) and ADR 0009 (provider-abstraction
layer, Direct API default).

## What this skill enforces

1. One seam, three operations: `generate` (text), `moderate` (classify),
   `describe_image` (vision). Feature code (prompt gen, drawing interpretation,
   moderation) calls only these. No feature imports the Anthropic SDK directly.
2. Adapters sit behind the seam. The POC ships the Direct Anthropic API adapter
   and is wired so a Bedrock or Claude-Platform adapter could drop in later
   without touching feature code (production target uses Bedrock; out of POC
   scope but the seam must not assume Direct).
3. Provider selection is config. An env var / config value picks the adapter at
   startup. Switching it requires no app-code change (AC8 check).
4. Model tiering lives behind the seam (ADR 0011): Opus 4.8 for daily prompt
   generation, Sonnet 4.6 vision for drawing interpretation, Haiku 4.5 for
   moderation. Callers ask for an operation; the layer maps it to the tier.

## Concrete steps

- Define the three operations as a small typed interface in the AI service.
- Implement one Direct Anthropic API adapter behind it; read the API key and
  model ids from config, not literals scattered in feature code.
- Centralize per-call token logging (input, output, cache-read, cache-write)
  here, since this is the one home for model selection and cost (ADR 0009).
- Keep request shapes clean and adapter-agnostic so a future Bedrock adapter
  preserves prompt caching (ADR 0009 risk note).

## Test shape

- Config swap: set the provider config to a stub/fake adapter and run a
  `generate` call. Assert the feature code path is unchanged and only the
  configured adapter handled the call. Proves swappable-by-config (AC8).
- Tier mapping: assert `generate` for the daily prompt resolves to Opus,
  `describe_image` to Sonnet vision, `moderate` to Haiku.
- No direct SDK import: grep feature modules; assert none import the Anthropic
  SDK directly (only the adapter does).

## Done when

Feature code calls only generate / moderate / describe_image, the Direct
Anthropic adapter is the configured default, flipping the provider config to a
stub requires zero app-code change, and tier mapping matches ADR 0011.
