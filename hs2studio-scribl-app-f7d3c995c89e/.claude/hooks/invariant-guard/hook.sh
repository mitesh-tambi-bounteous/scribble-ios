#!/usr/bin/env sh
# invariant-guard (PreToolUse / Bash / BLOCK)
#
# Purpose: the scribl POC has two launch-blocking invariants:
#   AC2 = submit-to-unlock (you must submit your own drawing to unlock
#         the feed; enforced at the data layer)
#   AC4 = channel isolation (server-side authz keeps channels separate)
# Before any `git commit`, verify a test exists for each. This is a
# pragmatic presence check (grep the test tree for markers), not a run.
# If either marker is missing, block and name the failing AC.
#
# Read-only: only greps the repo. Never mutates anything.
#
# Exit codes: 2 = block, 0 = allow.

set -u

payload=$(cat)

# Pull the Bash command out of the payload (best-effort, no JSON dep).
cmd=$(printf '%s' "$payload" \
  | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\(.*\)/\1/p' \
  | sed 's/".*//')

# Only gate on git commit.
case "$cmd" in
  *"git commit"*) : ;;
  *) exit 0 ;;
esac

# Locate the repo root so the search is stable regardless of cwd.
root=$(git rev-parse --show-toplevel 2>/dev/null) || root="."

# Search markers. We match on filename OR file content so either a file
# named "submit-to-unlock.test.ts" or a test labelled "submit-to-unlock"
# satisfies the check. -r recursive, -I skip binaries, -l list files,
# -q quiet for the content pass.
has_marker() {
  # has_marker <marker>: returns 0 if found as filename or content.
  marker=$1
  # Filename match.
  if find "$root" -type f -name "*${marker}*" 2>/dev/null | grep -q .; then
    return 0
  fi
  # Content match (skip .git and node_modules to stay fast).
  if grep -rIlq \
      --exclude-dir=.git \
      --exclude-dir=node_modules \
      "$marker" "$root" 2>/dev/null; then
    return 0
  fi
  return 1
}

missing=""

if ! has_marker "submit-to-unlock"; then
  missing="${missing}  - AC2 submit-to-unlock test (data-layer invariant)
"
fi

if ! has_marker "channel-isolation"; then
  missing="${missing}  - AC4 channel-isolation test (server-side authz)
"
fi

if [ -n "$missing" ]; then
  echo "invariant-guard: refusing commit. Missing launch-blocking test(s):" >&2
  printf '%s' "$missing" >&2
  echo "Add a test marked for each invariant before committing." >&2
  exit 2
fi

exit 0
