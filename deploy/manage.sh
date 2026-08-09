#!/usr/bin/env bash
# =============================================================================
#  yacd-mihomo 一键管理脚本
#
#  基于 docker compose 部署 mihomo + yacd 组合容器。
#
#  核心命令:
#    up       一键启动(自动创建网络 → 构建镜像 → 启动容器)
#    rebuild  重建容器(镜像 + 容器重建,数据卷保留,配置不清空)
#    network  创建/检查 macvlan 网络
#    restart  重启容器
#    ...
#
#  数据安全:容器重建/删除时,命名卷 mihomo-config 保留,配置不丢。
#  仅 clean 命令会删除数据卷(清空配置),使用前请三思。
#
#  用法:
#    ./manage.sh up
#    ./manage.sh rebuild
#    ./manage.sh -h
# =============================================================================

set -euo pipefail

# ── 定位与配置加载 ─────────────────────────────────────────────────────────
# 解析符号链接,保证从任意路径/PATH 调用都能正确定位脚本所在目录
SCRIPT_PATH="$(readlink -f "${BASH_SOURCE[0]:-$0}" 2>/dev/null || echo "${BASH_SOURCE[0]}")"
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"
cd "$SCRIPT_DIR"

# 加载 .env(若存在),供脚本与 docker compose 共用。
# 用 sed 剔除 CRLF 行尾(避免 Windows 编辑器保存 .env 后值带 \r 导致配置失效)。
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . <(sed 's/\r$//' .env)
  set +a
fi

# 默认值(可被 .env 覆盖)
NETWORK_NAME="${NETWORK_NAME:-macnet}"
PARENT_IFACE="${PARENT_IFACE:-eth1}"
SUBNET="${SUBNET:-192.168.3.0/24}"
GATEWAY="${GATEWAY:-192.168.3.1}"
CONTAINER_NAME="${CONTAINER_NAME:-yacd-mihomo}"
MIHOMO_IP="${MIHOMO_IP:-192.168.3.100}"

# 选择 compose 命令(v2 优先)
if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  echo "错误:未找到 docker compose 或 docker-compose" >&2
  exit 1
fi

# ── 工具函数 ───────────────────────────────────────────────────────────────
info()  { echo -e "\033[1;34m[INFO]\033[0m $*"; }
ok()    { echo -e "\033[1;32m[ OK ]\033[0m $*"; }
warn()  { echo -e "\033[1;33m[WARN]\033[0m $*"; }
err()   { echo -e "\033[1;31m[ERR ]\033[0m $*"; }

