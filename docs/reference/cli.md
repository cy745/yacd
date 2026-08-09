# CLI 命令参考

`yacd` 命令通过 `curl|sh` 安装(见[快速开始](/guide/quick-start)),软链到 `deploy/manage.sh`。

## 安装

```bash
curl -fsSL https://raw.githubusercontent.com/cy745/yacd/master/deploy/install.sh | sh
```

## 命令总览

### 容器管理

| 命令 | 作用 | 数据影响 |
|---|---|---|
| `yacd up` | 一键部署(自动建网络/构建/启动) | 保留 |
| `yacd rebuild` | 重建容器(镜像 + 容器) | 保留 |
| `yacd start` | 启动已停止的容器 | 保留 |
| `yacd stop` | 停止容器 | 保留 |
| `yacd restart` | 重启容器 | 保留 |
| `yacd logs` | 查看日志(跟随) | — |
| `yacd status` | 查看状态与访问地址 | — |
| `yacd down` | 停止并移除容器 | 保留 |
| `yacd clean` | 彻底清理(删容器 + 数据卷) | **清空** |

### 更新与安装

| 命令 | 作用 | 数据影响 |
|---|---|---|
| `yacd install` | 安装/升级 CLI(下载 release 包) | 不动容器 |
| `yacd update` | 更新到最新版 + 重建容器 | 保留 |
| `yacd self-update` | 仅更新部署脚本/compose | 不动容器 |
| `yacd uninstall` | 完全卸载(清容器 + 删 CLI) | **清空** |
| `yacd version` | 显示版本并对比远端 | — |

### 配置

| 命令 | 作用 |
|---|---|
| `yacd config show` | 查看当前 mihomo 配置 |
| `yacd config edit` | 编辑配置(自动写回 + 重载) |
| `yacd config reload` | 热重载配置 |
| `yacd config path` | 显示配置路径 |

### 网络

| 命令 | 作用 |
|---|---|
| `yacd network` | 创建/检查 macvlan 网络 |

## 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `YACD_INSTALL_DIR` | `/opt/yacd`(root)或 `~/.yacd` | 安装目录 |
| `YACD_PREFIX` | `/usr/local`(root)或 `~/.local` | 命令 bin 目录 |
| `YACD_USE_MAIN` | `0` | 设为 1 用 main 分支拉取(开发) |
| `YACD_FORCE_UPDATE` | — | 强制更新(跳过版本比较) |

## 退出码

| 退出码 | 含义 |
|---|---|
| `0` | 成功 |
| `1` | 一般错误(未知命令、前置检查失败) |
| `2` | 用法错误 |
