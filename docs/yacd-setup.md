# yacd 开发与部署指南

## 项目说明

[yacd](https://github.com/haishanh/yacd) (Yet Another Clash Dashboard) 是一个纯前端的 Clash/Mihomo 管理面板，基于 React + TypeScript + Vite。

本仓库是 [cy745/yacd](https://github.com/cy745/yacd) fork，在原版基础上做了依赖升级和 Docker 集成。

## 本地开发

```bash
# 安装依赖
pnpm install

# 启动 dev server
pnpm dev        # http://localhost:5173

# 生产构建
pnpm build      # 输出到 public/

# 预览构建产物
pnpm serve      # http://localhost:4173
```

后端 API 地址配置在 `index.html`：

```html
<div id="app" data-base-url="http://192.168.3.100:9090"></div>
```

## 变更记录

### 依赖升级 (v0.3.8 →)

| 包 | 旧版本 | 新版本 | 说明 |
|---|:------:|:------:|------|
| vite | 4.4.9 | 8.1.0 | 底层构建工具从 rollup 切换到 rolldown |
| @vitejs/plugin-react | 4.1.0 | 6.0.3 | |
| sass | 1.68.0 | 1.101.0 | |
| tailwindcss | 3.3.3 | 4.3.1 | **破坏性变更**，配置方式完全不同 |
| postcss | 8.4.31 | 8.5.15 | |
| vite-plugin-pwa | 0.16.5 | 1.3.0 | v0.16 不兼容 vite 8 |

### 升级中修复的问题

#### 1. tailwind v3 → v4 迁移

v4 是完全重写版本，以下内容均发生变化：

| 变化点 | v3 (旧) | v4 (新) |
|--------|---------|---------|
| PostCSS 插件 | `tailwindcss` | `@tailwindcss/postcss` |
| 入口指令 | `@tailwind base/components/utilities` | `@import "tailwindcss"` |
| 配置文件 | `tailwind.config.js` | 直接写在 CSS 中 |
| 安装 | `npm install tailwindcss` | `npm install tailwindcss @tailwindcss/postcss` |

修复步骤：
1. 安装 `@tailwindcss/postcss`
2. 更新 `postcss.config.js` 插件名为 `@tailwindcss/postcss`
3. 将 `Root.scss` 中的 `@tailwind base;` 等替换为 `@import "tailwindcss"`
4. 删除 `tailwind.config.js`

#### 2. country-flag-emoji-polyfill 字体导出

v0.1.4 的 `exports` 字段包含 `./TwemojiCountryFlags.woff2`，但 v0.1.8 移除了该导出。直接在 `src/app.tsx` 中注释掉字体导入和相关调用——该功能仅影响旧系统上的国旗 emoji 渲染，不影响核心功能。

#### 3. vite-plugin-pwa v0.16 不兼容 vite 8

v0.16 调用了 vite 内部已移除的 `applyHtmlTransforms` API，升级到 v1.3.0 解决。

#### 4. @types/node 缺失

`vite.config.ts` 使用了 `path`、`Buffer`、`__dirname` 等 Node.js API，需要安装 `@types/node`。

### pnpm v11 兼容性

`package.json` 中的 `pnpm.patchedDependencies` 字段在 pnpm v11 中不再支持。移除了该配置和对应的 `patches/` 目录。

## Docker 部署

### 构建镜像

```bash
# 1. 先构建 yacd 前端
pnpm build

# 2. 构建 Docker 镜像（需要 --network host 确保 DNS 解析正常）
docker build --network host -t yacd-mihomo:latest -f docker/Dockerfile .
```

### 镜像内容

```
yacd-mihomo:latest
├── nginx           — 端口 80，服务 yacd SPA
└── mihomo          — 代理引擎 (Mihomo)
     ├── :7890      — HTTP/SOCKS 代理
     └── :9090      — RESTful API
```

### 配置覆盖

通过环境变量 `YACD_DEFAULT_BACKEND` 可在容器启动时修改后端 API 地址：

```bash
docker run -e YACD_DEFAULT_BACKEND=http://192.168.3.100:9090 ...
```

默认值为 `http://127.0.0.1:9090`，容器内运行时指向本机 Mihomo API。

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
