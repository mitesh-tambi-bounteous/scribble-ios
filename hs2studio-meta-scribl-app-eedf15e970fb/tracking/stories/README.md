# Stories

Per-work-item tracking. One story per file (for example `S-001.md`). Stories are
the unit the board references; the board (`tracking/board.md`) moves story ids
across Now / Next / Blocked / Done.

Stories are markdown with YAML frontmatter so they are both greppable and
renderable in the doc site.

## Story shape

Frontmatter fields in use:

- **id** -- stable identifier, for example `S-001`. Never reused.
- **title** -- short human-readable name.
- **status** -- one of `now`, `next`, `blocked`, `done`, `backlog` (see below).
- **owner** -- who holds the work (person or agent); `unassigned` if not yet held.
- **stage** -- the POC-factory milestone code the work sits in (for example `B2`).
  This is a metadata tag, not a pipeline route.
- **phase** -- the roadmap phase letter (`A`, `B`, or `H`).
- **project** -- always `scribl`.
- **labels** -- freeform tags, for example `[daily-loop, canvas]`.

Acceptance criteria (AC) do NOT live in frontmatter. They are a
`## AC` checklist in the story body; a checked box means that criterion is
satisfied by shipped code.

### status values

- **now** -- actively in progress. Appears in the board Now column.
- **next** -- ready to pull, ordered by priority. Appears in the board Next column.
- **blocked** -- waiting on a dependency, decision, or review (for example
  implemented in the code repo and pending review). Appears in the board Blocked column.
- **done** -- completed and verified against AC / merged. Appears in the board Done column.
- **backlog** -- captured but not yet pulled onto the board. Has no board column;
  it is the icebox for work that is not `now`/`next`/`blocked`/`done`.

## Example

```markdown
---
id: S-001
title: Prompt-of-the-day
status: done
owner: unassigned
stage: B2
phase: B
project: scribl
labels: [daily-loop]
---

# S-001 -- Prompt-of-the-day

Short description of the work.

## AC

- [x] A criterion that shipped code satisfies.
- [ ] A criterion still open.
```
