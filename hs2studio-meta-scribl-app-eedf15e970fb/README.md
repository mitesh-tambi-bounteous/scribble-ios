# scribl

A generated **project brain** for the scribl mobile-app POC. Read `CLAUDE.md`
first for the working agreement and where everything lives.

## What it is

This repo is the hub for the scribl engagement (type: mobile-app-poc). It
combines several things in one place:

- **Playbook outputs** -- the S2D deliverables, customized for this project.
- **Knowledge base** -- research, articles, wiki, and meeting transcripts.
- **Tracking board** -- a built-in roadmap, kanban board, and per-work-item
  stories that drive the build.
- **Living docs** -- a VitePress site rendered from the source data, kept
  current automatically.
- **Hub model** -- it vendors the app code (hs2studio/scribl-app on Bitbucket)
  as a git submodule at `vendor/mobileapp`, so the wiki and stories stay in
  sync with what ships.

## Layout

```
.claude/        Knowledge commands (ingest, ingest-standup, query, remote-ingest) and agents
vendor/mobileapp/  The app code being built (git submodule -> hs2studio/scribl-app on Bitbucket)
s2d/            Playbook outputs: inputs/, overview.md, status.md, inputs/reference/decisions/ (ADRs)
tracking/       roadmap.md, board.md, stories/
knowledge/      raw/, research/, wiki/, articles/, meetings/
sessions/       AI work-session transcripts
inbox/          raw capture
patterns/       reusable learnings
context/        project context
reviews/        per-stage reviews plus the final postmortem
docs/           VitePress doc site (.vitepress/config.ts; rendered by docs-sync)
project.json    pointer to the code repo and type
package.json    doc-site tooling and scripts
CLAUDE.md       START HERE
```

## Knowledge commands

The `.claude/` commands ingest source material and answer questions against the
knowledge base:

- `ingest` -- ingest a URL into the knowledge wiki, or route a meeting
  transcript into `knowledge/meetings/`.
- `ingest-standup` -- ingest a standup or call transcript.
- `query` -- ask questions against the knowledge wiki.
- `remote-ingest` -- ingest URLs and ship each as a merged PR.

## How docs build

The doc site has a single source of truth: `s2d/`, `tracking/`, and
`knowledge/`. The sync script (`scripts/docs-sync.mjs`, plus
`scripts/context-ingest.mjs`) copies those into renderable pages under `docs/`.

```bash
npm install
npm run docs:sync   # render source data into docs/ pages
npm run docs:dev    # local preview with hot reload
npm run docs:build  # production build (CI gate)
```

Never hand-edit the generated dashboard pages under `docs/`. Edit the source in
`s2d/`, `tracking/`, or `knowledge/` and re-run `docs:sync`.

`docs:dev` and `docs:build` auto-run `docs:clean` first (via npm pre-scripts),
wiping `docs/.vitepress/cache` and `docs/.vitepress/dist` -- a stale VitePress
cache previously caused the site to render blank.
