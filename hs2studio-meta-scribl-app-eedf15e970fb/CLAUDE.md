# CLAUDE.md -- START HERE (scribl project brain)

This repo is a generated **project brain**. It is, at once: the S2D playbook
outputs, a knowledge base, a built-in planning/tracking board, a living
documentation site, and the hub that pairs with the code repo.

**Read this file at the start of every session.**

- **Project:** scribl
- **Type:** mobile-app-poc
- **Code repo:** hs2studio/scribl-app on Bitbucket (the thing we are building;
  vendored as a git submodule at `vendor/mobileapp`; see `project.json`)

## How to run the playbook

The methodology outputs already live in `s2d/`: `overview.md`, `status.md`, the
curated `inputs/`, and the ADRs under `inputs/reference/decisions/`. Work against those source
files directly, then re-render the doc site with `npm run docs:sync`.

- Build work is spawned into the code repo's worktrees; the build skills live
  in the code repo's own `.claude`, not here.

## Where things go

| Path | Holds |
|------|-------|
| `s2d/` | Playbook outputs: `inputs/`, `overview.md`, `status.md`, `inputs/reference/decisions/` (ADRs) |
| `tracking/` | The built-in board: `roadmap.md`, `board.md`, `stories/` (per-work-item) |
| `knowledge/` | Brain knowledge base: `raw/`, `research/`, `wiki/`, `articles/`, `meetings/` |
| `sessions/` | AI work-session transcripts |
| `inbox/` | Raw capture, route from here |
| `patterns/` | Reusable learnings extracted from work |
| `context/` | Persistent project context |
| `reviews/` | Self-improvement: per-stage reviews plus the final postmortem |
| `docs/` | The VitePress doc site (rendered from `s2d/` and `tracking/` by docs-sync) |
| `vendor/mobileapp/` | The app code (submodule, hs2studio/scribl-app on Bitbucket). This is the thing being built |
| `project.json` | Pointer to the code repo and type |

Single source of truth for the doc site is `s2d/` plus `tracking/`. Run
`npm run docs:sync` to render those into `docs/` pages, then `npm run docs:dev`
to preview. Never hand-edit the generated dashboard pages under `docs/`.
Source pages under `s2d/` use site-root links (like `/roadmap`) that resolve
only in the rendered site; this is by design, do not "fix" them.

## Hub model and story-sync pairing

This meta repo is the hub. App code lives in `vendor/mobileapp`; the living
wiki and stories (`tracking/stories/S-*.md`) live here. Code and process stay
in one place so the wiki can never fall out of sync with what actually shipped.

- **Clone with submodules.** `git clone --recurse-submodules
  https://bitbucket.org/hs2studio/meta-scribl-app.git`. If already cloned without that
  flag, run `git submodule update --init --recursive`.
- **Mandatory story-sync pairing.** Any change in `vendor/mobileapp` that
  advances or completes a story MUST, in the same unit of work, update that
  story's source at `tracking/stories/S-*.md`: move its `status` across the
  board states in `tracking/board.md` (Now / Next / Blocked / Done) and check
  off the `## AC` boxes that are now satisfied. Then run `npm run docs:sync`
  so the rendered wiki under `docs/` reflects reality. Never let the wiki
  drift from shipped code.
- **Advancing the app-code pin.** When `vendor/mobileapp` gets new commits,
  update the pin from the hub: `cd vendor/mobileapp && git pull origin main
  && cd ../.. && git add vendor/mobileapp && git commit -m "bump
  vendor/mobileapp"`.
- **Jira board.** scribl production stories live on the CMPSR board (project
  key CMPSR): https://bounteous.jira.com/jira/software/projects/CMPSR/boards/13809/backlog
  -- mapping conventions in `tracking/jira-board.md`. POC stories (S-*) stay
  hub-only.

## Baked-in habits (do these without being told)

These are standing conventions, not one-offs. Agents working in this brain
follow them by default:

1. **Record learnings as work happens.** When something is learned, surprising,
   or reusable, write it to `reviews/` (engagement-specific) or `patterns/`
   (reusable across projects) at the moment, not later.
2. **Run an end-of-stage review at each task boundary.** At the end of every
   stage or task, write a short review to `reviews/`: what went well, what took
   too long, what to change in the playbook. Do this even when working by hand.
3. **Ingest meeting transcripts.** Client and internal call transcripts go to
   `knowledge/meetings/`. On ingest, extract a "Suggested action items" section.
   A human promotes those to `tracking/stories/` (auto-creation is out of scope
   for now).
4. **Keep the tracking board current.** `tracking/board.md` always reflects
   reality across Now / Next / Blocked / Done. Move cards as state changes.
5. **On methodology friction, capture the fix.** If a convention gets in the
   way, record the friction and the proposed fix in `reviews/` so the playbook
   can improve. Do not silently patch around it.

## Self-improvement flywheel

Per-stage reviews accumulate in `reviews/`. When the work ships and the delivery
team rolls on, produce a final postmortem in `reviews/` (durations, friction,
wins, inventory). Those reviews plus a compact project record feed the playbook
so it improves from every engagement.

## Prose-lint and brand rules (grep-checked)

- No em-dash character anywhere. Use commas, colons, or " -- " (ASCII hyphens
  with spaces) instead.
- No emoji.
- Do not name the legacy consulting firm in committed docs.
- No absolute machine paths in committed docs. Refer to source material by
  description, not by filesystem path.
- Use ASCII arrows "->", not unicode arrows.
- Apply NASA Power-of-10 in spirit for any scripts: bound loops, assert
  invariants, check returns, small functions, tight scope.

## Working agreement

- Do not assume. Surface tradeoffs rather than silently choosing.
- Produce the minimum docs that solve the problem.
- Touch only what you must.
- Define success criteria up front and verify against them before claiming done.
