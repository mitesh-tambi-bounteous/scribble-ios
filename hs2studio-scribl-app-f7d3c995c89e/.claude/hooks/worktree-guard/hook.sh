#!/usr/bin/env sh
# worktree-guard (PreToolUse / Bash / BLOCK)
#
# Purpose: enforce the "always work in a git worktree, never the primary
# checkout" discipline for write operations. If the Bash command is a
# `git commit` or `git add` AND the current directory is the main worktree
# (the primary checkout), block and tell the operator to use a worktree.
#
# Read-only: this script only inspects state. It never mutates anything.
#
# Exit codes: 2 = block, 0 = allow.

set -u

# Read the hook payload (tool input JSON) from stdin.
payload=$(cat)

# Extract the Bash command string. The payload nests it under
# tool_input.command. We avoid a JSON dependency: grab the first
# "command" string value with sed. This is a best-effort extraction;
# if it fails we allow (fail-open for a guard that only gates commits).
cmd=$(printf '%s' "$payload" \
  | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\(.*\)/\1/p' \
  | sed 's/".*//')

# Only care about git commit / git add. Everything else is allowed.
case "$cmd" in
  *"git commit"*|*"git add"*) : ;;
  *) exit 0 ;;
esac

# Determine whether we are inside a git repo at all. If not, allow
# (let git itself complain).
git_dir=$(git rev-parse --git-dir 2>/dev/null) || exit 0

# A linked worktree has its git dir inside ".git/worktrees/<name>".
# The primary checkout's git dir is the plain ".git".
case "$git_dir" in
  *".git/worktrees/"*)
    # We are in a linked worktree. Allowed.
    exit 0
    ;;
esac

# Secondary signal: compare this toplevel against the main worktree path.
# `git worktree list` prints the main worktree first.
toplevel=$(git rev-parse --show-toplevel 2>/dev/null)
main_wt=$(git worktree list 2>/dev/null | sed -n '1s/[[:space:]].*//p')

if [ -n "$toplevel" ] && [ -n "$main_wt" ] && [ "$toplevel" != "$main_wt" ]; then
  # Toplevel differs from the main worktree -> we are in a linked worktree.
  exit 0
fi

# Reaching here means we are in the primary checkout. Block.
echo "worktree-guard: refusing 'git commit'/'git add' from the primary checkout." >&2
echo "Work in a git worktree instead, e.g.:" >&2
echo "  git worktree add ../<repo>-wt/<slug> -b <slug>" >&2
echo "Then re-run the commit from inside that worktree directory." >&2
exit 2
