# 常见问题

## 部署

### 宿主机访问不了容器

**现象**:宿主机 ping / curl 不通 `192.168.3.100`。

**原因**:macvlan 同端口隔离。容器 macvlan 挂在宿主主网卡(eth0)上时,宿主机访问被内核丢弃。

**处理**:
1. 确认 macvlan parent 是第二网口(`yacd network` 检查)
2. 若 parent 是 eth0,按[部署指南](/guide/deployment)改用 USB 网卡
3. 验证用 `curl`,不要用 `ping`(宿主可能缺 `cap_net_raw`)

### 宿主机 ping 报 `cap_net_raw` 错误

非 root 用户 `ping` 可能报 `Operation not permitted`(缺原始套接字权限)。用 `curl`/`wget` 验证。

### macvlan 网络创建失败

```
Error response from daemon: Pool overlaps with other one on this address space
```

同一子网已存在其他 macvlan 网络。删除旧的再建:

```bash
docker network rm <旧网络>
yacd up
```

### `public/index.html` 缺失

**现象**:`yacd up` 报找不到前端产物。

**处理**:本地构建后上传:

```bash
pnpm install && pnpm build
scp -r public/ <user>@<nas>:~/.yacd/
```

## 代理

### 7890 端口连不上

**现象**:局域网设备手动配代理 `192.168.3.100:7890` 连接失败。

**原因**:`mixed-port` 默认绑 `127.0.0.1`(仅容器内)。

**处理**:配置 `bind-address: 0.0.0.0`:

```bash
yacd config edit
```

### 流量不走代理 / 日志看不到客户端

**现象**:目标容器改了网关但 mihomo 日志无记录。

**处理**:
1. 目标容器需 `--cap-add NET_ADMIN` 才能改路由
2. 确认 `ip route` 默认网关是 `192.168.3.100`
3. 目标容器与 mihomo 容器须在同一 macvlan 网络

## 订阅

### 订阅只返回几个占位节点(而非完整列表)

**现象**:导入订阅后只有几个提示节点(如"请连接专用节点更新订阅"),没有真实可用节点。

**原因**:部分机场的订阅 URL 需通过其**专用节点**代理拉取,才返回完整节点列表;直连拉取只返回占位提示。

**处理**:
1. yacd 面板「订阅管理 → 订阅拉取方式」下拉,选择机场提供的**订阅专用节点**(通常含"订阅/专用"字样)
2. 点击「更新订阅」重新拉取
3. 确认拉取后的节点数明显增多(几十个为正常)

> 也可用 API 设置:`POST /api/subscription/proxy {"proxy": "订阅专用节点"}`(见 [API 文档](/development/api-endpoints))。

### 设备拿到 Fake-IP 但连不上

**现象**:DNS 解析返回 198.18.x.x,但流量没走 mihomo。

**原因**:只改了 DNS,没把网关指向 mihomo。

**处理**:网关 + DNS **同时**指向 `192.168.3.100`。

## 系统

### NAS 改网络模式后失联

**现象**:控制面板 → 网络 → 网络模式改动后,ping 通但 Web/SSH 无响应。

**处理**:NAS 机身上短按 Reset 重置网络(不丢数据),或电源重启。

**教训**:不要轻易改 UGOS 网络模式;本方案只创建 Docker 网络,不动系统网络。

### NAS 重启后容器没自动恢复

检查容器是否设置了 `restart: unless-stopped`(compose 已内置)。若手动 `docker run` 创建的旧容器,需先用 `yacd up` 接管(数据卷保留)。

### eth1 的 IP 变了

UGOS 重新 DHCP 分配,属正常。macvlan 容器 IP 是 `--ip` 指定的固定值,不受影响。

## 更新

### `yacd update` 下载失败

**现象**:解析不到 release 或下载失败。

**处理**:
- release 尚未发布(首次)时,用开发分支: `YACD_USE_MAIN=1 yacd update`
- 网络受限时检查 GitHub 可达性
