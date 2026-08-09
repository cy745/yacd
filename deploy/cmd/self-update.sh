#!/usr/bin/env bash
# yacd self-update — 仅更新部署脚本/compose 文件,不重建容器、不触碰运行中容器
# 数据影响:无(不动容器与卷)
set -euo pipefail
# shellcheck disable=SC1091
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib/utils.sh"
# shellcheck disable=SC1091
source "$DEPLOY_DIR/lib/download.sh"

info "下载最新部署脚本..."
TMP_TAR="$(mktemp -t yacd-sysupdate.XXXXXX.tar.gz)"
trap 'rm -f "$TMP_TAR"' EXIT
if ! download_release "$TMP_TAR"; then
  err "下载失败"
  exit 1
fi
extract_release "$TMP_TAR" "$INSTALL_DIR"

info "部署脚本已更新(容器未动)"
ok "如需重建容器应用最新镜像,请运行: yacd rebuild"
