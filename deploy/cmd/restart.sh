#!/usr/bin/env bash
# yacd restart — 重启容器
set -euo pipefail
# shellcheck disable=SC1091
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib/utils.sh"

info "重启容器..."
"${COMPOSE[@]}" restart
ok "已重启"
