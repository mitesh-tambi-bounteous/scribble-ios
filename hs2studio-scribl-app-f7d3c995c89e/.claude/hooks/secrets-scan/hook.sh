#!/usr/bin/env sh
# secrets-scan (PreToolUse / Edit|Write|Bash / WARN)
#
# Purpose: scan the tool payload (file content for Edit/Write, command
# string for Bash) for obvious committed-secret patterns and WARN the
# operator. This hook never blocks: a POC may legitimately reference
# placeholder tokens, so we surface findings and let a human judge.
#
# Read-only: only inspects the payload from stdin.
#
# Exit code: always 0 (warn or silent allow).

set -u

# The whole payload is scanned as plain text. This covers Write content,
# Edit new_string, and Bash command in one pass without JSON parsing.
payload=$(cat)

findings=""

add() {
  # add <label>: appends a finding line if the pattern matched.
  findings="${findings}  - $1
"
}

# AWS access key id (AKIA followed by 16 base32 chars).
if printf '%s' "$payload" | grep -Eq 'AKIA[0-9A-Z]{16}'; then
  add "AWS access key id (AKIA...)"
fi

# AWS secret access key assignment.
if printf '%s' "$payload" | grep -Eiq 'aws_secret_access_key'; then
  add "aws_secret_access_key reference"
fi

# Anthropic key in an env assignment.
if printf '%s' "$payload" | grep -Eq 'ANTHROPIC_API_KEY[[:space:]]*=[[:space:]]*"?sk-'; then
  add "ANTHROPIC_API_KEY=sk-... assignment"
fi

# Private key PEM header (RSA / EC / OPENSSH / generic).
if printf '%s' "$payload" | grep -Eq 'BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY'; then
  add "private key header (BEGIN ... PRIVATE KEY)"
fi

# Generic token=/secret= with a long value (likely high-entropy literal).
if printf '%s' "$payload" | grep -Eiq '(token|secret)[[:space:]]*[=:][[:space:]]*"?[A-Za-z0-9_/+-]{20,}'; then
  add "generic token=/secret= with a long literal value"
fi

if [ -n "$findings" ]; then
  echo "secrets-scan: possible secret(s) in this tool payload (WARN, not blocking):" >&2
  printf '%s' "$findings" >&2
  echo "Confirm these are placeholders, not real credentials, before proceeding." >&2
fi

exit 0
