# yacd 开发与部署指南

## 项目说明

[yacd](https://github.com/haishanh/yacd) (Yet Another Clash Dashboard) 是一个纯前端的 Clash/Mihomo 管理面板，基于 React + TypeScript + Vite。

本仓库是 [cy745/yacd](https://github.com/cy745/yacd) fork，做了以下改造：

- **依赖升级**（vite 4→8, tailwind 3→4, sass 等）
- **Express 全栈替换 nginx** — 同一端口提供静态文件 + Mihomo API 代理 + 自定义后端 API
- **移除后端切换功能** — 固定使用同源 API 请求

## 架构

```
Browser ──→ Express (:80 / :3001)
              ├── /             → static files (yacd SPA)
              ├── /api/status   → Express 自定义端点
              └── /*            → http-proxy-middleware → Mihomo (:9090)
                   └── ws://    → WebSocket 自动升级
```

所有请求同源，前端 JS 不再直接连接 Mihomo API。

## 本地开发

```bash
# 1. 安装依赖
pnpm install

# 2. 启动 Vite dev server（需要本地 Mihomo 在 :9090）
pnpm dev        # http://localhost:5173

# 3. 或在 Express 模式下测试（先 pnpm build）
pnpm build
pnpm server:dev  # http://localhost:3001
```

### Vite dev 模式

Vite 自动将 API 请求代理到 `127.0.0.1:9090`（Mihomo）。如需修改代理目标，编辑 `vite.config.ts` 的 `server.proxy`。

### Express 生产模式

```bash
pnpm build       # 构建前端到 public/
pnpm server      # 启动 Express（默认 :80）
pnpm server:dev  # 启动 Express（:3001）
```

环境变量：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `80` | Express 监听端口 |
| `MIHOMO_TARGET` | `http://127.0.0.1:9090` | Mihomo API 地址 |

## 构建产物

```bash
pnpm build  # 输出到 public/
```

## Docker 构建

### 构建镜像

```bash
pnpm build
docker build --network host -t yacd-mihomo:latest -f docker/Dockerfile .
```

### 镜像内容

```
yacd-mihomo:latest
├── Node.js / Express  — 端口 80（服务 yacd SPA + 代理 Mihomo API）
└── Mihomo             — 代理引擎
     ├── :7890         — HTTP/SOCKS 代理
     └── :9090         — RESTful API（Express 内部代理，不对外暴露）
```

### 容器启动

```bash
# 创建配置卷（持久化 Mihomo 配置）
docker volume create mihomo-config

# 启动容器
docker run -d --name yacd-mihomo \
  --network macnet --ip 192.168.3.100 \
  --cap-add NET_ADMIN --cap-add NET_RAW \
  --device /dev/net/tun:/dev/net/tun \
  -v mihomo-config:/root/.config/mihomo \
  -e MIHOMO_TARGET=http://127.0.0.1:9090 \
  yacd-mihomo:latest
```

## 变更记录

### 依赖升级 (v0.3.8 →)

| 包 | 旧版本 | 新版本 | 说明 |
|---|:------:|:------:|------|
| vite | 4.4.9 | 8.1.0 | 底层构建工具从 rollup 切换到 rolldown |
| @vitejs/plugin-react | 4.1.0 | 6.0.3 | |
| sass | 1.68.0 | 1.101.0 | |
| tailwindcss | 3.3.3 | 4.3.1 | **破坏性变更** |
| postcss | 8.4.31 | 8.5.15 | |
| vite-plugin-pwa | 0.16.5 | 1.3.0 | |

### Express 全栈迁移

- nginx 替换为 Express（`server/index.js`）
- 移除了后端切换功能（`/backend` 页面、`clashAPIConfigs` 状态）
- 所有 API 调用改为同源相对路径
- 新增 `pnpm server` / `pnpm server:dev` 脚本

### Tailwind v3 → v4 迁移

v4 是完全重写版本：

| 变化点 | v3 (旧) | v4 (新) |
|--------|---------|---------|
| PostCSS 插件 | `tailwindcss` | `@tailwindcss/postcss` |
| 入口指令 | `@tailwind base/components/utilities` | `@import "tailwindcss"` |
| 配置文件 | `tailwind.config.js` | 直接写在 CSS 中 |

### country-flag-emoji-polyfill

v0.1.8 移除了 `TwemojiCountryFlags.woff2` 导出。注释掉字体导入和相关调用——该功能仅影响旧系统上的国旗 emoji 渲染，不影响核心功能。

### vite-plugin-pwa

v0.16 调用了 vite 8 已移除的内部 API `applyHtmlTransforms`，升级到 v1.3.0 解决。

### @types/node 缺失

`vite.config.ts` 使用了 Node.js API，需要安装 `@types/node`。

### pnpm v11 兼容性

`pnpm.patchedDependencies` 字段在 pnpm v11 中不再支持，已移除。

## NAS 部署注意事项

### DNS 问题

Docker build 在 UGreen NAS 上可能遇到 DNS 解析失败（EAI_AGAIN），原因：
- Docker 构建环境使用默认 bridge 网络，无法正确解析外部域名
- 宿主机 `/etc/resolv.conf` 配置了 `127.0.0.1`（dnsmasq），但构建容器无法访问

解决方案：
- 使用 `--network host` 参数让构建容器使用宿主机的网络栈
- 或在 Docker daemon 配置中显式指定 DNS 服务器

### 配置重载

`PUT /configs?force=true` 可能不生效，可靠的方式是重启容器：

```bash
docker restart yacd-mihomo
```
