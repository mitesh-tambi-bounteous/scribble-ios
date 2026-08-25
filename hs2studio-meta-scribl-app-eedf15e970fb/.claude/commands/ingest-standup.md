Ingest a meeting transcript (a client call or an internal call) into `knowledge/meetings/`, write a structured digest, and extract a "Suggested action items" section a human can promote into `tracking/stories/`.

Argument: `$ARGUMENTS` -- a path to a transcript file (`.vtt` or `.txt`), and optional flags:
- `--kind=<meeting-kind>` -- e.g. `standup`, `client`, `internal`, `working-session`, `requirements`. Defaults to `meeting`.
- `--title="<short title>"` -- human-readable meeting title for the digest heading. Defaults to a title derived from the filename.

If no path is given, stop and ask for one.

All paths are relative to the brain repo root.

**Goal:** drop a transcript, get back a digest in `knowledge/meetings/` plus a clearly labeled list of suggested action items. Promotion of those items into `tracking/stories/` stays a human step for now.

---

## Pipeline

### 1. Resolve source

- Parse `$ARGUMENTS` for `--kind` and `--title`.
- Parse for a path. If a path is given and the file exists, use it. If no path is given, stop and ask.

### 2. Determine date and slug

- Date: read the file's modification time, format `YYYY-MM-DD`. Fall back to today if unreadable.
- `meeting_kind` = the `--kind` value or `meeting`.
- `slug` = `<date>-<meeting_kind>` (e.g. `2026-06-30-client`). If a digest with that slug already exists in `knowledge/meetings/`, append `-2`, `-3`, etc. to disambiguate, and note it in the report.

### 3. Copy raw

`cp <source> knowledge/meetings/raw/<slug>.<ext>`. Do not delete the original. Quote the source path if it contains spaces. Create `knowledge/meetings/raw/` if it does not exist.

### 4. Read full transcript and write digest

Read the transcript in chunks if it is large (more than ~900 lines). When quoting from a `.vtt`, strip the `WEBVTT` header, cue-ID lines, and timestamp lines; preserve `<v Name>` speaker attribution.

Write `knowledge/meetings/<slug>.md`:

```
---
date: <date>
type: meeting
meeting_kind: <meeting_kind>
title: <title>
source: meetings/raw/<slug>.<ext>
attendees: [list]
duration_min: <approx>
---

# <title> -- <date>

## TL;DR
3 to 6 bullets.

## Decisions
With owner. Convert relative dates to absolute.

## Blockers
With owner if named.

## Open questions
Unresolved items needing follow-up.

## Suggested action items
Markdown table: item | suggested owner | due (or TBD) | source cue.
Each row must be traceable to a specific cue in the transcript. This is the
section a human promotes into `tracking/stories/` -- keep items concrete and
self-contained so they read as candidate work items. Do NOT auto-create
stories; promotion is a manual step for now.

## Notable quotes
Verbatim or labeled "Cleaned-up quotes". 2 lines or fewer each, with speaker.
```

Omit any section that has no content (except TL;DR and Suggested action items, which always render -- write "None" if empty).

### 5. Update the meetings index

If `knowledge/meetings/index.md` exists, prepend a one-liner to the current year's section (create the file with a top heading and a year section if it does not exist):

`- **<date>** *(<meeting_kind>)* -- <one-sentence TL;DR>. ([digest](<slug>.md))`

### 6. Report

Chat output, 15 lines or fewer:
- Digest path and raw path.
- TL;DR (3 to 5 bullets).
- The "Suggested action items" list, with a reminder that promotion into `tracking/stories/` is a manual human step.

---

## Optional: ship as a PR

If this brain runs work through worktrees and pull requests, the digest can be shipped that way instead of committed in place: create a worktree off `main`, write the digest there, commit, push, and open a PR for review before merge. This is an optional hand-off shape, not a hardcoded requirement -- use the brain's own commit/PR workflow if it has one, otherwise just write the files in place.

---

## Stop conditions

- Source transcript not found.
- Slug collision that cannot be disambiguated (surface it rather than overwriting).

---

## Notes

- Meeting digests are project-scoped operational records, not durable wiki knowledge. Do not use the `wiki-ingestor` agent.
- The "Suggested action items" section is the seam to tracking: a human reviews it and promotes selected items into `tracking/stories/`. Auto-creation of stories is a deliberate generalize-later item.
- Run unattended through digest write; pause for the human at story promotion.
