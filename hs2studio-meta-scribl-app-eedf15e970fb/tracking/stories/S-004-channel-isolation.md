---
id: S-004
title: Channel isolation
status: done
owner: unassigned
stage: B2
phase: B
project: scribl
labels: [daily-loop, invariant, launch-blocking]
---

# S-004 -- Channel isolation

Responses and walls are scoped to their channel. A response submitted in one
channel does not appear on another channel's wall.

**Shipped** in commit `f434420` (#8): server-side membership authz in
`channel-responses.ts` via `getMembership`, scoped per channel id. Test
`tests/channel-isolation.test.ts` verifies cross-channel read is denied (403)
and isolation holds. Dedicated skill doc at `.claude/skills/channel-isolation-testing/SKILL.md`.

## AC

- [x] Each response is associated with exactly one channel id at submit time.
- [x] The channel wall for channel A returns only responses whose channel id is A.
- [x] Switching channels reloads the wall scoped to the newly selected channel.
- [x] A test asserts a response posted to channel A is absent from channel B's wall.
