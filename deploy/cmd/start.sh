#!/usr/bin/env bash
# yacd start — 启动已停止的容器
set -euo pipefail
# shellcheck disable=SC1091
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib/utils.sh"

info "启动容器..."
"${COMPOSE[@]}" start
ok "已启动"
