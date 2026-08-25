# Ceremonies

The recurring conversations that keep scribl moving. This team is small and
runs a POC, so treat cadences below as ceilings, not obligations: hold the
meeting when it earns its place, keep it short, and skip the ritual when a
Slack thread does the job. Work is tracked on the Now / Next / Blocked / Done
board in `tracking/board.md` and in the story files under `tracking/stories/`,
so every ceremony reads from and writes back to those.

## Daily standup

- **Purpose:** inspect progress toward the goal, surface blockers, and adapt
  the plan. Not a status report to a manager -- a sync among the people doing
  the work.
- **Cadence:** daily, time-boxed to 15 minutes. Keep a short "office hours"
  slot after it for anything that needs real discussion.
- **Who:** everyone actively adding value to the build. Others may observe.
- **Inputs:** the board (the Now column especially).
- **Outputs:** an updated board, flagged blockers moved to Blocked with a note,
  and any follow-ups scheduled outside standup.

Each person covers three things: what I finished, what I am on next, what is
blocking me. Identify issues, do not solve them in the room. If a card is stuck
in review or QA, ask why and what unsticks it. Start on time, end on time.

Standup must-haves, distilled:

- [ ] Start on time. Do not wait for stragglers.
- [ ] Screen-share the board so everyone reads from the same reality.
- [ ] Each person answers the three questions.
- [ ] Record blockers on the story or board, and name who will clear each one.
- [ ] Keep it to 15 minutes. Park deep dives for office hours.
- [ ] End on time.

## Refinement

- **Purpose:** get upcoming work ready. Clarify requirements, split items that
  are too big, drop items that no longer matter, and estimate what is close to
  ready. The goal is a Next column full of items that meet the Definition of
  Ready.
- **Cadence:** a regular slot ahead of the coming work, 15 to 90 minutes.
  Add extra sessions only when the whole team is present.
- **Who:** the whole team. Whoever owns the product priorities leads.
- **Inputs:** the backlog, open questions, designs.
- **Outputs:** refined, estimated story files ready to pull; a list of items
  that still need answers, flagged as not ready.

Aim to keep at least one iteration's worth of ready work ahead of the Now
column at all times. See `backlog-and-workflow.md` for how items flow.

## Planning

- **Purpose:** decide what the team commits to next. Pull the highest-priority
  ready items from Next into Now and agree they are achievable.
- **Cadence:** short session at the start of each iteration. Keep it tight --
  tickets should already be refined and estimated. Estimating during planning
  is a smell; do it in refinement.
- **Who:** the whole team plus whoever owns priorities.
- **Inputs:** the refined, estimated Next column; team capacity for the
  iteration (account for time off).
- **Outputs:** a committed set of Now items with a clear goal for the
  iteration. The team makes the commitment -- no one commits on its behalf.

Only pull in what the team can realistically finish. Rollover from iteration to
iteration is the enemy of a trustworthy forecast.

## Review / demo

- **Purpose:** show working software, get feedback, and fold it back into the
  backlog. Informal, collaborative, not a status meeting.
- **Cadence:** end of each iteration, 30 to 60 minutes.
- **Who:** the team plus any stakeholders.
- **Inputs:** the increment -- what actually shipped and merged.
- **Outputs:** feedback captured as new or updated story files; sign-off on
  what is done. For scribl, demo on both a device and the web export target so
  parity is visible.

Behind-the-scenes work counts too: a developer walking through how something
was built is valuable even when there is no UI to show.

## Retrospective

- **Purpose:** improve how the team works. A safe space to name what went well,
  what did not, and what to change next.
- **Cadence:** end of each iteration or at a milestone, 30 to 60 minutes.
- **Who:** the team.
- **Inputs:** the iteration just completed -- delivery, communication, process,
  tools.
- **Outputs:** one or two concrete actions to try next, recorded so they are
  followed up. Durable changes to how the team works belong in
  `team-chartering.md`; engagement-specific learnings go to `reviews/`.

A simple format works: what went right, what went wrong, what we would do
differently. Do the hard topics early while energy is high. Pick the top one or
two actions rather than a long wish list.

For retro formats and interactive boards, link out rather than recreating them
here: the Bounteous Agile Delivery space keeps a set of retrospective templates
and Miro board ideas (Retrospectives, id 264466970935563).

_Source: Bounteous Agile Delivery Confluence (space PD). Distilled from: The Daily Stand Up (id 264465985273892), 10 Standup Must-Haves (id 178520352), Refinement (id 264465984324049), Sprint Planning (id 264465985634313), Sprint Review (id 264465980853765), Retrospectives (id 264466970935563). Recreated 2026-07-10._