# 前置检查:前端构建产物存在(镜像构建需要)
check_public() {
  local pub="$SCRIPT_DIR/../public/index.html"
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

# 幂等创建 macvlan 网络(parent 网卡必须是有线物理网卡)
create_network() {
  if docker network inspect "$NETWORK_NAME" >/dev/null 2>&1; then
    local actual_parent
    actual_parent="$(docker network inspect "$NETWORK_NAME" --format '{{index .Options "parent"}}' 2>/dev/null || true)"
    if [ -n "$actual_parent" ] && [ "$actual_parent" != "$PARENT_IFACE" ]; then
      err "现有网络 $NETWORK_NAME 的 parent 是 $actual_parent,与 .env 配置 $PARENT_IFACE 不一致!"
      warn "这会导致宿主机无法访问容器(macvlan 同端口隔离)或网络不符合预期。"
      warn "请先删除旧网络再重试:"
      echo "    docker network rm $NETWORK_NAME"
      echo "    ./manage.sh up"
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

# 处理同名容器冲突(避免 compose 启动失败,数据卷不受影响)
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
    # 来自另一个 compose 项目:container_name 全局唯一,必然冲突
    warn "检测到容器 '$CONTAINER_NAME' 属于另一个 compose 项目 '$project',移除以便当前项目接管(数据卷保留)..."
  else
    warn "检测到手动创建的旧容器 '$CONTAINER_NAME',移除以便 compose 接管(数据卷保留)..."
  fi
  docker rm -f "$existing"
  ok "旧容器已移除(数据卷 mihomo-config 未受影响)"
}

# 展示运行状态与访问地址
show_status() {
  echo ""
  echo "── 容器状态 ──────────────────────────────────────"
  docker ps --filter "name=$CONTAINER_NAME" \
    --format '  {{.Names}}\t{{.Status}}'
  echo "── 访问地址 ──────────────────────────────────────"
  echo "  管理面板(宿主/局域网):  http://${MIHOMO_IP}"
  echo "  容器日志:                docker logs -f ${CONTAINER_NAME}"
}

# ── 子命令 ───────────────────────────────────────────────────────────────
cmd_up() {
  check_public
  create_network
  ensure_no_conflict
  info "构建并启动容器..."
  "${COMPOSE[@]}" up -d --build
  ok "启动完成"
  show_status
}

cmd_rebuild() {
  check_public
  create_network
  ensure_no_conflict
  info "重建容器(数据卷 mihomo-config 保留,配置不清空)..."
  # 先构建新镜像,构建成功后才替换容器,避免构建失败时服务停机
  "${COMPOSE[@]}" build
  "${COMPOSE[@]}" up -d --force-recreate --no-build
  ok "重建完成"
  show_status
}

cmd_network() { create_network; }

cmd_start()    { info "启动容器..."; "${COMPOSE[@]}" start; ok "已启动"; }
cmd_stop()     { info "停止容器..."; "${COMPOSE[@]}" stop;  ok "已停止(数据保留)"; }
cmd_restart()  { info "重启容器..."; "${COMPOSE[@]}" restart; ok "已重启"; }
cmd_logs()     { exec "${COMPOSE[@]}" logs -f --tail=50; }
cmd_status()   { show_status; }
cmd_down()     { info "停止并移除容器(数据卷保留)..."; "${COMPOSE[@]}" down --remove-orphans; ok "已移除容器,数据保留"; }

cmd_clean() {
  warn "此操作将删除数据卷 mihomo-config,清空全部 mihomo 配置!"
  # 非交互/EOF 时 read 返回非零,set -e 会中断;用 || true 兜底
  read -r -p "确认删除数据卷并清空数据? [y/N] " ans || ans=""
  case "$ans" in
    [yY]*)
      "${COMPOSE[@]}" down -v
      ok "已清理容器与数据卷"
      ;;
    *)
      info "已取消"
      ;;
  esac
}

# ── 入口 ─────────────────────────────────────────────────────────────────
usage() {
  cat <<'EOF'
yacd-mihomo 一键管理脚本

用法: ./manage.sh <命令>

命令:
  up        一键启动(自动创建网络/构建镜像/启动容器)
  rebuild   重建容器(镜像重建 + 容器重建,数据卷保留,配置不清空)
  network   创建/检查 macvlan 网络(up 会自动执行,一般无需手动)
  start     启动已停止的容器
  stop      停止容器(数据保留)
  restart   重启容器
  logs      查看日志(跟随)
  status    查看状态与访问地址
  down      停止并移除容器(数据卷保留)
  clean     彻底清理(删除容器 + 数据卷,会清空配置!)
  -h        显示帮助

环境变量通过 deploy/.env 配置(参考 .env.example)。
EOF
}

[ $# -lt 1 ] && { usage; exit 1; }
case "$1" in
  up)       cmd_up ;;
  rebuild)  cmd_rebuild ;;
  network)  cmd_network ;;
  start)    cmd_start ;;
  stop)     cmd_stop ;;
  restart)  cmd_restart ;;
  logs)     cmd_logs ;;
  status)   cmd_status ;;
  down)     cmd_down ;;
  clean)    cmd_clean ;;
  -h|--help|help) usage ;;
  *)        err "未知命令: $1"; usage; exit 1 ;;
esac
