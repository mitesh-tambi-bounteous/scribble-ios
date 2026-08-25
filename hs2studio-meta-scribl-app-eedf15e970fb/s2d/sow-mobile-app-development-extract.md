# Scribl <> Bounteous SOW "Mobile App Development" -- Structured Extract

Source: `Scribl-Bounteous SOW Mobile App Development.docx.pdf` (9 pages, PDF 1.7,
Docusign Envelope ID `9A10DEA4-2C98-8275-8320-AFEE81F05ABA`). All 9 pages read in
full; text extraction was clean on every page; no OCR was needed and no page
failed to extract.

Parties: Scribl, Inc. ("Client") and Bounteous, Inc. ("Vendor" / "Bounteous").
SOW Effective Date **2026-08-13**, under an MSA dated **2026-08-13**. Per the
SOW's own text: "If there is any conflict between this SOW and the MSA, this SOW
shall control with respect to the subject matter expressly addressed herein."

Signatories (p.9): Matthew Kaplan, CEO & Co-founder, Scribl, Inc. (8/13/2026);
Hemant Shah, Managing Director - Technology & Health, Bounteous, Inc. (8/13/2026).

## Term, phase structure, Kickoff Date (§1.1, §1.6, §1.7)

- §1.1: "The term for this SOW shall commence on the Kickoff Date and shall end
  on the date eight (8) weeks after the Kickoff Date, comprising a two (2) week
  Shape phase and six (6) weeks of build delivered as three (3) two-week
  sprints."
- §1.1: "The 'Kickoff Date' means the first business day on which Vendor's team
  commences the Shape phase, following the staffing ramp described in Section
  1.6 and Client's provision of the access described in Section 1.8."
- §1.6 (Timeline & cadence): "A staffing period is required between execution of
  this SOW and kickoff to finalize staffing." No specific duration is given for
  this staffing ramp anywhere in the SOW.
- §1.7 milestone table: "Contract execution to Kickoff" target date = "SOW
  Effective Date + staffing ramp" -- again undated. §1.7 considerations: "A ramp
  period is required between execution of this SOW and kickoff to finalize
  staffing; the project does not start the day after execution."
- Schedule: Shape = weeks 1-2; Build Sprint 1 = weeks 3-4; Build Sprints 2-3 =
  weeks 5-8; Engagement end = end of week 8.
