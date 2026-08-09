# Docker 容器网络:旁路由代理网关构建指南

> 从零构建"宿主机可访问 + 局域网可访问 + 目标容器走代理"的 Docker 网络结构。
> 本指南基于 2026-08 在 UGREEN DXP480T Plus 上实战验证的经验整理,目标是**可复现**。
> 旧方案(单网卡 macvlan 挂 eth0,宿主不可达)见 `gateway-deployment.md`,本文为替代方案。

---

## 一、目标与核心痛点

### 要解决的三个诉求

| 诉求 | 含义 | 旧方案卡在哪 |
|---|---|---|
| 局域网设备访问容器 | 其他设备能连 `192.168.3.100` | ✅ macvlan 天然支持 |
| **宿主机访问容器** | NAS 本机能访问 `192.168.3.100` | ❌ **macvlan 同端口隔离** |
| 目标容器走代理 | 某容器所有流量经 mihomo 分流 | ✅ TUN 透明代理可做 |

### 核心痛点:macvlan 的宿主机隔离

Docker macvlan 网络有一个内核级限制(不是 bug,是特性):

> **macvlan 父接口不能与其子接口(macvlan 容器)直接通信。**

原因:内核在**同一物理端口**上,当数据包的源/目的 MAC 都属于同一个 macvlan 设备树时,会直接丢弃(防止二层环路)。所以:

```
容器 macvlan 挂在 eth0,宿主 IP 也在 eth0
  → 宿主 ping 容器:包从 eth0 出 → 内核识别为"同端口子接口通信" → 丢弃 ✗
```

**这就是最初"宿主机访问不了容器"的根本原因。**

---

## 二、解决方案:跨物理端口绕开隔离

### 思路

macvlan 隔离**只发生在同一物理端口进出**。如果容器挂在**另一个物理网口**上,宿主从自己的口发出去、经交换机绕一圈回来,**就是不同物理端口**,内核不触发隔离检查 → 天然互通。

```
宿主 eth0 ──→ 交换机 ──→ eth1(USB 网卡)──→ 容器 macvlan
   ▲                                              │
   └────────────── L2 转发,跨端口,无隔离 ──────────┘
```

### 关键前提:NAS 有两个物理网口

| 网口 | 用途 |
|---|---|
| `eth0` | 板载 **10GbE**(192.168.3.6),宿主主接口,保持不动 |
| `eth1` | **USB 网卡 RTL8156 2.5G**(192.168.3.72),作为 **macvlan parent** |

> ⚠️ **不是必须让 eth1 无 IP**——我们实测过,即使 eth1 有 IP(192.168.3.72),宿主访问容器依然走 eth0 跨端口转发,完全正常。**不需要**任何 `/32` 静态路由,UGOS 的默认路由天然让宿主走 eth0。

---

## 三、硬件与环境

| 项 | 值 |
|---|---|
| NAS | UGREEN **DXP480T Plus** |
| 系统 | **UGOS Pro 1.17.0.0095**(底层 Debian 12 Bookworm) |
| CPU | Intel i5-1235U(12 线程) |
| 内存 | 23 GB |
| 板载网卡 | `eth0`,10GbE(192.168.3.6) |
| USB 网卡 | `eth1`,Realtek **RTL8156** 2.5G,USB(192.168.3.72,DHCP) |
| Docker | 26.1.0 |
| SSH | `ssh qiu745@192.168.3.6`(免密;**sudo 需密码**,先 `sudo -i` 提权) |

---

## 四、最终架构

```
局域网 (192.168.3.0/24, 网关 192.168.3.1, 主路由负责 DHCP)
  │
  ├── NAS 宿主 (192.168.3.6)        — eth0 板载 10GbE
  │     └── eth1 (USB RTL8156, 192.168.3.72)  ← macvlan parent
  │           └── yacd-mihomo 容器 (192.168.3.100)
  │                 ├── :80      yacd 管理面板(Express)
  │                 ├── :7890    mihomo mixed-port(注意绑 127.0.0.1,见踩坑)
  │                 ├── :9090    mihomo REST API
  │                 ├── :53      mihomo DNS
  │                 └── TUN      mihomo 透明代理(auto-route)
  │           └── 目标容器 (192.168.3.101, 默认网关 → 192.168.3.100)
  │
  ├── 局域网设备 (192.168.3.x)     — 可直连容器;网关/DNS 指向 3.100 即全透明代理
  └── 主路由 (192.168.3.1)         — DHCP + 外网
```

### 流量路径(目标容器 3.101 走代理)

