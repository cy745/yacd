# proxy-gateway 部署指南

## 架构

```
主路由 (192.168.3.1)
  │
  └── NAS (192.168.3.6) — Docker 宿主机 (UGreen DXP480T Plus)
       │
       └── Macvlan 容器 (192.168.3.100)
            ├── Express (:80)         — yacd 管理面板 + API 代理
            ├── Mihomo (:7890)        — HTTP/SOCKS 代理
            ├── Mihomo (:9090)        — RESTful API（Express 内部代理，不对外暴露）
            └── Mihomo (TUN)          — 透明代理 + DNS Fake-IP
```

所有浏览器请求同源：`http://192.168.3.100` → Express → 静态文件(yacd) 或 代理到 Mihomo API。

## 快速开始

### 前置条件

- Docker 已安装
- Macvlan 网络已创建（见下文）
- 本地已安装 Node.js + pnpm（用于构建前端）

### 1. 构建前端

```bash
pnpm install
pnpm build        # 输出到 public/
```

### 2. 构建 Docker 镜像

```bash
# NAS 上构建（需要 --network host，否则 DNS 解析失败）
docker build --network host -t yacd-mihomo:latest -f docker/Dockerfile .
```

### 3. 创建 Macvlan 网络

```bash
docker network create -d macvlan \
  --subnet=192.168.3.0/24 \
  --gateway=192.168.3.1 \
  -o parent=eth0 \
  macnet
```

### 4. 创建配置卷

```bash
docker volume create mihomo-config
```

首次启动时若卷中没有 `config.yaml`，Mihomo 会自动创建初始配置。后续可通过网页导入订阅配置。

### 5. 启动容器

```bash
docker run -d --name yacd-mihomo \
  --network macnet --ip 192.168.3.100 \
  --cap-add NET_ADMIN --cap-add NET_RAW --cap-add SYS_ADMIN \
  --device /dev/net/tun:/dev/net/tun \
  -v mihomo-config:/root/.config/mihomo \
  -e MIHOMO_TARGET=http://127.0.0.1:9090 \
  yacd-mihomo:latest
```

⚠️ **必须包含 `--cap-add SYS_ADMIN`**，否则 TUN 模式无法创建虚拟网卡。

### 6. 访问管理界面

浏览器打开 `http://192.168.3.100`

## config.yaml 关键配置

### TUN 透明代理（必须有）

```yaml
tun:
  enable: true
  device: mihomo
  stack: mixed
  dns-hijack:
    - any:53
    - tcp://any:53
  auto-route: true
  auto-detect-interface: true
  strict-route: true
  mtu: 1500
```

在 Macvlan 模式下，`auto-route` 只影响容器内部路由，不影响宿主机。

### DNS Fake-IP

```yaml
dns:
  enable: true
  listen: 0.0.0.0:53
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
```

客户端 DNS 必须指向容器（`192.168.3.100`），否则无法获得 Fake-IP，TUN 也无法正确分流。

### 日志级别

```yaml
log-level: info   # 使用 info 级别，silent 会导致 Web 日志页面无显示
```

## 客户端设置

局域网设备设置静态 IP：

- **网关**: `192.168.3.100`
- **DNS**: `192.168.3.100`

## Docker 构建注意事项

### DNS 问题（UGreen NAS）

NAS 上 Docker 构建时可能遇到 DNS 解析失败（`EAI_AGAIN`），原因：

| 现象 | 原因 | 解决 |
|------|------|------|
| `apk add` 超时 | Docker build 默认 bridge 网络 DNS 不可用 | `docker build --network host` |
| `npm install` 超时 | 同上 + 境外源慢 | 本地 `pnpm build` 后再上传，Dockerfile 只 COPY |

**最佳实践**：本地 `pnpm build` 构建好 `public/`，再上传到 NAS 构建镜像。Dockerfile 只做文件复制，不涉及网络请求。

### Macvlan 宿主机隔离

