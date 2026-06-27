# proxy-gateway 旁路由网关部署总结

## 架构

```
主路由 (192.168.3.1)
  │
  └── NAS (192.168.3.6) — Docker 宿主机 (UGreen DXP480T Plus)
       │
       └── Macvlan 容器 (192.168.3.100)
            ├── nginx (:80)    — yacd 管理面板
            ├── Mihomo (:7890)  — HTTP/SOCKS 代理
            ├── Mihomo (:9090)  — RESTful API
            └── Mihomo (TUN)    — 透明代理 + DNS Fake-IP
```

## 容器配置

### Macvlan 网络

Macvlan 让容器拥有独立的 LAN IP，局域网设备直接将其设为网关。

```bash
docker network create -d macvlan \
  --subnet=192.168.3.0/24 \
  --gateway=192.168.3.1 \
  -o parent=eth0 \
  macnet
```

**注意**：
- Macvlan 容器与宿主机无法直接通信（特性而非 bug）
- 局域网内其他设备可以正常访问
- 如需宿主机访问容器，需创建 shim 接口

### 容器启动

```bash
docker run -d --name yacd-mihomo \
  --network macnet --ip 192.168.3.100 \
  --cap-add NET_ADMIN --cap-add NET_RAW --cap-add SYS_ADMIN \
  --device /dev/net/tun:/dev/net/tun \
  --dns 223.5.5.5 \
  -v /path/to/config.yaml:/root/.config/mihomo/config.yaml:ro \
  yacd-mihomo:latest
```

### TUN 模式

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

## 手机设置

局域网设备设置静态 IP：
- **网关**: `192.168.3.100`
- **DNS**: `192.168.3.100`

## DNS Fake-IP

Mihomo DNS 返回 `198.18.0.0/16` 范围内的虚拟 IP，TUN 拦截后映射回真实域名。

```yaml
dns:
  enable: true
  listen: 0.0.0.0:53
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
```

关键：客户端 DNS 必须指向容器（`192.168.3.100`），否则无法获得 Fake-IP，TUN 也无法正确分流。

## 代理节点

节点信息通过订阅链接获取，具体节点以实际订阅为准。
