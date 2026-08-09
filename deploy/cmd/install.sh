#!/usr/bin/env bash
# yacd install — 安装/升级 CLI(等价重跑 curl|sh 安装脚本,幂等)
# 数据影响:不动容器与数据卷;若 .env 已存在则保留
set -euo pipefail
# shellcheck disable=SC1091
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib/utils.sh"

exec sh "$DEPLOY_DIR/install.sh" "$@"
