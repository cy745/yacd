#!/usr/bin/env bash
# yacd logs — 查看容器日志(跟随)
set -euo pipefail
# shellcheck disable=SC1091
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib/utils.sh"

exec "${COMPOSE[@]}" logs -f --tail=50
