#!/usr/bin/env bash
# yacd network — 创建/检查 macvlan 网络(幂等,parent 冲突即报错)
set -euo pipefail
# shellcheck disable=SC1091
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib/utils.sh"

create_network
