---
title: Production backlog (starter / draft)
project: scribl
target: production-MLP
status: draft
updated: 2026-07-10
---

# Production backlog -- scribl

**Starter / draft backlog for the production build -- seeds for the future Jira,
not committed scope.** This is a first-pass epic and feature inventory for the
production MLP that the POC seeds toward. It is derived from the
[full-app spec](/scribl-full-app-spec) feature set (sections 4.1 -- 4.8,
"Out-of-POC seams", "Open Decisions") and the production research notes
([production AWS architecture and TCO](/knowledge/research/scribl-poc-aws-architecture)
and [technical implementation plan](/knowledge/research/scribl-technical-implementation-plan)).
It is intentionally coarse: epics
with candidate features, meant to be triaged, sized, and split by the delivery
team, not treated as final scope. POC stories (`S-0xx`) that seed each epic are
referenced where they apply.

## EPIC-01 -- Accounts & Auth

Intent: move from POC local credential validation to real, federated identity
with profiles and privacy controls. Seeds from S-010, S-011.

- Cognito user pools per region with federated sign-in (Apple, Google) and
  email/password fallback; resolves Open Decision E.
- User profile, display name, avatar, and account settings.
- Third-party-AI consent capture at onboarding and content opt-in/opt-out for
  model training (verify against current app-store data-use and AI-disclosure
  guidelines).
- Account lifecycle: sign-out/sign-in round-trip, delete-account and data export.

## EPIC-02 -- Daily Prompt at Scale

Intent: generate one universal, editorially gated prompt per day for all users,
worldwide, from the top-tier model. Seeds from S-001.

- Opus-tier daily prompt generation behind an editorial approval gate before
  publish.
- Async prompt-generation lane (EventBridge -> SQS -> workers) that publishes the
  day's prompt ahead of each region's local morning.
- Prompt caching and a rotating fallback set so a generation failure never leaves
  a day without a prompt.
- Per-user submission-status read that scales (has the caller submitted today).

## EPIC-03 -- Creative Capture & Media Pipeline

Intent: production-fidelity draw / text / voice capture with a durable media
pipeline. Seeds from S-002, S-012, S-013.

- Skia canvas hardening across the real-device matrix; fixed palette, single
  brush, capture/serialize to stored artwork.
- Voice note capture with transcription-to-caption on submit (typed caption wins
  if present) and playback; resolves Open Decision B (on-device vs cloud STT).
- Media pipeline: S3 storage with CloudFront signed-URL delivery, thumbnails,
  and retention.
- 140-character text mode with server-side validation.

## EPIC-04 -- Social Channels & Isolation

Intent: the four-channel private model (Personal Archive, Family, Friends,
Co-Workers) with launch-blocking server-side isolation. Seeds from S-004, S-016,
S-022; resolves Open Decision D.

- Four-channel model with membership, roles, and per-channel walls.
- Invitation-only membership: invite-by-email resolve-or-create, no public
  discovery, no strangers.
- Channel isolation enforced server-side (a response in channel A never surfaces
  in channel B) with isolation regression tests treated as a privacy gate.
- Submit-to-unlock as a transactional existence check per (user, prompt) at the
  data layer.

## EPIC-05 -- Reactions & Progression

Intent: the social currency and the habit mechanics that make the practice
stick. Seeds from S-005, S-006, S-014.

- Standardized sentiment-emoji reactions available only post-unlock; resolves
  Open Decision C (emoji vs star-rating coexistence, self-reaction rules).
- Streak engine: increments on same-day submit, resets on a missed day,
  timezone-correct.
- Milestone badges at 7 / 30 / 100 days and aggregate participation stats.
- Personal Archive: the user's own creation history with a week view.

## EPIC-06 -- Push & Messaging

Intent: the re-engagement loop via managed push, replacing POC-local
notifications (spec 4.6, out-of-POC seam).

- SNS -> Pinpoint managed push with timezone-aware daily-prompt scheduling.
- Quiet hours and per-user notification preferences (at minimum on/off).
- Momentum nudges: streak-at-risk and channel/friend-activity notifications.

## EPIC-07 -- AI Pipeline & Moderation

Intent: the async inference and moderation backbone with model tiering behind a
provider abstraction. Seeds from S-008.

- Async AI lane (EventBridge -> SQS -> workers) for vision-read/caption and
  moderation so inference never blocks submit.
- Model tiering: Sonnet vision on drawings, Haiku moderation on the text path,
  Opus for prompt generation.
- Content-moderation queue with a named owner and a defined review SLA and
  fail policy (app-store UGC review guidelines expect prompt action on reported
  content; confirm the current turnaround requirement).
- Provider abstraction hardened for a Bedrock-fronted Claude adapter behind the
  same Messages-API shape (config choice, not a rewrite).
- Per-enhanced-image cost tracking: record the Claude (describe) and image-model
  (OpenAI / Bedrock) spend per enhanced artifact and roll it up per user and per
  day, so enhancement cost is observable before scaling. Mirrors the Mission
  Cloud POC's per-stage `pipeline_report.md`. See
  [Our enhancement pipeline](/context/pages/reference/poc/architecture/our-enhancement-pipeline).

## EPIC-08 -- Creative Challenges

Intent: grow the additive challenge line on top of the base daily practice; AI
prompts, judges, and commentates but is never the artist (spec 4.8). Seeds from
S-020.

- Blind draw-off extended with tournament brackets, family/friend leaderboards,
  and rematch.
- Guess-the-drawing (Pictionary-style) with family and/or AI-vision guessing.
- Themed challenge packs, adaptive prompts, and speed/constraint challenges.
- Streak-unlocked challenge types tied to progression.

## EPIC-09 -- Platform, Infra & Observability

Intent: the multi-region AWS platform, system-of-record data tier, delivery
pipeline, and the observability plus cost controls that keep it healthy and
affordable (production AWS seam).

- CDK-provisioned multi-region platform (Route 53 -> WAF -> CloudFront -> ALB ->
  EKS per environment), launching us-east-2 and expanding to eu-west-2 and
  ap-southeast-1.
- Aurora Serverless v2 as relational system of record, with DynamoDB for
  high-velocity data, ElastiCache Redis, and OpenSearch.
- Analytics data lake (S3 -> Glue -> Athena, plus SageMaker), gated on after
  Year 1; product analytics (PostHog) from launch.
- CI/CD (GitHub Actions -> CDK deploy + own-CI native build, no EAS),
  observability (CloudWatch, Managed Prometheus/Grafana, X-Ray), and AI cost
  controls (prompt caching, Batch API, right-sized models).

## EPIC-10 -- iOS & Android Platform Delivery

Intent: take the shared Expo / React Native codebase to store-quality native
apps on both platforms via separate per-platform work streams, since each side
needs its own native modules, store process, and device tuning. Grounds in
ADR-0001 (React Native primary, native modules only where required).

- iOS work stream: Apple developer setup, native modules (Skia, audio capture,
  push), App Store submission and review (UGC moderation and data-use
  disclosures), TestFlight beta.
- Android work stream: Play Console setup, native modules, Play internal/closed
  testing tracks, Play submission and review.
- Per-platform UI/UX tuning: safe-area/notch handling, haptics, gesture and
  keyboard behavior, platform navigation conventions, and dark mode.
- Device matrix and performance tuning: draw-canvas performance across the real
  iPhone and Android OEM device spread, plus memory and battery profiling.
- Per-platform release engineering: signing, versioning, phased rollout, crash
  reporting, and an over-the-air update strategy (own CI, no EAS).