```
目标容器 →(默认路由)→ mihomo 3.100 →(TUN auto-route)→ mihomo 分流
                        ├── 国外流量 → 香港节点(代理)
                        ├── 国内流量 → DIRECT 直连
                        └── DNS → dns-hijack 接管
```

---

## 五、从零构建步骤

> 全部命令在 NAS 上执行(SSH 后 `sudo -i` 提 root,或直接 root 会话)。

### 1. 创建 macvlan 网络(一次性)

```bash
# 关键:parent=eth1(USB 网卡),不是 eth0!
docker network create -d macvlan \
  --subnet=192.168.3.0/24 --gateway=192.168.3.1 \
  -o parent=eth1 macnet
```

验证:

```bash
docker network inspect macnet --format '{{index .Options "parent"}}'
# 期望输出: eth1
```

> ⚠️ **不要再建第二个同子网的 macvlan 网络**——Docker 报 `Pool overlaps with other one on this address space`。macnet 是唯一指定。

### 2. 启动 mihomo 容器(核心)

```bash
docker run -d --name yacd-mihomo \
  --network macnet --ip 192.168.3.100 \
  --cap-add NET_ADMIN --cap-add NET_RAW --cap-add SYS_ADMIN \
  --device /dev/net/tun:/dev/net/tun \
  -v mihomo-config:/root/.config/mihomo \
  -e MIHOMO_TARGET=http://127.0.0.1:9090 \
  yacd-mihomo:latest
```

**必须的三个 capability + tun 设备**:

| 参数 | 作用 |
|---|---|
| `--cap-add NET_ADMIN` | 容器内管理 TUN 网卡、改路由 |
| `--cap-add NET_RAW` | 原始套接字(TUN 收发) |
| `--cap-add SYS_ADMIN` | **TUN 模式创建虚拟网卡必需**(缺了 TUN 起不来) |
| `--device /dev/net/tun` | 透传 TUN 设备节点 |

### 3. 验证宿主机访问容器(原痛点)

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://192.168.3.100/
# 期望:200(yacd 面板)
```

> 宿主上 `ping` 可能因 `cap_net_raw` 报 `Operation not permitted`——**用 HTTP/TCP 验证**,别用 ping 判断。

### 4. 目标容器走 mihomo 网关

```bash
# 示例:挂 macnet, 拿 192.168.3.101, 需 NET_ADMIN 才能改路由
docker run -d --name gwtest \
  --network macnet --ip 192.168.3.101 \
  --cap-add NET_ADMIN --cap-add NET_RAW \
  alpine sleep 300

# 改默认路由指向 mihomo
docker exec gwtest ip route replace default via 192.168.3.100
```

### 5. 验证流量真的经过 mihomo(关键证据)

**不要只看出口 IP**——国内流量会 DIRECT 直连,出口 IP 不变是正常的。要看 **mihomo 日志**:

```bash
docker exec gwtest wget -qO- http://example.com 2>&1   # 触发流量
docker logs yacd-mihomo 2>&1 | grep 192.168.3.101      # 关键!
```

mihomo 日志会显示每个客户端 IP 的连接:

```
[TCP] 192.168.3.101:41502 → 199.232.114.132:443  match Match using ⚓️其他流量[海外节点]  ← 走代理
[TCP] 192.168.3.101:49870 → 120.226.74.152:80    match GeoIP(cn) using DIRECT            ← 国内直连
```

**看到自己的容器 IP 出现在 mihomo 日志里 = 链路通。**

---

## 六、mihomo 配置要点(config.yaml)

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

# DNS
dns:
  enable: true
  listen: 0.0.0.0:53
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.0/16

# 端口(注意 7890 绑定问题,见踩坑 #2)
redir-port: 7892
mixed-port: 7890        # 默认绑 127.0.0.1
external-controller: 0.0.0.0:9090

log-level: info          # info 级别,Web 日志页面才有显示
```

---

## 七、UGOS 特性与踩坑记录

### 1. eth1(USB 网卡)由 UGOS netevent 托管,删 IP 会被重配 ❗

**现象**:想把 eth1 腾出来给 macvlan,删掉它的 IP 后 20 秒内被 UGOS 自动重新配回(新的 `dhclient eth1` 进程)。

**原因**:UGOS 把 USB 网卡识别为 LAN2,`netevent` 服务检测到它在线就自动起 `dhclient` 配置 DHCP IP。

**结论**:
- **不要**和 netevent 抢 eth1 的 IP——`ip addr flush dev eth1` 会被自动恢复,白费劲。
- **也不影响**我们的方案:eth1 有 IP(192.168.3.72)完全没问题,宿主跨端口访问容器依旧正常。
- 重启后 eth1 的 DHCP IP **可能变化**(取决于主路由),但 macvlan 容器 IP 是 `--ip` 指定的,不受影响。

