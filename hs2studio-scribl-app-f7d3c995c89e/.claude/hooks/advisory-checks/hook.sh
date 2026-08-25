#!/usr/bin/env sh
# advisory-checks (PostToolUse / Edit|Write / WARN)
#
# Purpose: after an Edit or Write to a markdown file, scan the resulting
# file for prose nits and WARN. Findings are advisory only; this hook
# never blocks. Current checks:
#   - em-dash (unicode U+2014) usage (house style is plain ASCII)
#   - trailing whitespace
#   - common doubled words ("the the", "and and")
#   - TODO/FIXME left in prose
#
# Read-only: only reads the edited file. Never mutates anything.
#
# Exit code: always 0.

set -u

payload=$(cat)

# Resolve the edited file path from the payload. PostToolUse payloads
# carry it under tool_input.file_path. Best-effort sed extraction.
file=$(printf '%s' "$payload" \
  | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
  | head -n 1)

# Only act on markdown files that exist.
case "$file" in
  *.md|*.markdown) : ;;
  *) exit 0 ;;
esac
[ -f "$file" ] || exit 0

findings=""
add() {
  findings="${findings}  - $1
"
}

# Em-dash detection. The em-dash is the 3-byte UTF-8 sequence E2 80 94.
# We match it via grep -P if available, else fall back to a printf'd
# literal byte search. Either way we never emit the character ourselves.
emdash=$(printf '\342\200\224')
if grep -qF "$emdash" "$file" 2>/dev/null; then
  n=$(grep -oF "$emdash" "$file" 2>/dev/null | wc -l | tr -d ' ')
  add "em-dash (unicode) used ${n} time(s); house style is plain ASCII (use ' - ')"
fi

# Trailing whitespace.
if grep -nq '[[:space:]]$' "$file" 2>/dev/null; then
  add "trailing whitespace on one or more lines"
fi

# Doubled words (case-insensitive simple cases).
if grep -Eiq '\b(the|and|a|to|of|in|is)[[:space:]]+\1\b' "$file" 2>/dev/null; then
  add "possible doubled word (e.g. 'the the')"
fi

# Leftover TODO / FIXME markers.
if grep -Eq '\b(TODO|FIXME)\b' "$file" 2>/dev/null; then
  add "TODO/FIXME marker left in prose"
fi

if [ -n "$findings" ]; then
  echo "advisory-checks: prose nits in ${file} (WARN, not blocking):" >&2
  printf '%s' "$findings" >&2
fi

exit 0
