#!/usr/bin/env bash
# yacd up — 一键部署(自动建网络/构建镜像/启动容器)
set -euo pipefail
# shellcheck disable=SC1091
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib/utils.sh"

check_public
create_network
ensure_no_conflict
info "构建并启动容器..."
"${COMPOSE[@]}" up -d --build
ok "启动完成"
show_status
