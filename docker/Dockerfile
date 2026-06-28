# yacd + Mihomo 组合镜像 (Express 全栈)
# 提示: 构建前先本地运行 pnpm build

FROM metacubex/mihomo:latest

# 安装 Node.js + npm
RUN apk add --no-cache nodejs npm

# 复制 yacd 构建产物
COPY public /app/public

# 复制 Express 服务器并安装依赖
COPY server/package.json /app/package.json
COPY server/index.js /app/server/index.js
RUN cd /app && npm install --production

# 复制入口脚本
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /app

EXPOSE 80 7890 9090

ENV PORT=80
ENV MIHOMO_TARGET=http://127.0.0.1:9090

ENTRYPOINT ["/entrypoint.sh"]
