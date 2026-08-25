---
type: research
title: "Research note: Scribl D2C engagement approach"
description: Engagement-level framing for the Scribl D2C mobile-app build -- why it matters, what is being built, and the phase plan.
tags: [scribl, engagement, ai-sdlc]
date-ingested: 2026-06-30
---

<!-- source: scribl engagement project inputs, reference/engagement-approach.md (engagement source-of-record deliverable) -->
<!-- date-ingested: 2026-06-30 -->

# Research note: Scribl D2C engagement approach

Ingested from the Scribl engagement approach draft (2026-06-09, David and Rob).
This is the engagement-level framing for the Scribl D2C mobile-app build.

## Why the engagement matters

Threefold output: (1) a shipped consumer app validating Scribl's D2C thesis,
(2) a reference implementation proving the AI-SDLC methodology in production,
(3) a public reference story fundable by Anthropic (deep Claude integration) and
potentially AWS (consumer-scale architecture, code coaching already active).

## What is being built

Full iOS + Android D2C app on AWS, powered by Claude, public launch target
September 15, 2026. Feature scope per PRFAQ and BRD: daily Claude-powered prompt,
creative response (drawing, text, voice), submit-to-unlock, four private channels,
emoji reactions, streaks and progression, push habit loop, analytics layer,
premium tier.

## Engagement phases

- Phase 0 Discovery and requirements (wks 1-2): PRFAQ and BRD to engineering-ready
  backlog via AI-SDLC; PKB set up for Scribl; ADRs; risk register.
- Phase 1 Design and architecture (wks 2-4): mobile design system, UX flows, AWS
  architecture (with AWS code coaching), Claude integration spec, security model.
- Phase 2 Build sprint (wks 4-14): five vertical habit-loop streams plus premium
  seam; ARC agents on review, test gen, PR analysis; PKB live from day one.
- Phase 3 Beta and launch (wks 14-16): internal alpha, 500-1,000 user beta, store
  submission with two-week buffer, public launch Sept 15.
- Phase 4 Stabilization (wks 16+): 30-day support, board retention report (Oct),
  Q4 roadmap hand-off.

## Team shape (Bounteous)

On-spec arrangement, headcount to be finalized internally. Roles: Engagement
Lead / PM, UX/Product Designer, Mobile Engineer(s), Backend/API Engineer,
AI/Claude Integration Engineer (the differentiator), DevOps/AWS, QA.

## Strategic angles

- Anthropic funding and public reference (deep Claude product integration plus
  Claude Code-native delivery team).
- AWS co-investment beyond the already-funded code coaching.
- Bounteous methodology proof point: a documented case study with velocity,
  quality, and cost-efficiency data.

## Timeline pressure

14 weeks to a hard Sept 15 launch. Critical path risks: App Store review (submit
by Sept 1), Claude integration complexity (lock scope before week 4), enterprise
scope creep (consumer-only MVP), discovery gaps (reserve two full weeks).
