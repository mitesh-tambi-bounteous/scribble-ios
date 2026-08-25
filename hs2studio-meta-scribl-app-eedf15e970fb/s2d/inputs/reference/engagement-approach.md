# Scribl D2C — Bounteous Engagement Approach

**Status:** Draft for internal review — David + Rob  
**Date:** 2026-06-09  
**Model:** On-spec (economic participation deferred; actual cost to be finalized after internal estimation conversation with Marty)

---

## Why We Do This

This project is more than a client build. It is the first opportunity to run our AI-SDLC methodology end-to-end on a real product — from blank slate through public launch. The output is threefold:

1. A shipped consumer app for Scribl that validates their D2C thesis
2. A reference implementation proving the Bounteous AI development methodology works in production
3. A public reference story fundable by both Anthropic (deep Claude integration in the product) and potentially AWS (consumer-scale architecture story, code coaching already active)

If we do this right, the project becomes a reusable case study for every future ARC pitch: "We built Scribl this way; we can build yours the same way."

---

## What We Are Building

A full Direct-to-Consumer mobile application — iOS and Android — built on AWS, powered by Claude, launched publicly by September 15, 2026.

Feature scope per the PRFAQ and BRD:

| Feature | Notes |
| --- | --- |
| Daily Prompt (Claude-powered) | Universal daily prompt to all users via Claude API |
| Creative Response | Drawing canvas, text story, voice memo |
| Submit-to-Unlock | See others only after submitting; core mechanic |
| Private Social Channels | 4 channels per user (Archive, Family, Friends, Co-Workers) |
| Emoji Reactions | Lightweight engagement layer |
| Streak and Progression | Badges, milestones, retention loops |
| Push Notification Habit Loop | Daily reminder, friend activity, personalized follow-ups |
| Data and Analytics Layer | Internal metrics: DAU, retention, K-factor, monetization signals |
| Premium Tier | Archive access, export tools, badge collections |

Full scope also includes: discovery and requirements, UX design, backend architecture, infrastructure-as-code (AWS CDK), API layer, content moderation, security, go-to-market support, and post-launch stabilization.

---

## Engagement Phases

### Phase 0: Discovery and Requirements (Weeks 1-2)

**Goal:** Translate the PRFAQ and BRD into an engineering-ready backlog using the AI-SDLC methodology.

- Kickoff with Matt Kaplan and Eric Rice (Scribl product/design lead)
- Deep-dive on the wireframe flow, user journeys, and edge cases
- Story authoring using ARC agents — PRFAQ and BRD feed directly into structured user stories
- Technical discovery: auth model, data model, channel architecture, content moderation requirements
- Set up the Project Knowledge Base (PKB) for Scribl in the ARC platform — this becomes the shared memory layer for all agents working the project
- Agree on definition of done and launch criteria

**Methodology:** This is the first live test of the AI-SDLC requirements phase. The PRFAQ is rich enough that an agent should be able to generate 80% of the backlog from it. The remaining 20% comes from discovery conversations. We document the gap and how we closed it.

**Deliverables:**
- Prioritized backlog (MVP stories)
- Technical architecture decision records (ADRs)
- Risk register with mitigation owners

---

### Phase 1: Design and Architecture (Weeks 2-4, parallel with late Phase 0)

**Goal:** Mobile design system, UX flows, and AWS architecture validated before a line of code is written.

- Mobile UX design: iOS and Android (React Native shared component layer per PRFAQ stack)
- Design system: lightweight, consistent, built for the creative/habit feel the product requires
- Backend architecture: API layer, WebSocket for event mode, push notification infrastructure, content storage
- AWS architecture review in partnership with AWS code coaching (already funded — no cost to Scribl or Bounteous)
- Claude integration architecture: prompt generation pipeline, content moderation layer, personalized follow-up design (see discussion topics)
- Security model: encryption at rest (AES-256) and in transit, data isolation per channel, GDPR/CCPA baseline

**Deliverables:**
- Design specs (Figma)
- Architecture diagram with ADRs
- Infrastructure-as-code scaffolding (AWS CDK)
- Claude integration specification

---

### Phase 2: Build Sprint (Weeks 4-14)

**Goal:** Ship the full MLP to beta-quality on iOS, Android, and backend.

The build is organized around the five habit-loop components: prompt delivery, creative response, social sharing, progression, and notification. Each is a vertical slice (mobile + API + infra) to allow parallel team streams.

| Stream | Weeks | Scope |
| --- | --- | --- |
| Auth and onboarding | 4-6 | Sign-up, tutorial, channel invitation |
| Daily prompt and response | 4-8 | Claude integration, drawing canvas, text/voice, submit-to-unlock |
| Social channels and reactions | 6-10 | Channel architecture, feed view, emoji reactions |
| Streak and progression | 8-12 | Badge system, milestones, stats |
| Push notifications | 8-12 | Daily reminder, friend activity, personalized follow-ups |
| Admin and analytics | 10-14 | Internal metrics dashboard, content moderation, user reporting |
| Premium tier | 12-14 | Paywall, archive access, export tools |

