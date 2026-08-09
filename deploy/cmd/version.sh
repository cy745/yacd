#!/usr/bin/env bash
# yacd version — 显示本地版本并对比远端最新
set -euo pipefail
# shellcheck disable=SC1091
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib/utils.sh"
# shellcheck disable=SC1091
source "$DEPLOY_DIR/lib/download.sh"

echo "yacd $YACD_VERSION"
echo "安装目录: $INSTALL_DIR"

# 对比远端(可选,失败不阻塞)
remote_tag="$(fetch_latest_tag 2>/dev/null || true)"
if [ -n "$remote_tag" ]; then
  if [ "$YACD_VERSION" = "$remote_tag" ]; then
    ok "已是最新版本 ($remote_tag)"
  else
    warn "远端最新版本: $remote_tag(本地 $YACD_VERSION,运行 yacd update 升级)"
  fi
else
  warn "无法检查远端版本(网络受限?)"
fi
