#!/bin/sh
# yacd + Mihomo 组合入口 (Express 全栈)
#
# 职责:
#  1. 空卷时拷贝种子配置(镜像内置),保证首次启动开箱可用
#  2. 启动 mihomo(后台) + Express(后台)
#  3. 双进程守护:任一进程死亡即退出容器 → 触发 compose restart: unless-stopped 自愈
#     (修复:mihomo 崩溃时此前容器仍显示 Up,代理静默失效;现在会让容器重启)

set -e

CONFIG_DIR=/root/.config/mihomo
CONFIG_FILE="$CONFIG_DIR/config.yaml"
SEED_FILE=/etc/mihomo-seed/config.yaml

# 1. 首次启动(空卷)时,写入种子配置
#    mihomo 自己生成的初始配置缺 external-controller/tun/dns,面板连不上。
#    用镜像内置种子配置替代,保证 TUN + API 开箱可用。
if [ ! -f "$CONFIG_FILE" ]; then
  echo "首次启动:写入种子配置 $SEED_FILE -> $CONFIG_FILE"
  mkdir -p "$CONFIG_DIR"
  cp "$SEED_FILE" "$CONFIG_FILE"
fi

# 2. 启动 mihomo(后台)
echo "启动 Mihomo..."
/mihomo -d "$CONFIG_DIR" &
MIHOMO_PID=$!
echo "Mihomo PID: $MIHOMO_PID"

# 3. 启动 Express(后台)
echo "启动 yacd-server (Express)..."
echo "  Web:   :${PORT:-80} (yacd)"
echo "  API:   ${MIHOMO_TARGET:-http://127.0.0.1:9090} (Mihomo, 通过 Express 代理)"
echo "  Proxy: :7890 (Mihomo)"
node /app/server/index.js &
EXPRESS_PID=$!
echo "Express PID: $EXPRESS_PID"

# 4. 双进程守护:任一进程死亡,退出容器触发 restart
#    用循环轮询而非 wait -n(避免依赖 bash/dash 的 wait -n 扩展)
trap 'exit 0' TERM INT
while kill -0 "$MIHOMO_PID" 2>/dev/null && kill -0 "$EXPRESS_PID" 2>/dev/null; do
  sleep 2
done

# 记录哪个进程挂了,便于排查
if ! kill -0 "$MIHOMO_PID" 2>/dev/null; then
  echo "ERROR: mihomo 进程($MIHOMO_PID)已退出,容器将重启"
  exit 1
fi
if ! kill -0 "$EXPRESS_PID" 2>/dev/null; then
  echo "ERROR: Express 进程($EXPRESS_PID)已退出,容器将重启"
  exit 1
fi
exit 0
