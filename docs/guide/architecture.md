# 架构

## 整体拓扑

```
浏览器(宿主/局域网)
   │
   ▼ http://192.168.3.100
Express (:80) ──────────────────────────────────────────┐
   │ ① 静态文件(yacd SPA)                               │
   │ ② /api/* 自定义端点                                 │
   │ ③ 其余 → 反向代理                                   │
   │                                                     ▼
   │                                     Mihomo REST API (:9090)
   │
Mihomo
   ├── :7890  mixed-port(HTTP/SOCKS 代理)
   ├── :9090  RESTful API
   ├── :53    DNS(Fake-IP)
   └── TUN    透明代理(auto-route + dns-hijack)
```

## 请求流转

**浏览器请求**:同源 `http://192.168.3.100` → Express:
1. `/api/*` → Express 自定义逻辑(订阅管理、配置读写)
2. 静态文件 → yacd SPA
3. 其余(如 `/proxies`、`/configs`)→ 反向代理到 Mihomo REST API
4. WebSocket(`/logs`、`/connections`、`/traffic`)→ 自动升级代理

**局域网设备流量**:设备 →(网关)→ Mihomo TUN → mihomo 分流规则:
- 国外流量 → 代理节点
- 国内流量 → DIRECT 直连

## macvlan 网络与宿主机互通

```
┌─ 宿主 ──────────────────────┐
│  eth0 (10GbE, 192.168.3.6)  │──┐
│                             │  │ 跨端口 L2 转发
│  eth1 (USB, 192.168.3.72)   │◄─┘
└─────────────────────────────┘
         │ macvlan parent
         ▼
   yacd-mihomo 容器 (192.168.3.100)
```

**关键设计**:容器 macvlan 挂在 `eth1`(USB 网卡),宿主机从 `eth0` 访问。
macvlan 的宿主机隔离只发生在"同一物理端口进出",跨端口经交换机 L2 转发天然互通。

## 数据持久化

| 数据 | 存储 | 重建容器 |
|---|---|---|
| mihomo 配置/订阅 | 命名卷 `mihomo-config` | ✅ 保留 |
| 容器定义 | compose 文件 | ✅ 保留 |
| 镜像 | Docker 镜像 | ✅ 重建 |
