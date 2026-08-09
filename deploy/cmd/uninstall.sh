#!/usr/bin/env bash
# yacd uninstall — 卸载(clean 清数据 + 删软链 + 删安装目录,双重确认)
# 数据影响:清空容器 + 数据卷 + CLI 本体
set -euo pipefail
# shellcheck disable=SC1091
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib/utils.sh"

warn "此操作将:"
warn "  1. 停止并删除容器(含数据卷 mihomo-config,清空全部配置)"
warn "  2. 删除命令入口 \$(command -v yacd 2>/dev/null)"
warn "  3. 删除安装目录 $INSTALL_DIR"
echo ""
read -r -p "确认完全卸载 yacd? [y/N] " ans || ans=""
case "$ans" in
  [yY]*)
    # 先清理容器与数据卷
    if docker ps -a --filter "name=$CONTAINER_NAME" --format '{{.Names}}' | grep -q "$CONTAINER_NAME"; then
      info "清理容器与数据卷..."
      "${COMPOSE[@]}" down -v 2>/dev/null || docker rm -f "$CONTAINER_NAME" || true
    fi
    # 删除软链
    local link
    link="$(command -v yacd 2>/dev/null || echo "")"
    if [ -n "$link" ] && [ -e "$link" ]; then
      rm -f "$link"
      ok "已删除命令入口 $link"
    fi
    # 删除安装目录
    if [ -d "$INSTALL_DIR" ]; then
      rm -rf "$INSTALL_DIR"
      ok "已删除安装目录 $INSTALL_DIR"
    fi
    ok "yacd 已卸载"
    ;;
  *)
    info "已取消"
    ;;
esac
