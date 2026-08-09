# 本地开发

## 前端(yacd SPA)

```bash
pnpm install
pnpm dev          # Vite 开发服务器,代理 API 到 Mihomo
```

## 后端(Express)

```bash
# 方式一:本地跑 Express(需 mihomo 可达)
pnpm server       # node server/index.js

# 方式二:开发模式(Express 在 3001,Vite 代理 /api 过去)
pnpm server:dev   # PORT=3001 node server/index.js
pnpm dev          # 另开终端
```

## 构建前端产物(镜像构建需要)

```bash
pnpm build        # 输出到 public/
```

> `public/` 是 gitignore 的,不入库。构建镜像或打包 release 前需先 `pnpm build`。

## Docker 镜像构建

```bash
make docker-build     # 或 docker build -f docker/Dockerfile .
```

## 测试

```bash
# 前端单测
pnpm test

# 后端测试
cd server && npm install && npm test

# shell 脚本测试(需 bats)
bats test/

# compose 配置校验
docker compose -f deploy/docker-compose.yml config --quiet
```

## 文档站本地预览

```bash
pnpm docs:dev     # VitePress 开发服务器
pnpm docs:build   # 构建文档站
```

## 项目结构

```
src/       前端(React + Vite)
server/    Express 后端(config 管理 + API 代理)
docker/    镜像构建(Dockerfile / entrypoint / 种子配置)
deploy/    CLI(manage.sh 派发器 + cmd/*.sh 子命令 + install.sh)
docs/      VitePress 文档站源
test/      shell 脚本 bats 测试
.github/   CI / 发布 workflow
```
