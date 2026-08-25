---
type: research
title: "Research note: Scribl client summary"
description: Pre-engagement opportunity brief covering what Scribl does, the D2C MLP opportunity, and the partnership structure.
tags: [scribl, client-brief, d2c]
date-ingested: 2026-06-30
---

<!-- source: scribl engagement project inputs, reference/client-summary.md (engagement source-of-record deliverable) -->
<!-- date-ingested: 2026-06-30 -->

# Research note: Scribl client summary

Ingested from the Scribl client summary (2026-06-09). Pre-engagement opportunity
brief. CEO: Matt Kaplan.

## What Scribl does

Creativity platform with an existing enterprise motion (facilitated workshops and
team events). The D2C initiative is a net-new consumer growth engine to prove
daily habit formation, viral growth, and monetization at consumer scale; the proof
points needed for the next fundraise. Positioning: "AI powers everything else.
Scribl empowers people." AI generates the prompt; humans make the art. Anti-noise,
anti-algorithm, pro-human expression.

## The D2C opportunity (MLP)

Daily creative practice app inspired by Wordle, NYT Games, BeReal. Core loops:
daily universal Claude prompt, constrained creative response (drawing / text /
voice), submit-to-unlock, four private channels (Personal Archive, Family,
Friends, Co-Workers), lightweight emoji reactions, streaks and progression, push
notifications, AI personalized follow-ups (stretch).

## Partnership structure

- Bounteous: primary build partner, on-spec (economic participation deferred, not
  T&M).
- Anthropic: AI infrastructure (Claude for prompt gen, moderation, future
  conversational features).
- AWS: cloud infrastructure and CDK; code coaching funded and active.

## Tech stack (per PRFAQ)

Mobile iOS (Swift) + Android (Kotlin) with React Native shared component layer;
AWS backend via CDK; Anthropic Claude API; WebSocket for event mode; AES-256 at
rest, TLS in transit, CloudTrail audit. Scale target: daily habit traffic plus
enterprise event-mode spikes up to 2,000 concurrent per event.

## Business context

Fundraise story rests on D2C MLP retention curves (available October 2026) for the
October-December 2026 angel pitch window. Enterprise flywheel: D2C adoption
pre-sells enterprise customers (active pilots include EY, CVS/Aetna, Go Health).
Scribl cash investment roughly $70K (agentic architecture validation $50K, GTM
$15-20K; AWS code coaching funded separately).

## Key success metrics

DAU 1,000 by end of beta; 10,000 by 90 days; Day 7 retention >=40%; prompt
completion >=70%; social share rate >=60%; viral K-factor >=1.0 at 90 days;
free-to-paid conversion 5-10% over 30 days.

## Source documents referenced

The BRD (D2C MVP scope PDF), the full PRFAQ (DOCX), and the D2C user-flow wireframe
(PNG); all preserved verbatim under s2d/inputs/.
