<h1 align="center">
  <img src="https://user-images.githubusercontent.com/1166872/47954055-97e6cb80-dfc0-11e8-991f-230fd40481e5.png" alt="yacd">
</h1>

<div align="center">

**yacd + mihomo 旁路由代理网关** — 一条命令部署到你的 NAS

[![CI](https://github.com/cy745/yacd/actions/workflows/ci.yml/badge.svg)](https://github.com/cy745/yacd/actions/workflows/ci.yml)
[![Docs](https://img.shields.io/badge/docs-vitepress-blue)](https://cy745.github.io/yacd/docs/)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)

</div>

## 🚀 一键安装

在部署机器(NAS / 任何有 Docker 的 Linux)上运行:

```bash
curl -fsSL https://raw.githubusercontent.com/cy745/yacd/main/deploy/install.sh | sh
```

安装后使用 `yacd` 命令:

```bash
yacd up          # 一键部署(自动建网络/构建镜像/启动容器)
yacd status      # 查看状态与访问地址
yacd logs        # 查看 mihomo 日志
```

局域网设备把 **网关 + DNS** 指向容器 IP(默认 `192.168.3.100`)即实现全屋透明代理。

## 📚 文档

- **文档站**:https://cy745.github.io/yacd/docs/
- **快速开始**:[docs/guide/quick-start.md](docs/guide/quick-start.md)
- **CLI 参考**:[docs/reference/cli.md](docs/reference/cli.md)
- **部署原理**:[docs/guide/deployment.md](docs/guide/deployment.md)

## ✨ 特性

| 特性 | 说明 |
|---|---|
| **透明代理** | mihomo TUN + Fake-IP,全屋设备网关指向容器即代理 |
| **宿主机可访问** | 跨端口 macvlan(USB 网卡),摆脱同端口隔离 |
| **一键 CLI** | `curl|sh` 安装 `yacd` 命令,管理安装/更新/卸载/配置 |
| **数据安全** | 命名卷持久化,重建容器不丢订阅与规则 |
| **自动恢复** | `restart: unless-stopped` + 进程守护 |
| **多架构镜像** | CI 构建 amd64/arm64 镜像到 GHCR |

## 🏗️ 架构

```
局域网设备 →(网关/DNS)→ yacd-mihomo 容器(192.168.3.100)
                          ├── :80    yacd 面板(Express)
                          ├── :7890  mihomo mixed-port
                          ├── :9090  mihomo REST API
                          └── TUN    透明代理
```

详见 [docs/guide/architecture.md](docs/guide/architecture.md)。

## 🛠️ 开发

```bash
pnpm install
pnpm dev          # 前端开发
pnpm test         # 前端测试
cd server && npm install && npm test   # 后端测试
bats test/        # shell 脚本测试
```

## 🤖 Agent 技能

仓库内置 Claude Code 技能 [`yacd-container-gateway`](.claude/skills/yacd-container-gateway/SKILL.md),
指导其他 Agent 如何配置自己的容器使用本网关代理。

## 📄 许可

Apache-2.0,基于 [haishanh/yacd](https://github.com/haishanh/yacd) 定制。

---

> 上游 yacd 原始说明见 [docs/legacy/README-upstream.md](docs/legacy/README-upstream.md)。