**Methodology in the build sprint:**
- ARC agents assist with code review, test generation, and pull request analysis on every stream
- PKB is live from day one: architectural decisions, API contracts, and design patterns are queryable by all agents and engineers
- Weekly velocity check against AI-SDLC benchmarks (we are measuring ourselves, not just Scribl)
- Automated test generation per the methodology; human QA on the golden path

---

### Phase 3: Beta and Launch (Weeks 14-16)

**Goal:** Internal alpha, controlled beta (500-1,000 users, August 2026), public launch (September 15, 2026).

- Internal alpha: Bounteous and Scribl team (week 14)
- Beta cohort: invitation-only, 500-1,000 users; data collection begins
- Retention and engagement monitoring (we need Day 7 data before public launch)
- If Day 7 retention is below 30% at beta, we iterate on prompt experience and notification strategy before public launch (per Scribl's own risk plan)
- App Store and Google Play submission and review cycles (build in 2-week buffer)
- PR and launch campaign support (Scribl leads; Bounteous supports with technical talking points and reference materials)

**Deliverables:**
- Beta app (TestFlight / Play internal track)
- Public app on App Store and Google Play
- Launch metrics baseline report
- AI-SDLC methodology retrospective (internal Bounteous artifact)

---

### Phase 4: Post-Launch Stabilization and Iteration (Weeks 16+)

**Goal:** 30-day post-launch support; position for Q4 roadmap hand-off.

- Bug triage and hotfix SLA (critical: 24h; high: 72h)
- Performance monitoring under real consumer load
- First board data report support (30-day retention curves, October 2026)
- Q4 roadmap scoping: Booster Pack marketplace, Champions activation, enhanced analytics
- Transition plan: Scribl internal team takes ownership of ongoing development or Bounteous continues under a follow-on agreement

---

## Team Model (Bounteous)

Actual headcount and allocation to be finalized with Marty. This is the shape of the team the work requires.

| Role | Phase 0 | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
| --- | --- | --- | --- | --- | --- |
| Engagement Lead / PM | Full | Full | Full | Full | Part |
| UX/Product Designer | Part | Full | Part | Part | -- |
| Mobile Engineer (iOS/Android) | -- | Part | Full (x2) | Full | Part |
| Backend / API Engineer | Part | Full | Full | Full | Part |
| AI/Claude Integration Engineer | Part | Full | Full | Part | -- |
| DevOps / AWS Infrastructure | -- | Part | Part | Full | Part |
| QA | -- | -- | Part | Full | Part |

"Full" = dedicated to this project. "Part" = shared across engagements or ramping.

The AI/Claude Integration Engineer role is the differentiator. This person architects the Claude pipeline, owns the prompt generation and moderation systems, and is responsible for making the Claude integration deep enough to qualify as an Anthropic public reference. (See discussion topics.)

---

## Timeline Pressure

The September 15 public launch date is 14 weeks from now. This is achievable but not comfortable. The critical path risks:

- **App Store review:** iOS review can take 1-2 weeks. Submit by September 1 at the latest. Any rejection resets the clock.
- **Claude integration complexity:** Depth of integration directly affects Phase 1 and Phase 2 duration. Scope must be locked before Week 4.
- **Scope creep from enterprise features:** The PRFAQ includes enterprise admin, analytics dashboards, and SSO integration. These are post-launch. The MVP backlog must be ruthlessly scoped to consumer features only.
- **Discovery gaps:** The PRFAQ is detailed but was written as a narrative, not a technical spec. Phase 0 will surface engineering questions the PRFAQ does not answer. Reserve two full weeks for this.

---

## Strategic Angles

### Anthropic funding and public reference

Scribl already uses Claude for prompt generation and content moderation. If we deepen the Claude integration (see discussion topics), this becomes an Anthropic reference customer story: a consumer habit-forming app built from scratch using Claude as a core product feature, delivered by a Claude Code-native development team using the AI-SDLC methodology. That is a compelling story for Anthropic to co-fund and co-market.

### AWS co-investment

AWS code coaching is already funded and active. The D2C launch is a consumer-scale story on AWS CDK. If we architect this well and document the patterns, AWS has an incentive to feature this as a reference architecture. Worth a direct conversation with the AWS account team about whether there is incremental funding beyond code coaching.

### Bounteous methodology proof point

This is the reference implementation of the AI-SDLC methodology. Every decision, every agent assist, every PKB interaction should be documented. At the end, we have a case study showing velocity, quality, and cost-efficiency data from a real shipped product. This is the evidence base for every future AI-SDLC pitch.

---

## Open Items

See [discussion-topics.md](discussion-topics.md) for topics that need resolution before the approach is final.

---

## Next Steps

- [ ] David and Rob review this document; add questions and corrections
- [ ] Align on discussion topics priority and schedule the discussion
- [ ] Internal estimation session with Marty (team size, weeks, on-spec economic model)
- [ ] First call with Matt Kaplan to confirm scope and begin Phase 0 kickoff planning
