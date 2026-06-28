#!/bin/sh
# yacd + Mihomo 组合入口 (Express 全栈)

# 启动 Mihomo（后台）
if [ -f /root/.config/mihomo/config.yaml ]; then
    echo "启动 Mihomo..."
    /mihomo -d /root/.config/mihomo &
    MIHOMO_PID=$!
    echo "Mihomo PID: $MIHOMO_PID"
else
    echo "警告: 未找到配置文件 /root/.config/mihomo/config.yaml，Mihomo 未启动"
    MIHOMO_PID=""
fi

# 启动 Express（前台，接管容器生命周期）
echo "启动 yacd-server (Express)..."
echo "  Web:   :${PORT:-80} (yacd)"
echo "  API:   ${MIHOMO_TARGET:-http://127.0.0.1:9090} (Mihomo, 通过 Express 代理)"
echo "  Proxy: :7890 (Mihomo)"

exec node /app/server/index.js
