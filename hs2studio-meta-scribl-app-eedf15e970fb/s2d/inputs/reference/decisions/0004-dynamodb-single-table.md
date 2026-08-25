# ADR 0004: Aurora Serverless v2 (PostgreSQL) as system of record

**Status:** Proposed (revised 2026-06-10 — reverses the earlier DynamoDB single-table decision)
**Date:** 2026-06-10
**Deciders:** David Lawton, Rob Forshier II
**Related:** [../architecture-plan.md](../architecture-plan.md) §5, §9; [0007](0007-submit-to-unlock-data-layer.md), [0008](0008-analytics-separate-pipeline.md)

## Context

The operational access patterns are: get today's prompt and a user's submission status, write a submission (enforcing submit-to-unlock atomically), list a channel's responses for a prompt, list a user's channels and memberships, read/write streak state, append reactions. Analytics runs on a separate path (see [0008](0008-analytics-separate-pipeline.md)), so the operational store does not need to serve heavy analytical joins.

Two facts drove a reversal of the earlier draft (DynamoDB single-table):

1. **The access patterns are not yet frozen.** The channel model is an open decision (fixed four channels vs user-creatable, and whether a response can be shared to multiple channels at once). Multi-channel share changes the key design materially. DynamoDB single-table requires modeling access patterns up front and is expensive to re-shape; committing to it before the channel model is frozen is the wrong sequencing.
2. **The DynamoDB scale argument does not hold at this product's scale.** The daily "thundering herd" is overwhelmingly reads of the day's prompt, served from CloudFront and never touching the operational store. The writes (one submission per active user, clustered in a release window) are tens/sec at 10k DAU and low hundreds at 50k DAU — trivial for a relational store.

## Decision

We will use **Aurora Serverless v2 (PostgreSQL)** as the operational system of record for the MLP. The data-access layer is kept thin so a specific hot path could move to another store later without a rewrite. **DynamoDB (single-table) is retained as a documented forward-scale option, not the default.**

Rationale, decided on the merits of this product at this scale (not on individual team experience):

- The domain is relational (users, channels, memberships, prompts, submissions, reactions). Submit-to-unlock is a clean transactional `EXISTS` precondition; multi-channel share is a join table; channel feeds are indexed queries.
- An evolving access model (open channel-model decision) is far cheaper to absorb in a relational schema than in single-table DynamoDB.
- Aurora Serverless v2 autoscales capacity and scales down between spikes, so the team is not running a database fleet — the zero-ops benefit is not exclusive to DynamoDB.

## Alternatives considered

### Option A: DynamoDB single-table (the earlier draft decision)
- Pros: single-digit-ms reads at very large scale; on-demand autoscaling; submit-to-unlock maps to a conditional write.
- Cons: access patterns must be modeled up front and are expensive to re-shape; the channel model is not frozen; the scale advantage is not needed in the relevant window.
- Why not chosen now: premature optimization for a scale this MLP does not reach, against an unfrozen data model. Retained as the documented forward-scale path.

### Option B: DynamoDB multi-table
- Pros: simpler per-entity mental model than single-table.
- Cons: more round trips for composite reads; still key-value-shaped against a relational domain.
- Why not chosen: relational fit and schema flexibility favor Postgres for the MLP.

## Consequences

### Positive
- Schema flexibility while the channel model and other access patterns are still being decided.
- Transactional submit-to-unlock and natural joins for channel/membership/reactions.
- Autoscaling capacity without managing instances.

### Negative
- Connection management from Lambda needs care (RDS Proxy or a data API) to avoid connection exhaustion at the daily spike.
- A future very-large-scale tier may want a key-value hot path; the thin data-access layer is what keeps that option open.

### Risks to monitor
- Lambda-to-Aurora connection pressure at the release-window spike. Mitigation: RDS Proxy; load-test the herd before beta.
- A genuinely key-value-shaped hot path emerging at scale. Trigger: move that slice to DynamoDB behind the data-access layer.

## Related
- [0002](0002-serverless-first-backend.md), [0007](0007-submit-to-unlock-data-layer.md), [0008](0008-analytics-separate-pipeline.md)
