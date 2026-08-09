#!/usr/bin/env bash
# =============================================================================
#  yacd 公共工具函数
#
#  被 manage.sh 与 deploy/cmd/*.sh 以 source 方式加载。
#  依赖:bash + curl/wget/tar + docker(零第三方运行时)
# =============================================================================

# 幂等:只加载一次(注意:不要 export,否则会误伤子进程重复加载)
[ -n "${YACD_UTILS_LOADED:-}" ] && return 0
YACD_UTILS_LOADED=1

# ── 定位 ───────────────────────────────────────────────────────────────────
# 本文件位于 <deploy>/lib/utils.sh;DEPLOY_DIR 即 deploy/ 根
UTILS_PATH="$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")"
DEPLOY_DIR="$(cd "$(dirname "$UTILS_PATH")/.." && pwd)"
REPO_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"

# 关键:切换到 deploy/ 目录,使 docker compose 能定位 docker-compose.yml
# (compose 依赖 cwd 查找配置;否则从任意目录调用会报 "no configuration file provided")
cd "$DEPLOY_DIR"

# ── 环境变量加载(.env,自动剔除 CRLF) ─────────────────────────────────────
load_env() {
  if [ -f "$DEPLOY_DIR/.env" ]; then
    set -a
    # shellcheck disable=SC1090
    . <(sed 's/\r$//' "$DEPLOY_DIR/.env")
    set +a
  fi
}
load_env

# ── 默认值(可被 .env 覆盖) ────────────────────────────────────────────────
NETWORK_NAME="${NETWORK_NAME:-macnet}"
PARENT_IFACE="${PARENT_IFACE:-eth1}"
SUBNET="${SUBNET:-192.168.3.0/24}"
GATEWAY="${GATEWAY:-192.168.3.1}"
CONTAINER_NAME="${CONTAINER_NAME:-yacd-mihomo}"
MIHOMO_IP="${MIHOMO_IP:-192.168.3.100}"
MIHOMO_TARGET="${MIHOMO_TARGET:-http://127.0.0.1:9090}"
# 安装目录(install.sh / self-update.sh 使用;manage.sh 自身定位到 deploy/,
# 默认 INSTALL_DIR = deploy/ 的上级目录,即安装根)
INSTALL_DIR="${YACD_INSTALL_DIR:-$(dirname "$DEPLOY_DIR")}"

# 版本:优先 VERSION 文件,否则 git describe,兜底 dev
if [ -f "$DEPLOY_DIR/VERSION" ]; then
  YACD_VERSION="$(cat "$DEPLOY_DIR/VERSION" 2>/dev/null || echo dev)"
else
  YACD_VERSION="$(git -C "$REPO_DIR" describe --tags --always 2>/dev/null || echo dev)"
fi

# ── compose 命令探测(v2 优先) ─────────────────────────────────────────────
select_compose() {
  if docker compose version >/dev/null 2>&1; then
    COMPOSE=(docker compose)
  elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE=(docker-compose)
  else
    err "未找到 docker compose 或 docker-compose"
    exit 1
  fi
}
select_compose

# ── 日志 ───────────────────────────────────────────────────────────────────
info() { echo -e "\033[1;34m[INFO]\033[0m $*"; }
ok()   { echo -e "\033[1;32m[ OK ]\033[0m $*"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m $*"; }
err()  { echo -e "\033[1;31m[ERR ]\033[0m $*" >&2; }

# ── 前端产物检查(镜像构建需要) ────────────────────────────────────────────
check_public() {
  local pub="$REPO_DIR/public/index.html"
  if [ ! -f "$pub" ]; then
    err "未找到 public/index.html,镜像构建需要前端产物。"
    echo "  请先在本地(开发机)构建前端:"
    echo "    pnpm install"
    echo "    pnpm build"
    echo "  将生成的 public/ 上传到 NAS 项目目录后重试。"
    exit 1
  fi
  ok "前端产物存在: $pub"
}

# ── macvlan 网络:幂等创建 + parent 校验 ──────────────────────────────────
create_network() {
  if docker network inspect "$NETWORK_NAME" >/dev/null 2>&1; then
    local actual_parent
    actual_parent="$(docker network inspect "$NETWORK_NAME" --format '{{index .Options "parent"}}' 2>/dev/null || true)"
    if [ -n "$actual_parent" ] && [ "$actual_parent" != "$PARENT_IFACE" ]; then
      err "现有网络 $NETWORK_NAME 的 parent 是 $actual_parent,与 .env 配置 $PARENT_IFACE 不一致!"
      warn "这会导致宿主机无法访问容器(macvlan 同端口隔离)或网络不符合预期。"
      warn "请先删除旧网络再重试:"
      echo "    docker network rm $NETWORK_NAME"
      echo "    yacd up"
      exit 1
    fi
    ok "macvlan 网络 $NETWORK_NAME 已存在 (parent=$PARENT_IFACE)"
    return 0
  fi
  info "创建 macvlan 网络 $NETWORK_NAME (parent=$PARENT_IFACE)..."
  docker network create -d macvlan \
    --subnet="$SUBNET" \
    --gateway="$GATEWAY" \
    -o "parent=$PARENT_IFACE" \
    "$NETWORK_NAME"
  ok "macvlan 网络 $NETWORK_NAME 已创建"
}

# ── 同名容器冲突处理(数据卷保留) ─────────────────────────────────────────
ensure_no_conflict() {
  local existing project
  existing="$(docker ps -a --filter "name=$CONTAINER_NAME" --format '{{.Names}}' | grep -x "$CONTAINER_NAME" || true)"
  [ -z "$existing" ] && return 0

  # 若容器已由当前 compose 项目管理(compose up 会复用,不冲突),跳过
  if [ -n "$("${COMPOSE[@]}" ps -q "$CONTAINER_NAME" 2>/dev/null || true)" ]; then
    ok "容器 $CONTAINER_NAME 已由当前 compose 项目管理,无需处理"
    return 0
  fi

  project="$(docker inspect "$existing" --format '{{index .Config.Labels "com.docker.compose.project"}}' 2>/dev/null || true)"
  if [ -n "$project" ]; then
    warn "检测到容器 '$CONTAINER_NAME' 属于另一个 compose 项目 '$project',移除以便当前项目接管(数据卷保留)..."
  else
    warn "检测到手动创建的旧容器 '$CONTAINER_NAME',移除以便 compose 接管(数据卷保留)..."
  fi
  docker rm -f "$existing"
  ok "旧容器已移除(数据卷 mihomo-config 未受影响)"
}

# ── 状态展示 ───────────────────────────────────────────────────────────────
show_status() {
  echo ""
  echo "── 容器状态 ──────────────────────────────────────"
  docker ps --filter "name=$CONTAINER_NAME" \
    --format '  {{.Names}}\t{{.Status}}'
  echo "── 访问地址 ──────────────────────────────────────"
  echo "  管理面板(宿主/局域网):  http://${MIHOMO_IP}"
  echo "  容器日志:                docker logs -f ${CONTAINER_NAME}"
  echo "  CLI 版本:                ${YACD_VERSION}"
}
