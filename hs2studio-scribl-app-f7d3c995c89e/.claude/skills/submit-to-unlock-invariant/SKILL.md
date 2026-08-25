---
name: submit-to-unlock-invariant
description: Use when reviewing the channel-responses read path, the submit endpoint, or code gating seeing others' art on submitting; enforces submit-to-unlock as a server-side transactional check, not UI-only.
metadata:
  type: skill
---

# submit-to-unlock-invariant (launch-blocking)

Enforces the core scribl mechanic: a user cannot read any other user's
response for a prompt until their own submission for that prompt is recorded.
This is an invariant of the system, not a property of the client.

Traces to AC2 (submit-to-unlock data-layer invariant) and ADR 0007
(submit-to-unlock enforced at the data/API layer). Launch-blocking.

## What this skill enforces

1. The gate lives in the backend, not the app. The channel-responses read
   path (Lambda behind API Gateway) authorizes every read against the
   submission record before returning any peer content.
2. The check is transactional: a single conditional read against DynamoDB
   that asks "does a submission item exist for this (user, prompt)?" The read
   returns peer responses only when that item exists. No cached or eventual
   variant (ADR 0007 rejects eventual enforcement: it opens a race window).
3. The client MUST NOT be the enforcement point. A Zustand store flag or a
   hidden screen is not the gate. The app may hide the feed for UX, but the
   API returns 403 regardless of what the client sends.

## Concrete steps

- Submit endpoint writes a submission item keyed by (userId, promptId) before
  returning success. Submit is the only thing that creates that item.
- Read endpoint for channel responses does a point lookup on that key first.
  Missing item -> return HTTP 403 (not 200 with empty body, not 404). Present
  item -> return the peer responses.
- Keep the read composite (prompt + submission-status in one path) to hold the
  added authz check off the latency budget (ADR 0007 risk note).

## Test shape (for the test-author agent)

- Read-before-submit denied: as user A with no submission for prompt P, call
  GET channel-responses for P. Assert HTTP 403 and that no peer response bodies
  appear in the payload.
- Read-after-submit succeeds: user A POSTs a submission for P, then GETs
  channel-responses for P. Assert HTTP 200 and peer responses are returned.
- Bypass attempt: craft the read request directly against the API (no app),
  with any client-supplied "unlocked" flag set true. Assert still 403 when no
  submission item exists. Proves the gate is server-side, not client-trusted.
- Per-prompt scope: a submission for prompt P1 does NOT unlock prompt P2.
  Assert read of P2 responses is 403 while only P1 is submitted.

## Done when

The read path returns 403 with no submission and 200 with one, the decision is
made entirely server-side against the DynamoDB submission item, and the bypass
test (client flag spoofed) still returns 403. All four tests above pass in B3.
