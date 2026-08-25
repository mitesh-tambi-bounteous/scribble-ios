<!-- source: Scribl x Bounteous kickoff workshop review (synthesized from the 2026-07-14 Teams transcript + live LucidSpark board) -->
<!-- date-fetched: 2026-07-15 -->

# Scribl x Bounteous Kickoff Workshop, Review

**Meeting:** CONFIRMED: BNTS + Scribl Workshop
**Date:** July 14, 2026, 1:00 to 5:00 PM ET (recorded 1:01 to 4:46 PM, ~3h 44m)
**Format:** Microsoft Teams, live LucidSpark board, working prototype demo
**Facilitators:** Angie Yap (MC), David Lawton (working sessions), Rob Forshier II (demos)

**Room:**

| Side | People |
| --- | --- |
| Scribl | Matt Kaplan (CEO), Jeff Sparr (CRO, co-founder), Eric Rice (CCO / Chief Creative, game design), Helen Leffers (Chief of Staff), Abbie Knapton (Customer Experience Lead) |
| Bounteous | Angie Yap (Alliances, MC), David Lawton (Sr. Principal, AI Methodology & Delivery), Marty Young (EVP Data & AI, executive sponsor), Rob Forshier II (AI Architect), John Kilgore (Client Service, relationship + MSA lead) |

**Sources:** raw transcript `2026-07-14-scribl-workshop.vtt` and readable transcript `2026-07-14-scribl-workshop-transcript.md` (preserved in the brain at `knowledge/meetings/raw/2026-07-14-workshop.md`), live board "Scribl Arc Workshop, July 14 2026".

---

## 1. Headline

The workshop achieved its goal: the room committed to a path into Phase 0 and mapped the launch scope. It also reset one major assumption. The PRFAQ's August 1 submission and September 15 launch dates came off the table. Matt called them "very fictitious," and the room re-anchored the whole plan on the **AWS re:Invent keynote (~December 5, 2026)** as the aspirational proof point, with every other date driven by product readiness once Scribl syncs internally.

Everything else landed cleanly. All eight key feature decisions were made, mostly matching the pre-read recommendations. The prototype earned strong buy-in ("I would be out pitching this tomorrow with what you showed us today," Matt). Both founders closed with clear commitment ("We've been waiting 20 years for this. Let's go," Jeff).

**Three shifts to carry forward:**

1. **Timeline is now re:Invent-anchored and readiness-driven.** Beta, public launch, and first-submission dates are TBD pending Scribl's internal sync.
2. **Claude ambition rose above the conservative baseline.** The room wants Claude visibly central from beta, both as a user differentiator and as an Anthropic-funding magnet.
3. **The prototype is the production seed.** Rob's Expo app plus the "brain" knowledge repo is the starting point the team finishes, and it grew live during the session.

---

## 2. North Star

**Status: direction locked, final wording pending.** The room agreed the bet is **connection**, and that **simplicity** is the essence that must appear in the statement (Jeff: "without that word simple, it's missing the essence"). The team left with a mandate to finish the wording with Helen. The board's final AGREED box stayed open by design; Bounteous has what it needs to converge.

**The three finalists the room voted up** (dot votes shown live):

| Type | Statement | Votes |
| --- | --- | --- |
| We win when | "We win when users connect with the people in their lives who matter most." | 3 (top) |
| Billboard | "Draw something simple. Discover something real." | 3 (top) |
| Product is | "Scribl empowers you to connect authentically with those that matter most across distance, schedules, and generations." | 2 |

Matt favored centering the individual: an empowering personal experience is the fuel for adoption and virality. Next step is a short working pass with Helen to fold "simple" into the winning frame.

---

## 3. Key decisions

All eight decision cards were filled on the board and confirmed verbally. Owner is the person who made or ratified the call.

