---
description: One-time per-clone setup — points git at this repo's tracked .githooks/ directory (if any) so hooks fire outside Claude Code too.
---

1. Check whether `.githooks/` exists at the repo root.
2. If it exists: run `git config core.hooksPath .githooks` and confirm with
   `git config --get core.hooksPath`. Tell the user this is one-time per clone and
   reversible with `git config --unset core.hooksPath`.
3. If it doesn't exist: tell the user this repo has no tracked git-level hooks needing
   wiring — its hooks are enforced entirely through `.claude/settings.json`
   (PreToolUse/PostToolUse/Stop), which need no separate setup step. Nothing to do.

Idempotent — safe to re-run.
