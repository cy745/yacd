# 参与贡献

欢迎贡献!以下是贡献指南。

## 开发流程

1. **Fork 并克隆**仓库
2. 创建功能分支:`git checkout -b feat/xxx`
3. 开发 + 测试(见[本地开发](/development/local-dev))
4. 提交:`git commit -m "feat: ..."`
5. 推送并提交 PR

## 测试要求

所有改动需通过 CI 校验:

| 层 | 工具 | 运行 |
|---|---|---|
| Shell 脚本 | shellcheck + bats | `bats test/` |
| 前端 | vitest | `pnpm test` |
| 后端 | node:test | `cd server && npm test` |
| Compose | docker compose config | CI |
| Docker | hadolint + 冒烟 | CI |

## 代码风格

- **Shell**:bash,遵循 `set -euo pipefail`,函数注释说明数据影响
- **前端**:TypeScript + React,遵循现有 ESLint 规则
- **后端**:ESM,`node:test` 测试

## 文档贡献

文档在 `docs/`(VitePress)。本地预览:

```bash
pnpm docs:dev
```

## 提交规范

参考 [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: 新功能
fix: 修复
docs: 文档
test: 测试
refactor: 重构
ci: CI 配置
```