- **Open item**: the SOW nowhere states a specific calendar length for the
  staffing ramp or a specific Kickoff Date -- it is defined functionally (first
  business day Shape work starts, gated on staffing + Client access per §1.8).
  Whether the 2026-08-19 kickoff meeting itself IS the contractual Kickoff Date
  depends on facts outside the SOW (has Client access per §1.8 actually been
  provisioned, and has Vendor's team actually started Shape work).

## Fee, payment, expenses (§2.1, §2.2)

- §2.1: Fixed fee **$100,000**, "representing eight (8) weeks of the dedicated
  team capacity." "The fees set forth in this SOW are fixed and inclusive for
  the Services and Deliverables described herein. No increase in fees or
  extension of schedule shall be effective unless documented in a written change
  order signed by both parties."
- Payment schedule (§2.1 table):
  - 50% ($50,000) due upon execution of this SOW (signing)
  - 50% ($50,000) due upon completion of the 8-week engagement
- §2.2 Reimbursement: Client reimburses "reasonable, pre-approved in writing,
  actual expenses" for transportation, mileage/tolls/parking, car rental,
  lodging, meals, "other ordinary and necessary travel and living costs during
  travel by Vendor personnel," plus "reasonable fees and disbursements incurred
  or charged by third-party experts engaged by Vendor from time to time with
  Client's prior written consent." All expense reimbursement requires prior
  written Client approval.

## Deliverables, per phase/sprint (§1.5)

**Shape** -- Activities: kickoff/team onboarding; establish backlog with Scribl
and set sprint cadence; stand up AWS environments, repos, CI/CD; configure the
knowledge base; prototyping.
Deliverables: prioritized, estimated backlog; running project skeleton in
CI/CD; sprint plan for 3 two-week sprints; initial velocity baseline; definition
of done.
Related assumptions: Client provides backlog priorities/decisions within 2
business days; environments and access available at kickoff.

**Build (velocity delivery)** -- Activities: build against Scribl's prioritized
backlog, highest value first; AI-native development (Bounteous ARC); continuous
validation and CI/CD; sprint review/demo of running prototype each sprint;
re-prioritize backlog with Scribl.
Deliverables: a working prototype at the end of each two-week sprint;
incrementally growing functionality across sprints; living specs, automated
tests, and deployment pipeline; velocity metrics reported each sprint.
Related assumptions: scope is time-boxed to what the team can deliver within
budget and timeline -- "there is no fixed feature list"; backlog and priorities
may change between sprints.

**Wrap-up (end of week 8)** -- Activities: final sprint demo and handover;
summarize velocity results and learnings; outline options for a follow-on
phase.
Deliverables: final working prototype at week 8; velocity summary and
recommendations; backlog and specs in current state for continuation.
Related assumptions: "Continuation beyond week 8 is subject to a separate
SOW / change request."

**Additional Build-phase deliverables (§1.5, unnumbered list after the table)**:
"During the build phase referenced above, Bounteous shall also deliver to
Scribl as part of the Deliverables:
i. Current source code and configuration created under this SOW
ii. Current technical documentation sufficient for a competent development team
    to understand and continue the work
iii. List of third-party and open source components included in the
     Deliverables, with applicable license information
iv. Sprint summary identifying completed work, work in progress, blockers, and
    known issues."

Definition of "running prototype" (§1.4): "a functional build of the
application demonstrating the backlog items completed during the applicable
sprint in a test environment reasonably accessible to Client."

## Vendor obligations (consolidated, cite each source)

- Provide the Services described in the SOW; deliver Deliverables and handoff
  materials "including all materials reasonably necessary for Client to use,
  evaluate, support, and continue development" (§1.2).
- Run a velocity-based engagement using Bounteous ARC, "in which design and
  engineering move together from idea to running code. AI generates the volume
  of code, tests, and pipelines while Vendor's engineers own the architecture,
  product intent, and quality bar" (§1.4).
- Deliver the Shape-phase outputs, sprint deliverables, and wrap-up
  deliverables per §1.5 (above).
- Provide a team of "approximately four (4) personnel with varying allocations"
  (§1.8, Team Model -- Vendor):
  - Agentic Lead -- Solution Engineering -- Half-time
  - Principal Architect (Engineering Lead), AWS -- Solution Engineering --
    Full-time
  - iOS Engineer -- Mobile -- Full-time
  - QA -- Quality Assurance -- Full-time
  - "The Vendor team model may be periodically adjusted to address the nature
    of the required Services."
- Comply with "External Standards" applicable solely to Vendor's own internal
  business operations ("Vendor Compliance Obligations") (§1.9.A).
- Vendor "provides technical delivery and implementation Services only and does
  not provide compliance advisory services" and has no responsibility for
  Client Compliance Obligations (§1.9.B).
- Reasonable-efforts commitment is on Client for staffing cooperation, not on
  Vendor -- Vendor's staffing/team commitments are per the Team Model above.
- Use React Native + TypeScript, single codebase, on AWS; iOS is the target
  platform this phase, codebase maintained Android-ready; use Bounteous ARC as
  approved AI tools "under a license Vendor provides" (§1.6, Platform &
  technology).

## Client responsibilities / dependencies / assumptions (consolidated -- the load-bearing list)

From §1.6 (Assumptions table) and §1.8 (Team Model -- Client):

- **Product owner / single point of contact**: "Client will provide a single
  point of contact / product owner who owns and prioritizes the backlog and has
  sign-off authority" (§1.8). Also: "Client will own and maintain a prioritized
  product backlog and will make priority calls each sprint" (§1.6).
- **Decision turnaround**: "Client provides backlog priorities and decisions
  within two (2) business days" (§1.5, Shape assumptions); "Client will provide
  a single point of contact with decision authority and will respond within two
  (2) business days unless otherwise agreed upon" (§1.8); "Availability for
  sprint reviews and between-sprint re-prioritization, with responses within
  two (2) business days" (§1.8).
- **Access at kickoff** (§1.8): "Timely access to AWS environments, Claude
  access, repositories, credentials, tools, and existing product materials at
  kickoff." Also stated in §1.6 Assumptions (Client decisions & access): "Client
  will provide timely access to AWS environments, AI service accounts and
  access, repositories, credentials, tools, and any existing product materials
  at the kickoff date. Delays reduce the functionality deliverable within the
  fixed timeline." (Note: §1.6 says "AI service accounts and access"; §1.8 says
  "Claude access" specifically -- both refer to the same access item.)
- **Developer accounts**: "Ownership and administration of the Apple and Google
  developer accounts and any required third-party services" (§1.8). Restated in
  §1.6 Platform & technology: "Client owns and administers the Apple and Google
  developer accounts, and provisions the AI services the product consumes."
