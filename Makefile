# ─────────────────────────────────────────────────────────────
#  yacd 统一命令入口
#  用法: make <target>(默认 help)
#  参考:outline / portainer 等项目的 Makefile 惯例
# ─────────────────────────────────────────────────────────────

SHELL := /bin/bash
.PHONY: help build dev server test lint docs docker-build docker-deploy install

# 可被环境变量覆盖的默认值
VERSION  ?= $(shell git describe --tags --always 2>/dev/null || echo dev)
PLATFORM ?= linux/amd64

help: ## 显示所有可用命令
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

build: ## 构建前端产物到 public/(pnpm build)
	pnpm install
	pnpm build

dev: ## 前端开发服务器(vite)
	pnpm dev

server: ## 本地启动 Express(容器外调试用,需 MIHOMO_TARGET 可达)
	node server/index.js

test: ## 运行全部测试(前端 vitest + 后端 node:test + shell bats)
	pnpm test
	cd server && npm test
	bash -c 'command -v bats >/dev/null 2>&1 && bats test/manage.bats test/cmd/up.bats || npx --yes bats@1.11.1 test/manage.bats test/cmd/up.bats' || true

lint: ## 前端 lint + shell 静态检查
	pnpm lint
	shellcheck deploy/*.sh docker/entrypoint.sh 2>/dev/null || true

docs: ## 文档站开发预览(VitePress)
	pnpm docs:dev

docker-build: ## 构建镜像(默认 linux/amd64;PLATFORM 可覆盖)
	docker build -t yacd-mihomo:$(VERSION) -f docker/Dockerfile .

docker-deploy: ## 在 NAS 上一键部署(通过 deploy/ 脚本)
	cd deploy && ./manage.sh up

install: ## curl|sh 一键安装(把 yacd CLI 装到本机)
	@echo "推荐用 curl|sh 安装:"
	@echo "  curl -fsSL https://raw.githubusercontent.com/cy745/yacd/main/deploy/install.sh | sh"
