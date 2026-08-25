---
date: 2026-08-18
type: meeting
meeting_kind: alignment
title: Scribl Bounteous Internal Alignment (Pre-Kickoff)
source: meetings/raw/scribl-prekickoff-20260818.md
attendees: [David Lawton, John Kilgore, Neelesh Aggarwal, Nitish Goyal, Pramod Kumar, Rob Forshier II]
duration_min: 60
---

# Scribl Bounteous Internal Alignment (Pre-Kickoff) -- 2026-08-18

John Kilgore joined only for the first few minutes and left before the
technical discussion. Pankaj Aggarwal (engineering lead/architect per the SOW)
was invited but missed the call; he still appears below in team-structure
notes as a named role.

## TL;DR

- SOW reshaped: originally a full app targeted for re:Invent; now scoped to
  the AWS funding already on hand -- David put it at roughly 1/3 of the
  original scope -- with a smaller team and a tighter deadline, while
  additional budget is negotiated. Delivery model is rapid iterative POCs
  with a client release every sprint.
- Team introduced with explicit gaps: no PM assigned; QA role unfilled
  (Pramod expects it closed within a day or two); Pankaj Aggarwal (engineering
  lead/architect per the SOW) is not full-time, split across accounts, and
  missed this call; the full-time iOS developer to work under Neelesh is
  still TBD.
- Decided: Lucid board (not a deck) for the kickoff so the client can put
  stickies up; Bounteous Claude accounts confirmed; Bounteous AWS accounts
  used initially until the client provisions; Macs being provisioned for the
  India team by end of week (default is Windows); comms channel builds off
  the existing "scribl general" Teams channel; the kickoff is US-only and
  must be recorded because it falls after midnight IST; Pramod to run a
  dry-run session the morning of 2026-08-19 before the client call.
- Strategic overlay: David stated this engagement is where Bounteous
  validates its new AI-native methodology -- deliberately changed language
  ("instead of discovery"), heavy Claude use, rapid prototyping, and regular
  client demos -- and that Rob is on the team specifically to make that
  consistent.
- Product scope reality: Rob's POC deliberately overshoots (extra brushes,
  colors, a fill tool, custom tools, challenges). The first client-facing run
  is much simpler -- roughly 5 colors, a couple of brush sizes, one brush,
  personal walls, invites to daily walls, speech-to-text, simple drawing,
  plus static tutorial / invite-explainer onboarding screens. Challenges are
  NOT in the first run. `scribl.co` is the client's existing B2B web product;
  this build is a deliberately separate B2C app.
- Tech as built: React Native + Node.js backend, currently a monorepo (split
  undecided), Skia for drawing, deployed on Vercel, speech-to-text via Super
  Whisper / OpenAI. Repos live in Bitbucket; Pramod now has admin on both,
  including the meta repo.

### Team structure (as stated on the call, gaps included -- not tidied over)

| Person | Role | Notes |
|---|---|---|
| Rob Forshier (Forshier II on the call) | Engagement lead, Chicago/CT | Built the original POC; owns the repos and meta repo |
| David Lawton | Relationship conduit / accountable executive, Seattle/PT | Explicitly "not an official role capacity"; shared with Marty |
| Marty | Head of AI company-wide | Personal client relationship, brought the client in; in/out of exec steercos (not on this call) |
| Pramod Kumar | Delivery management, Bangalore | Staffing, planning, performance, escalations |
| Pankaj Aggarwal | Engineering lead / architect per SOW | **Not full-time**, split across accounts; missed this call |
| Nitish Goyal | Backend, .NET/AWS | **Full-time**; works closely with Pankaj |
| Neelesh Aggarwal | iOS lead | On another account under John Kilgore; 17 years, ex-Apple (iOS/macOS/tvOS/watchOS) |
| (unnamed) | Full-time iOS developer | TBD, to work under Neelesh |
| (unfilled) | QA | Pramod expects it closed within a day or two |
| (unassigned) | PM | David raised the gap explicitly -- no PM assigned |

Client side: Christina is the client's designer. The client PO is unknown --
the SOW promises one; Rob's answer was "we'll have to figure out who that
is."

## Decisions

- Lucid board (not a slide deck) for the kickoff -- Rob's rationale: it lets
  the client put stickies on the board rather than just receive a
  presentation; ratified by David.
- Bounteous Claude accounts confirmed for the team (David Lawton).
- Bounteous AWS accounts used initially, until the client provisions their
  own (David Lawton): "we have to work through all of that with them still."
- Macs being provisioned for the India team by end of week (Pramod Kumar) --
  most of the India team defaults to Windows, and Mac access is treated as
  critical for iOS builds.
