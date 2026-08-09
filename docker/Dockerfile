# yacd + Mihomo 组合镜像 (Express 全栈)
# 提示: 构建前先本地运行 pnpm build

# 锁定构建架构为 amd64(目标 NAS 为 x86_64),避免 multi-arch 拉错平台
FROM --platform=linux/amd64 metacubex/mihomo:latest

# 安装 Node.js + npm
RUN apk add --no-cache nodejs npm

# 复制 yacd 构建产物
COPY public /app/public

# 复制 Express 服务器并安装依赖
# server/package.json 是依赖清单;npm ci 需要 lock 文件,当前用 install --production
COPY server/package.json /app/package.json
COPY server/ /app/server/
RUN cd /app && npm install --production

# 复制种子配置(空卷首次启动时写入)
COPY docker/mihomo-seed.yaml /etc/mihomo-seed/config.yaml

# 复制入口脚本
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /app

EXPOSE 80 7890 9090

ENV PORT=80
ENV MIHOMO_TARGET=http://127.0.0.1:9090

ENTRYPOINT ["/entrypoint.sh"]
