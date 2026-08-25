---
title: "Production backend plan -- single-region MVP"
project: scribl
updated: 2026-07-27
---

# Production backend plan -- single-region MVP

The backend for the production rebuild (see the sprint plan and /expo-rebuild-epics),
deliberately scoped to a single AWS region: us-east-2 (Ohio). This page is the
MVP profile; everything deferred lives in /future-scale-track.

## Framing: two designs, one target

Two backend designs exist in the corpus:

1. **The cloud VP's target architecture** (multi-region, EKS-based, Bedrock-fronted;
   see the POC architecture reference under `s2d/inputs/reference/poc/architecture/`
   and the Future Architecture (AWS) context page). It is the 30-month,
   3-region, 5M-user destination and the basis of the cost model.
2. **The technical implementation plan's serverless delivery plan**
   (API Gateway + Lambda, Aurora Serverless v2), which is what ADR-0002
   (serverless-first) records.

The MVP profile is the **serverless single-region cut of the same target**. It
honors ADR-0002 and keeps the target's service seams (edge, auth, relational
system of record, S3 media, async lanes) so the full design remains the
scale-up destination, not a discarded alternative.

> **Flagged divergence for team review: EKS vs Lambda.** The target runs the
> application tier on EKS; ADR-0002 and this MVP run it on Lambda. Both cannot
> be "the architecture" forever. The MVP proceeds on Lambda (right cost shape
> for spiky diurnal traffic, near-zero team ops); the EKS migration trigger is
> defined in /future-scale-track. This divergence needs explicit sign-off.

## The MVP stack (us-east-2, dev + prod)

| Service | Role in the MVP |
|---------|-----------------|
| Route 53 + CloudFront | DNS and edge delivery for API and media; single origin region |
| API Gateway + Lambda (Node/TS) | The entire request/response API; autoscales to the daily prompt herd, costs near zero overnight |
| Aurora Serverless v2 (PostgreSQL) | Relational system of record (users, channels, memberships, prompts, submissions, reactions) per ADR-0004 |
| RDS Proxy | Connection pooling between Lambda and Aurora; non-negotiable at the daily spike |
| S3 media + CloudFront signed URLs | All drawing media; signed URLs scoped to channel membership, no media bytes in Postgres |
| Cognito user pool | Email + username + password ONLY; no federation (that is RE-F4) |
| EventBridge + SQS | Present as thin seams only (prompt rollover, future async AI lane per ADR-0010); no heavy consumers in MVP |
| CDK TypeScript stacks | All infrastructure as code per ADR-0005; dev + prod environments, staging deferred |
| CloudWatch + X-Ray | Baseline observability: logs, alarms, sampled traces |
| PostHog | Product analytics (activation, prompt funnel, submit, share); the warehouse stays deferred per ADR-0008-under-review |

> **Flagged implementation choice: Cognito vs own credential store.** The MVP
> directive is backend-managed email/username/password. Recommendation is a
> Cognito user pool (no rolled-own password storage); an own credential store
> in Aurora is the noted alternative. Team review item (sprint-spec trim T4).

## Deliberately NOT in the MVP (all scale-up, see /future-scale-track)

| Deferred piece | One line |
|----------------|----------|
| EKS | Target application tier; MVP runs Lambda instead (flagged divergence above) |
| ElastiCache (Redis) | Always-on cache baseline; nothing in MVP needs it |
| OpenSearch | Search + log analytics; no search surface in MVP |
| Analytics/ML data lake (S3 + Glue + Athena + SageMaker) | Research workstream, gated to ~month 13 in the target model |
| SNS + Pinpoint managed push | MVP ships a LOCAL daily reminder only (trim T5) |
| WAF beyond defaults | Target puts WAF in front of CloudFront; MVP takes platform defaults |
| Multi-region | Target adds eu-west-2 ~month 13 and ap-southeast-1 ~month 25; MVP is us-east-2 only |
| Reserved/standby DR line | Explicit launch-readiness headroom in the cost model; not carried in MVP |
| Bedrock | The Claude provider seam defaults to Direct API, Bedrock by config (ADR-0009) |

**No AI lanes run in the MVP at all.** The automated moderation pass (Haiku),
drawing vision/interpretation (Sonnet), and AI prompt generation (Opus) are all
future (RE-F2/RE-F3 and the moderation fast-follow, trim T7). Daily prompts
come from a seeded rotating curated set served through the same fetch contract
AI prompts will use later (trim T11). Safety in MVP is the human path: report,
block/mute, takedown queue, account deletion.

## Load-bearing invariants the backend enforces

- **Submit-to-unlock, server-side.** Channel reads return 403 until a
  submission row exists for (user, prompt), enforced as a transactional
  EXISTS check in Postgres, never in the UI (ADR-0007). Bypass-attempt tests
  are required CI gates.
- **Channel isolation as a privacy gate.** A response in channel A is never
  visible from channel B; membership authz on every channel read. An isolation
  failure is a privacy breach, not a bug.
- **Thin data-access layer.** All storage access goes through one thin layer
  so a hot path could move to DynamoDB later without a rewrite; DynamoDB
  stays a documented forward-scale option, not the default (ADR-0004).

## Team shape

The whole backend workstream -- architecture, CDK/AWS infrastructure and
backend services -- is ONE person (the Backend Lead, three hats). The sprint
plan is sequenced for that single thread: infrastructure-as-code and the
schema land in Sprint 1, service endpoints ride the established rails after,
and QA owns the invariant gates so the lead is never the test bottleneck.
Sprint 3 is the lead's peak; the Personal Archive story is the marked release
valve (capacity flags in /production-sprint-backlog).

## Known risks

| Risk | Handling |
|------|----------|
| Lambda -> Aurora connection exhaustion at the daily prompt herd | RDS Proxy from day 1; load-test the herd before beta (ADR-0004 risk register) |
| Region-homed data when multi-region comes | The target design runs per-region Cognito pools and per-region Aurora with NO cross-region replication story -- a real gap for a global daily prompt (whose wall is where?). Single region sidesteps it for now; it must be solved before region two (see /future-scale-track) |

## Cost note

The target model's month-1 run rate is ~$9.1k/mo, of which ~$8.9k is a non-AI
floor dominated by always-on ElastiCache, OpenSearch, EKS clusters (three
environments) and the reserved/standby line. The serverless single-region MVP
cut removes that floor: no clusters, no always-on cache/search, two
environments, pay-per-request compute. Order of magnitude, expect low hundreds
of dollars per month at beta scale; the technical implementation plan's
checkpoint math lands ~$265/mo of AI spend at 1k DAU, and the MVP runs zero AI,
so infra alone is the bill. Treat these as directional, not budget lines.

## Multi-region as a scale-up step

Nothing above forecloses the target: the edge is already global
(Route 53 + CloudFront), the API is stateless, media is on S3/CloudFront from
day 1, and the provider and event seams are in place. When growth or the
re:Invent event bar demands it, the rollout sequence, the service ladder, and
the gaps to solve first (region-homed users, 100k-concurrent walls) are laid
out in /future-scale-track.
