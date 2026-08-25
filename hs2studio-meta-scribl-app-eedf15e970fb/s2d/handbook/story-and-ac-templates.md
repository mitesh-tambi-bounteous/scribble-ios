# Story and Acceptance-Criteria Templates

The format for writing work on scribl. Consistent stories make refinement,
estimation, and QA faster because everyone reads them the same way. Stories live
at `tracking/stories/S-*.md`.

## Story frontmatter template

Each story file opens with this YAML frontmatter. Bump `updated:` whenever the
story's status or AC boxes change.

```yaml
---
id: S-0NN
title: Short title
status: next
owner: unassigned
stage: B2
phase: B
project: scribl
labels: []
updated: YYYY-MM-DD
---
```

## The user-story template

Write the intent from the user's point of view, in one sentence:

> As a (user type), I want to (do something), so that (business value).

The three parts each earn their place:

- **As a** -- who this is for. A real user type, not "the system".
- **I want to** -- the capability, not the implementation.
- **So that** -- the value. If you cannot state the value, question whether the
  story belongs in the backlog.

A larger goal that spans several stories is an epic; it uses the same shape at a
higher altitude and is broken down during refinement until each piece fits in a
single iteration.

## Acceptance criteria

Acceptance criteria say when the story is done. On scribl they are the checkable
`## AC` boxes in the story file. Prefer the Gherkin form for anything with real
behavior:

> Given (some context), when (an action happens), then (an observable outcome).

Worked example:

> As a member, I want to record a voice response to a prompt, so that I can
> reply without typing.

Acceptance criteria:

- [ ] Given I am on a prompt with recording available, when I tap record, then
      capture starts and a timer shows.
- [ ] Given I am recording, when I tap stop, then playback of my clip is
      offered before I submit.
- [ ] Given a recorded clip, when I submit, then my response is attached to the
      prompt and the feed unlocks per the daily-loop rule.
- [ ] Given the web export target, when recording is unsupported, then the UI
      degrades gracefully rather than erroring.

Tips that keep criteria useful:

- One observable outcome per criterion. If a line has two "then" clauses, split
  it.
- Cover the unhappy paths, not just the happy one -- empty states, errors,
  unsupported platforms.
- Write them so QA and the product owner can check each box without asking a
  follow-up question.
- Keep implementation detail out of the criteria; that belongs in the story body
  or a linked design or ADR.

## Non-story items

Not everything is a user story. Tasks, bugs, and spikes use a plain description
instead of the "as a" form:

- **Task** -- a unit of work with no direct user-facing behavior. State the goal
  and the done condition.
- **Bug** -- describe the expected versus actual behavior and how to reproduce
  it.
- **Spike** -- a timeboxed investigation. Its output is what makes the resulting
  story ready (see the Definition of Ready).

_Source: Bounteous Agile Delivery Confluence (space PD). Distilled from: Sample User Stories / Acceptance Criteria (id 112558838). Recreated 2026-07-10._
