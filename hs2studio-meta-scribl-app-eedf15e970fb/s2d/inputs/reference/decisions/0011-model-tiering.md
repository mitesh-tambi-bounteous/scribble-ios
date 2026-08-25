# ADR 0011: Model tiering — Opus for prompt gen, Sonnet for vision, Haiku for moderation

**Status:** Proposed
**Date:** 2026-06-10
**Deciders:** David Lawton, Rob Forshier II
**Related:** [../architecture-plan.md](../architecture-plan.md) §7, [../technical-implementation-plan.md](../technical-implementation-plan.md) §9

## Context

The three product-side Claude touchpoints have very different volume and quality profiles. Prompt generation happens once per day for everyone and is quality-critical. Drawing interpretation is per-submission and needs vision. Moderation is per-submission and high-volume, where latency and cost matter most. Using one model for all three would either overpay on moderation or underserve prompt quality.

## Decision

We will tier the models: **Opus 4.8** for daily prompt generation, **Sonnet 4.6 (vision)** for drawing interpretation, **Haiku 4.5** for content moderation. Because matching model strength to each task's volume and quality profile minimizes cost without compromising the quality-critical, low-volume path (the daily prompt) or the differentiating one (drawing interpretation).

## Alternatives considered

### Option A: Single model (e.g., Sonnet) for everything
- Pros: one integration.
- Cons: ~5x overpay on moderation (the highest-volume call) vs Haiku; or underserved prompt quality if the single model is cheaper.
- Why not chosen: tiering is materially cheaper at scale with no quality loss.

### Option B: Haiku for vision too
- Pros: cheaper drawing calls.
- Cons: the drawing reflection is the headline Claude feature; it warrants Sonnet's quality.
- Why not chosen: under-serves the differentiator.

## Consequences

### Positive
- AI spend dominated by the feature we want to pay for (engaged drawing), not by prompt generation.
- Cost levers (prompt caching, Batch API, async sampling) apply per tier.

### Negative
- Three model integrations to maintain (all behind the same provider abstraction, so the cost is low).

### Risks to monitor
- Moderation quality on Haiku for edge content; mitigated by escalating flagged items and a golden-set regression eval.

## Related
- [0009](0009-claude-provider-abstraction.md), [0010](0010-async-ai-pipeline.md)
