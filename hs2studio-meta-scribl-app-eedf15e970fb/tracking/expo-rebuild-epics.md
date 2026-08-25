---
title: "scribl -- Expo rebuild epics"
project: scribl
type: planning
updated: 2026-07-27
---

# scribl -- Expo rebuild epics

Epic/feature dataset for rebuilding scribl in Expo from the ground up, with MVP
scope strictly separated from future scope. Derived from the functionality
inventory extracted from: `s2d/scribl-full-app-spec.md` (SPEC),
`s2d/context/documents/scribl-d2c-mvp-scope.md` (BRD),
`s2d/context/documents/scribl-d2c-mlp-prfaq.md` (PRFAQ),
`s2d/context/pages/reference/technical-implementation-plan.md` (TIP), stories
`tracking/stories/S-001..S-023`, ADRs in `s2d/inputs/reference/decisions/`, and
`tracking/production-backlog.md` (EPIC-01..10). This file does not replace
`tracking/production-backlog.md`, which tracks POC -> production epics; this
dataset scopes a ground-up rebuild. It is a planning dataset for team review,
structured so each feature row can become a story. The dataset now carries a
production sprint mapping: the sprint-planned view lives at
`tracking/production-sprint-backlog.md` (rendered at /production-sprint-backlog),
and stories map to the CMPSR Jira board.

## Scoping rules

- **MVP** = the BRD's six MVP areas (daily prompt, creative response, social
  sharing/channels, progression, push-notification habit loop, data and
  insights) plus the minimum platform, trust-and-safety and compliance work
  required to ship to the app stores.
- **Challenge mode and all its sub-features are FUTURE (post-MVP) by
  direction**, even though family challenges are implemented and pending
  review in the POC.
- **The AI enhancement pipeline is FUTURE (post-MVP)** even though it is fully
  proven in the POC: the BRD's MVP definition does not include it. Flagged for
  the team to challenge -- it is the cheapest "wow" to pull forward because
  the rebuild can port shipped code rather than build new.
- **Voice response is MVP per the BRD** (creative response = draw plus text or
  voice), but it carries open gating decision #8 (keep / cut / iOS-only). The
  TIP recommends cut or iOS-only; the BRD keeps it in. Scoped MVP here,
  gated on #8.
- POC evidence vocabulary: **shipped** (POC proved it on main; rebuild ports
  patterns), **pending review** (in an open POC PR), **stubbed** (partial or
  placeholder code exists), **spec-only** (specified, never built),
  **partial** (some sub-scope shipped, the rest not), **new** (no POC
  antecedent).

## Production MVP trim (2026-07-27)

These are deliberate LIGHT-MVP judgment calls layered on top of the scoping
rules above for the 4-sprint production plan, and every one is flagged for team
review. Where a trim conflicts with the BRD (voice T1, managed push T5, badges
T6), the trim wins for the 8-week MVP and the BRD scope moves to future.