### 2. mihomo mixed-port 默认绑 127.0.0.1(容器内)

**现象**:容器外(局域网/宿主)连 `192.168.3.100:7890` 是 `Connection refused`,但 mihomo 明明在监听。

**原因**:mixed-port 默认只监听容器内回环地址。

**需要局域网设备手动配代理时**,改成:

```yaml
mixed-port: 7890
bind-address: 0.0.0.0    # 或 bind-address: '*' ,让 7890 对外
```

### 3. 改"网络模式"会搞挂 UGOS 服务(血的教训)

**现象**:控制面板 → 网络 → 网络模式 改成桥接后,NAS 变成 ping 通、但 SSH/Web 全部无响应。

**原因**:UGOS 的用户态服务(nginx/sshd)在网络模式切换后没有重新绑定接口,全部挂起。

**恢复**:NAS 机身上**短按 Reset** 重置网络(不丢数据),或电源键重启。

**教训**:UGOS 的网络模式是系统级配置,**不要轻易改**。本文方案不需要动网络模式,只建 Docker 网络,零风险。

### 4. sudo 需要密码,qiu745 用户权限有限

- `ip addr` 改宿主接口、改 `ugos.d` 配置需要 root(`sudo -i`)。
- 删宿主 eth1 IP 被 `Operation not permitted` 拦。
- **本方案只需要 Docker 权限**(qiu745 在 docker 组),够用了,不用 root。

### 5. 宿主 `ping` 报 `cap_net_raw` 错误

非 root 用户 `ping` 容器可能报 `Operation not permitted`(缺原始套接字权限)。**用 `curl`/`wget`/`nc` 验证连通性,别用 ping 判断成败**。

---

## 八、验证清单(完整验收)

- [ ] `docker network inspect macnet` 的 parent 是 `eth1`
- [ ] `docker ps` 显示 yacd-mihomo 运行中
- [ ] `curl http://192.168.3.100/` 返回 200(宿主访问容器 ✅)
- [ ] 局域网其他设备能打开 `http://192.168.3.100`(局域网访问 ✅)
- [ ] 目标容器改网关后,mihomo 日志出现它的 IP 流量(容器走代理 ✅)
- [ ] mihomo 日志显示分流正确:国外流量走节点、国内 DIRECT(规则生效 ✅)

---

## 九、持久化(已通过 deploy/ 落地)

**当前状态**:已由 `deploy/manage.sh` + `docker-compose.yml` 固化,不再是手动 `docker run`。
`restart: unless-stopped` 保证容器崩溃/宿主机重启后自动拉起,`rebuild` 重建容器时数据卷保留。

已实现:
- ✅ mihomo 容器 `restart: unless-stopped`(compose 内置,含 mihomo 进程级守护,见 docker/entrypoint.sh)
- ✅ macnet 网络脚本化(`./manage.sh network` / `up` 自动建网)
- ✅ 一键启动/重建:`./manage.sh up` / `./manage.sh rebuild`
- ⏳ 目标容器改路由固化(示例:`docker exec <target> ip route replace default via 192.168.3.100`,需在目标容器 entrypoint 固化)

> ⚠️ 注意:UGOS 重启后 eth1 的 DHCP IP 会重新分配,但 macvlan 容器 `--ip` 固定不受影响;若 eth1 未被 UGOS 重新启用,需要重新拉起网络。

---

## 十、故障排查速查

| 现象 | 排查方向 |
|---|---|
| 宿主访问不了容器 | 确认 macnet parent=eth1(不是 eth0);用 curl 别用 ping |
| 容器走不了代理 | 目标容器需 `--cap-add NET_ADMIN`;确认 `ip route` 默认网关是 3.100 |
| mihomo 日志无流量 | 容器网关没指向 3.100,或 mihomo 没在跑 |
| 7890 连不上 | mixed-port 绑 127.0.0.1,需 `bind-address: 0.0.0.0` |
| NAS 重启后容器没了 | 手动 docker run 不持久,需 restart policy/compose |
| eth1 IP 变了 | UGOS 重新 DHCP,属正常;不影响容器 macvlan |
| macnet 删除重建失败 | 子网冲突,先 `docker network rm macnet` 再建 |

---

## 参考

- Docker macvlan 文档:https://docs.docker.com/engine/network/drivers/macvlan/
- 旧版部署指南:`docs/gateway-deployment.md`(macvlan 挂 eth0,宿主不可达,已废弃)
- mihomo 配置文档:https://wiki.metacubex.one/
