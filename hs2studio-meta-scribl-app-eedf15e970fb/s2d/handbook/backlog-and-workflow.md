# Backlog and Workflow

How work is organized on scribl, from a raw idea to something shipped and
merged. The canonical tools here are the board in `tracking/board.md` and the
story files under `tracking/stories/`. This page maps the general Agile
delivery practice onto those.

## The backlogs

- **Product backlog** -- the prioritized list of everything needed to deliver
  the product: stories, tasks, defects, spikes, and larger groupings (epics).
  On scribl this is the full set of story files plus the roadmap. The product
  owner owns priority; anyone can contribute items.
- **Sprint / active backlog** -- the high-priority subset the team is working
  now. On scribl this is the Now column of the board. Everything in it should
  be estimated, meet the Definition of Ready, and be finishable in the current
  iteration. Scope has to be actively controlled or the column loses meaning.

## The board: Now / Next / Blocked / Done

scribl runs a lightweight four-column flow instead of a heavy multi-board setup.
Cards reference story ids (for example `S-014`) and move as state changes:

- **Now** -- actively in progress. Keep this column small; it is the team's
  work-in-progress limit.
- **Next** -- ready to pull, ordered by priority, top first. Items here should
  meet the Definition of Ready.
- **Blocked** -- waiting on a dependency, decision, or external input. Always
  note the blocker on the card and the story.
- **Done** -- completed and verified against acceptance criteria.

The board always reflects reality. Move cards as things change, not in a
batch before a meeting.

## Story files

Each card links to a story file at `tracking/stories/S-*.md`. The story holds
the "as a / I want / so that" statement, acceptance criteria as checkable `## AC`
boxes, and status. See `story-and-ac-templates.md` for the format.

Story-sync is mandatory: any change in the app code that advances or completes a
story updates that story file in the same unit of work -- move its status across
the board states and check off the acceptance criteria that are now satisfied.
The wiki must never drift from what shipped.

## How work flows

1. **Capture and populate.** New needs land as story files or backlog items.
   Start comprehensive but high level -- name all the big pieces before
   decomposing any one of them. This progressive-refinement approach keeps the
   forecast honest and stops the team from over-investing in detail on work that
   may never rise to the top.
2. **Refine.** Break high-priority items into stories small enough to finish in
   one iteration, add acceptance criteria, and estimate. The item moves toward
   Next.
3. **Ready.** When it meets the Definition of Ready, it can sit in Next in
   priority order.
4. **Commit.** At planning, pull the top of Next into Now.
5. **Build.** A branch and PR per story: in progress, code review, QA, merged.
   See the Definition of Done for the exit bar.
6. **Done.** Acceptance criteria met, reviewed, merged. The card moves to Done
   and the story file is updated.

## Working-item hygiene

A few conventions worth keeping, drawn from broader Agile delivery guidance and
adapted to this repo:

- Every item has a clear goal and acceptance criteria. Do not assume anyone
  knows what "done" means -- write it down.
- Keep back-end and front-end concerns as separate, well-scoped items where it
  helps the natural build order, grouped under a shared theme.
- Blocked items are made loud: flag them, note why, and give them an owner and a
  timebox. If a blocked item is not going to clear soon, take it out of Now.
- Treat scope changes explicitly rather than silently absorbing them (see
  `release-management.md`).

## A note on tooling

Broader Bounteous delivery guidance is written around Jira with distinct Scrum
and Kanban project templates and multi-board pipelines (discovery, intake,
design, product, development, UAT, release). scribl deliberately runs a single
Now / Next / Blocked / Done board in this repo instead. The underlying flow --
ready, in progress, review, QA, done -- is the same; the ceremony around it is
trimmed to fit a small POC team. If this work graduates to a full engagement,
the fuller multi-board workflow is the place to look.

_Source: Bounteous Agile Delivery Confluence (space PD). Distilled from: The Backlogs (id 264465938743537), Backlog Population / Refinement Approach (id 264465938612951), JIRA / Agile Delivery Guidelines (id 32785193730145), JIRA Integrated Design/Dev Template (id 264466172674318). Recreated 2026-07-10._