Macvlan 容器与宿主机无法直接通信（特性而非 bug）。局域网其他设备可以正常访问。

### 配置重载

`PUT /configs?force=true` 可能不生效，可靠的方式是重启容器：

```bash
docker restart yacd-mihomo
```

## 容器配置

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `80` | Express 监听端口 |
| `MIHOMO_TARGET` | `http://127.0.0.1:9090` | Mihomo RESTful API 地址（容器内） |

### 端口

| 端口 | 服务 | 说明 |
|------|------|------|
| `:80` | Express | Web 管理界面 + API 代理（浏览器访问） |
| `:7890` | Mihomo | HTTP/SOCKS 代理（局域网设备使用） |
| `:9090` | Mihomo | RESTful API（Express 内部代理，不对外暴露） |

### 卷

| 卷 | 挂载点 | 说明 |
|------|--------|------|
| `mihomo-config` | `/root/.config/mihomo` | Mihomo 配置文件目录（config.yaml + geoip/geosite 等） |

## 订阅管理

当前阶段：通过 Docker volume 持久化配置，后续将在 yacd 网页内实现订阅导入和管理功能。

## 容器操作

```bash
# 查看日志
docker logs yacd-mihomo

# 重启容器
docker restart yacd-mihomo

# 进入容器
docker exec -it yacd-mihomo sh

# 手动编辑配置
docker exec -it yacd-mihomo vi /root/.config/mihomo/config.yaml
# 或上传新配置
docker cp config.yaml yacd-mihomo:/root/.config/mihomo/config.yaml

# 编辑后重启
docker restart yacd-mihomo
```

## 部署脚本

项目提供了 `docker/deploy.sh`，在 NAS 上运行即可完成构建和部署。

## 已知问题 / 踩坑记录

### 1. useApiConfig() 返回新对象导致无限重渲染

**现象**：Proxies 页面疯狂发送 API 请求。
**原因**：`useApiConfig()` 每次渲染返回新的 `{ baseURL, secret }` 对象字面量，React 依赖比较认为引用变化，触发无限循环。
**解决**：将对象定义为模块级常量，`useMemo` 返回稳定引用。

### 2. 解构默认值对 null 不生效

**现象**：Connections 页面崩溃，报 `Cannot read properties of null (reading 'map')`。
**原因**：`{ connections = [] }` 在 JS 中只对 `undefined` 生效。Mihomo 返回 `"connections": null`，默认值不触发。
**解决**：改为 `(data) => { const conns = data.connections || []; }`。

### 3. TUN 模式缺少 SYS_ADMIN 权限

**现象**：容器运行正常，但流量不经过代理。
**原因**：TUN 需要 `SYS_ADMIN` capability 来创建虚拟网卡设备，仅 `NET_ADMIN` + `NET_RAW` 不够。
**解决**：添加 `--cap-add SYS_ADMIN`。

### 4. log-level: silent 导致日志无显示

**现象**：Web 日志页面空白，无任何输出。
**原因**：config.yaml 中 `log-level: silent` 关闭了所有日志输出。
**解决**：改为 `log-level: info`。

### 5. tar --exclude 误伤 assets

**现象**：部署后页面白屏，JS/CSS 404。
**原因**：打包时 `--exclude=assets` 排除了 `public/assets/`，构建产物缺失。
**解决**：去掉 `--exclude=assets`，只排除顶层 `assets/` 目录。

### 6. Mihomo 默认 API 端口非 9090

**现象**：Express 代理连接失败（504）。
**原因**：本地启动时 Mihomo API 在 `:9091`，但默认假设是 `:9090`。
**解决**：通过 `MIHOMO_TARGET` 环境变量显式指定端口。

### 7. useApiConfig() 不持久化改动

**现象**：重启后 `useApiConfig()` 返回一致的 `window.location.origin`。
**说明**：这是预期行为——后端切换功能已移除，API 地址固定为同源。不再是用户可配置的。
