# Scribl Engagement — Discussion Topics

Topics that need a conversation before the engagement approach is final. Intended for David + Rob alignment, and where noted, for discussion with Scribl or Anthropic.

---

## Topic 1: Claude Integration Depth

**What we know:** The PRFAQ has Claude doing two things — daily prompt generation and content moderation. Both are relatively standard API calls.

**What we need to decide:** How much deeper do we go, and what does "deep enough for an Anthropic public reference" actually mean?

Possible directions to explore:
- Personalized follow-up notifications based on a user's story history (the PRFAQ mentions this as a stretch feature: "Are you staying on top of your hydration goal?") — this is agentic, requires memory of prior submissions
- Conversational daily companion: Claude as a lightweight conversational partner that responds to voice memos or drawings with an encouraging reflection or question
- Collective artifact generation: Claude aggregates channel responses into a composed collective drawing or story (tied to the Exciting Artifact initiative, planned for Q1 2027 — could we pull this into MVP?)
- Prompt personalization over time: Claude learns which prompt themes resonate with a specific user and surfaces similar themes in their premium prompt pack
- AI-powered archive search: natural language search across a user's creative history ("show me everything I drew about family")

**Why this matters:** The depth of Claude integration determines (a) how fundable this is from Anthropic's perspective, (b) how long Phase 1 and Phase 2 take, and (c) whether this is a true differentiator or just a commodity API call.

**Who needs to be in this conversation:** David, Rob, and ideally someone from Anthropic partnerships.

---

## Topic 2: On-Spec Economic Structure

**What we know:** Bounteous is building on-spec in exchange for future economic participation in product success. Terms are being finalized as of June 2026 per the PRFAQ.

**What we need to decide:**
- What does "economic participation" actually mean? Revenue share? Equity? Performance milestone payments?
- At what revenue or user threshold does participation begin?
- What happens if Scribl raises before reaching that threshold?
- How do we protect Bounteous if the product pivots or is acquired?

**Why this matters:** The on-spec model is our cost-reduction mechanism for Scribl, but it creates real financial exposure for Bounteous. We need the terms to be structured, not handshake-level.

**Who needs to be in this conversation:** David, Marty, Bounteous legal or partnerships lead.

---

## Topic 3: Anthropic Funding Narrative

**What we know:** Deep Claude integration + on-spec build + Bounteous as a Claude Code-native agency creates a potentially compelling story for Anthropic co-funding or a public reference customer arrangement.

**What we need to decide:**
- Has anyone from Bounteous spoken to Anthropic about this? Who is the right contact?
- What does Anthropic's co-funding or reference customer program actually look like? What do they require?
- Is the Scribl + Bounteous + AI-SDLC story strong enough to pitch to Anthropic directly?
- What is the ask? Marketing co-investment? API credits? A case study feature?

**Who needs to be in this conversation:** David, Rob, and an Anthropic partnerships contact.

---

## Topic 4: AWS Co-Investment Beyond Code Coaching

**What we know:** AWS code coaching is already funded and active on the Scribl D2C project. AWS CDK is the infrastructure target.

**What we need to decide:**
- Is there an incremental funding opportunity with AWS beyond code coaching (e.g., AWS Activate credits for the beta cohort, co-marketing for the launch, reference architecture publication)?
- Who is the AWS account team contact? Can we get Bounteous included in that conversation?
- If we architect the CDK patterns cleanly, does AWS want to publish this as a reference architecture? What does that relationship look like?

**Who needs to be in this conversation:** David, Rob, Scribl's AWS contact.

---

## Topic 5: Methodology Documentation Strategy

**What we know:** This project is intended to be a reference implementation of the AI-SDLC methodology. Every agent assist, PKB interaction, and velocity metric should be captured.

**What we need to decide:**
- How do we instrument the build for methodology documentation without adding overhead that slows the build?
- What are the specific metrics we want to prove? Velocity vs. traditional? Defect rate? Story completion rate with AI assist vs. without?
- Who owns the methodology retrospective deliverable? How does it get turned into a publishable case study?
- Can any of this be done in the open (public GitHub, blog post, conference talk) given the on-spec arrangement and Scribl's confidentiality needs?

**Who needs to be in this conversation:** David, Rob.

---

## Topic 6: Team Allocation and Bounteous Resourcing

**What we know:** The engagement requires a full-stack team across mobile, backend, AI integration, design, and DevOps. The on-spec model means Bounteous is carrying this headcount without immediate billing.

**What we need to decide:**
- Who from Bounteous is available and right for this project? Do we have an AI/Claude integration engineer who can own the Claude pipeline?
- How many projects will team members be shared across? Full dedication vs. split time directly affects the September 15 timeline.
- Is there a budget ceiling on the on-spec investment internally? At what point do we need to revisit the model?

**Who needs to be in this conversation:** David, Marty, relevant practice leads.

---

## Topic 7: Scope Boundary for MLP

**What we know:** The PRFAQ describes both the MLP (mobile app, consumer features) and the roadmap (enterprise admin, Slack/Teams integration, Booster Pack marketplace, SSO). The September 15 date is hard.

**What we need to decide:**
- What is the explicit cut line between MLP and post-launch? Some PRFAQ features (e.g., enterprise analytics dashboard, domain-restricted invites, content moderation admin tools) are described as enterprise features but will be needed for beta organizational users.
- Does the premium tier (paywall, archive, export) ship on day one or is it a post-launch gate?
- Is the voice memo feature in scope for MLP, or does it add too much complexity to the response model?

**Who needs to be in this conversation:** David, Rob, Matt Kaplan (Scribl).

---

## Status

| Topic | Priority | Conversation Needed With | Status |
| --- | --- | --- | --- |
| 1. Claude Integration Depth | High | David, Rob, Anthropic | Open |
| 2. On-Spec Economic Structure | High | David, Marty, legal | Open |
| 3. Anthropic Funding Narrative | Medium | David, Rob, Anthropic | Open |
| 4. AWS Co-Investment | Medium | David, Rob, Scribl/AWS | Open |
| 5. Methodology Documentation Strategy | Medium | David, Rob | Open |
| 6. Team Allocation | High | David, Marty | Open |
| 7. MLP Scope Boundary | High | David, Rob, Scribl | Open |
