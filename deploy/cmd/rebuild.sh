#!/usr/bin/env bash
# yacd rebuild — 重建容器(镜像重建 + 容器重建,数据卷保留,配置不清空)
set -euo pipefail
# shellcheck disable=SC1091
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib/utils.sh"

check_public
create_network
ensure_no_conflict
info "重建容器(数据卷 mihomo-config 保留,配置不清空)..."
# 先构建新镜像,构建成功后才替换容器,避免构建失败时服务停机
"${COMPOSE[@]}" build
"${COMPOSE[@]}" up -d --force-recreate --no-build
ok "重建完成"
show_status
