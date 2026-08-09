#!/usr/bin/env bash
# yacd self-update — 仅更新部署脚本/compose 文件到 master 分支最新,不重建容器、不触碰运行中容器
# 数据影响:无(不动容器与卷)
#
# 注意:强制用 master 分支源码(而非 release 资产),这样每次 push master 后
#       yacd self-update 即可拿到最新脚本,不依赖发版。
set -euo pipefail
# shellcheck disable=SC1091
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib/utils.sh"
# shellcheck disable=SC1091
source "$DEPLOY_DIR/lib/download.sh"

info "从 master 分支下载最新部署脚本..."
TMP_TAR="$(mktemp -t yacd-sysupdate.XXXXXX.tar.gz)"
trap 'rm -f "$TMP_TAR"' EXIT
if ! YACD_USE_MAIN=1 download_release "$TMP_TAR"; then
  err "下载失败"
  exit 1
fi
extract_release "$TMP_TAR" "$INSTALL_DIR"

info "部署脚本已更新(容器未动)"
ok "如需重建容器应用最新镜像,请运行: yacd rebuild"
