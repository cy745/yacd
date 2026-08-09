#!/usr/bin/env bash
# yacd config — mihomo 配置管理(show/edit/reload/path)
# 数据影响:edit 会修改配置;show/path 只读;reload 触发重载
set -euo pipefail
# shellcheck disable=SC1091
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib/utils.sh"

CONFIG_IN_CONTAINER="/root/.config/mihomo/config.yaml"

# 校验容器在运行
require_running() {
  if ! docker ps --filter "name=$CONTAINER_NAME" --filter "status=running" --format '{{.Names}}' | grep -q "$CONTAINER_NAME"; then
    err "容器 $CONTAINER_NAME 未在运行"
    warn "先执行: yacd up"
    exit 1
  fi
}

# 触发 mihomo 配置重载(优先 API 热重载,失败降级容器重启)
reload_mihomo() {
  if curl -sf -X PUT "$MIHOMO_TARGET/configs?force=true" \
    -H 'Content-Type: application/json' \
    -d "{\"path\":\"$CONFIG_IN_CONTAINER\"}" >/dev/null 2>&1; then
    ok "已通过 API 热重载配置"
    return 0
  fi
  warn "API 热重载失败,降级重启容器..."
  "${COMPOSE[@]}" restart
  ok "容器已重启,配置生效"
}

sub_show() {
  require_running
  docker exec "$CONTAINER_NAME" cat "$CONFIG_IN_CONTAINER"
}

sub_edit() {
  require_running
  local editor="${EDITOR:-vi}"
  local tmp
  tmp="$(mktemp -t mihomo-config.XXXXXX.yaml)"
  trap 'rm -f "$tmp"' EXIT
  docker exec "$CONTAINER_NAME" cat "$CONFIG_IN_CONTAINER" > "$tmp"
  info "用 $editor 编辑配置(保存后自动写回并重载)..."
  "$editor" "$tmp"
  # 写回容器
  docker exec -i "$CONTAINER_NAME" sh -c "cat > $CONFIG_IN_CONTAINER" < "$tmp"
  ok "配置已写回容器"
  reload_mihomo
}

sub_reload() {
  require_running
  reload_mihomo
}

sub_path() {
  echo "容器内配置: $CONFIG_IN_CONTAINER"
  echo "数据卷:     mihomo-config(命名卷)"
  echo "本地查看:   docker exec $CONTAINER_NAME cat $CONFIG_IN_CONTAINER"
}

case "${1:-show}" in
  show)   sub_show ;;
  edit)   sub_edit ;;
  reload) sub_reload ;;
  path)   sub_path ;;
  *)      err "未知子命令: $1"; echo "用法: yacd config {show|edit|reload|path}"; exit 1 ;;
esac
