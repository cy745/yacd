#!/usr/bin/env bash
# =============================================================================
#  yacd — mihomo + yacd 旁路由代理网关一键管理 CLI
#
#  既是命令行入口(软链 /usr/local/bin/yacd → 本脚本),也可直接:
#    ./deploy/manage.sh <命令>
#
#  子命令通过 deploy/cmd/<cmd>.sh 分发(bash case → exec 子脚本)。
#  数据安全:容器重建/删除时命名卷 mihomo-config 保留;仅 clean/uninstall 清空。
#
#  用法:
#    yacd up          # 一键部署
#    yacd update      # 更新到最新版并重建容器
#    yacd help        # 全部命令
# =============================================================================

set -euo pipefail

# ── 定位与公共函数 ─────────────────────────────────────────────────────────
# 解析符号链接,保证从任意路径/PATH(软链)调用都能正确定位脚本所在目录
SCRIPT_PATH="$(readlink -f "${BASH_SOURCE[0]:-$0}" 2>/dev/null || echo "${BASH_SOURCE[0]}")"
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"

# 权限自愈:源码 tarball 解压可能丢可执行位,确保子命令可被 exec 分发
if ! find "$SCRIPT_DIR/cmd" -maxdepth 1 -name '*.sh' -perm -u+x -print -quit 2>/dev/null | grep -q .; then
  chmod +x "$SCRIPT_PATH" "$SCRIPT_DIR"/cmd/*.sh "$SCRIPT_DIR"/lib/*.sh 2>/dev/null || true
fi

# 读取版本(仅用于帮助文案;不 source utils.sh,避免 docker 探测等副作用)
if [ -f "$SCRIPT_DIR/VERSION" ]; then
  YACD_VERSION="$(cat "$SCRIPT_DIR/VERSION" 2>/dev/null || echo dev)"
else
  YACD_VERSION="$(git -C "$SCRIPT_DIR/.." describe --tags --always 2>/dev/null || echo dev)"
fi

# ── 帮助 ───────────────────────────────────────────────────────────────────
usage() {
  cat <<EOF
yacd — mihomo + yacd 旁路由代理网关一键管理 CLI (v${YACD_VERSION})

用法: yacd <命令>

容器管理:
  up        一键部署(自动创建网络/构建镜像/启动容器)          [数据保留]
  rebuild   重建容器(镜像重建 + 容器重建)                     [数据保留]
  start     启动已停止的容器                                  [保留]
  stop      停止容器                                          [保留]
  restart   重启容器                                          [保留]
  logs      查看日志(跟随)
  status    查看状态与访问地址
  down      停止并移除容器                                    [数据保留]
  clean     彻底清理(删除容器 + 数据卷,清空配置!)            [清空]

更新与安装:
  install    安装/升级 CLI(下载最新 release 包)               [不动容器]
  update     更新到最新版 + 重建容器(拉最新代码重建)          [数据保留]
  self-update 仅更新部署脚本/compose 文件,不重建容器          [不动容器]
  uninstall  完全卸载(清容器 + 删 CLI + 删安装目录)           [清空]
  version    显示版本并对比远端

配置:
  config show    查看当前 mihomo 配置
  config edit    编辑 mihomo 配置(自动写回 + 重载)
  config reload  热重载配置
  config path    显示配置路径

其他:
  network   创建/检查 macvlan 网络
  help      显示本帮助

环境变量通过 deploy/.env 配置(参考 .env.example)。
EOF
}

# ── 派发 ───────────────────────────────────────────────────────────────────
[ $# -lt 1 ] && { usage; exit 1; }

case "$1" in
  -h|--help|help)  usage ;;
  up)               exec "$SCRIPT_DIR/cmd/up.sh" ;;
  rebuild)          exec "$SCRIPT_DIR/cmd/rebuild.sh" ;;
  start)            exec "$SCRIPT_DIR/cmd/start.sh" ;;
  stop)             exec "$SCRIPT_DIR/cmd/stop.sh" ;;
  restart)          exec "$SCRIPT_DIR/cmd/restart.sh" ;;
  logs)             exec "$SCRIPT_DIR/cmd/logs.sh" ;;
  status)           exec "$SCRIPT_DIR/cmd/status.sh" ;;
  down)             exec "$SCRIPT_DIR/cmd/down.sh" ;;
  clean)            exec "$SCRIPT_DIR/cmd/clean.sh" ;;
  network)          exec "$SCRIPT_DIR/cmd/network.sh" ;;
  install)          exec "$SCRIPT_DIR/cmd/install.sh" ;;
  update)           exec "$SCRIPT_DIR/cmd/update.sh" ;;
  self-update)      exec "$SCRIPT_DIR/cmd/self-update.sh" ;;
  uninstall)        exec "$SCRIPT_DIR/cmd/uninstall.sh" ;;
  version)          exec "$SCRIPT_DIR/cmd/version.sh" ;;
  config)           shift; exec "$SCRIPT_DIR/cmd/config.sh" "$@" ;;
  *)
    echo -e "\033[1;31m[ERR ]\033[0m 未知命令: $1" >&2
    usage
    exit 1
    ;;
esac
