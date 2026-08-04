#!/bin/bash
# Rebuild and publish the static dashboard into the directory served by launchd.
set -euo pipefail

# 默认取脚本自身位置的上两级（= vault 根），不写死绝对路径
ROOT="${CONTENT_WORKBENCH_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
DASHBOARD_DIR="${CONTENT_WORKBENCH_DASHBOARD_DIR:-$ROOT/dashboard}"
PUBLIC_DIR="${CONTENT_WORKBENCH_PUBLIC_DIR:-$HOME/.content-workbench-public}"
CRON_DIR="${CONTENT_WORKBENCH_CRON_DIR:-$ROOT/06-业务运营/cron}"
BUILD=1

if [ "${1:-}" = "--skip-build" ]; then
  BUILD=0
fi

# 必须与 dashboard/build.py 的 PAGES 元组保持一致（当前 9 页）。
# 历史缺陷：此处长期只列 7 页，导致 cheat / dbs 两个控制台从未发布到公网。
PAGES=(index ideas auto-hotspots radar pipeline analytics library cheat dbs)

if [ "$BUILD" -eq 1 ]; then
  (cd "$DASHBOARD_DIR" && python3 build.py)
fi

mkdir -p "$PUBLIC_DIR/assets"

for page in "${PAGES[@]}"; do
  src="$DASHBOARD_DIR/$page.html"
  if [ ! -f "$src" ]; then
    echo "missing dashboard page: $src" >&2
    exit 1
  fi
  install -m 0644 "$src" "$PUBLIC_DIR/$page.html"
done

if [ ! -d "$DASHBOARD_DIR/assets" ]; then
  echo "missing dashboard assets dir: $DASHBOARD_DIR/assets" >&2
  exit 1
fi

rsync -a --delete "$DASHBOARD_DIR/assets/" "$PUBLIC_DIR/assets/"

URL=""
if [ -x "$CRON_DIR/public-workbench-url.sh" ]; then
  URL="$("$CRON_DIR/public-workbench-url.sh" 2>/dev/null || true)"
fi

echo "published workbench: $PUBLIC_DIR"
if [ -n "$URL" ]; then
  echo "public url: $URL"
fi
