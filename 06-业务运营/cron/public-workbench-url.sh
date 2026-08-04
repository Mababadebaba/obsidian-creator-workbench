#!/bin/bash
# Print the latest trycloudflare.com URL emitted by the public workbench tunnel.
set -euo pipefail

LOG="${CONTENT_WORKBENCH_TUNNEL_LOG:-/tmp/content-workbench-cloudflared.err}"

if [ ! -f "$LOG" ]; then
  echo "no tunnel log found: $LOG" >&2
  exit 1
fi

URL="$(
  awk '
    match($0, /https:\/\/[a-z0-9-]+\.trycloudflare\.com/) {
      url = substr($0, RSTART, RLENGTH)
    }
    END {
      if (url) print url
    }
  ' "$LOG"
)"

if [ -z "$URL" ]; then
  echo "no trycloudflare URL found in $LOG" >&2
  exit 1
fi

echo "$URL"
