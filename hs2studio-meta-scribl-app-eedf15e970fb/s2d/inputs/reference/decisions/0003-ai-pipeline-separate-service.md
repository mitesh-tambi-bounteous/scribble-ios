# ADR 0003: AI pipeline is a separate service, not inline in request Lambdas

**Status:** Proposed
**Date:** 2026-06-10
**Deciders:** David Lawton, Rob Forshier II
**Related:** [../architecture-plan.md](../architecture-plan.md) §5, §7

## Context

Claude work in Scribl (prompt generation, drawing interpretation, moderation) has different latency, scaling, and dependency characteristics than the CRUD API. It also carries the provider-abstraction logic and prompt-cache state that we want to keep in one place.

## Decision

We will isolate all Claude work in a dedicated AI Service (Python, Fargate) that the core API and async workers call through internal interfaces. Because it lets the AI surface evolve, scale, and fail independently of the user-facing API, and concentrates the provider abstraction and caching in one component.

## Alternatives considered

### Option A: Call Claude inline from API Lambdas
- Pros: fewer moving parts.
- Cons: couples AI latency to the user's request; spreads provider logic and keys across many handlers; loses cache warmth.
- Why not chosen: violates the "submit never blocks on AI" principle.

### Option B: One Lambda per AI task
- Pros: serverless consistency.
- Cons: no connection reuse or cache warmth; cold starts on the most latency-sensitive calls.
- Why not chosen: persistent service is the better fit for sustained Claude traffic.

## Consequences

### Positive
- Single home for the provider abstraction, model selection, caching, and token-cost logging.
- AI can degrade gracefully without affecting the core loop.

### Negative
- One more deployable service.

### Risks to monitor
- Service becomes a bottleneck under the daily spike; mitigated by SQS buffering (see [0010](0010-async-ai-pipeline.md)) and Fargate autoscaling.

## Related
- [0009](0009-claude-provider-abstraction.md), [0010](0010-async-ai-pipeline.md), [0011](0011-model-tiering.md)
