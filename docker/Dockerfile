# yacd + Mihomo 组合镜像
# 提示: 构建前先本地运行 pnpm build

FROM metacubex/mihomo:latest

# 安装 nginx
RUN apk add --no-cache nginx

# 复制预构建的 yacd（本地 pnpm build 后的 public/）
COPY public /usr/share/nginx/html

# 复制 nginx 配置
COPY docker/nginx.conf /etc/nginx/http.d/default.conf

# 复制入口脚本
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80 7890 9090

ENTRYPOINT ["/entrypoint.sh"]