| # | Decision | The call the room made | Owner | Rationale | Vs. pre-read |
| --- | --- | --- | --- | --- | --- |
| 1 | Voice memo response | Fast-follow after MLP. Typed story text stays in for both platforms. | Matt | Typing suffices for MLP speed; Android audio storage is heavy; dictation is a nice-to-have. | Matches (cut from MLP) |
| 2 | Paywall timing | Post-launch. | Matt | Beta gathers maximum data; run-cost and artifact-cost are unknown, so pricing waits. | Matches |
| 3 | Personalized follow-ups | Post-MLP for real personalization. Scaffold from the start; use generic and event-based pushes ("Matt just drew on your wall") in the interim. | Eric, Rob, Marty | Build the plumbing early, activate per user once data accrues. | Matches (seam) |
| 4 | Age gate / minors (COPPA) | Ship 13+ first for beta and public launch. Pursue under-13 as a separate submission after launch, with in-app "coming soon" messaging for minors. | Marty | Apple's minor-protection and COPPA rules add a month-plus and heavy reporting; deferral protects the re:Invent window. | Matches, with a flag (below) |
| 5 | Moderation fail policy | Fail-safe: hold submissions if moderation is down. Richer degradation UX lands post-MLP. | Matt (to Bounteous's lead) | "If we're gonna fail, let's be safe." Outages are rare and beta users tolerate rough edges. | Matches |
| 6 | Claude integration depth | Claude is a beta-visible differentiator: personalized and context-aware prompts, drawing reflection, and an empathy-oriented agent. Exciting Artifact stays a seam. | David, Marty | A meaningful Claude presence delights users and strengthens the Anthropic funding case. | Deviation: more ambitious than baseline (see section 5) |
| 7 | Partner API "at launch" claim | Post-MLP. Scribl amends the PRFAQ. | Matt | The PRFAQ is a working draft; the API has no build stream today. | Matches intent (date left as "post-MLP") |
| 8 | Channel model | A fixed set of predefined, renamable channels for MLP, tagged by wall type (family / friends / coworkers) for segmentation. Unlimited channels behind the paywall. | David, Matt | Predefined keeps measurement consistent; the instinct converged near three (personal, family, friends). | Partial: fixed set agreed, exact number open |

**Two items on the pre-read to note:**

- **August 1 submission strategy:** retired along with the fixed dates. The two-build idea now applies specifically to minors: an adults / 13+ build the room can carry at re:Invent, then a separate later submission for under-13.
- **Claude hosting:** confirmed on **Amazon Bedrock**, settled outside the workshop and tied to the AWS funding arrangement. The board's AWS architecture diagram already routes Claude through Bedrock, so the plan and the diagram agree. The provider abstraction stays in the design to keep the adapter swappable.

**Flag on decision 4:** the deferral is reluctant. All three Scribl leaders named the 8 to 12 family sweet spot as the ideal target. They defer under-13 purely because Apple and COPPA would threaten the re:Invent timeline. **David to research** whether Apple's parental-approval ("ask-to-buy") flow could mitigate the under-13 requirement.

**One decision beyond the list: comments are removed from the product.** The room's aversion to social-media negativity became a product principle. Rob deleted comments live in the pivot demo. Marty logged a future idea: reactions expressed as drawings or emoji rather than text.

---

## 4. Feature placement

Where the room put each feature. Items that moved buckets during the session are flagged.

### Beta (first build, proves the habit loop)

Core drawing canvas, fill bucket, brush sizes, color palette. Typed story text (both platforms). AI background enhancement **with an on/off toggle in settings**. Daily prompt delivery and challenges. Streaks, milestones, badges. Archives / timeline view. Draw-your-own avatars. Fixed channels (number TBD) with wall-type tags. Submit-to-unlock. Content moderation (fail-safe). **Meaningful Claude features (personalized prompts, drawing reflection) targeted for beta.** Compliance gates: 13+ age gate, UGC report button, block/mute, privacy labels. **Accessible analytics and data reporting for Scribl staff (raised as a hard requirement).**

### By launch (polish and store readiness)

Share submissions to social media (a Wordle-style image plus a "wrapped," branded link to a static "coming soon" site, Rob's idea). Export tools and printables. Custom / renamable channel names. Organizing and archiving reusable custom prompts (Abbie: heavily used on Scribl today). Notification preferences and quiet hours. Store listings, screenshots, review notes. Channel-isolation and load tests as a launch gate. AI-consent surface, in-app deletion, AI-content labels, ToS acceptance, support contact.

### Post-launch

Voice memo and Android dictation (fast-follow). Premium paywall. Under-13 experience (separate submission). Partner API. Unlimited archives (paywall). Theme packs and custom props. Unlockables and progression rewards (colors, brushes, stamps, Eric's vision). Stamps / sticker store. The **Exciting Artifact** (combine chosen pieces into a shareable family collage, held as a seam). Slack / Teams, SSO, enterprise admin dashboards, localization, SOC 2.

### Features that moved during the session

| Feature | From | To | Why |
| --- | --- | --- | --- |
| Voice memo | Shown in demo (implied beta) | Post-MLP fast-follow | Typing covers MLP; Android variance |
| Social sharing | Beta candidate | By launch | A growth lever worth polishing for launch |
| Enterprise event mode / high-capacity walls | Post-launch | Solution now, plan for re:Invent | re:Invent could mean ~100k concurrent submissions |
| Comments | Shown in demo | Removed | Negativity and social-comparison risk |
| Notification prefs / quiet hours | Unscoped | By launch | Partly free from OS-level controls |

---

## 5. Notable shifts and surprises

1. **The hard dates collapsed.** The CEO called the PRFAQ dates fictitious. Timelines are now product-readiness-driven and anchored on re:Invent (~Dec 5). This is the single biggest change from the pre-workshop framing, and it relaxes the 9-week compression pressure that drove several pre-read recommendations.
2. **Fundraising is immediate and continuous.** Matt would pitch "tomorrow." Marty floated a strategic reframe: an MLP built primarily to sharpen the pitch, which may reach public release later.
3. **Claude ambition exceeds the conservative baseline.** The room wants Claude central in beta: personalized and context-aware prompts (Eric's "favorite ride at Epcot" example) and a psychology-informed empathy agent (Marty, Eric), explicitly to win Anthropic's attention and delight users. The specific Sonnet / Haiku / Opus model mapping stayed at the "Claude" level and was never named in the room.
4. **Enterprise event mode pulled forward** to be solutioned for re:Invent, reframed as wall capacity for organizations. Eric flagged that a past game degraded around 50 to 60 participants, so scaling is a real risk.
5. **Mission Cloud is a live third party.** Mission built the AI-enhancement pipeline (PDF delivered the prior Friday). Rob rebuilt it in-app using per-stroke data, which removes the OCR step Mission needed. **The Bounteous and Mission Cloud vendor boundary stayed open**, an ownership question to resolve. Related Scribl ask: flavor AI output with Scribl's own style ("scribbly clouds," rather than a Renaissance field), so Scribl will supply reference art.
6. **Analytics accessibility surfaced as a hard requirement.** Scribl struggles to parse its own data today (Metabase). Eric called it "the bane of my existence." Accessible reporting for Scribl staff must be usable at launch.
7. **The prototype grew live.** Marty asked Rob for extra "wow factor" mid-session, and Rob added draw-your-own avatars, more brushes and colors, an archives "yesterday" view, and removed comments, on the spot.

---

## 6. Risks raised

| Risk | Impact | Raised by |
| --- | --- | --- |
| Apple social + minor-protection review (April 2026 COPPA update) | Month-plus review delay, heavy reporting, higher rejection odds | David |
| Store rejection eating the launch buffer | Slips public launch past re:Invent | David |
| Android device fragmentation | Voice and speech features may fail on older hand-me-down devices in family beta groups | David |
| Scribl data / analytics inadequacy | Scribl cannot parse its own usage today | Eric, Abbie |
| Cost uncertainty (run-cost, artifact-cost) | Blocks the pricing model | Matt |
| Wall overcrowding / crash at scale | Enterprise and re:Invent scale is unproven | Eric |
| Q4 vacation-season staffing | Sprint velocity risk (Eric reframed an October launch as a family-connection opportunity) | David, Eric |

---

## 7. Action items and next steps

| # | Action | Owner | Timing |
| --- | --- | --- | --- |
| 1 | Synthesize the workshop into a readout PDF | Angie / Bounteous | Within a cycle or two |
| 2 | Produce a high-level proposal plus pricing | Angie / Bounteous | After the readout |
| 3 | Kick off the MSA for Scribl legal to redline (long-pole item) | John Kilgore | Start now |
| 4 | Prepare the SOW and team staffing plan | Bounteous | Phase 0 kickoff |
| 5 | Apply for AWS funding on Scribl's behalf; set up a three-way AWS + Scribl + Bounteous alignment call; confirm status with James | Angie | Near-term |
| 6 | Pursue Anthropic funding (Claude-from-the-start strengthens the case) | Marty | Ongoing |
| 7 | Work backward from re:Invent with AWS on stage / submission requirements; get Helen lobbying early for a stage or activation slot | Angie, Marty (Helen lobbies) | ASAP |
| 8 | Explore a Bounteous story around Scribl for re:Invent | Marty, Angie | Follow-up |
| 9 | Research whether Apple's parental-approval flow mitigates the under-13 requirement, and Apple's current rejection stringency | David | Before commitments |
| 10 | Amend the PRFAQ (dates, partner API, beta/MLP/commercial scope) | Matt / Scribl | Before the final PR |
| 11 | Build accessible analytics and reporting for Scribl staff | Bounteous | By launch (raised for beta) |
| 12 | Put a hiring / scale-up plan on the radar to support data access (6 to 10 people) | Scribl | On radar |
| 13 | Walk the team through the onboarding flow Eric mapped | Eric | At a convenient point |
| 14 | Solution wall capacity / enterprise event mode for re:Invent (~100k concurrent) | Bounteous | Alongside the re:Invent plan |
| 15 | Supply Scribl-branded reference art to tune AI-enhancement output | Scribl to Bounteous | Design phase |
| 16 | Stamp beta / public-launch / first-submission dates once Scribl syncs internally | Scribl + Bounteous | After internal sync |
| 17 | Resolve the Bounteous / Mission Cloud vendor boundary on the AI-enhancement pipeline | Eric (David surfaces) | Early Phase 0 |
| 18 | Claude hosting confirmed on Amazon Bedrock (tied to AWS funding); keep the provider abstraction swappable | Rob + AWS architect | Decided |

**The commercial path** the room agreed to: Bounteous synthesizes the readout, then delivers a proposal with pricing. John Kilgore starts the MSA now so Scribl legal has runway. Bounteous applies for AWS funding on Scribl's behalf and coordinates a three-way alignment call, and Marty carries the Anthropic funding case. Dates get stamped after Scribl's internal sync.

---

## 8. Open questions and parking lot

- Final North Star wording (connection is locked; add "simple"; finish with Helen).
- Exact number of fixed channels (three vs four; whether coworkers is its own channel).
- Pricing model, and what sits in front of vs behind the paywall (blocked on run-cost and artifact-cost).
- Free-tier archive cap and whether it couples to the paywall (David's instinct: they are independent).
- Per-wall capacity limits and enterprise / re:Invent scale.
- Apple parental-approval mitigation for under-13 (David researching).
- Exciting Artifact scope, and whether any version belongs earlier than a post-launch seam.
- All launch dates (beta, public, first submission), pending Scribl's internal sync.
- Bounteous / Mission Cloud vendor boundary.
- AI-generated daily prompts (PRFAQ) vs a curated preset list.
- Angel pitch cadence (continuous rather than a single window; Matt pitching immediately).

---

## 9. Board close-out gaps to chase

The board captured strong divergent output (demo reactions, North Star votes, the eight decision calls, feature-map write-ins, milestone back-plan). Several convergent close-out fields were left open on the board and are worth completing from this review:

- The final agreed North Star sentence (AGREED box empty).
- RACI letters in the Key Stakeholders matrix (names filled, letters empty).
- Owners on the Risks Log (every owner cell blank).
- Owners and dates on the Phase 0 Commit next-action rows.

These live in the action items above; this review is the durable record until they are stamped.
