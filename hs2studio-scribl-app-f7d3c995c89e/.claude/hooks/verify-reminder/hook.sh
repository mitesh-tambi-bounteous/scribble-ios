#!/usr/bin/env sh
# verify-reminder (Stop / no matcher / WARN)
#
# Purpose: on session stop, print a manual-verification checklist to
# stderr. Expo SDK 56, no EAS, no remote Expo MCP means there is no
# automated device pipeline; a human must eyeball the build. This hook
# only reminds. It never blocks and never inspects state.
#
# Exit code: always 0.

set -u

# Drain stdin so the payload does not linger on the pipe.
cat >/dev/null 2>&1

echo "verify-reminder: before you call this done, manually verify:" >&2
echo "  1. Runs on web (expo start --web)." >&2
echo "  2. Runs on at least one device or simulator (iOS or Android)." >&2
echo "  3. Drawing feels smooth on-device (no lag while sketching)." >&2
echo "  4. AC7: submit-to-unlock actually gates the feed. The feed stays" >&2
echo "     locked until you submit your own drawing, then unlocks." >&2

exit 0
