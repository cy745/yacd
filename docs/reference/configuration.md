# 配置参考

## 环境变量(`deploy/.env`)

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PARENT_IFACE` | `eth1` | macvlan 父网卡(**必须是有线/USB 网卡**) |
| `NETWORK_NAME` | `macnet` | macvlan 网络名 |
| `SUBNET` | `192.168.3.0/24` | 局域网网段 |
| `GATEWAY` | `192.168.3.1` | 主路由网关 |
| `CONTAINER_NAME` | `yacd-mihomo` | 容器名 |
| `MIHOMO_IP` | `192.168.3.100` | 容器固定 IP(旁路由网关/DNS) |
| `MIHOMO_TARGET` | `http://127.0.0.1:9090` | Mihomo REST API(容器内) |
| `PORT` | `80` | Express 监听端口 |

> 网络相关变更(如换网段)需要:改 `.env` → 删除旧 macvlan 网络 → `yacd up`。

## mihomo 配置(`/root/.config/mihomo/config.yaml`)

由 yacd 面板管理(订阅导入)或 `yacd config edit` 直接编辑。

### TUN 透明代理(旁路由核心)

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

### DNS Fake-IP

```yaml
dns:
  enable: true
  listen: 0.0.0.0:53
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.0/16
  nameserver:
    - 223.5.5.5
    - 119.29.29.29
```

### 关键端口

| 配置 | 说明 | 注意 |
|---|---|---|
| `mixed-port: 7890` | HTTP/SOCKS 代理端口 | 局域网设备手动配代理需 `bind-address: 0.0.0.0` |
| `redir-port: 7892` | REDIRECT 端口 | — |
| `external-controller: 0.0.0.0:9090` | REST API | yacd 面板经 Express 代理访问 |
| `log-level: info` | 日志级别 | `silent` 会让 Web 日志页面空白 |

## 种子配置

空卷首次启动时,mihomo 会使用镜像内置的种子配置(`docker/mihomo-seed.yaml`),
包含最小可用的 TUN/DNS/external-controller 配置。之后通过面板导入订阅生成完整配置。

## 订阅拉取代理

部分机场的订阅 URL 需通过其**专用节点**代理拉取,才返回完整节点列表。

- **设置位置**:yacd 面板「订阅管理 → 订阅拉取方式」下拉
- **API**:`POST /api/subscription/proxy {"proxy": "节点名"}`
- **持久化**:存于 `subscription-meta.json` 的 `proxyForSubscribe` 字段
- **实现原理**:拉取订阅前,确保订阅域名/IP 的规则指向所选节点(非 DIRECT),
  拉取走 mihomo TUN 分流;同时清理历史遗留的 DIRECT 规则
- **直连恢复**:`{"proxy": null}` 或面板选"直连(默认)"

> 若订阅返回的节点数异常少(几个占位节点),通常是未走专用节点拉取,见 [FAQ](/faq)。

## 网络拓扑相关

macvlan 网络要求:

- `PARENT_IFACE` 必须是有线物理网卡(桥接/USB),不能是 Wi-Fi
- 子网需与主路由一致
- 跨端口方案(eth1 parent)保证宿主机可访问容器,详见[架构](/guide/architecture)
