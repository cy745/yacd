# yacd + Mihomo 组合镜像 (Express 全栈)
# 提示: 构建前先本地运行 pnpm build
#
# hadolint 注意事项:
# - FROM 锁版本(DL3007);平台由 buildx platforms 传参,不在 Dockerfile 内硬编码(DL3029)
# - apk 包锁版本约束(DL3018);WORKDIR 提前,避免 cd(DL3003)
# - HEALTHCHECK 基于 /api/status,增强运行期自愈可见性

FROM metacubex/mihomo:v1.19.29

# 安装 Node.js + npm(版本约束 ~= 允许小版本更新,避免精确版本过时导致构建失败)
RUN apk add --no-cache nodejs~=22 npm~=11

# ── Express 后端依赖(独立最小清单,避免把前端依赖装进镜像) ──
WORKDIR /app
COPY server/package.json /app/package.json
COPY server/ /app/server/
RUN npm install --production

# ── yacd 前端构建产物(由本地 pnpm build 或 CI frontend job 产出) ──
COPY public /app/public

# ── 种子配置 + 入口脚本 ──
COPY docker/mihomo-seed.yaml /etc/mihomo-seed/config.yaml
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80 7890 9090

ENV PORT=80
ENV MIHOMO_TARGET=http://127.0.0.1:9090

# 健康探针:yacd-server 的 /api/status 返回 200 即健康
# (mihomo 与 Express 都在容器内,mihomo 崩溃会导致容器重启——见 entrypoint.sh 双进程守护)
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT:-80}/api/status >/dev/null 2>&1 || exit 1

ENTRYPOINT ["/entrypoint.sh"]
