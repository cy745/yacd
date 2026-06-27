# Docker 镜像构建经验总结

## 架构

```
yacd-mihomo 容器
├── nginx (:80)       — 服务 yacd 静态文件
├── Mihomo (:7890)    — 代理引擎
└── Mihomo (:9090)    — RESTful API
```

## Dockerfile 设计

多阶段构建（本地 pnpm build 后，不再需要在 Docker 内安装依赖）：

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /build
COPY package.json .
RUN npm install -g pnpm && pnpm install
COPY . .
RUN pnpm build

FROM metacubex/mihomo:latest
RUN apk add --no-cache nginx
COPY --from=builder /build/public /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/entrypoint.sh /entrypoint.sh
EXPOSE 80 7890 9090
ENTRYPOINT ["/entrypoint.sh"]
```

**简化版**（本地构建后，省略构建阶段，避免 NAS DNS 问题）：
```dockerfile
FROM metacubex/mihomo:latest
RUN apk add --no-cache nginx
COPY public /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/entrypoint.sh /entrypoint.sh
```

## NAS 上构建的 DNS 问题

UGreen NAS（DXP480T Plus）上 Docker 构建时无法解析外部域名：

| 现象 | 原因 | 解决 |
|------|------|------|
| `apk add` DNS 超时 | Docker build 默认 bridge 网络 DNS 不可用 | `docker build --network host` |
| `npm install` DNS 超时 | 同上，且 npmjs.org 被墙 | 使用 `--network host` + npmmirror.com |
| `registry.npmmirror.com` 仍失败 | NAS 的 dnsmasq 转发异常 | 直接预构建再上传，跳过构建阶段 |

**最佳方案**：本地 `pnpm build` 构建好 `public/`，再上传到 NAS，Dockerfile 只做 COPY，不涉及网络请求。

## entrypoint.sh 设计

启动两个服务，任一退出则容器停止：

```sh
#!/bin/sh
# 通过环境变量覆盖后端 API 地址
YACD_DEFAULT_BACKEND="${YACD_DEFAULT_BACKEND:-http://127.0.0.1:9090}"
sed -i "s|http://[^/]*:9090|$YACD_DEFAULT_BACKEND|" /usr/share/nginx/html/index.html

nginx -g "daemon off;" &
/mihomo -d /root/.config/mihomo &

wait $NGINX_PID $MIHOMO_PID
```

## yacd 配置

`data-base-url` 配置在 `index.html` 中：
```html
<div id="app" data-base-url="http://127.0.0.1:9090"></div>
```

容器运行时可通过环境变量覆盖：
```bash
docker run -e YACD_DEFAULT_BACKEND=http://192.168.3.100:9090 ...
```

部署到 Macvlan 网络后，浏览器通过 `http://容器IP:80` 访问 yacd，yacd 通过 `data-base-url` 连接 Mihomo API。

## 已知问题

1. **Macvlan 宿主机隔离**：宿主机无法直接访问 Macvlan 容器的端口，局域网其他设备正常
2. **配置热重载不稳定**：`PUT /configs?force=true` 可能不生效，可靠方式是 `docker restart`
3. **nginx 配置**：SPA 需要所有路径回退到 `index.html`，已配置 `try_files $uri /index.html`
