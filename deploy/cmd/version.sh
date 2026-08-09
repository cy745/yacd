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
# 归一化版本号:本地 VERSION 无 v 前缀,远端 tag 有 v 前缀,去 v 后比较
remote_tag="$(fetch_latest_tag 2>/dev/null || true)"
if [ -n "$remote_tag" ]; then
  local_norm="${YACD_VERSION#v}"
  remote_norm="${remote_tag#v}"
  if [ "$local_norm" = "$remote_norm" ]; then
    ok "已是最新版本 ($remote_tag)"
  else
    warn "远端最新版本: $remote_tag(本地 $YACD_VERSION,运行 yacd update 升级)"
  fi
else
  warn "无法检查远端版本(网络受限?)"
fi
