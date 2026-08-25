---
type: research
title: "Research note: Scribl D2C team model and architecture shape"
description: Lean ~6.0 FTE team configuration running AI-SDLC, how the team runs, and the resulting architecture shape.
tags: [team-model, ai-sdlc, scribl]
date-ingested: 2026-06-30
---

<!-- source: scribl engagement project inputs, reference/scribl-team-model.md (engagement source-of-record deliverable) -->
<!-- date-ingested: 2026-06-30 -->

# Research note: Scribl D2C team model and architecture shape

Ingested from the team model draft (2026-06-10). Lean ~6.0 FTE configuration
running AI-SDLC with Claude Code as the primary dev tool for every engineer; 14
weeks to the Sept 15 launch.

## Team

Engagement Lead, PM, Engineering Lead (React Native architecture, Claude pipeline,
final code-review call), Mobile Engineer 1 (creative response, Skia canvas),
Mobile Engineer 2 (auth, channels, notification client), Backend/API Engineer,
DevOps/AWS, UX/Product Designer (exits early Build, week 6), QA. The second Mobile
Engineer is in the core team, not the ceiling, because mobile is the real
parallelism bottleneck. Full-build ceiling adds an AI/Claude Integration Engineer
(1.0 FTE in Build) if agentic follow-ups land in MLP scope (~7.0 FTE at peak).

## How the team runs

Shape deliverable is a working interactive prototype, not a requirements document;
two week-1 spikes (Skia canvas on cheapest Android; clickable core-loop test). PKB
configured for Scribl. Build runs five parallel vertical streams with two Mobile
Engineers; real-device testing from week 6; store compliance from week 11. Beta
iterates prompt/notification if Day-7 retention < 30%. Evolve sustains ~3.0 FTE.

## Architecture shape

React Native (iOS + Android) with native modules only where required (Skia canvas,
secure storage, push, on-device STT) on Expo dev build. API Gateway + Lambda
(Node/TS) behind CloudFront, Cognito auth with Apple/Google. A persistent Python
AI service (ECS Fargate) owns all Claude calls behind a provider abstraction.
Aurora Serverless v2 (PostgreSQL) as operational system of record; S3 media via
CloudFront with membership-scoped signed URLs. EventBridge for the daily prompt
scheduler and habit loop; SQS so submit never waits on AI; Pinpoint + SNS for
push. PostHog for MLP analytics; warehouse deferred.

## Key decisions (all Proposed)

React Native primary; serverless-first with a separate persistent AI service;
Aurora Serverless v2 operational store (DynamoDB as forward-scale option); AWS CDK;
submit-to-unlock at data/API layer; one hardened Claude adapter behind an
abstraction; async drawing interpretation and moderation; model tiering (Opus
prompt, Sonnet vision, Haiku moderation); voice transcribed on-device with no audio
to Claude in MLP; product-analytics SDK as system of record, warehouse deferred.

## Design principles

Product comes first, Claude follows; submit-to-unlock is a data-layer invariant;
privacy by channel; Claude is optional and degrades gracefully; cost scales with
engaged users, not registered users.

## Recommendations

Tighten MLP scope (cut enterprise event mode, lead with PostHog, cut/iOS-only
voice). De-risk early (two week-1 spikes, design the cold-start first session,
validate the loop before build lock). Keep the build lean (one Claude adapter,
Aurora Serverless v2). Protect the launch (third-party-AI consent surface, named
moderation owner with a response SLA, channel-isolation tests launch-blocking).

## Decisions needed

Block the build: COPPA/minors scope; agentic follow-up MLP-or-post-launch; channel
model; moderation fail policy. Resolve early without blocking: Claude hosting,
operational store confirmation, premium timing, voice scope, MLP scope cuts and the
2,000-concurrent scale-target inconsistency.