- **Environments at kickoff** (§1.5, Shape-phase related assumptions):
  "Environments and access available at kickoff."
- **General cooperation** (§1.8, Client paragraph, first sentence): Client
  "will make reasonable efforts to provide the necessary staffing and resources
  required to enable Vendor to fulfill its obligations under this SOW,"
  including "reasonable access to Client data and personnel," and decisions
  within 2 business days "unless otherwise agreed upon."
- **Delay consequence, tied to fees**: "Delays in Client responses may affect
  the schedule only to the extent not reasonably avoidable by Vendor and only
  as documented in a written change order signed by both parties" (§1.8). This
  is the contractual lever if Client-side delays are to move the schedule/fee --
  it requires a signed change order, it is not automatic.
- **Third-party procurement**: "Client shall be responsible for procuring and
  maintaining all third-party products, licenses, and approvals, including
  those required for Vendor to deliver the Services and/or Deliverables and
  those needed for Client's use thereof" (§1.9.D).
- **Qualified personnel**: "Client shall provide qualified personnel to
  coordinate with Vendor and deliver all inputs reasonably required for
  Vendor's provision of the Services" (§1.9.E).
- **Client Compliance Obligations**: Client is responsible for compliance with
  "External Standards" applicable to "Client's industry, operations, and use of
  the Services and/or Deliverables" (§1.9.A) -- see dedicated section below.

## §1.6 staffing ramp and §1.8 Client access -- verbatim, in full

§1.6 is titled "Assumptions" and is a table of Area/Phase -> Assumption. The
row most relevant to staffing ramp is **Timeline & cadence**: "The engagement
runs for eight (8) weeks from the Kickoff Date: (2) week Shape phase followed
by three (3) two-week build sprints. A staffing period is required between
execution of this SOW and kickoff to finalize staffing." No further detail
(duration, named individuals, or start trigger) is given anywhere in the SOW.

§1.8 is titled "Team Model" and has a Vendor subsection (team roles/allocation,
quoted above) and a Client subsection. The Client subsection, in full:

> "Client will provide a stakeholder with full decision-making authority for
> approving Deliverables and will make reasonable efforts to provide the
> necessary staffing and resources required to enable Vendor to fulfill its
> obligations under this SOW. Such cooperation will include, but not be limited
> to, providing reasonable access to Client data and personnel and, in
> situations where Client is required to make decisions, Client will make such
> decisions within two (2) business days unless otherwise agreed upon. Delays
> in Client responses may affect the schedule only to the extent not reasonably
> avoidable by Vendor and only as documented in a written change order signed
> by both parties.
>
> Client will provide the following personnel:
> - A single point of contact / product owner who owns and prioritizes the
>   backlog and has sign-off authority.
> - Timely access to AWS environments, Claude access, repositories,
>   credentials, tools, and existing product materials at kickoff.
> - Ownership and administration of the Apple and Google developer accounts and
>   any required third-party services.
> - Availability for sprint reviews and between-sprint re-prioritization, with
>   responses within two (2) business days."

Neither §1.6 nor §1.8 states a calendar date or day-count for when this access
must be granted relative to the SOW Effective Date -- only "at kickoff" / "at
the kickoff date." The Kickoff Date itself is defined circularly, in part, by
this same access being provided (§1.1).

## Out of Scope (§1.2, full list)

"Any services or activities that are not explicitly described or identified
under this SOW as the responsibility of Vendor shall be considered out of
scope of this SOW, including, but not limited to:"

A. Client responsibilities identified in this SOW, including any dependencies
   and assumptions.
B. Any activities that require the involvement, coordination, procurement,
   management, or direct participation of any third-party vendor, contractor,
   consultant, or service provider not under Vendor's direct control,
   including but not limited to:
   - Integration with third-party systems, platforms, or APIs not owned or
     controlled by Vendor
   - Coordination with Client's other vendors or contractors
   - Obtaining approvals, licenses, or permissions from third parties
   - Third-party data migration, system configuration, or technical
     implementation
   - Third-party security assessments, audits, or compliance reviews
   - Any delays, failures, or performance issues caused by third parties
C. Any project-specific tools, platforms, software licenses, hardware, or
   infrastructure not specifically identified in this SOW as Vendor's
   responsibility to provide.
D. Client Compliance Obligations (defined below).
E. Any modifications, enhancements, or additional requirements not explicitly
   documented in this SOW or a change request, regardless of whether such
   changes are requested during project execution.

