# Express 全栈迁移计划

## 背景

当前架构中，yacd 前端直接调用 Mihomo REST API (`:9090`)，通过 `data-base-url` + 用户可切换的后端列表实现。这种方式的问题：

1. **浏览器跨站访问** — 前端 JS 直接连 Mihomo API，非同一来源时需要 CORS
2. **无法添加自定义逻辑** — 纯前端无法做订阅解析、配置写回等服务端操作
3. **后端切换 UX 多余** — 单实例部署下切换后端功能无意义

迁移目标：**Express 替换 nginx**，作为统一的 Web 入口，同时提供反向代理和自定义 API。

---

## 目标架构

```
Browser ──→ Express (:80 / :5173)
              ├── /             → static files (yacd SPA)
              ├── /api/*        → Express router（自定义后端功能）
              └── /*            → http-proxy-middleware → Mihomo (:9090)
                   └── ws://    → WebSocket 自动升级
```

### 数据流对比

| 当前（nginx） | 迁移后（Express） |
|---|---|
| 浏览器直接 `fetch('http://127.0.0.1:9090/proxies')` | 浏览器 `fetch('/proxies')` → Express 代理 → Mihomo |
| 浏览器直接 `WebSocket('ws://127.0.0.1:9090/logs')` | 浏览器 `WebSocket('/logs')` → Express 代理 → Mihomo |
| 无服务端 API | `GET /api/status` 等自定义端点 |

---

## 阶段划分

### 第一阶段：Express 基础 + 前端瘦身 ✅（当前阶段）

核心目标：Express 跑起来，yacd 去掉后端切换逻辑，前后端联调通过。

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| 1.1 | 简化 `useApiConfig()` | `src/store/app.ts` | 删除 clashAPIConfigs 数组逻辑，`useApiConfig()` 返回固定的 `{ baseURL: window.location.origin, secret: '' }` |
| 1.2 | 删除 `/backend` 路由和页面 | `src/components/backend/*`、`src/components/Root.tsx` | 删除 Backend.tsx、BackendForm.tsx、BackendList.tsx，移除 `/backend` 路由 |
| 1.3 | 简化持久化 | `src/components/fn/AppConfigSideEffect.tsx`、`src/misc/storage.ts` | 移除 localStorage 中 backend 配置的持久化 |
| 1.4 | 简化错误页面 | `src/components/error/BackendErrorFallback.tsx`、`ErrorFallback.tsx` | 去掉"切换后端"按钮，显示友好提示 |
| 1.5 | 清理 StateApp 类型 | `src/store/types.ts` | 移除 `clashAPIConfigs`、`selectedClashAPIConfigIndex` 字段（或其引用） |
| 1.6 | 调整 WebSocket URL 构建 | `src/misc/request-helper.ts` | `buildWebSocketURLBase` 需要处理 origin 级别的 baseURL |
| 1.7 | **创建 Express 服务器** | `server/index.js` | 静态文件服务 + http-proxy-middleware 代理到 Mihomo |
| 1.8 | **WebSocket 代理** | `server/index.js` | 确保 `/logs`、`/connections`、`/traffic` 的 WebSocket 连接被正确代理 |
| 1.9 | **自定义 API 占位** | `server/index.js` | 添加 `/api/status` 端点 |
| 1.10 | 更新 package.json scripts | `package.json` | 添加 `"server"`、`"start"` 等脚本 |
| 1.11 | 更新 Docker 构建 | `docker/Dockerfile`、`docker/entrypoint.sh` | 替换 nginx 为 Node.js + Express |
| 1.12 | 更新开发环境文档 | `docs/yacd-setup.md` | 记录新架构的开发和部署方式 |

### 第二阶段：订阅解析功能（后续）

- 订阅链接抓取与解析
- Config 转换与写入
- Mihomo 配置重载

### 第三阶段：配置管理（后续）

- 可视化配置编辑
- 节点管理增强
- 规则管理增强

