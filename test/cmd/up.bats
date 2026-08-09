#!/usr/bin/env bats
# yacd up / rebuild 子命令的调用序列测试
# 用 stub docker 脚本替代真实 docker,验证:create_network → ensure_no_conflict → compose up

setup() {
  # 本文件在 test/cmd/ 下,仓库根需要 ../..
  REPO_ROOT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)"
  MANAGE="$REPO_ROOT/deploy/manage.sh"

  # 创建 stub docker 目录,置于 PATH 最前
  STUB_DIR="$BATS_TEST_TMPDIR/bin"
  mkdir -p "$STUB_DIR"
  DOCKER_LOG="$BATS_TEST_TMPDIR/docker.log"
  export DOCKER_LOG

  cat > "$STUB_DIR/docker" <<'STUB'
#!/usr/bin/env bash
echo "docker $*" >> "${DOCKER_LOG:?}"
# 模拟 docker network inspect:网络不存在则退出 1
if [ "$1" = "network" ] && [ "$2" = "inspect" ]; then
  exit 1
fi
# 模拟 docker compose version:返回 0
if [ "$1" = "compose" ] && [ "$2" = "version" ]; then
  exit 0
fi
# 其余命令均视为成功
exit 0
STUB
  chmod +x "$STUB_DIR/docker"
  export PATH="$STUB_DIR:$PATH"
}

@test "up 依次调用 network create 与 compose up" {
  # 需要前端产物
  mkdir -p "$REPO_ROOT/public"
  touch "$REPO_ROOT/public/index.html"

  run "$MANAGE" up
  [ "$status" -eq 0 ]

  cat "$DOCKER_LOG"
  # 应包含 macvlan 网络创建
  grep -q "docker network create -d macvlan" "$DOCKER_LOG"
  # 应包含 compose up
  grep -q "docker compose up -d --build" "$DOCKER_LOG"
}

@test "network create 使用 macvlan 驱动和 parent" {
  mkdir -p "$REPO_ROOT/public"
  touch "$REPO_ROOT/public/index.html"

  run "$MANAGE" up
  [ "$status" -eq 0 ]

  # 断言 parent 参数存在(默认 eth1,或 .env 覆盖)
  grep -qE "docker network create -d macvlan .*parent=" "$DOCKER_LOG"
}

@test "network 子命令独立触发网络创建" {
  run "$MANAGE" network
  [ "$status" -eq 0 ]
  grep -q "docker network create -d macvlan" "$DOCKER_LOG"
}
