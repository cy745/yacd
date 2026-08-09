#!/usr/bin/env bash
# yacd stop — 停止容器(数据保留)
set -euo pipefail
# shellcheck disable=SC1091
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib/utils.sh"

info "停止容器..."
"${COMPOSE[@]}" stop
ok "已停止(数据保留)"