## Client Compliance Obligations (§1.9)

Defined in §1.9.A: "Client shall be responsible for compliance with External
Standards applicable to Client's industry, operations, and use of the Services
and/or Deliverables ('Client Compliance Obligations')." "External Standards" is
defined in the same clause as "laws, rules, regulations, third-party rights,
and government orders."

§1.9.B: "Vendor provides technical delivery and implementation Services only
and does not provide compliance advisory services. Vendor shall have no
responsibility for any Client Compliance Obligations or any compliance-related
measures taken or not taken at Client's direction or with Client's approval."

§1.9.C: indemnification for non-compliance with each party's respective
Compliance Obligations is cross-referenced to, and "governed exclusively by,"
the MSA (not restated here).

## Change-control mechanism

- §1 (preamble): "Unless otherwise expressly stated in this SOW, any changes or
  additions to this SOW must be documented in a change request executed by
  each party's authorized representatives."
- §1.2: "No change to scope, fees, timeline, or Deliverables shall be effective
  unless documented in a written change order signed by both parties."
- §1.7: "Any change to the schedule that would affect fees, delivery dates, or
  scope shall require a written change order signed by both parties."
- §2.1: "No increase in fees or extension of schedule shall be effective unless
  documented in a written change order signed by both parties."
- §1.6 (Follow-on funding): "Any continuation beyond week 8 will be addressed
  in a separate SOW or change request."

## IP / ownership, licensing, handoff materials (§5, §1.2, §1.5)

- §5, "Vendor Pre-Existing Technology": "Bounteous ARC (agentic delivery
  platform and AI-native SDLC tooling); Bounteous reusable React Native
  modules, components, and CI/CD pipeline templates." Both terms are defined
  by reference to the MSA ("as defined in the MSA") -- the SOW does not restate
  the MSA's IP-ownership mechanics for Pre-Existing Technology.
- §5, "Vendor Reusable Items": "Bounteous accelerators, code scaffolding,
  architecture patterns, and internal libraries developed independently of
  this engagement and not incorporating Client Confidential Information."
- §1.2: Vendor must deliver "handoff materials," "including all materials
  reasonably necessary for Client to use, evaluate, support, and continue
  development of the Deliverables."
- §1.5 build-phase deliverables (i-iv above) are the concrete handoff
  materials: source code/config, technical documentation, third-party/OSS
  component list with license info, sprint summaries.
- §4 (Termination for Convenience) ties handoff to payment: on Client
  termination, Vendor turns over partially completed Deliverables "upon receipt
  of any outstanding payments due to Vendor," and "upon receipt of any
  undisputed outstanding payments," delivers "all completed and partially
  completed Deliverables, source code, repositories, documentation, work in
  progress, and other project materials created under this SOW."
- **Note**: this SOW has no dedicated "Ownership"/"IP" section of its own
  beyond §5's Pre-Existing Technology / Reusable Items carve-outs -- general IP
  assignment/ownership of the Deliverables presumably lives in the MSA, which
  this document does not include or restate.

## Termination, warranty, confidentiality, acceptance criteria

- **Termination for Convenience (§4, in full particulars)**: Either party may
  terminate with 30 days' written notice. Defines "Termination Notice Date" and
  "Termination Effective Date." On Client-initiated termination: Vendor ceases
  Services at the Termination Effective Date and "will not incur any
  additional fees or expenses"; within 5 days of the Termination Notice Date
  Vendor provides "a description of activities to be performed and milestones
  and Deliverables to be achieved by the Termination Effective Date"; Client
  pays for all Services performed and expenses incurred through the
  Termination Effective Date; Vendor then turns over Deliverables as described
  above. On Vendor-initiated termination: "Client shall pay for any partially
  completed milestones or Deliverables that are scheduled to complete prior to
  the Termination Effective Date," and otherwise "Client shall pay only for
  Services properly performed through the Termination Effective Date and any
  non-cancellable, pre-approved expenses actually incurred."
- **§3, Pause and Restart Work** (adjacent/related risk, not termination):
  Vendor may reallocate resources if Services are paused "for reasons
  attributable to Client," with "no guarantee" reclaimed resources return
  promptly, and "pausing any of the Services may result in additional costs and
  time to complete the project than originally estimated in this SOW, which
  shall be the responsibility of Client."
- **Warranty**: No warranty section appears anywhere in this SOW. Not
  addressed here -- presumably governed by the MSA, which this SOW does not
  include.
