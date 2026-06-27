#!/bin/sh
# yacd + Mihomo 组合入口

# 允许通过环境变量覆盖后端 API 地址
# 默认：http://127.0.0.1:9090
YACD_DEFAULT_BACKEND="${YACD_DEFAULT_BACKEND:-http://127.0.0.1:9090}"
sed -i "s|http://[^/]*:9090|$YACD_DEFAULT_BACKEND|" /usr/share/nginx/html/index.html

# 启动 nginx（前台）
nginx -g "daemon off;" &
NGINX_PID=$!

# 启动 Mihomo（后台）
if [ -f /root/.config/mihomo/config.yaml ]; then
    /mihomo -d /root/.config/mihomo &
    MIHOMO_PID=$!
else
    echo "警告: 未找到配置文件，Mihomo 未启动"
    MIHOMO_PID=""
fi

echo "yacd + Mihomo 启动完成"
echo "  Web:   :80 (yacd)"
echo "  API:   :9090 (Mihomo)"
echo "  Proxy: :7890 (Mihomo)"

# 等待任一进程退出
wait $NGINX_PID $MIHOMO_PID