- Comms channel builds off the existing "scribl general" Teams channel
  rather than a new one (Rob Forshier, agreed by David and Pramod) -- this is
  the first Scribl engagement at Bounteous, so that channel gets leveled up
  for the team.
- The kickoff call is US-only; India is past midnight IST, so the call must
  be recorded for them (Rob Forshier).
- Pramod to set up a dry-run session the morning of 2026-08-19 so the India
  team can review and give feedback before the actual client kickoff.

## Blockers

- QA role unfilled -- Pramod expects it closed within a day or two
  (~2026-08-19/20).
- Pankaj Aggarwal (engineering lead/architect) is not full-time and missed
  this call.
- No PM assigned to the team (David raised this explicitly as an open gap).
- Updated client designs not yet available -- Christina (client designer)
  was given access to the POC/board to redo designs; Rob expects them "in
  the next couple of days," but nothing has landed yet.
- Client product owner is unknown -- the SOW promises one but no one has
  identified who that is.

## Open questions

- Sprint start day: David favors Wednesday-to-Tuesday because Friday/Monday
  US-India overlap is awkward, but says client demo timing should ultimately
  drive it.
- Release day (tied to the same discussion).
- Whether repos live on Bounteous's side or the client's.
- Whether AWS is Bounteous's account or the client's, long-term.
- Where the backlog lives (Jira? a document?).
- Internal team cadence and standups -- not yet defined.
- Definition of ready / definition of done -- not yet defined.
- Status reporting approach -- not yet defined.
- Who the client PO actually is.

Possible SOW discrepancy to reconcile (not resolved here): David
characterized the reshaped scope as roughly 1/3 of the original SOW; verify
this fraction against the actual SOW document once ingested by the parallel
scribl-sow-ingest worker.

## Suggested action items

| Item | Suggested owner | Due | Source cue |
| --- | --- | --- | --- |
| Send over the pickup-flow materials generated the day before | David Lawton | ~2026-08-18, about an hour after the call | "I'll send it out probably in about an hour or something like that" |
| Build kickoff materials on the Lucid board | Rob Forshier, David Lawton | 2026-08-18 | "David and I can start working on that today" |
| Schedule a dry-run session for the India team before the client kickoff | Pramod Kumar | 2026-08-19 (morning) | "if you want to set up a session for tomorrow morning" |
| Close the QA hiring gap | Pramod Kumar | 2026-08-19/20 (low confidence -- stated as "next day or so") | "in the next day or so, we should have that person coming in" |
| Close the full-time iOS developer hiring gap | Pramod Kumar | 2026-08-19/20 (low confidence -- stated as "next day or two") | "in the next day or two, we should have all these positions closed" |
| Create the Teams comms channel (building off "scribl general") and add team members | Pramod Kumar | Not dated | "we'll do that, Rob, with all the team members" |
| Get Angie onto the kickoff invite | John Kilgore | Before 2026-08-19 kickoff | "I will make sure that she is on that invite for tomorrow" |
| Grant repo / Lucid board access on request | Rob Forshier | Ongoing, on-demand | "please reach out to me and then I can give you access" |
| Finish provisioning Macs for the India team | Pramod Kumar | ~2026-08-22 (low confidence -- stated as "by the end of this week") | "by the end of this week, all of the folks should be up and running with the Macs" |
| Follow-up discussion to lock cadence, PM coverage, status reporting, and definition of ready/done | Rob Forshier, David Lawton, Pramod Kumar | Not dated | "coming up with a system and agreements on the team will be really good as maybe a follow-up to this meeting" |

## Notable quotes

- "Originally we were planning a full app that was going to be released
  basically for re:Invent. What changed is they're using the AWS funding
  they have... so we're going to have to be very focused from a feature
  delivery standpoint." -- David Lawton
- "The first SOW though is scoped only to that budget, which is roughly 1/3
  of the scope, basically." -- David Lawton
- "We're heavily using Claude for all things, so... please record your
  meetings, keep the transcripts. We're feeding into our harness and brain
  for this project." -- David Lawton
- "We also have a goal that's been negotiated that this is going to be a
  project where we validate our new AI methodology... instead of discovery,
  like we're changing the language." -- David Lawton
- "That is also specifically why we have Rob working on this team, is so
  that he can help everybody do that in a very consistent way and bring the
  tools and methodology together." -- David Lawton
- "We'll have to figure out who that is." -- Rob Forshier (on the unknown
  client PO)
- "This will be completely different than their business-to-business
  version, because this will be now their business-to-consumer." -- Rob
  Forshier (distinguishing this app from scribl.co)
