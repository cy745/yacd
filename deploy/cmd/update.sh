#!/usr/bin/env bash
# yacd update — 更新到最新版(下载最新代码 + 重建容器)
# 数据影响:配置保留(卷不清空);重建镜像与容器
set -euo pipefail
# shellcheck disable=SC1091
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib/utils.sh"
# shellcheck disable=SC1091
source "$DEPLOY_DIR/lib/download.sh"

info "检查最新版本..."
local_tag="$(cat "$DEPLOY_DIR/VERSION" 2>/dev/null || echo dev)"

# 解析远端最新版本
if [ "${YACD_USE_MAIN:-0}" = "1" ]; then
  remote_tag="main"
  info "使用 main 分支开发版"
else
  remote_tag="$(fetch_latest_tag || true)"
  if [ -z "$remote_tag" ]; then
    err "无法解析远端版本(GitHub API 不可达?)"
    warn "网络受限时可用 YACD_USE_MAIN=1 直接抓 main 分支。"
    exit 1
  fi
  info "本地: $local_tag | 远端: $remote_tag"
  if [ "$local_tag" = "$remote_tag" ] && [ -z "${YACD_FORCE_UPDATE:-}" ]; then
    ok "已是最新版本,无需更新"
    exit 0
  fi
fi

# 下载并解压
TMP_TAR="$(mktemp -t yacd-update.XXXXXX.tar.gz)"
trap 'rm -f "$TMP_TAR"' EXIT
if ! download_release "$TMP_TAR"; then
  err "下载失败(可能 release 尚未发布,尝试 YACD_USE_MAIN=1 用 main 分支)"
  exit 1
fi
extract_release "$TMP_TAR" "$INSTALL_DIR"

# 更新后重建容器(拉最新代码重建容器)
info "触发重建容器..."
exec "$DEPLOY_DIR/manage.sh" rebuild
