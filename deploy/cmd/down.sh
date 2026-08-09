#!/usr/bin/env bash
# yacd down — 停止并移除容器(数据卷保留)
set -euo pipefail
# shellcheck disable=SC1091
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib/utils.sh"

info "停止并移除容器(数据卷保留)..."
"${COMPOSE[@]}" down --remove-orphans
ok "已移除容器,数据保留"
