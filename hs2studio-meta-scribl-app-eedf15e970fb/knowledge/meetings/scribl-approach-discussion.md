---
date: 2026-06-09
type: meeting
meeting_kind: internal
title: Scribl approach discussion
description: Internal David + Rob call on team model, Claude integration assessment, Anthropic pitch framing, and the open Bedrock question.
attendees: [David Lawton, Rob Forshier II]
duration_min: 26
date-ingested: 2026-06-30
---

<!-- source: scribl engagement project inputs, reference/discussions/scribl-approach-digest.md and scribl-approach.vtt transcript (engagement source-of-record deliverable) -->
<!-- date-ingested: 2026-06-30 -->

# Meeting digest: Scribl approach discussion

**Meeting date:** 2026-06-09
**Participants:** David Lawton, Rob Forshier II
**Source:** Scribl approach call transcript (.vtt), ~26 minutes, reliable speaker
attribution. Original digest and the verbatim transcript are preserved under
s2d/inputs/reference/discussions/.

## What was discussed

### Session goals

Three goals handed down by Marty: (1) figure out the Anthropic funding channel
with Scribl as the vehicle; (2) use Scribl to prove the ARC methodology
end-to-end, structured in partnership with Anthropic and AWS; (3) give Marty a
methodology and team model, not a financial structure (David and Rob own the
approach, Marty sets the price). Economic structure and funding terms explicitly
deferred.

### Team positioning

Marty wants an aggressive, minimal team: "here is what we can deliver in a short
time with a minimal team," as the methodology proof point. Both agree scope is
doable; posture is lean and fast.

### Claude integration assessment

Candid read: Claude inside the app is light outside standard usage. The two real
value areas: (1) vision model for drawing analysis and response (the most
compelling product-side use case, ideally Claude); (2) standard LLM calls for
prompts and moderation. Voice can be done on-device (no cloud API). The bigger
Claude story is development-side: Claude Code drives the entire build and the team
is the high-volume consumer.

### Anthropic pitch framing

Like AWS MAP funding: do not argue "Claude over OpenAI." Map the Claude services in
use and projected token spend; Anthropic computes ROI. The deliverable is a list of
all Claude touchpoints (product and dev side) with projected usage at target scale.
Do not add Claude features for their own sake.

### Bedrock question (open and urgent at the time)

AWS will likely want Claude on Bedrock as a co-funding condition. David's worry:
possible Claude feature loss on Bedrock (unverified). Rob's counter: has used
Claude Code with Bedrock without issues, "just swapping the backend," but notes
prompt caching can break if tooling mutates prompt headers. Not resolved; needed a
clear answer before the Friday AWS call (2026-06-13).

### Other threads

Claude Design (claude.ai/design) as a faster-than-Figma discovery tool the design
team already uses. Prototype-as-discovery is the right fit for Shape (build an HTML
prototype, demo, convert reactions to requirements). A slash-command idea for the
arc-ideation repo, using Scribl as the template engagement. Urgency: a three-way
AWS partner call; Marty wants the collaborative David + Rob perspective ready
before it.

## Decisions made

- Lead with an aggressive/minimal team model (David).
- Anthropic pitch framing: services used + expected spend (MAP model) (David + Rob).
- Do not add Claude features not grounded in the product (David + Rob).
- Prototype-as-discovery is the right approach for Shape (David + Rob).
- Document the Bedrock question before the AWS call (David).

## Suggested action items

Humans promote these to tracking/stories/ manually; they are not auto-created.

- Draft team model and methodology structure; send to Rob for review (David,
  same day 2026-06-09).
- Review engagement docs (client summary, engagement approach, team model draft)
  and give feedback (Rob, same day 2026-06-09).
- Investigate Bedrock vs Direct Anthropic API feature parity; get a clear answer
  before the AWS call (David, before 2026-06-13).
- Build a list of all Claude touchpoints with projected token spend for the
  Anthropic funding narrative (David + Rob, before the AWS call).
- Get Rob access to Claude Design if not already active (David, 2026-06-10).
- Draft the Anthropic funding case document, MAP-style (David, before the AWS call).
- Consider building a slash command in arc-ideation for client engagement setup,
  with Scribl as the template (Rob, backlog).