- **Confidentiality**: No confidentiality section appears in this SOW beyond
  the passing reference to "Client Confidential Information" in §5's Reusable
  Items carve-out. Presumably governed by the MSA.
- **Acceptance criteria**: The SOW does not define a formal Deliverable
  acceptance/sign-off procedure (e.g., a review period, deemed-acceptance
  clause, or rejection process) beyond "Client will provide a stakeholder with
  full decision-making authority for approving Deliverables" (§1.8). No
  acceptance-testing window or cure period is specified.

## Follow-on phase / additional funding

- §1.3 (Objectives): "Vendor will also deliver a velocity summary and
  recommended options for a follow-on phase, which the parties will pursue
  subject to additional funding."
- §1.5 (Wrap-up assumptions): "Continuation beyond week 8 is subject to a
  separate SOW / change request."
- §1.6 (Follow-on funding assumption, in full): "This SOW is the first phase.
  Vendor and Client are pursuing additional funding for a potential follow-on.
  Any continuation beyond week 8 will be addressed in a separate SOW or change
  request."

## Open items for Rob (flagged, not resolved)

1. **Product owner identity unknown.** The SOW (§1.8) requires Client to
   provide "a single point of contact / product owner who owns and prioritizes
   the backlog and has sign-off authority." As of 2026-08-18, per the brief,
   nobody at Bounteous knows who this is. This is a direct, named Client
   deliverable under a signed contract and should be confirmed at tomorrow's
   kickoff.
2. **Sprint length is contractually fixed.** §1.1 and §1.7 fix the build phase
   as "three (3) two-week sprints" (6 weeks total). This settles, as a matter
   of the executed contract, any open internal question about sprint length --
   changing it would require a signed change order per §1.2/§1.7/§2.1.
3. **Kickoff Date may not have started yet, and the SOW does not name a date
   for it.** Per §1.1, the Kickoff Date is "the first business day on which
   Vendor's team commences the Shape phase, following the staffing ramp
   described in Section 1.6 and Client's provision of the access described in
   Section 1.8." §1.6 requires only a functional "staffing period"; §1.8
   requires Client to provide AWS/Claude/repo/credential access "at kickoff" /
   "at the kickoff date" -- again, no calendar date. The SOW nowhere specifies
   how many days after the 2026-08-13 Effective Date this must occur. If the
   §1.8 access has not actually been granted as of the 2026-08-19 kickoff
   meeting, the contractual 8-week clock (and the $100,000 fixed-fee
   time-box) may not yet have started, regardless of whether a kickoff meeting
   is held that day. This should be confirmed as a factual matter at kickoff,
   not assumed either way.
4. **"AI service accounts and access" (§1.6) vs. "Claude access" (§1.8)** are
   used to describe what appears to be the same Client-provided access item,
   but the two sections use different wording. Worth clarifying at kickoff
   whether this is Claude specifically or "AI services" more broadly, given
   §1.6 Platform & technology also says "Vendor will use Bounteous ARC as
   approved AI Tools, under a license Vendor provides" and separately "Client
   ... provisions the AI services the product consumes" (i.e., product-facing
   AI, not Vendor's delivery tooling) -- these look like two distinct AI-access
   items that the SOW's wording does not clearly separate.
5. **No warranty, confidentiality, or acceptance-criteria section in the SOW
   itself.** All three appear to be governed by the MSA, which is referenced
   but not included in the ingested source. If the MSA is needed for kickoff
   questions on these topics, it has not yet been ingested by this task.

## P2 -- operationally risky terms observed (flag only, no proposed changes)

- The Client-delay clause (§1.8: "Delays in Client responses may affect the
  schedule only to the extent not reasonably avoidable by Vendor and only as
  documented in a written change order signed by both parties") gives Vendor no
  automatic schedule/fee relief for Client-caused delay -- every instance
  requires a signed change order. On a fixed-fee, 8-week time-boxed engagement,
  this is a real exposure if the product-owner/access gaps above are not
  resolved quickly.
- Acceptance has no defined process or deemed-acceptance clock (see above) --
  on a fixed-fee engagement this could create ambiguity about when a sprint
  deliverable is "done" for payment/milestone purposes, though the $100,000 fee
  is split only 50/50 (signing / end-of-engagement), not per-sprint, which
  limits this risk's practical bite for cash flow.
- Staffing ramp and Kickoff Date are both undated in the SOW (see Open Item 3)
  -- on an 8-week fixed-timeline, fixed-fee engagement, ambiguity about when the
  clock starts is itself an operational risk worth resolving explicitly at
  kickoff rather than leaving implicit.
</content>
