# yacd + mihomo 一键部署

基于 docker compose 部署 mihomo + yacd 组合容器,作为局域网旁路由代理网关。

## 目录结构

```
deploy/
├── docker-compose.yml   # 容器编排(macvlan + TUN + 命名卷)
├── .env.example         # 环境变量模板(复制为 .env 使用)
├── manage.sh            # 一键管理脚本(核心入口)
└── README.md
```

## 架构

```
局域网 (192.168.3.0/24, 网关 192.168.3.1)
  ├── NAS 宿主 (192.168.3.6)          eth0 板载 10GbE
  │     └── eth1 (USB RTL8156 2.5G)   macvlan parent
  │           └── yacd-mihomo 容器 (192.168.3.100)
  │                 ├── :80   yacd 管理面板(Express)
  │                 ├── :7890 mihomo mixed-port
  │                 ├── :9090 mihomo REST API
  │                 └── TUN   透明代理(auto-route + dns-hijack)
  └── 局域网设备 → 网关/DNS 指向 192.168.3.100
```

> 为什么用 USB 网卡 eth1 做 macvlan parent:`docs/mihomo-gateway-network.md`
> 里解释了 macvlan 同端口隔离问题——容器挂在 eth1 上,宿主从 eth0 跨端口访问,
> 从而让**宿主机 + 局域网设备都能访问容器**。

## 快速开始

### 1. 配置环境变量

```bash
cd deploy
cp .env.example .env
# 编辑 .env:确认 PARENT_IFACE(USB 网卡名)、SUBNET、GATEWAY、MIHOMO_IP
```

### 2. 一键启动

```bash
./manage.sh up
```

自动完成:
1. 检查前端构建产物 `public/index.html`(不存在会提示先 `pnpm build`)
2. 创建 macvlan 网络 `macnet`(parent=eth1,幂等)
3. 处理手动 `docker run` 的旧容器(自动接管,数据卷保留)
4. 构建镜像并启动容器(compose,`restart: unless-stopped`)

### 3. 验证

```bash
./manage.sh status            # 查看状态与访问地址
curl http://192.168.3.100/    # 宿主机访问 yacd 面板(应为 200)
```

## 常用命令

| 命令 | 作用 | 数据影响 |
|---|---|---|
| `./manage.sh up` | 一键启动(含自动建网络/接管旧容器) | 保留 |
| `./manage.sh rebuild` | 重建容器(重拉镜像依赖 + 重构建) | **保留** |
| `./manage.sh restart` | 重启容器 | 保留 |
| `./manage.sh stop` / `start` | 停止 / 启动 | 保留 |
| `./manage.sh logs` | 查看容器日志 | — |
| `./manage.sh down` | 停止并移除容器 | 保留(卷不删) |
| `./manage.sh clean` | 彻底清理 | **清空配置!** |

## 数据与配置

- **配置持久化**:命名卷 `mihomo-config` 挂载到 `/root/.config/mihomo`。
- **重建不清空**:`rebuild` / `down` / `up` 都不会删卷,配置(含订阅、规则)
  完整保留。
- **首次初始化**:卷为空时,mihomo 会自动生成初始 `config.yaml`;之后通过
  yacd 面板导入订阅、管理配置。
- **彻底清空**:仅 `clean` 命令会 `down -v` 删除卷。

## 容器自愈

`docker-compose.yml` 设置了 `restart: unless-stopped`:
- 容器崩溃 / NAS 重启后会自动拉起
- 手动 `docker stop` 后不会自动启动(符合预期)

## 局域网设备接入

把设备的 **网关 + DNS** 指向 `192.168.3.100`(全屋透明代理);
或按设备手动配置 HTTP/SOCKS 代理 `192.168.3.100:7890`
(需 mihomo 配置 `bind-address: 0.0.0.0`,见经验文档踩坑 #2)。

## 常见问题

| 现象 | 处理 |
|---|---|
| `public/index.html` 缺失 | 本地 `pnpm install && pnpm build`,上传 `public/` |
| macvlan 网络创建失败 | 确认 `PARENT_IFACE` 是有线网卡名(`ip link` 查看) |
| 宿主机访问不了容器 | 确认 `PARENT_IFACE=eth1`(跨端口),用 curl 别用 ping |
| 7890 连不上 | mihomo `mixed-port` 默认绑 127.0.0.1,需 `bind-address: 0.0.0.0` |
| 想彻底重来 | `./manage.sh clean` 后重新 `up`(会清配置) |

## 参考

- 网络原理与踩坑:`docs/mihomo-gateway-network.md`
- 旧版 `docker run` 部署脚本:已由本脚本替代
- mihomo 配置:https://wiki.metacubex.one/
