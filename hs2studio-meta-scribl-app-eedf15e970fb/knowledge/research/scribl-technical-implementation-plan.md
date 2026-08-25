---
type: research
title: "Research note: Scribl D2C technical implementation plan"
description: Build sequence, repository and tooling choices, build streams, and AI cost model for the Scribl D2C app.
tags: [implementation-plan, monorepo, scribl]
date-ingested: 2026-06-30
---

<!-- source: scribl engagement project inputs, reference/technical-implementation-plan.md (engagement source-of-record deliverable) -->
<!-- date-ingested: 2026-06-30 -->

# Research note: Scribl D2C technical implementation plan

Ingested from the technical implementation plan (draft, 2026-06-10). Turns the
architecture into a build sequence, story-level backlog, and AI cost model.
Assumes a lean team (~6.0 FTE, two Mobile Engineers) running AI-SDLC with Claude
Code as the volume engine.

## Timeline

Shape (wks 1-2): interactive prototype, week-1 spikes (Skia canvas on cheap
Android; clickable "would you do this daily" test), locked backlog, finalized
architecture, PKB configured. Build (wks 3-12): beta-quality MLP across five
vertical streams. Beta + Launch (wks 13-14): alpha, 500-1,000 beta, store
submission Sept 1, public launch Sept 15. Evolve (wks 15+): stabilization, board
retention report (Oct), retrospective. Critical path: store submission by Sept 1.

## Repository and tooling

Single monorepo (apps/mobile React Native, services/api Node Lambdas, services/ai
Python on Fargate, packages for shared-types / analytics-events / claude-client,
infra CDK). Expo + EAS dev build with config plugins; Aurora Serverless v2 +
Prisma; PostHog for analytics; pnpm workspaces; Claude Code as primary dev tool;
Claude Design for screens in Shape, Figma for spec of record.

## Build streams

Stream 0 Foundations (CDK, Cognito auth, Aurora, media storage, Claude client
package with one hardened adapter, event taxonomy + PostHog, observability,
CI/CD); A Auth and onboarding; B Daily prompt and creative response (the core
loop); C Social channels and reactions; D Streaks and progression; E Push habit
loop; F Admin/analytics/moderation. Premium tier is a conditional seam. Out of MLP:
agentic follow-ups, AI archive search, collective artifact, enterprise admin/SSO,
Slack/Teams, marketplace.

## Submit-to-unlock

Server-side precondition: channel-read returns 403 unless a submission row exists
for (user, prompt), a transactional EXISTS check in Postgres.

## AI services, cost, and token consumption

Model tiering and list pricing: Opus 4.8 for daily prompt generation ($5/$25 per
1M in/out), Sonnet 4.6 for drawing vision ($3/$15), Haiku 4.5 for moderation
($1/$5). Cost levers: prompt caching (cache reads ~0.1x input), Batch API (50%
off), right-sized models. Submission mix assumed 60% drawing / 30% text / 10%
voice; voice transcribed on-device (text-path moderation only).

Monthly product-side cost projections (list): ~$265/mo at 1,000 DAU beta;
~$2,050-2,150/mo at 10,000 DAU with caching; ~$10,500/mo at 50,000 DAU. AI cost is
dominated by drawing interpretation (Sonnet vision), not prompt generation; the
universal-prompt design keeps the most "AI-feeling" feature essentially free.

Dev-side Claude (Claude Code across ~5-7 engineers) is the largest single
Anthropic line item during build, captured separately for the funding narrative.

Anthropic funding narrative input is MAP-style: every Claude touchpoint
(product-side and dev-side) with projected volume and spend at target scale.

Bedrock vs Direct API: same Messages API shape, so it is a config choice behind
the provider abstraction, not a rewrite. Default recommendation is Direct
Anthropic API for cleanest caching and feature parity; switch to Bedrock or Claude
Platform on AWS if AWS co-funding or data-residency posture favors in-AWS. Note the
known cache-break issue if tooling mutates prompt headers.

## Testing, CI/CD, DoD

TDD per AI-SDLC; canvas spike on cheap Android in week 1, full real-device matrix
from week 6. Channel-isolation tests are launch-blocking (a gap is a privacy
breach, not a bug). GitHub Actions -> CDK deploy + EAS build. Launch criteria
include third-party-AI consent (Apple 5.1.2(i)) and a named moderation-queue owner
with a ~24h SLA (Apple 1.2).

## Gating decisions before build lock

Block the build until resolved: COPPA/minors in scope; agentic follow-up
MLP-or-post-launch; channel model; moderation fail policy. Resolve early but do not
block: Claude hosting, operational data store, premium timing, voice in MLP, MLP
scope cuts.
