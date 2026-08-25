---
name: channel-isolation-testing
description: Use when reviewing channel routing, membership, or any read path returning channel-scoped responses; enforces response visibility is authorized server-side by membership and proven by isolation tests.
metadata:
  type: skill
---

# channel-isolation-testing (launch-blocking)

Enforces that a response routes only to the channel(s) the submitter selected,
and that channels stay isolated across users. Membership is authorized
server-side; a non-member cannot read a channel's responses.

Traces to AC4 (channel isolation) and ADR 0007 (server-side authz, related).
Launch-blocking.

## What this skill enforces

1. Channel membership is checked in the backend (Lambda), not inferred by the
   client. Every channel-scoped read authorizes the caller against the
   channel's membership before returning any response in that channel.
2. A response is visible only in the channel(s) its author selected on submit.
   Selecting channel C1 must not leak the response into C2.
3. Isolation composes with submit-to-unlock: a caller must BOTH have submitted
   (AC2) AND be a member of the channel (AC4) to read peer responses there.

## Concrete steps

- On submit, persist the selected channel id(s) on the response item; default
  to nothing leaking beyond the explicit selection.
- Channel-responses read endpoint resolves the caller's membership for the
  requested channel first. Non-member -> HTTP 403. Member -> proceed (then the
  submit-to-unlock check still applies).
- Model membership so a point lookup answers "is this user a member of this
  channel?" cheaply (DynamoDB membership item keyed by channel + user).

## Test shape (for the test-author agent)

- Non-member read denied: user B who is not a member of channel C calls GET
  channel-responses for C. Assert HTTP 403 and no response bodies in payload.
- Member read allowed: user A is a member of C and has submitted for the
  prompt. GET channel-responses for C returns A's peers in C with HTTP 200.
- Cross-channel non-leak: user A submits a response selecting only channel C1.
  A member of C2 (who has submitted) reads C2. Assert A's response does NOT
  appear in the C2 payload.
- Membership not client-trusted: craft the read directly against the API with a
  spoofed "member" claim in the client payload while no membership item exists.
  Assert still 403. Proves authz is server-side.

## Done when

A non-member channel read returns 403, a member read returns 200, a response
selected for one channel never appears in another, and the spoofed-membership
request still returns 403. All four tests above pass in B3.