| # | Trim | Rationale | Flag |
|---|------|-----------|------|
| T1 | Voice response -> FUTURE (was MVP-gated in dataset, decision #8) | BRD kept it; TIP recommended cut or iOS-only; brief directs trim-down | JUDGMENT CALL |
| T2 | Palette = 8 colors (half of the live build's 16) | Brief: "~half the color palette". Mockup had 6; workshop went to 16 | JUDGMENT CALL |
| T3 | Single solid-round ("point") brush + size row (6 sizes). The 3 custom brush styles AND the fill bucket -> FUTURE | Brief: "brush SIZES + single point brush only". Workshop's first sticky was "fill bucket is awesome" -- expect pushback | JUDGMENT CALL |
| T4 | Auth = email + username + password managed by the backend; NO SSO/federation (federation stays RE-F4). Recommend Cognito user pool with email/password only (no rolled-own password storage); own-credential-store noted as alternative | Brief directive | JUDGMENT CALL (implementation choice) |
| T5 | Managed push (SNS/Pinpoint, RE-11) -> FUTURE; MVP keeps a LOCAL daily prompt reminder only | BRD area 5 was MVP; push infra is heavy for 8 weeks; local reminder preserves the habit loop | JUDGMENT CALL |
| T6 | Milestone badges 7/30/100 -> FUTURE; MVP keeps streak counter + week view + stats panel | Progression was BRD MVP area 4; badges are additive polish | JUDGMENT CALL |
| T7 | Automated (Haiku) pre-publish moderation -> fast-follow FUTURE; MVP ships human-path trust and safety: report content, block/mute, takedown queue, account deletion | Apple 1.2 UGC + 5.1.1(v) still require report/block/delete at App Store review; automated scanning can follow. If the 8-week target is public App Store launch (not TestFlight), pull automated moderation back in | JUDGMENT CALL (store-gate risk) |
| T8 | Public wall ("The Wall" mockup screen, "312 strangers") -> NOT in MVP | Conflicts with the no-public-feed invariant; Open Decision D unresolved | JUDGMENT CALL |
| T9 | AI enhancement pipeline, AI prompt generation, challenge mode -> FUTURE | Already the dataset ruling (RE-F2, RE-F3, RE-F1); challenge mode FIRST among future | inherited |
| T10 | Android delivery -> FUTURE (iOS-first); web export = dev convenience, not a release target; single theme (Ink) -- theme switcher FUTURE | Brief directive + trim-down | JUDGMENT CALL (theme) |
| T11 | Daily prompt = seeded rotating curated set (same fetch contract AI prompts will use later) | RE-03 MVP scope; AI generation is RE-F3 | inherited |
| T12 | Backend = single region (us-east-2), serverless-first (API Gateway + Lambda, Aurora Serverless v2, S3 + CloudFront). Jonathan's EKS/Bedrock multi-region target = scale-up track, not MVP | Brief directive; ADR-0002 serverless-first | inherited + flagged divergence |

## MVP epics

### RE-01 App shell, navigation and design system

Full route graph clickable end to end, one Expo codebase with web + device
parity, and errors that never strand the user on a blank screen.

| Feature | Description | Source | POC evidence |
|---|---|---|---|
| Web + device parity, single codebase | One Expo codebase; web via `expo export -p web`, native via `run:ios`/`run:android`; no web/native fork, no EAS. | SPEC, S-007, ADR-0001 | shipped |
| Full route graph | Sign-up -> Tutorial -> Splash/Start -> Today's Prompt -> Draw -> Write/Record -> Home -> walls -> Family grid -> Response detail -> Share; every screen a route. | DESIGN, S-021 | partial |
| Error normalization | Raw network errors normalized to a human message plus retry; splash/home never blank on error. | S-021 | pending review |
| Bottom nav bar | Home / inbox / sparkle nav present on wall surfaces. | S-016 | spec-only |
| Settings screen | Settings affordance and screen housing notification and account preferences. | S-016, PRFAQ Q14 | spec-only |
| Per-platform UI polish | Safe area/notch, haptics, gesture and keyboard behavior, platform nav conventions, dark mode. | BACKLOG EPIC-10 | new |

### RE-02 Accounts and onboarding

A real account from first launch: sign-up, validated login, tutorial, and
profile basics. Local email/password now; federation is future (RE-F4).

| Feature | Description | Source | POC evidence |
|---|---|---|---|
| Splash / Start screen | Branded dark hero screen, wordmark, single Start button into the loop. | SPEC, S-009 | spec-only |
| Sign-up | Account-creation flow handing off to the tutorial. | SPEC 4.7, S-010 | stubbed |
| Login with real validation | Matching credentials sign in, mismatched rejected, sign-out/sign-in round-trips (POC Bug 5 fixed by design). | SPEC 4.7, S-010 | stubbed |
| Tutorial / onboarding walkthrough | Onboarding panels explaining the daily loop. | SPEC 4.7, S-011 | spec-only |
| Profile basics | Display name, account settings surface. | BACKLOG EPIC-01 | spec-only |
| Custom avatars | Create an avatar from Home. | DESIGN | shipped |

### RE-03 Daily prompt

Exactly one universal prompt per day, fetched from the backend; the client
never generates or edits it.

| Feature | Description | Source | POC evidence |
|---|---|---|---|
| Prompt-of-the-day fetch and display | One prompt per day, same for everyone, from the thin backend. | SPEC 4.1, BRD 1, S-001 | shipped |
| Submitted-state on prompt screen | Screen reflects whether the caller already submitted today. | SPEC 4.1 | shipped |
| Empty / loading / unavailable states | Defined empty state, never blank or crash. | S-001 | shipped |
| Seeded rotating prompt set | Curated seed set fetched the same way AI prompts will be (RE-F3). | SPEC 4.1 | shipped |
| Local daily prompt reminder | Local notification for the daily prompt; managed push arrives with RE-11. | SPEC 4.6, BRD 5 | spec-only |

### RE-04 Drawing canvas

Skia finger-on-glass drawing with deliberate constraints: low skill barrier is
the feature.

| Feature | Description | Source | POC evidence |
|---|---|---|---|
| Skia canvas | `@shopify/react-native-skia`; web via CanvasKit, native via Skia; smooth under quick scribble. | SPEC 4.2, S-002, ADR-0006 | shipped |
| Constrained tools | Small fixed palette, no layers, no undo spirals. | SPEC 4.2, PRFAQ Q4 | shipped |
| 16-color palette | Expanded palette added live at the workshop. | DESIGN | shipped |
| Brush set and sizes | Custom brushes and additional sizes from the workshop build. | DESIGN | shipped |
| Artwork serialization | Drawn artwork serialized for submit. | S-002 | shipped |
| Swatch selected-ring fix | Selected color swatch ring must not clip at container top (POC Bug 6). | SPEC 4.2, S-002 | new |
| Device-matrix canvas hardening | Canvas verified across a real low-end-to-flagship device spread. | TIP 7, BACKLOG EPIC-03 | new |

### RE-05 Write and voice responses

Text or voice as first-class response modes alongside drawing; mode is always
the user's choice. Voice gated on decision #8; STT provider is Open Decision B.

| Feature | Description | Source | POC evidence |
|---|---|---|---|
| Text response, 140-char cap | Short caption with visible counter, reachable from the canvas; Share -> Home. | SPEC 4.2, BRD 2, S-012 | spec-only |
| Server-side text validation | Character cap enforced server-side. | BACKLOG EPIC-03 | new |
| Voice capture, 30s cap (web) | MediaRecorder/getUserMedia capture, unit-tested in POC. | SPEC 4.2, BRD 2, S-013 | shipped |
| Voice capture, 30s cap (native) | iOS/Android recording; POC native recorder is a throwing stub. | S-013, ADR-0001 | stubbed |
| Voice submit and playback | Recording wired into submit; playback works on the response (POC Bug 1 fixed by design). | SPEC 4.2, S-013, S-017 | spec-only |
| STT transcription on submit | Transcript fills the caption only when empty; typed caption wins. Provider = Open Decision B. | SPEC 4.2, ADR-0006 | spec-only |
| Response-mode choice per day | Draw / write / speak, any day, user's choice. | SPEC 4.2, PRFAQ Q13 | partial |

### RE-06 Submit-to-unlock invariant

You cannot see today's wall until you have created; enforced at the data
layer, not the UI.

| Feature | Description | Source | POC evidence |
|---|---|---|---|
| Data-layer 403 until submission | Channel read returns 403 until a submission row exists for (user, prompt); transactional EXISTS check. | SPEC 4.1, S-003, ADR-0007, PRFAQ Q7 | shipped |
| Bypass-attempt tests | Security-layer tests proving direct routing cannot bypass the gate. | TIP 7 | shipped |
| Submit endpoint contract | Production `/submit` returning pre-signed media URL. | TIP 5 | new |

### RE-07 Channels, walls and membership

Private, invitation-only channels with server-side isolation; the wall
surfaces that make sharing feel like a family fridge, not a feed.

| Feature | Description | Source | POC evidence |
|---|---|---|---|
| Four-channel model | Personal Archive, Family, Friends, Co-Workers; invitation-only, private by default; MVP capped at 4. Gating decision #3 / Open Decision D. | SPEC 4.3, BRD 3, PRFAQ Q5 | partial |
| Channel isolation, server-side | Response in channel A never visible from channel B; membership authz per channel id; launch-blocking privacy gate with regression tests. | SPEC 4.3, S-004, ADR-0007 | shipped |
| Channel switching | Switching reloads only that channel's responses. | S-004 | shipped |
| Multi-channel share | Pick which channels receive each day's response; join-table model drives schema and unlock check. | BRD 3, ADR-0004, PRFAQ Q5 | spec-only |
| Invite by email | `POST /channels/:id/members`; caller must be a member; invitee resolved-or-created idempotently. | S-022, BACKLOG EPIC-04 | pending review |
| Invite accept flow | Invitee installs, creates account, lands in the channel; signed expiring invite link/token. | PRFAQ Q9, TIP 5 | spec-only |
| Create-wall screen | Wall creation with invite email capture. | S-022 | shipped |
| Home: Your Walls carousel | Wall cards with add-wall (+), swipe between walls, active-wall indicator. | S-014, S-015 | spec-only |
| Family wall grid | Colorful thumbnail grid with empty state; hero screen. | S-016 | spec-only |
| Response detail view | Drawing plus caption, heart/bookmark, T/play toggle, Share affordance; hero screen. | S-017 | spec-only |
| Multi-day wall history | Scroll back through previous days. | DESIGN | shipped |
| No public feed | No discovery, no followers, no strangers; resolve the POC public-wall conflict (Open Decision D). | SPEC 4.3, PRFAQ Q12 | spec-only |
| Membership management | Channel roles and member administration. | BACKLOG EPIC-04 | new |

### RE-08 Reactions

Fixed sentiment-emoji reactions as the only social currency: no comments, no
counts, no algorithm.

| Feature | Description | Source | POC evidence |
|---|---|---|---|
| Post-unlock emoji reactions | Fixed `REACTION_EMOJIS` set, gated behind unlock, persisted, consistent web + device. | SPEC 4.4, BRD 3, S-005 | shipped |
| Fixed standardized emoji set | Sentiment set defined in code; no comment threads (comments were removed at the workshop -- do not rebuild). | SPEC 4.4, BRD 3 | shipped |
| Reaction-gating invariant test | Dedicated test that reactions are impossible pre-unlock, same class as S-003/S-004 gates. | TIP 7, S-005 | new |
| Heart and bookmark affordances | Detail-screen reaction affordances. | S-017 | spec-only |
| Self-reaction rule | Whether a user can react to their own work = Open Decision C. | SPEC 4.4 | spec-only |

### RE-09 Streaks, archive and progression

The habit mechanic: streaks that are timezone-correct, an automatic personal
archive, and milestones worth keeping.

| Feature | Description | Source | POC evidence |
|---|---|---|---|
| Streak rule | +1 on a new-day submit, no double count same day, reset on miss; display matches state. | SPEC 4.5, BRD 4, S-006 | shipped |
| Timezone-correct streak engine | Day boundaries computed in the user's timezone. | BACKLOG EPIC-05 | new |
| Personal Archive ("Your Channel") | Every submission auto-saved to the user's own history. | SPEC 4.5, BRD 4, PRFAQ Q10 | spec-only |
| Milestone badges 7 / 30 / 100 | Badges at streak milestones. | SPEC 4.5, BRD 4, PRFAQ Q6 | spec-only |
| Home: Your Stats panel | Current streak, week view, aggregate "how many responded today" stat. | SPEC 4.5, S-014 | partial |

### RE-10 Sharing basics

Get a creation out of the app: share screen, native share sheet, download.

| Feature | Description | Source | POC evidence |
|---|---|---|---|
| Share screen | Terminal share surface; Share/Done returns to Home. | SPEC, S-018 | spec-only |
| Native share sheet | iOS/Android share sheet for a creation card out to messaging apps. | PRFAQ Inst. Q7 | new |
| Download affordance | Save a creation from the wall. | S-016 | spec-only |

### RE-11 Notifications habit loop

BRD area 5: the push loop that brings people back once a day.

| Feature | Description | Source | POC evidence |
|---|---|---|---|
| Push registration | APNs/FCM registration native module; managed push (SNS/Pinpoint). | TIP Stream E, ADR-0001, BACKLOG EPIC-06 | new |
| Daily prompt reminder (push) | Timezone-aware daily reminder via managed push. | SPEC 4.6, BRD 5, PRFAQ Q14 | spec-only |
| Channel activity notifications | Notify when someone in your channel responds; configurable per channel. | SPEC 4.6, BRD 5, PRFAQ Q14 | spec-only |
| Notification on/off preferences | User-controllable minimum bar; preferences endpoint (`PUT /me/notifications`), delivery time, quiet hours. | SPEC 4.6, TIP 5 | spec-only |
| Streak-at-risk nudges | Momentum-based re-engagement per BRD area 5. | SPEC 4.6, BRD 5, BACKLOG EPIC-06 | new |

### RE-12 Trust, safety and compliance

Launch-blocking app-store and privacy work; not optional for a store release.

| Feature | Description | Source | POC evidence |
|---|---|---|---|
| Pre-publish content moderation | Drawings and text/transcripts scanned (Haiku tier) before appearing in channels; fail-open vs fail-safe = gating decision #4. | SPEC, TIP 9.2, ADR-0010, ADR-0011, BACKLOG EPIC-07 | new |
| Moderation review queue | Named owner, ~24h action SLA (Apple 1.2 launch requirement). | TIP 8, BACKLOG EPIC-07 | new |
| User reporting and block/mute | Any channel member can flag content; app-store UGC requirement. | PRFAQ Inst. Q9, TIP 8 | new |
| Third-party-AI consent | Consent surface (Apple 5.1.2(i)); content never used for training without explicit opt-in. | SPEC, PRFAQ Q11 | new |
| Account deletion and data export | Delete any or all creative history; full export; GDPR/CCPA data-subject rights. | PRFAQ Q10, PRFAQ Q11, BACKLOG EPIC-01 | new |
| Encryption in transit and at rest | TLS + AES-256; region-configurable residency. | PRFAQ Q11 | new |

### RE-13 Backend and data platform

The thin-by-design platform under everything: serverless API, relational
system of record, real media storage, real infrastructure.

| Feature | Description | Source | POC evidence |
|---|---|---|---|
| Serverless API | API Gateway + Lambda request/response path. | ADR-0002, S-001 | shipped |
| Postgres system of record | Aurora Serverless v2 target; transactional EXISTS for unlock, join table for multi-channel share. Gating decision #6. | ADR-0004 | partial |
| Media pipeline | S3 storage, CloudFront signed URLs, thumbnails, retention; replaces base64-in-Postgres. | TIP Stream 0, BACKLOG EPIC-03 | new |
| Auth tokens and secure storage | Token issuance plus native secure-storage seam. | ADR-0001 | new |
| Claude provider adapter | One adapter (generate / moderate / describe_image); Direct API default, Bedrock by config; mockable. Gating decision #5. | ADR-0009, S-008 | shipped |
| Async AI lane | AI work (moderation now, enhancement later) never blocks submit. | ADR-0003, ADR-0010 | shipped |
| CDK infrastructure | All infra as CDK (TypeScript) stacks. | ADR-0005 | new |
| Environments | dev / staging / prod stacks. | ADR-0005 | new |
| One-command dev startup | `npm run dev`: local Postgres, idempotent seed, API + web together. | S-021 | pending review |

### RE-14 Quality, analytics and release

Prove it works, measure it, and ship it to both stores.

| Feature | Description | Source | POC evidence |
|---|---|---|---|
| Test pyramid | Unit, component (RNTL), device e2e (Maestro/Detox), web e2e. | TIP 7 | partial |
| Invariant test gates | Channel-isolation and submit-to-unlock regression tests as launch gates; isolation failure is a privacy breach. | TIP 7, ADR-0007 | shipped |
| Cold-start e2e harness | Two-server Playwright harness plus scripted user-walk, zero console errors. | S-021 | pending review |
| Product analytics (PostHog) | Versioned typed event taxonomy: DAU/WAU, D1/D7/D30, prompt funnel, share rate, K-factor, premium intent (BRD area 6). | BRD 6, TIP 6, ADR-0008, BACKLOG EPIC-09 | new |
| CI/CD and release engineering | Own-CI native builds (no EAS), signing, versioning, phased rollout, crash reporting, OTA strategy. | TIP 8, BACKLOG EPIC-09 | new |
| iOS store delivery | Apple developer setup, native modules, TestFlight, App Store review. | BACKLOG EPIC-10, TIP 8 | new |
| Android store delivery | Play Console, testing tracks, submission/review. | BACKLOG EPIC-10 | new |
| Load test | Daily thundering-herd load test. | TIP 7 | new |
| Baseline observability | Structured logging, dashboards, per-call model token logging. | TIP Stream 0, BACKLOG EPIC-09 | new |

## Future epics

### RE-F1 Challenge mode (explicitly post-MVP by direction)

Family challenges and the whole Creative Challenges line. The blind draw-off
is implemented and pending review in the POC (S-020), but the entire mode is
post-MVP by direction. Governing principle: AI prompts, judges, guesses and
commentates -- AI is never the artist.

| Feature | Description | Source | POC evidence |
|---|---|---|---|
| Family challenge / blind draw-off | Custom word + time limit; blind-until-reveal enforced server-side; reveal on all-submitted or deadline. | SPEC 4.8, S-020, BACKLOG EPIC-08 | pending review |
| 1-5 star rating and winner | Submitters rate post-reveal, not own entry; leaderboard ranks by average stars with tie-breaks. | SPEC 4.8, S-020 | pending review |
| Challenge e2e | Blindness and rating proven against real UI + API + DB. | S-020 | pending review |
| Tournament brackets | Draw-off extended to bracketed play. | SPEC 4.8, BACKLOG EPIC-08 | spec-only |
| Persistent leaderboards | Cross-challenge family/friend standings. | SPEC 4.8, BACKLOG EPIC-08 | spec-only |
| Rematch | Re-run with the same participants. | SPEC 4.8, BACKLOG EPIC-08 | spec-only |
| Guess-the-drawing | Pictionary-style; family and/or AI vision guess; points for fooling and guessing. | SPEC 4.8, BACKLOG EPIC-08 | spec-only |
| Themed challenge packs | AI-generated weekly themes, escalating difficulty, seasonal packs. | SPEC 4.8, BACKLOG EPIC-08 | spec-only |
| Adaptive prompts | AI tailors challenge prompts to a group's history and skill. | SPEC 4.8, BACKLOG EPIC-08 | spec-only |
| Speed / constraint challenges | Beat-the-clock, one-color, no-lift; AI scores gently. | SPEC 4.8, BACKLOG EPIC-08 | spec-only |
| Streak-unlocked challenge types | New modes unlock with progression. | SPEC 4.8, BACKLOG EPIC-08 | spec-only |
| AI drawing reflection | Encouraging, on-tone Claude vision feedback as a challenge enhancer; quality bar defined. | SPEC 4.8, TIP 7 | spec-only |

### RE-F2 AI enhancement pipeline

Proven end to end in the POC -- port, don't reinvent. North Star is
structural: user drawing bytes never reach an image model; only the
Claude-produced caption crosses that seam.

| Feature | Description | Source | POC evidence |
|---|---|---|---|
| Async enhancement trigger | Fire-and-forget off submit, never awaited; errors recorded as failed, never thrown back. | ENH, ADR-0010 | shipped |
| Describe stage | Claude vision (Sonnet) one-sentence caption of the drawing. | ENH, ADR-0011 | shipped |
| Background generation behind provider seam | Style directive plus hard negatives; `IMAGE_PROVIDER` openai or deterministic stub so CI stays green. | ENH | shipped |
| Compose stage | Original drawing composited unchanged over the background (sharp, ~80% canvas, optional shadow). | ENH, HANDOVER 4 | shipped |
| Status lifecycle | null -> pending -> ready or failed; surfaced on the channel response. | ENH | shipped |
| Client polling | Bounded attempts, silent reloads, poll-exhaustion fallback to failed. | ENH | shipped |
| Original/enhanced toggle UI | Sparkles toggle when ready; spinner while pending; unavailable state on failure. | ENH | shipped |
| Externalized tuning config | `ENHANCE_CONFIG`; re-tuning never touches handler logic. | ENH, HANDOVER 7 | shipped |
| Enhanced media to S3 | Move enhanced + original images out of Postgres text columns. | ENH | new |
| Per-image cost tracking | Claude + image-model spend per artifact, per user/day. | ENH, BACKLOG EPIC-07 | new |
| Refine loop | Claude vision review pass nudging composition; capped at one iteration. | ENH, HANDOVER 3 | new |
| Evaluation harness | Repeatable "what makes a good artifact" scoring for prompt regression tests. | HANDOVER 8, TIP 7 | new |
| User-provided drawing labels | User label replaces AI-inferred description; overlaps the 140-char caption. | HANDOVER 8 | spec-only |

### RE-F3 AI prompt generation with editorial gate

| Feature | Description | Source | POC evidence |
|---|---|---|---|
| Opus-tier candidate generation | Prompt candidates generated on Opus behind human editorial approval. | SPEC 4.1, ADR-0011, BACKLOG EPIC-02 | new |
| Async generation lane | EventBridge -> SQS -> workers; region-local morning publish. | TIP Stream B, BACKLOG EPIC-02 | new |
| Caching and rotating fallback | No day ever lacks a prompt. | BACKLOG EPIC-02 | new |
| Editorial calendar | Seasonal themes, cultural moments, inclusivity guardrails. | PRFAQ Q3 | spec-only |

### RE-F4 Federated identity

| Feature | Description | Source | POC evidence |
|---|---|---|---|
| Apple / Google / Cognito sign-in | Federation with email/password fallback; Open Decision E. | ADR-0001, TIP Stream A, BACKLOG EPIC-01 | new |

### RE-F5 Premium tier

| Feature | Description | Source | POC evidence |
|---|---|---|---|
| Archive access tiering | Free = last 30 days; premium = unlimited plus search and date filter. | PRFAQ Q2, PRFAQ Q10 | new |
| Export tools | PNG export, compilations, physical prints. | PRFAQ Q2, PRFAQ Q10 | new |
| Paywall and entitlements | Ships at launch only if Phase 0 confirms; otherwise entitlement stubbed as a seam (gating decision #7). | PRFAQ Q2, TIP | new |

### RE-F6 Community and aggregate stats

| Feature | Description | Source | POC evidence |
|---|---|---|---|
| Worldwide participation stats | Aggregate "how many responded" beyond your channels; top prompts worldwide. | PRFAQ Q6 | spec-only |
| Community highlights (opt-in) | Opt-in surfacing of standout responses. | PRFAQ Q6 | spec-only |
| Progression unlocks and recognition | Milestones unlock features and in-channel recognition. | PRFAQ Q6 | spec-only |
| Scribl Champions | Status markers, exclusive badges, early access for power users. | PRFAQ Partner Q5 | spec-only |

### RE-F7 Advanced platform

| Feature | Description | Source | POC evidence |
|---|---|---|---|
| Event mode | Real-time WebSocket broadcast up to 2,000 concurrent; out of MLP per gating decision #9. | SPEC, TIP 5 | new |
| Analytics warehouse | Kinesis -> S3 -> Glue -> Athena -> QuickSight; deferred until PostHog cannot answer a question. | ADR-0008, TIP 6, BACKLOG EPIC-09 | new |
| Multi-region production architecture | Route 53 -> WAF -> CloudFront -> ALB -> EKS, Aurora + DynamoDB + ElastiCache + OpenSearch. | ADR-0002, ADR-0004, BACKLOG EPIC-09 | new |
| Observability at scale | X-Ray/OTel, Prometheus/Grafana, CloudTrail. | TIP Stream 0, BACKLOG EPIC-09 | new |
| Second Claude adapter (Bedrock) | Bedrock-fronted Claude as a config choice, not a rewrite. | ADR-0009, BACKLOG EPIC-07 | new |
| AI cost controls | Prompt caching, Batch API, right-sized model tiering. | TIP 9.1, ADR-0011, BACKLOG EPIC-09 | new |
| Agentic personalized follow-ups | BRD-asterisked; out of MLP per TIP; gating decision #2. | BRD 5, TIP | spec-only |
| AI archive search | Out of MLP scope; seam only. | TIP | spec-only |
| Internal admin/metrics dashboard | DAU, retention, K-factor, completion. | TIP Stream F | new |

### RE-F8 Enterprise and partner

| Feature | Description | Source | POC evidence |
|---|---|---|---|
| SSO and admin portal | SAML 2.0 / OIDC, org analytics, admin thresholds, provisioning API. | PRFAQ Inst. Q2, PRFAQ Inst. Q8 | new |
| Org channel structure | Department sub-channels, visibility rules, domain-restricted invites, admin moderation, org supplemental prompts. | PRFAQ Inst. Q5, PRFAQ Inst. Q8 | new |
| Partner API and integrations | Webhooks, deep-link protocol, Slack/Teams/Discord bots. | PRFAQ Inst. Q11, PRFAQ Partner Q6 | new |
| Booster Pack marketplace and localization | Themed prompt packs, content partner program, localization. | PRFAQ Partner Q4, PRFAQ Partner Q10 | new |

### RE-F9 Stroke-vector differentiators

| Feature | Description | Source | POC evidence |
|---|---|---|---|
| Drawing playback / animation | Scribl stores every stroke as vectors; enables playback and animation no raster competitor can match. | HANDOVER 8, ENH | spec-only |

## Open decisions that gate scope

| # | Decision | Gates |
|---|---|---|
| 1 | COPPA / under-13 scope (build-blocking) | RE-02, RE-12 |
| 2 | Agentic personalized follow-ups in MLP or post-launch | RE-11 vs RE-F7 |
| 3 | Channel model: fixed four vs user-creatable; invite/membership rules; multi-channel share | RE-07 |
| 4 | Moderation fail-open vs fail-safe per content type | RE-12 |
| 5 | Claude hosting: Direct vs Bedrock vs Claude Platform | RE-12, RE-13, RE-F2, RE-F3 |
| 6 | Aurora vs DynamoDB confirmation | RE-13 |
| 7 | Premium at launch or post-launch | RE-F5 (and an entitlement stub in RE-13) |
| 8 | Voice in MLP: keep / cut / iOS-only | RE-05 |
| 9 | MLP scope cuts: event mode out, PostHog over warehouse, 2,000-concurrent inconsistency | RE-14, RE-F7 |
| B | Voice STT provider: on-device vs cloud | RE-05 |
| C | Reactions model: emoji vs star coexistence; self-reaction rules | RE-08 (stars: RE-F1) |
| D | Channel set: all four vs Family-plus-public-wall; public wall conflicts with no-public-feed principle | RE-07 |
| E | Auth fidelity: local validation now, federation later | RE-02, RE-F4 |
| F | POC vs production fidelity confirmation | RE-13, RE-14 (sets the bar for all epics) |

## Sprint mapping (production MVP, 4 x 2 weeks)

Role-loaded plan: every story carries an owning role (IOS / BE / QA / PM) and
all four roles have parallel work in every sprint. Role loads below are points
per sprint.

| Sprint | Theme | RE epics covered | Stories | IOS | BE | QA | PM |
|--------|-------|------------------|---------|-----|----|----|----|
| 1 | Foundation: repo, infra, auth, shell | RE-01, RE-02, RE-13, RE-14 | P1-01..P1-13 | 24 | 16 | 8 | 2 |
| 2 | The daily loop: prompt, draw, submit | RE-03, RE-04, RE-05, RE-06, RE-13, RE-14 | P2-01..P2-12 | 16 | 16 | 10 | 2 |
| 3 | Walls and social | RE-07, RE-08, RE-09, RE-14 | P3-01..P3-12 | 18 | 21 | 8 | 2 |
| 4 | Share out, safety, TestFlight | RE-01, RE-04, RE-10, RE-11, RE-12, RE-13, RE-14 | P4-01..P4-13 | 18 (+3 stretch) | 11 | 8 | 2 |

Future epics RE-F1..RE-F9 and the trimmed items above (T1-T12) are out of the
MVP sprints; they live on the future track.

### Team and roles

| Role tag | Who | Load | Notes |
|---|---|---|---|
| IOS | iOS Engineer (India) | full time | Builds the new Expo app repo and all client work |
| BE | Backend Lead (India) | full time | ONE person, three hats: architect + AWS/PE lead + backend developer. Owns architecture, CDK/AWS infra, and backend services |
| QA | QA Engineer (India) | full time | Owns a test-infrastructure workstream from Sprint 1 (under RE-14): per-feature test plans, E2E/device testing on iOS, release gates |
| PM | Rob (NA) at 50% | half time | Plays PM until a Product Manager is staffed. Desired NA add: Dan Hill (PM/lead, per Jonathan) to pair with Rob |

Everyone except Rob is in India; plan ceremonies inside the NA/India overlap
window. Capacity flags (judgment calls for team review):

- CAP1: Backend Lead is single-threaded across three hats; Sprint 3 is their
  peak (21 pts). P3-09 (Personal Archive) is the marked release valve -- it can
  slip to Sprint 4 without breaking the loop.
- CAP2: Points are Fibonacci placeholders for relative sizing; the team
  calibrates real velocity at Sprint 1 planning.
- CAP3: QA discipline reuses the intelligent-engineering SDLC loop in spirit
  (per-feature test plans up front, evidence-before-done, review gates before
  merge); QA builds the scribl test harness fresh.
- CAP4: Sprint 1 iOS load (24 pts) is the iOS peak -- screens are small but
  numerous; P1-13 (error normalization) is the iOS release valve and may slip
  to Sprint 2.

## Jira (CMPSR) mapping

- Board: bounteous.jira.com project CMPSR, board 13809 (backlog view):
  https://bounteous.jira.com/jira/software/projects/CMPSR/boards/13809/backlog.
  Issues do not exist yet; this backlog is the import source.
- Mapping: each RE-xx MVP epic -> one CMPSR Epic named `RE-xx <epic name>`.
  Future epics (RE-F1..F9) -> CMPSR Epics labeled `future`, created at triage
  time, not before.
- Each story `P<s>-<nn>` -> one CMPSR Story under its epic; summary = story
  title; description = intent + acceptance sketch; labels: `sprint-1..sprint-4`,
  `mvp`, and a role label `role-ios` / `role-backend` / `role-qa` / `role-pm`;
  story points = the Fibonacci placeholder; assignee = the owning role's
  person.
- Once keys exist, record them back in the story tables (this dataset and the
  sprint-planned view) as CMPSR-nnn so hub docs and Jira never drift.

## Cross-cutting invariants

These bind every epic above.

- AI empowers, humans create: AI is never the artist.
- Submit-to-unlock enforced at the data layer, not the UI.
- One universal daily prompt that consumers cannot modify.
- Creation before consumption.
- Private, invitation-only channels: no public feed, no discovery, no
  strangers, no followers.
- Low skill barrier: few colors, no layers, no undo spirals.
- One meaningful daily touchpoint of roughly 3-5 minutes; not engineered for
  infinite engagement.
- The user owns their creations; content is never used for training without
  explicit opt-in.
- Enhancement North Star is structural, not prompted: user drawing bytes never
  reach an image model; only the Claude-produced caption crosses that seam.
