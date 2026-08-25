# Scribl — Client Workspace

Orientation for Claude working in `clients/scribl/`. Read this first, then open the file that matches the task.

## What this engagement is

Scribl is an **on-spec** Bounteous build of a Direct-to-Consumer (D2C) mobile app: a daily creative-practice product (iOS + Android) on AWS, powered by Claude, targeting **public launch September 15, 2026** (beta August). It doubles as the first end-to-end reference implementation of the ARC AI-SDLC methodology and a Claude/Anthropic funding-narrative case study.

For the full business context (CEO, partnership structure, success metrics, timeline), read [`client-summary.md`](client-summary.md). It is the single orientation doc for "what is Scribl and why."

## Where to start, by task

| If you are asked to... | Read / edit |
| --- | --- |
| Understand the client, the deal, the timeline | [`client-summary.md`](client-summary.md) |
| Work on system architecture (mobile, AWS, Claude, data, security) | [`architecture-plan.md`](architecture-plan.md) |
| Work on the build sequence, backlog, AI cost model | [`technical-implementation-plan.md`](technical-implementation-plan.md) |
| Change or add an architecture decision | [`decisions/`](decisions/) — see rules below |
| Understand or revise the team / staffing model | [`scribl-team-model.md`](scribl-team-model.md) |
| Understand the Bounteous engagement framing (on-spec, methodology goals) | [`engagement-approach.md`](engagement-approach.md) |
| Find open questions awaiting David + Rob (or Scribl/Anthropic) alignment | [`discussion-topics.md`](discussion-topics.md) and architecture §16 |
| Reference the original client requirements | [`Initial source docs/`](Initial source docs/) — treat as read-only source of truth |

## File map

```
clients/scribl/
├── README.md                          # this file
├── clientsummary.md                   # client orientation: deal, metrics, timeline, stack
├── architecture-plan.md               # system architecture (16 sections, ADR index, risks, open Qs)
├── technical-implementation-plan.md   # build sequence, 6 streams, API sketch, AI cost model
├── engagement-approach.md             # Bounteous on-spec framing + methodology goals
├── scribl-team-model.md (+ .html)     # staffing model (~5.0 FTE), role seams
├── discussion-topics.md               # open alignment topics for David + Rob
├── decisions/                         # ADRs 0001-0011 + README index (all Proposed)
├── discussions/                       # meeting digests + raw VTT
│   ├── 2026-06-09-scribl-approach-digest.md
│   └── Scribl approach.vtt
└── Initial source docs/               # client-provided BRD, PRFAQ, wireframe (READ-ONLY)
```

A generated HTML overview lives at [`../../output/scribl-engagement-overview.html`](../../output/scribl-engagement-overview.html) (local-only, regenerate with `/arc-overview`).

## How the two plans relate

`architecture-plan.md` and `technical-implementation-plan.md` are **companion documents and must stay in sync.** The architecture plan defines *what the system is*; the implementation plan turns it into *how and when we build it*, plus the cost model. Both share:

- The same scope baseline: **lean MLP, extension-ready.** Consumer features only. Enterprise admin, SSO, Slack/Teams, Booster Pack marketplace, agentic follow-ups, and the Q1 2027 "Exciting Artifact" are explicitly out of MLP and called out as **seams** (built so they drop in later without rework).
- The same 11 ADRs (architecture §14 ↔ `decisions/`).
- The same open questions (architecture §16 ↔ implementation §12 ↔ `discussion-topics.md`).

If you change one, check the other for the matching section. Do not let the ADR index, the scope statement, or the open-questions list drift between them.

## Load-bearing decisions (do not silently reverse)

These are stated as architecture principles and ADRs. Treat them as binding unless explicitly asked to reopen one:

1. **Product comes first; Claude follows the product.** No Claude features for their own sake. Claude earns its place in three spots only: prompt generation (Opus), drawing interpretation (Sonnet vision), moderation (Haiku).
2. **Submit-to-unlock is a data-layer invariant** (ADR-07), enforced server-side, not a UI rule.
3. **Claude is always optional and degrades gracefully** — the core habit loop survives a Claude outage.
4. **Provider-agnostic Claude access** (ADR-09): one abstraction, Direct API default, Bedrock and Claude Platform on AWS selectable by config. The Direct-vs-Bedrock decision is deliberately deferred and must not block the build.
5. **AI runs async** (ADR-10): submit never waits on Claude.
6. **Model tiering** (ADR-11): Opus prompt gen / Sonnet vision / Haiku moderation. Cost is dominated by drawing interpretation, not prompt generation.

When working anywhere in this folder, follow the ARC OSS rule (MIT/Apache 2.0, OTel forward-compat) and the no-em-dashes writing rule.

## Working rules for this folder

- **`Initial source docs/` is read-only.** It is the client's BRD, PRFAQ, and wireframe. Never edit; cite it.
- **ADRs:** all 11 are currently **Proposed**. They become **Accepted** only when David + Rob confirm (and where noted, Matt Kaplan or the AWS conversation). Use `/new-adr` to add one; update `decisions/README.md` and the architecture §14 index together. Six open questions are tracked in `decisions/README.md` and are *not yet ADRs* — do not promote one to an ADR without a recorded decision.
- **Status banners matter.** The plans are "Draft v1 for internal review (David + Rob)." Keep that until told otherwise; do not mark anything final on your own.
- **Meeting digests** go in `discussions/` following the repo's sync-digest voice rules (active, decision-led, action items as a table). Raw VTTs sit alongside.
- This is an ideation/planning workspace, not the Scribl codebase. The repo structures under `apps/`, `services/`, `infra/` described in the implementation plan are the **proposed build layout**, not files that exist here.
