# 部署指南

## 目标架构

```
局域网 (192.168.3.0/24, 网关 192.168.3.1)
  ├── NAS 宿主 (192.168.3.6)          eth0 板载 10GbE
  │     └── eth1 (USB 网卡 RTL8156)   macvlan parent
  │           └── yacd-mihomo 容器 (192.168.3.100)
  │                 ├── :80   yacd 面板(Express)
  │                 ├── :7890 mihomo mixed-port
  │                 ├── :9090 mihomo REST API
  │                 └── TUN   透明代理
  └── 局域网设备 → 网关/DNS 指向 192.168.3.100
```

## 为什么用 USB 网卡做 macvlan parent

Docker 的 macvlan 网络有一个内核级限制:

> **macvlan 父接口不能与其子接口(macvlan 容器)直接通信。**

如果容器 macvlan 挂在宿主主网卡 `eth0` 上,宿主机访问容器会被内核丢弃(同端口隔离)。

**解法**:利用 NAS 的第二个物理网口(USB 网卡 `eth1`):

```
容器 macvlan 挂 eth1 → 宿主从 eth0 跨端口访问 → 经交换机 L2 转发 → 不触发隔离
```

这样宿主机 + 局域网设备都能访问容器。完整原理与踩坑见
[网络原理](../guide/architecture.md)与经验文档。

## 硬件要求

| 项 | 要求 |
|---|---|
| NAS | 有 Docker 的 NAS(如 UGreen DXP 系列 / 群晖 / PVE) |
| 第二网口 | 建议 USB 网卡(RTL8156 2.5G 最佳),作为 macvlan parent |
| 系统 | Debian 系(base)或任何支持 Docker 的发行版 |

## 部署步骤

### 1. 安装 yacd CLI

```bash
curl -fsSL https://raw.githubusercontent.com/cy745/yacd/main/deploy/install.sh | sh
```

### 2. 配置 `.env`

```bash
vim ~/.yacd/deploy/.env
```

关键项:

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PARENT_IFACE` | `eth1` | macvlan 父网卡(必须是有线/USB 网卡) |
| `SUBNET` | `192.168.3.0/24` | 局域网网段 |
| `GATEWAY` | `192.168.3.1` | 主路由网关 |
| `MIHOMO_IP` | `192.168.3.100` | 容器固定 IP(旁路由网关/DNS) |

### 3. 启动

```bash
yacd up
```

### 4. 验证

```bash
yacd status
curl http://192.168.3.100/api/status
```

### 5. 接入局域网设备

- **全屋透明代理**:把设备网关 + DNS 设为 `192.168.3.100`
- **按设备手动代理**:HTTP/SOCKS 代理 `192.168.3.100:7890`(需配置 `bind-address: 0.0.0.0`)

## 宿主机上其他容器走代理

目标容器加入同一 macvlan 网络,把默认网关指向 mihomo 容器:

```bash
docker run --network macnet --ip 192.168.3.101 \
  --cap-add NET_ADMIN \
  <镜像> sh -c "ip route replace default via 192.168.3.100; exec <原命令>"
```

或通过 `HTTP_PROXY=http://192.168.3.100:7890` 环境变量(仅对读取代理环境变量的程序生效)。

## 更新与升级

```bash
yacd update        # 更新到最新版 + 重建容器(配置保留)
yacd self-update   # 仅更新部署脚本,不重建容器
```

## 卸载

```bash
yacd uninstall     # 需二次确认,会清空配置
```
