Ingest one or more URLs into this project brain's knowledge wiki and ship each as a merged PR -- fully unattended. Designed for remote/cloud sessions where the `gh` CLI is unavailable; uses MCP GitHub tools for all PR operations.

Argument: `$ARGUMENTS` -- one or more space-separated `http://` or `https://` URLs.

**Use this instead of `/ingest` when on a phone or any web session where `gh` and local worktrees are unavailable.**

All paths are relative to the brain repo root. The brain's own GitHub owner/repo (from `project.json` or the repo's `origin` remote) is used for all MCP calls -- substitute it wherever `<owner>` / `<repo>` appear below.

---

## Routing

If no argument starts with `http://` or `https://`: stop with `remote-ingest only accepts URLs. Got: <argument>`.

URL type (GitHub repo, YouTube video, or generic article) is auto-detected per URL.

**Multi-URL:** process each URL through the full pipeline SEQUENTIALLY -- complete Steps 1 to 9 for URL #1 before starting URL #2. Do NOT dispatch parallel agents across multiple URLs; they share one git working directory and will corrupt each other's branches.

---

## Pipeline (repeat for each URL)

### Step 1 -- Derive slug and branch name

From the URL:
- GitHub repo (`github.com/<o>/<r>`): slug = `<o>-<r>` lowercased, dots/underscores -> hyphens. Branch = `remote-ingest-<slug>`.
- YouTube (`youtube.com/watch?v=<id>` or `youtu.be/<id>`): slug = `yt-<video-id>`. Branch = `remote-ingest-<slug>`.
- Other URL: slug = hostname + first meaningful path segment, kebab-case, 40 chars or fewer. Branch = `remote-ingest-<slug>`.

### Step 2 -- Get ingested_sha (GitHub repos only)

Use `git ls-remote` -- do NOT use WebFetch on the GitHub API (it 403s without auth):
```bash
SHA=$(git ls-remote https://github.com/<o>/<r>.git HEAD | cut -f1)
```
For YouTube or non-GitHub URLs, skip this step.

### Step 3 -- Create branch from latest main

```bash
git fetch origin main --quiet
git branch remote-ingest-<slug> origin/main
# (do NOT git checkout -- stay on current branch; the agent will check out)
```
If the branch already exists: `git branch -D remote-ingest-<slug>` then re-create.

### Step 4 -- Dispatch wiki-ingestor agent (foreground, one at a time)

Dispatch the `wiki-ingestor` agent (subagent_type: `wiki-ingestor`) and wait for it to complete before proceeding. Do NOT run multiple ingestor agents in parallel.

Prompt must include:
- The URL to ingest.
- The branch: `remote-ingest-<slug>`.
- The `ingested_sha` from Step 2 (GitHub repos only).
- Critical instructions for the agent:
  - `git checkout remote-ingest-<slug>` before any file edits.
  - Create content pages only: raw snapshot, `knowledge/wiki/sources/`, `knowledge/wiki/tools/` or `knowledge/wiki/repos/`, `knowledge/wiki/concepts/`, `knowledge/wiki/patterns/`.
  - Do NOT edit `index.md` or `log.md` -- the orchestrator updates those centrally after the agent returns.
  - Commit all content files with message: `wiki: ingest <slug> (content pages)`.
  - Report back the list of files created.
- For YouTube: `yt-dlp` and `youtube-transcript-api` may not be pre-installed -- run `pip install yt-dlp youtube-transcript-api -q` before extracting.

### Step 5 -- Update index.md and log.md centrally

After the agent returns, the orchestrator (main session) does these edits directly -- no sub-agent:

1. `git checkout remote-ingest-<slug>`
2. Add entries to `knowledge/wiki/index.md` for all pages the agent created.
3. Prepend a log entry to `knowledge/wiki/log.md`:
   ```
   ## [YYYY-MM-DD] ingest | <Title> -- <one-line description>
   - Source: <url>
   - SHA: <ingested_sha>
   - Pages created: <comma-separated list>
   - Key concepts: <brief notes>
   ```
4. `git add knowledge/wiki/index.md knowledge/wiki/log.md`
5. `git commit -m "wiki: update index and log for <slug>"`

### Step 6 -- Run gate checks

Run whatever gate checks the brain provides (e.g. an index-drift check and a protected-files-deletion check). If an index check fails, run the index auto-fix target, commit the fix, and re-check:
```bash
make check-index 2>&1 | tail -3          # if available
make update-index && git add knowledge/wiki/index.md && git commit -m "wiki: fix index drift"   # only if check-index failed
```
Stop and report if any other gate fails.

### Step 7 -- Rebase on main and push

```bash
git fetch origin main --quiet
git rebase origin/main
```

Conflict resolution (`index.md` and `log.md` only -- all conflicts here are additive): keep both sides of each conflict hunk, then `git add <file> && git rebase --continue`. If a commit is a duplicate of something already on main, use `git rebase --skip`.

Push:
```bash
git push -u origin remote-ingest-<slug> --force-with-lease   # after a rebase
git push -u origin remote-ingest-<slug>                      # if no rebase was needed
```

### Step 8 -- Create PR via MCP

Call the MCP create-pull-request tool with:
- `owner`: `<owner>`, `repo`: `<repo>`
- `head`: `remote-ingest-<slug>`, `base`: `main`
- `title`: `wiki: ingest <human-readable title>`
- `body`:
  ```
  ## Summary
  - <bullet per page created>
  - Updates index.md and log.md

  ## Test plan
  - [ ] Entity page exists with correct frontmatter
  - [ ] ingested_sha is 40-char hex (GitHub repos)
  - [ ] index.md has entries for all new pages
  - [ ] log.md has the ingest entry
  - [ ] No secrets or PII
  ```

### Step 9 -- Squash merge via MCP

Call the MCP merge-pull-request tool with `owner`, `repo`, the PR number, `merge_method: squash`, and `commit_title` equal to the PR title.

If merge fails with "merge conflicts": return to Step 7, rebase again, force-push, retry once.

### Step 10 -- Fetch main and repeat for next URL

```bash
git fetch origin main --quiet
```
Then go to Step 1 for the next URL.

### Step 11 -- Report (after all URLs processed)

15 lines or fewer total:
- One line per PR: `#<num> merged -- <title>`.
- Pages created per ingest (file paths).
- Any open questions or concept gaps.

---

## Stop conditions

- No valid http/https URLs in `$ARGUMENTS`.
- wiki-ingestor agent fails or returns an error.
- Any gate fails (report which one and the output).
- MCP merge fails after one rebase retry.

---

## Notes

- Single working directory rule: never run parallel ingestor agents -- they share one git working directory. Sequential is mandatory.
- SHA retrieval: always use `git ls-remote`. WebFetch on `api.github.com` 403s without auth.
- index.md / log.md: always edited by the main session after the agent returns, never inside the agent. This eliminates the primary source of rebase conflicts.
- On a machine with `gh` and worktrees, use `/ingest` instead.
- YouTube requires `yt-dlp` + `youtube-transcript-api`; the agent pip-installs them if absent.
