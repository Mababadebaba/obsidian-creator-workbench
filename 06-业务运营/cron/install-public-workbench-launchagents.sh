#!/bin/bash
# Install launchd services that keep the public workbench online after reboot.
set -euo pipefail

# 默认取脚本自身位置的上两级（= vault 根），不写死绝对路径
ROOT="${CONTENT_WORKBENCH_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
CRON_DIR="$ROOT/06-业务运营/cron"
PUBLIC_DIR="${CONTENT_WORKBENCH_PUBLIC_DIR:-$HOME/.content-workbench-public}"
HTTP_PLIST="$HOME/Library/LaunchAgents/com.content-workbench.http.plist"
TUNNEL_PLIST="$HOME/Library/LaunchAgents/com.content-workbench.cloudflared.plist"
HTTP_LOG="/tmp/content-workbench-http.log"
HTTP_ERR="/tmp/content-workbench-http.err"
TUNNEL_LOG="/tmp/content-workbench-cloudflared.log"
TUNNEL_ERR="/tmp/content-workbench-cloudflared.err"
USER_ID="$(id -u)"
PYTHON_BIN="${PYTHON_BIN:-/usr/bin/python3}"
CLOUDFLARED_BIN="${CLOUDFLARED_BIN:-$(command -v cloudflared || true)}"

if [ -z "$CLOUDFLARED_BIN" ] && [ -x "/opt/homebrew/bin/cloudflared" ]; then
  CLOUDFLARED_BIN="/opt/homebrew/bin/cloudflared"
fi

if [ ! -x "$PYTHON_BIN" ]; then
  echo "python not executable: $PYTHON_BIN" >&2
  exit 1
fi

if [ -z "$CLOUDFLARED_BIN" ] || [ ! -x "$CLOUDFLARED_BIN" ]; then
  echo "cloudflared not found. Install it with: brew install cloudflared" >&2
  exit 1
fi

"$CRON_DIR/publish-workbench.sh"

mkdir -p "$HOME/Library/LaunchAgents"
: > "$TUNNEL_LOG"
: > "$TUNNEL_ERR"

cat > "$HTTP_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.content-workbench.http</string>
  <key>ProgramArguments</key>
  <array>
    <string>$PYTHON_BIN</string>
    <string>-m</string>
    <string>http.server</string>
    <string>8787</string>
    <string>--bind</string>
    <string>127.0.0.1</string>
    <string>--directory</string>
    <string>$PUBLIC_DIR</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$HTTP_LOG</string>
  <key>StandardErrorPath</key>
  <string>$HTTP_ERR</string>
</dict>
</plist>
PLIST

cat > "$TUNNEL_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.content-workbench.cloudflared</string>
  <key>ProgramArguments</key>
  <array>
    <string>$CLOUDFLARED_BIN</string>
    <string>tunnel</string>
    <string>--no-autoupdate</string>
    <string>--url</string>
    <string>http://127.0.0.1:8787</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$TUNNEL_LOG</string>
  <key>StandardErrorPath</key>
  <string>$TUNNEL_ERR</string>
</dict>
</plist>
PLIST

plutil -lint "$HTTP_PLIST" "$TUNNEL_PLIST"

launchctl bootout "gui/$USER_ID" "$HTTP_PLIST" 2>/dev/null || true
launchctl bootout "gui/$USER_ID" "$TUNNEL_PLIST" 2>/dev/null || true
launchctl bootstrap "gui/$USER_ID" "$HTTP_PLIST"
launchctl bootstrap "gui/$USER_ID" "$TUNNEL_PLIST"
launchctl kickstart -k "gui/$USER_ID/com.content-workbench.http"
launchctl kickstart -k "gui/$USER_ID/com.content-workbench.cloudflared"

sleep 8
"$CRON_DIR/public-workbench-url.sh"
