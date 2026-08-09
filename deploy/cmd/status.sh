#!/usr/bin/env bash
# yacd status — 查看状态与访问地址
set -euo pipefail
# shellcheck disable=SC1091
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib/utils.sh"

show_status
