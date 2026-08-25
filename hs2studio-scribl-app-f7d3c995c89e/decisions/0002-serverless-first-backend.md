# ADR 0002: Serverless-first backend; Fargate for the AI pipeline

**Status:** Proposed
**Date:** 2026-06-10
**Deciders:** David Lawton, Rob Forshier II
**Related:** [../architecture-plan.md](../architecture-plan.md) §5

## Context

Consumer habit traffic is spiky and diurnal: a universal daily prompt means everyone opens the app near the same release time, creating a daily thundering herd, then near-zero load overnight. Enterprise event mode adds short bursts of up to 2,000 concurrent users. The team is lean and has funded AWS code coaching for CDK.

## Decision

We will build the request/response API on **API Gateway + Lambda** (Node/TypeScript) and run the **Claude AI pipeline as a persistent ECS Fargate service** (Python). Because Lambda autoscales to the daily spike and costs nothing overnight, while the AI pipeline benefits from connection reuse and prompt-cache warmth that a persistent service provides and per-request Lambdas do not.

## Alternatives considered

### Option A: Always-on container fleet (ECS/EKS) for everything
- Pros: predictable latency; no cold starts.
- Cons: pays for idle capacity overnight; more ops for a lean team.
- Why not chosen: wrong cost shape for diurnal consumer traffic.

### Option B: Lambda for everything, including AI calls
- Pros: one compute model.
- Cons: loses connection reuse and prompt-cache warmth; long Claude calls fit awkwardly in the request path.
- Why not chosen: the AI pipeline is long-running and async by design (see [0010](0010-async-ai-pipeline.md)).

## Consequences

### Positive
- Cost scales with traffic; the overnight bill is near zero.
- The AI service is isolated, so AI latency and outages do not touch the core loop.

### Negative
- Two compute models to operate (Lambda + Fargate).
- Lambda cold starts at the very start of the daily spike; mitigated by provisioned concurrency / pre-warm on the read path.

### Risks to monitor
- Daily-spike cold-start latency; watch p95 open-to-prompt time.

## Related
- [0003](0003-ai-pipeline-separate-service.md), [0004](0004-dynamodb-single-table.md), [0010](0010-async-ai-pipeline.md)
