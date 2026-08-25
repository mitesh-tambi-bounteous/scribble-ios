---
name: async-ai-pipeline
description: Use when wiring drawing interpretation or moderation into the submit flow; runs Claude work async off an SQS queue so submit and unlock stay instant and the core loop survives an AI outage.
metadata:
  type: skill
---

# async-ai-pipeline

Claude work (drawing interpretation, moderation-as-enhancement) runs
asynchronously off an SQS queue. Submit never blocks on AI. The user submits
and unlocks immediately; the Claude reflection arrives shortly after as a
non-blocking update.

Traces to ADR 0010 (drawing interpretation and moderation run async; submit
never blocks on AI). Related to ADR 0011 (model tiering) and the cost model
(AI sampling/throttling).

## What this skill enforces

1. Submit is on the critical path; AI is not. The submit Lambda writes the
   submission, applies the submit-to-unlock gate, and returns. It does NOT
   call Claude inline.
2. AI work is enqueued, not awaited. Submit drops a message on SQS; a separate
   worker (Lambda for the POC slice) consumes it, calls the provider adapter,
   and writes the reflection back as an update to the response item.
3. Eventual-consistency UX is explicit. The reflection appears after the
   submission. The client must handle the later update (poll or refetch);
   absence of a reflection is a normal transient state, not an error.
4. Resilient and throttleable. An AI outage or backlog must not break submit or
   unlock. Work can be sampled or throttled under cost pressure without
   breaking the core loop (ADR 0010).

## Concrete steps

- Submit Lambda: write submission, enforce AC2 gate, enqueue an SQS message
  carrying (userId, promptId, responseId, drawing ref), return success.
- Worker Lambda: triggered by SQS, calls describe_image (Sonnet) for the
  drawing reflection and moderate (Haiku) per ADR 0011 via the provider
  adapter, then patches the response item with the result.
- Client: render the submission and unlocked feed immediately; show a pending
  state for the reflection and reconcile when the update lands.
- A moderation fail policy is required (fail-open vs fail-safe per content
  type); treat it as an explicit decision, not a silent default (ADR 0010).

## Test shape

- Submit does not block on AI: assert the submit handler returns success
  without invoking the provider adapter inline (adapter is called only by the
  worker). Stub SQS and assert a message was enqueued.
- Unlock independent of AI: simulate the worker failing or being slow; assert
  submit-to-unlock still succeeds and the feed is readable.
- Reflection arrives async: run the worker against an enqueued message; assert
  the response item is patched with a reflection afterward.

## Done when

Submit returns and unlock holds without any inline Claude call, AI work is
consumed from SQS by a separate worker that patches the response later, and the
core loop still works when the worker is down.
