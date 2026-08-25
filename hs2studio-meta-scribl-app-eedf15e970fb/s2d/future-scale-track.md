---
title: "Future scale track (NOT MVP)"
project: scribl
updated: 2026-07-27
---

# Future scale track (NOT MVP)

**Nothing on this page is in the MVP sprints.** This page exists for one
reason: so the MVP architecture in /production-backend-plan does not foreclose
any of it. It collects the growth targets, the event-scale demo bar, the
multi-region rollout, and the deferred-service ladder in one place, with the
gaps named honestly.

## The growth bar (model inputs, not forecasts)

The target cost model's registered-user curve. These are **assumptions the
model was built on**, not forecasts or commitments:

| Milestone | Registered users | DAU (25% of registered) |
|-----------|------------------|--------------------------|
| Month 6 | 100k | 25k |
| Month 12 | ~1M | 250k |
| Month 30 | 5M | 1.25M |

MAU is modeled at 45% of registered. DAU share is the single largest swing
factor in the whole model.

## The December re:Invent demo bar

Re-anchored at the 2026-07-14 kickoff workshop: the aspirational proof point
is the AWS re:Invent keynote (~2026-12-05), where the ask is to spin up a wall
and share it with an audience of thousands up to ~100k people submitting to a
SINGLE wall (~100k concurrent).

**State this plainly: this is the largest unaddressed architectural gap in the
corpus.** Earlier event-mode numbers were 2,000 concurrent; nothing in the
cost model or the target architecture covers a 100k-concurrent single-wall
burst. A past comparable product degraded around 50-60 participants per wall.

Candidate directions -- design work to schedule, **not decisions**:

| Direction | Sketch |
|-----------|--------|
| Fan-out/broadcast | WebSocket API or AppSync subscriptions to push wall updates instead of 100k clients polling |
| Cached wall reads | CloudFront-cached wall snapshots so reads never hit the origin per-client |
| Write buffering | SQS or Kinesis between submit and the store to absorb the burst; the wall renders from the drained stream |
| Pre-aggregated wall tiles | Server-composed tile/mosaic renders so the client never fetches 100k individual media objects |

## Multi-region rollout as designed

The target model's sequence: **us-east-2 (primary, plus dev/stage) -> eu-west-2
(London) ~month 13 -> ap-southeast-1 (Singapore) ~month 25.** CloudFront routes
each user to the nearest active region.

- **Replicates per region:** the prod stack -- EKS (or its serverless
  equivalent), Cognito user pool, Aurora, S3 media.
- **Stays global/primary-only:** Route 53, WAF, CloudFront at the edge;
  dev/stage and the analytics/ML data lake stay in us-east-2.
- **Regional premiums:** London ~8%, Singapore ~18% vs Ohio; only the traffic
  share served there carries the premium.
- **The gap to solve first: region-homed users.** Per-region Cognito pools and
  per-region Aurora with no cross-region replication story means a user's
  account and walls live in one region. A family wall spanning continents, or
  a traveler, has no defined behavior in the target design. This must be
  designed before region two goes live.

## The scale-up service ladder

When and why each deferred piece turns on:

| Piece | Trigger |
|-------|---------|
| EKS migration | Sustained baseline load makes always-on compute cheaper than Lambda, or long-lived connections (event-mode fan-out, AI pipeline warmth) demand a persistent tier; revisit the ADR-0002 divergence flag at that point |
| ElastiCache (Redis) | Read amplification on hot walls/streaks that CloudFront caching cannot absorb |
| OpenSearch | A real search surface (content/user search) or log analytics beyond CloudWatch |
| Data lake (S3 + Glue + Athena + SageMaker) | Month-13 gate in the target model; mental-health outcomes research workstream, with consent and de-identification work outside the infra model |
| SNS + Pinpoint push | Managed push replaces the local daily reminder (future RE-11 work, trim T5) |
| Bedrock switch | Config flip on the provider seam (ADR-0009) if AWS co-funding or in-VPC data-path requirements land that way |
| Warehouse vs PostHog | ADR-0008 is under review: lead with PostHog, build the Kinesis -> S3 -> Athena warehouse only when a question arises that the SDK cannot answer |

## The AI cost curve reality

In the 30-month target model, **AI is ~69% of the total TCO** (~$2.45M total).
Within AI spend at 5M users: Sonnet vision (drawing read/caption) ~78%, Haiku
moderation ~22%, Opus daily prompt generation <0.1% (~150 calls/mo -- the
universal prompt is essentially free). The spend scales with how many people
draw, which is the engagement the product wants to pay for; but it means AI
cost control is THE cost program, not a line item.

Cost-control playbook levers (per ADR-0011 tiering and the technical
implementation plan section 9):

- **Prompt caching** on the shared daily-prompt/system context (cache reads
  ~0.1x input).
- **Batch API** (50% off) for everything async: vision runs off-queue anyway
  (ADR-0010), so it batches.
- **Model tiering:** Haiku for moderation, Sonnet for vision, Opus only for
  the once-a-day prompt.
- **Sampling/throttling** the non-gating AI work under cost pressure --
  possible only because AI is async and off the critical path.
- **Token discipline:** modest image resolution for canvas drawings, bounded
  prompt context, output caps.

## What the MVP must not foreclose (checklist)

- [ ] **Stateless API** -- no server affinity, so the compute tier can change
      (Lambda -> containers) without a client change.
- [ ] **Thin data-access layer** -- keeps the DynamoDB hot-path option open
      (ADR-0004).
- [ ] **Provider seam** -- Direct Anthropic API -> Bedrock by config, never a
      rewrite (ADR-0009).
- [ ] **Media on S3/CloudFront from day 1** -- never in the database, so edge
      delivery and regional replication stay possible.
- [ ] **Vector-serialized artwork** -- strokes stored as vectors alongside the
      PNG, so stroke playback (RE-F9) stays possible.
- [ ] **Event-mode seam kept in the API surface** -- the WS event channel stays
      a documented seam even though event mode is out of the MVP.
- [ ] **Analytics events versioned** -- a typed, versioned taxonomy so a future
      warehouse can replay history.

## Pointers

- The MVP profile this track builds on: /production-backend-plan
- The future epics RE-F1..F9 (challenge mode, AI enhancement, AI prompt gen,
  federation, premium, community stats, event mode/multi-region/warehouse,
  enterprise, stroke playback): /expo-rebuild-epics
