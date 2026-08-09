# 快速开始

在部署机器(如 UGreen NAS)上一键安装 yacd CLI:

```bash
curl -fsSL https://raw.githubusercontent.com/cy745/yacd/master/deploy/install.sh | sh
```

安装后即可使用 `yacd` 命令管理旁路由代理网关。

## 首次部署

```bash
# 1. 配置环境变量
vim ~/.yacd/deploy/.env
#    确认 PARENT_IFACE(USB 网卡名,如 eth1)
#    确认 SUBNET / GATEWAY / MIHOMO_IP

# 2. 一键启动
yacd up
#    自动:创建 macvlan 网络 → 构建镜像 → 启动容器

# 3. 验证
yacd status
curl http://192.168.3.100/    # 应返回 200
```

## 验证代理生效

```bash
yacd logs                      # 查看 mihomo 日志
```

日志中应看到局域网设备(如 `192.168.3.x`)的连接记录与分流结果:

```
[TCP] 192.168.3.101:41502 → example.com:443  match Match using [节点]  ← 走代理
[TCP] 192.168.3.101:49870 → 国内IP:80        match GeoIP(cn) using DIRECT ← 直连
```

## 局域网设备接入

把设备的 **网关 + DNS** 指向 `MIHOMO_IP`(默认 `192.168.3.100`),即实现全屋透明代理。

> 注意:macvlan 方案下请用 `curl` 验证连通性,不要用 `ping`(宿主机可能缺 `cap_net_raw` 权限)。

## 常用命令速查

| 命令 | 作用 | 数据影响 |
|---|---|---|
| `yacd up` | 一键部署 | 保留 |
| `yacd status` | 查看状态 | — |
| `yacd logs` | 查看日志 | — |
| `yacd update` | 更新到最新版 + 重建容器 | 保留 |
| `yacd config edit` | 编辑 mihomo 配置 | 修改配置 |
| `yacd rebuild` | 重建容器 | 保留 |
| `yacd clean` | 彻底清理(清配置!) | 清空 |

完整命令见 [CLI 参考](/reference/cli)。