---

## 详细实施说明

### 1.1 简化 `useApiConfig()`

**改动后**：
```typescript
// src/store/app.ts
export function useApiConfig(): ClashAPIConfig {
  return {
    baseURL: window.location.origin,
    secret: '',
  };
}
```

效果：所有 API 调用变为同源请求（如 `http://192.168.3.100/proxies`），由 Express 代理转发到 Mihomo。

**需要保留** 的原子状态：
- `latencyTestUrlAtom` — 延迟测试 URL
- `themeAtom` — 主题
- 其他 UI 状态（collapsible, proxySortBy 等）

**需要删除** 的原子状态：
- `clashAPIConfigsAtom` — 不再需要数组
- `selectedClashAPIConfigIndexAtom` — 不再需要索引

### 1.6 WebSocket URL 构建

当前 `buildWebSocketURLBase` 用 `new URL(baseURL)` 构造，如果 baseURL 为 `window.location.origin` 则正常工作。

验证逻辑：
- `new URL('http://192.168.3.80')` → 正常
- `url.protocol = 'ws:'` → `ws://192.168.3.80`
- 最终 URL: `ws://192.168.3.80/logs?token=`

WebSocket 同源策略允许连接到当前页面来源，所以 Express 在同一端口处理 WebSocket 升级即可。

### 1.7 Express 服务器

```javascript
// server/index.js
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 80;
const MIHOMO_TARGET = process.env.MIHOMO_TARGET || 'http://127.0.0.1:9090';

// 1. 自定义 API
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', name: 'yacd-server' });
});

// 2. 静态文件
app.use(express.static('public'));

// 3. SPA fallback — index.html
app.get('/', (req, res) => {
  res.sendFile(path.resolve('public/index.html'));
});

// 4. 代理到 Mihomo（REST + WebSocket）
app.use('/', createProxyMiddleware({
  target: MIHOMO_TARGET,
  ws: true,
  changeOrigin: true,
}));

app.listen(PORT, () => {
  console.log(`yacd-server running on :${PORT}`);
});
```

### 1.8 Docker 更新

```dockerfile
FROM metacubex/mihomo:latest

# 安装 Node.js
RUN apk add --no-cache nodejs npm

# 复制 yacd 构建产物
COPY public /app/public

# 复制 Express 服务器
COPY server /app/server
COPY server/package.json /app/package.json
RUN cd /app && npm install --production

WORKDIR /app

EXPOSE 80 7890 9090

ENTRYPOINT ["/app/server/entrypoint.sh"]
```

entrypoint.sh:
```sh
#!/bin/sh
# 启动 Mihomo（后台）
if [ -f /root/.config/mihomo/config.yaml ]; then
    /mihomo -d /root/.config/mihomo &
fi

# 启动 Express（前台）
node server/index.js
```

---

## 端口规划

| 端口 | 服务 | 说明 |
|------|------|------|
| `:80` | Express | Web 管理界面 + API 代理（浏览器访问） |
| `:7890` | Mihomo | HTTP/SOCKS 代理（局域网设备使用） |
| `:9090` | Mihomo | RESTful API（Express 内部代理用，不对外暴露） |

---

## 风险与注意事项

1. **WebSocket 握手** — http-proxy-middleware 的 `ws: true` 自动处理升级，但需要在 `server.listen` 之外额外调用 `server.on('upgrade', ...)`，需确认实现正确
2. **Sass/SCSS 的 `@import` vs `@use`** — 前端代码使用 `@import`（已弃用），当前 sass 版本支持，暂不需要修改
3. **mock 模式** — dev 环境下 API 调用走 `api/mock.ts`，不受 backend 改动影响
4. **PWA Service Worker** — SW 注册在 `swRegistration.ts`，其中可能包含对 API 路径的引用，需要确认不影响
5. **`window.location.origin` 在 SSR 中不可用** — 但 yacd 是纯客户端 SPA，无 SSR
