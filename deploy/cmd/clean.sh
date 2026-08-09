#!/usr/bin/env bash
# yacd clean — 彻底清理(删除容器 + 数据卷,清空配置!需确认)
set -euo pipefail
# shellcheck disable=SC1091
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib/utils.sh"

warn "此操作将删除数据卷 mihomo-config,清空全部 mihomo 配置!"
# 非交互/EOF 时 read 返回非零,set -e 会中断;用 || true 兜底
read -r -p "确认删除数据卷并清空数据? [y/N] " ans || ans=""
case "$ans" in
  [yY]*)
    "${COMPOSE[@]}" down -v
    ok "已清理容器与数据卷"
    ;;
  *)
    info "已取消"
    ;;
esac
