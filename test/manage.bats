#!/usr/bin/env bats
# manage.sh(CLI 派发器)的 bats 测试
# 只测试不依赖 docker 守护进程的纯逻辑分支:usage / 未知命令 / 参数解析

setup() {
  # 用 BATS_TEST_FILENAME 定位仓库根目录(不要用 $BASH_SOURCE)
  REPO_ROOT="$(cd "$(dirname "$BATS_TEST_FILENAME")/.." && pwd)"
  MANAGE="$REPO_ROOT/deploy/manage.sh"
}

@test "无参数时打印 usage 并以 1 退出" {
  run "$MANAGE"
  [ "$status" -eq 1 ]
  assert_output_contains '用法: yacd <命令>'
}

@test "-h 打印 usage 并以 0 退出" {
  run "$MANAGE" -h
  [ "$status" -eq 0 ]
  assert_output_contains 'up'
  assert_output_contains 'clean'
}

@test "help 与 --help 等价" {
  run "$MANAGE" --help
  [ "$status" -eq 0 ]
}

@test "未知命令打印错误并以 1 退出" {
  run "$MANAGE" not-a-command
  [ "$status" -eq 1 ]
  assert_output_contains '未知命令'
  assert_output_contains '用法:'
}

@test "usage 中列出核心子命令(脚本逻辑自洽)" {
  run "$MANAGE" -h
  for cmd in up rebuild network restart status down clean update uninstall version config; do
    assert_output_contains "$cmd"
  done
}

@test "usage 中标注数据影响(保留/清空)以指导用户" {
  run "$MANAGE" -h
  assert_output_contains '数据保留'
  assert_output_contains '清空'
}

# 小工具断言:断言 $output 包含某子串(纯 bats,不依赖 bats-assert)
assert_output_contains() {
  local needle="$1"
  [[ "$output" == *"$needle"* ]] || {
    echo "expected output to contain: $needle" >&2
    echo "actual output: $output" >&2
    return 1
  }
}
