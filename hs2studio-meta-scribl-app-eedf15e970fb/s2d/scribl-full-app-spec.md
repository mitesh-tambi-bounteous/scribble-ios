# scribl -- full-app spec

**Name:** scribl
**Type:** mobile-app-poc
**Status of this doc:** authoritative product spec for the POC "bake-out"

## What this is

This is the single, authoritative product spec for the scribl app. It is the
contract the upcoming implementation "bake-out" builds against: what the app does
end-to-end, what "done" means, and which decisions are still open. It synthesizes
the org source-of-record (BRD, PRFAQ, technical implementation plan, client
summary, and UI mockup, all under [input artifacts](/input-artifacts)) with the resolved product
decisions Rob made on 2026-07-06.

Precedence, when sources disagree:

1. The org source-of-record in [input artifacts](/input-artifacts) is authoritative.
2. Rob's resolved decisions (below) sit on top of the org intent, not against it.
3. The operator scaffold draft and the current build are inputs, not authority.
   Where the current build or the mockup diverge from the org intent, that is
   flagged under [Open Decisions](#open-decisions) rather than silently adopted.

Fidelity framing: the "full app" here is the POC target -- a local Expo /
React Native build with a thin backend and a real database, delivering the full
org feature-set end-to-end. The production AWS MLP (Cognito federation, Aurora,
CDK, Claude vision, managed push, analytics warehouse) is a set of seams the POC
is shaped toward but does not implement. See [Out-of-POC seams](#out-of-poc-seams).

## Product vision and principles

scribl is a daily creative practice: one universal, AI-generated prompt goes to
everyone at once; you respond in a few minutes by drawing, writing, or speaking;
you submit to unlock and see what everyone else made; you react. It is
positioned as the antidote to AI-generated noise -- anti-algorithm, anti-feed,
pro-human expression.

The load-bearing principles, which the build must not compromise:

- **AI empowers, humans create.** "AI powers everything else. scribl empowers
  people." AI generates the prompt, moderates content, and (as challenges grow)
  judges, guesses, and commentates. AI is NEVER the artist. The output is always,
  unmistakably human.
- **Submit-to-unlock.** You only see others' responses after you submit your own.
  This protects an uninfluenced response, creates the reveal moment, and defeats
  blank-canvas anxiety. Enforced at the data layer, not just the UI.
- **Universal daily prompt.** The same prompt for everyone, everywhere, the same
  day. Consumers cannot modify it; universality is the point (it is what makes the
  shared cultural moment).
- **Creation before consumption.** You create before you observe.
- **Private channels, not public performance.** Invitation-only, private by
  default. No public feed, no algorithmic discovery, no strangers, no followers.
- **Low skill barrier.** Finger-on-glass, a handful of colors, no layers, no undo
  spirals. Constraints are the feature.
- **One meaningful daily touchpoint.** Roughly 3 to 5 minutes a day. Not
  engineered for infinite engagement.
- **The user owns their creations.** Content is never used to train AI without
  explicit opt-in consent.

## Target users

- **Primary -- the daily creative-habit seeker.** Individuals who want a low-
  pressure, few-minutes-a-day creative ritual, in the segment exhausted by
  AI-generated content. Persona from the PRFAQ: Sarah, a marketing director and
  mother of two, who uses scribl as a 3-minute reset and draws to her Family
  channel. No artistic skill required; the wonky drawings are the point.
- **Circles.** Families (parent and child), friend groups, and co-worker groups,
  each an invitation-only private channel.
- **Platform "doors in" (future context, not POC scope).** The same creative
  foundation is meant to serve classrooms, teams, and enterprises later. This is
  the fundraise story, seeded architecturally, not built in the POC.

## Full feature set

The org BRD defines six feature areas. Each is specified below with intended
behavior and acceptance criteria, and mapped to the existing stories it advances.
Story references point to real stories in [the project stories](/stories/)
(`S-001` through `S-019`). Gaps are called out as future stories in prose only;
no new story files are created by this spec.

### 4.1 Daily prompt

One universal prompt per day, delivered to all users, fetched from the thin
backend (no client-side generation). In production the prompt is AI-generated on
the top-tier Claude model behind an editorial gate; in the POC a seeded and
rotating prompt set is acceptable, fetched the same way. The screen shows the
caller's submission status for today.

Advances: S-001 (prompt-of-the-day), S-003 (submit-to-unlock invariant).

Acceptance criteria:

- Opening the app on a given day shows exactly one prompt, the same for every
  user that day.
- The prompt is fetched from the backend; the client never generates or edits it.
- The prompt screen reflects whether the current user has already submitted today.

### 4.2 Creative response

Three response modes, the user's choice on any day, all constrained by design:

- **Drawing canvas** -- finger-on-glass Skia canvas, a small fixed color palette,
  a single brush, no layers or undo spirals.
- **Text** -- a short caption, character-limited (140 characters per S-012).
- **Voice** -- a length-limited voice note that is transcribed to text on submit.
  The transcription populates the caption / text field only if the user did not
  already type one. Playback of the recording should work.

Advances: S-002 (Skia canvas), S-012 (write / 140-char caption), S-013 (record /
30-sec audio). The voice STT provider for the POC is [Open Decision B](#open-decisions).

Acceptance criteria:

- A user can create a response in any of the three modes and submit it.
- Drawing is smooth on device and runs from the one Expo codebase on web too.
- Text is capped at the character limit.
- Finishing a voice note transcribes audio to text and fills the caption when the
  caption is empty; if the user already typed a caption, the typed text wins.
- A recorded voice note can be played back.

### 4.3 Social channels

Responses are shared into private channels. The org model is four channels:
Personal Archive (your private journal / "Your Channel"), Family, Friends, and
Co-Workers. All non-archive channels are invitation-only and private by default.
There is no public feed and no strangers.

Channel isolation is enforced server-side and is launch-blocking: a response in
one channel must never surface in another, and channel reads must return forbidden
until the caller has submitted for the current prompt (the submit-to-unlock check
is a transactional existence check on a submission row for the user and prompt).

Advances: S-004 (channel isolation), S-016 (family wall grid). Related:
S-014/S-015 (walls hub and carousel), S-017 (response detail).

Note on the current build and mockup: the current build skews Family-centric with
a public "wall," and the mockup shows a public wall plus a "strangers drew today"
stat. Both diverge from the org "no public feed / no strangers" principle. Whether
the POC ships all four channels with isolation or a reduced set is
[Open Decision D](#open-decisions); this spec specifies the org four-channel model
as the target.

Acceptance criteria:

- A submitted response appears only in the channel(s) the user shared it to.
- A channel read returns forbidden until the caller has submitted for that prompt.
- A response in channel A is never visible from channel B.
- Channels are joined by invitation; there is no public discovery of channels.

### 4.4 Reactions

Lightweight, standardized sentiment emoji reactions on channel responses,
available only after the user has unlocked (submitted). Reactions are the only
social currency: no comments threads, no counts that drive an algorithm.

Advances: S-005 (post-unlock reactions).

Whether star ratings coexist with emoji (they arrived with the shipped
family-challenge work), and whether a user can react to their own drawing, is
[Open Decision C](#open-decisions). This spec specifies sentiment emoji as the
base reaction model; star rating is a Creative-Challenges mechanic (see 4.8).

Acceptance criteria:

- Reactions can be added to a response only after the user has submitted.
- The reaction set is a fixed, standardized set of sentiment emoji.
- Reaction rules for a user's own response follow the resolution of Open Decision C.

### 4.5 Progression and achievement

Creative streaks and a personal archive that make the habit stick. A streak
counts consecutive days on which the user responded and resets when a day is
missed. Badges mark milestones (7, 30, 100 days). Aggregate participation stats
("how many responded today") give the shared-moment feeling. The personal archive
is the user's own history.

Advances: S-006 (streak rule), S-014 (Home stats and walls hub).

Note: badges/milestones are thin in the current build; the spec keeps them in
scope for the POC feature-set.

Acceptance criteria:

- The streak increments on a same-day submit and resets after a missed day.
- Milestone badges are awarded at 7, 30, and 100 days.
- Home shows the user's current streak, a week view, and an aggregate
  participation stat.

### 4.6 Push notification habit loop

A daily prompt reminder plus channel/friend activity and momentum-based
re-engagement. In the POC, local notifications are acceptable; production managed
push (timezone-aware scheduling, quiet hours, streak-at-risk nudges) is a seam.

Acceptance criteria:

- A daily reminder can be delivered locally in the POC.
- Notification behavior is customizable (at minimum, on/off) by the user.

### 4.7 Accounts and auth

Create-account and login with real validation. In the POC, local email/username
validation is in scope: creating an account admits the user; logging in with the
same credentials logs the user in; mismatched credentials are rejected with a
"not found" result; sign-out and sign-back-in round-trip correctly. Federated
identity (Apple, Google, Cognito) is a production seam.

Advances: S-010 (sign-up), S-011 (tutorial / onboarding). Auth fidelity
(local now, federation later) is [Open Decision E](#open-decisions).

Acceptance criteria:

- Creating an account signs the user in.
- Logging in with valid, matching credentials signs the user in.
- Logging in with credentials that do not match an account is rejected as
  "not found."
- Sign-out followed by sign-in with the same credentials round-trips.

### 4.8 Creative Challenges (additive feature line)

Creative Challenges are a first-class, growing feature line layered on top of the
base daily practice, not a pivot away from it. The anchor, already shipped, is the
blind draw-off with star rating (the family-challenge work). The guiding principle
holds: AI prompts, judges, guesses, and commentates, but AI is never the artist.

The following are candidate future stories seeded from the scaffold, listed here
so the backlog owner can promote them (no story files are created by this spec;
family-challenge work is not yet tracked as a numbered story):

- **Blind draw-off** (shipped) extended with tournament brackets, family/friend
  leaderboards, and rematch.
- **AI drawing reflection** -- encouraging, on-tone Claude vision feedback on a
  drawing (a production seam pulled forward as a challenge enhancer).
- **Guess-the-drawing** -- Pictionary-style; family members and/or AI vision guess
  the subject, with points for fooling and for guessing.
- **Themed challenge packs** -- AI-generated weekly themes, escalating difficulty,
  seasonal packs.
- **Adaptive prompts** -- AI tailors challenge prompts to a group's history and
  skill.
- **Speed / constraint challenges** -- beat-the-clock, one-color, no-lift; AI
  scores creativity and theme-match gently.
- **Streak-unlocked challenge types** -- new modes unlock with progression.

## Core end-to-end flows

- **Daily loop.** Open app -> see today's prompt and your submission status ->
  choose a mode (draw / write / speak) -> create (voice is transcribed to caption
  on finish) -> submit -> unlock -> view your channels' responses -> react.
- **Onboarding and auth.** Create account -> tutorial -> into the loop. Login
  validates: matching credentials sign in, mismatched are rejected. Sign-out and
  sign-back-in round-trip.
- **Channels.** Create or join a channel by invitation -> share a response to the
  chosen channel(s) -> see members' post-unlock responses -> react.

## Current build status and live bugs

The current repo is the Expo app "scribl": database-backed, with an end-to-end
test harness and a login-first boot, and the shipped family-challenge (blind
draw-off + star rating) work. Six live bugs were captured against the running app
on 2026-07-06 and are mapped to spec areas below. The bake-out fixes all six.

| # | Bug | Spec area | Story |
|---|-----|-----------|-------|
| 1 | Voice note only shows "voice note taken"; no playback; no transcription to caption | 4.2 Creative response (voice) | S-013 |
| 2 | After "Done" on a drawing, lands on a blank "family" screen; family picker is non-functional | 4.3 Social channels / Creative Challenges | family-challenge (future story) |
| 3 | No way to rate or add emoji reactions on a public drawing; self-vs-others rules unclear | 4.4 Reactions | S-005 (ties to Open Decision C) |
| 4 | Cannot add a drawing to "my family" channel | 4.3 Social channels | family-challenge (future story) |
| 5 | Login does not validate; matching credentials should sign in, mismatched should be rejected | 4.7 Accounts and auth | S-010 (ties to Open Decision E) |
| 6 | Selected color-swatch ring is clipped at the top by its container | 4.2 canvas UI polish | S-002 |

## Open Decisions

These remain open. This spec does NOT resolve them; it surfaces them for Rob. The
bake-out should treat each as a gate.

- **B -- Voice STT provider.** Voice is in and transcribes on submit (Rob wants it
  working). Open: on-device vs cloud STT provider for the POC. The technical plan
  had recommended cutting voice or making it iOS-only because Android on-device STT
  is OEM-variable; Rob's direction keeps voice, so the provider choice is the open
  question.
- **C -- Reactions model.** Sentiment emoji is the base reaction. Open: do star
  ratings (from the challenge work) coexist with emoji, and if so where (emoji on
  channel responses, stars on challenges)? Can a user react to or rate their own
  drawing?
- **D -- Channels in the POC.** The org model is four channels (Personal Archive,
  Family, Friends, Co-Workers) with server-side isolation and submit-to-unlock.
  Open: does the POC implement all four with isolation, or a reduced set (the
  current build leans Family plus a public wall)? Note the mockup's public wall and
  "strangers drew today" stat conflict with the "no public feed / no strangers"
  principle; channel isolation is a launch-blocking privacy gate.
- **E -- Auth fidelity.** Local email/username validation now (bug 5), federated
  identity (Apple / Google / Cognito) later. Confirm this is the intended POC line.
- **F -- POC vs production fidelity.** Confirm the "full app" is the POC (local
  Expo plus DB) delivering the full feature-set, with production AWS (Cognito,
  Aurora, CDK, Claude vision, managed push, analytics warehouse) as post-POC seams.

Related conflicts to resolve alongside the above: the mockup labels the social
surface a "wall" while the BRD calls it a "channel"; the mockup shows only the
drawing mode (no text/voice UI) and reaction icons rather than sentiment emoji.
This spec follows the BRD/PRFAQ; the mockup is treated as illustrative.

## Out-of-POC seams

In the org roadmap but out of the POC bake-out. Built toward as extension points,
not implemented:

- Production AWS: CDK infrastructure, Cognito federated auth, Aurora Serverless
  Postgres, S3/CloudFront signed media.
- Claude vision "reflection" on drawings and the content-moderation pipeline.
- Managed push (timezone-aware scheduling, quiet hours, streak-at-risk nudges).
- Analytics warehouse (the POC uses product analytics only).
- Premium / paywall, enterprise admin / SSO / dashboards, event mode
  (real-time broadcast to large audiences), and Booster-Pack marketplace.
- A second Claude provider adapter (Bedrock) behind the same Messages-API-shaped
  abstraction; the POC ships one hardened adapter (advances S-008).

## Definition of done (bake-out)

- The daily loop works end-to-end: prompt -> create (including voice -> text) ->
  submit -> unlock -> channel view -> react, per the resolved Open Decisions.
- All six live bugs are fixed.
- Auth validates and round-trips (create, login match, login mismatch rejected,
  sign-out / sign-in).
- Channel isolation and submit-to-unlock are enforced at the data layer.
- Unit and end-to-end tests are green.
- The app runs in the local two-server harness (web plus API).

## Links

- [overview.md](overview.md) -- project overview and scope.
- [Board](/board) -- Now / Next / Blocked / Done.
- [Roadmap](/roadmap) -- phases and milestones.
- [Stories](/stories/) -- the S-0xx stories mapped above.
- [Input artifacts](/input-artifacts) -- the org source-of-record: BRD (MVP scope), PRFAQ,
  technical implementation plan, client summary, user-flow diagram, AWS
  architecture and cost estimate, and the UI mockup.
