# API 端点

yacd 自定义 API(Express,前缀 `/api`)。Mihomo 原生 API 见 [Mihomo 官方文档](https://wiki.metacubex.one/)。

## 状态

### `GET /api/status`

服务状态与代理目标。

```json
{
  "status": "ok",
  "name": "yacd-server",
  "target": "http://127.0.0.1:9090"
}
```

## 配置管理

### `GET /api/config`

返回 config.yaml 顶层键。

```json
{ "exists": true, "keys": ["port", "mode", "tun", "dns", "..."] }
```

### `GET /api/config/read`

返回完整 config.yaml(纯文本,YAML)。

### `GET /api/config/status`

配置与订阅状态:

```json
{
  "configKeys": ["port", "..."],
  "subscription": { "imported": true, "url": "...", "proxiesCount": 42, "...": "..." }
}
```

### `POST /api/config/apply`

把订阅字段合并进 config.yaml 并重载。

**请求体**: `{}`(当前无参数)

**返回**: `{ "mergedFields": 3, "proxiesCount": 42, "groupsCount": 5 }`

## 订阅管理

### `GET /api/subscription`

当前订阅状态:

```json
{ "imported": false }
```

或已导入:

```json
{
  "imported": true,
  "url": "https://...",
  "updatedAt": "2026-08-09T...",
  "proxiesCount": 42,
  "groupsCount": 5,
  "proxyNames": ["节点1", "节点2"],
  "groupNames": ["策略组1"]
}
```

### `POST /api/subscribe`

导入订阅链接。

**请求体**: `{ "url": "https://..." }`

**返回**: `{ "keys": [...], "proxiesCount": 42, "groupsCount": 5 }`

**错误**: 缺 url 返回 400 `{ "error": "Missing subscription URL" }`

### `POST /api/subscription/proxy`

设置订阅拉取用的代理节点(绕过 TUN Fake-IP 抓取问题)。

**请求体**: `{ "proxy": "节点名" }`(或 `null` 表示直连)

**返回**: `{ "ok": true, "proxy": "节点名" }`

## Mihomo 原生 API(经 Express 代理)

Express 将所有非 `/api/*` 请求代理到 Mihomo REST API(`:9090`),包括:

| 路径 | 说明 |
|---|---|
| `/proxies` | 代理节点与策略组 |
| `/configs` | 配置读写/重载 |
| `/rules` | 规则列表 |
| `/connections` | 活跃连接 |
| `/logs` | 日志(WebSocket) |
| `/traffic` | 流量(WebSocket) |
| `/version` | 版本信息 |
| `/providers` | 订阅/规则提供者 |

详细参数见 [Mihomo RESTful API](https://wiki.metacubex.one/en/api/overview/)。
