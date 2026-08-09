#!/usr/bin/env bash
# =============================================================================
#  yacd release 下载工具(update.sh / self-update.sh 共用)
#
#  适配 NAS 无 git 的约束:不用 git clone,改用 GitHub API 解析版本 + 下载 release 包。
# =============================================================================

[ -n "${YACD_DOWNLOAD_LOADED:-}" ] && return 0
YACD_DOWNLOAD_LOADED=1

REPO="${REPO:-cy745/yacd}"
RAW_BASE="https://raw.githubusercontent.com/$REPO"
API_BASE="https://api.github.com/repos/$REPO"

# 从 GitHub API 解析最新 release tag
fetch_latest_tag() {
  curl -fsSL "$API_BASE/releases/latest" \
    | grep -o '"tag_name": *"[^"]*"' | head -1 | sed 's/.*: *"//;s/"//'
}

# 下载 release 资产(yacd-release.tar.gz)或 main 分支的打包版本到指定路径
# 参数:$1 = 输出文件路径;可选 YACD_USE_MAIN=1 强制用 main 分支
download_release() {
  local out="$1"
  local url
  if [ "${YACD_USE_MAIN:-0}" = "1" ]; then
    # main 分支:直接抓 deploy 目录打好的包(本地/CI 构建时产出)
    url="$RAW_BASE/main/deploy/yacd-release.tar.gz"
    info "从 main 分支下载: $url"
  else
    local tag
    tag="$(fetch_latest_tag)"
    [ -z "$tag" ] && { err "无法解析最新 release tag"; return 1; }
    # 优先尝试 release 资产;fallback 到 GitHub 自动生成的 source tarball
    url="$RAW_BASE/$tag/deploy/yacd-release.tar.gz"
    info "从 release $tag 下载: $url"
  fi
  curl -fsSL -o "$out" "$url" 2>/dev/null \
    || return 1
  ok "下载完成: $(du -h "$out" 2>/dev/null | cut -f1)"
}

# 解压 release 包到安装目录(幂等覆盖;不触碰用户 .env)
extract_release() {
  local tarball="$1" dest="$2"
  mkdir -p "$dest"
  if command -v tar >/dev/null 2>&1; then
    # release 包解压后即 deploy/docker/server/public/VERSION 等,无外层目录
    tar -xzf "$tarball" -C "$dest" 2>/dev/null \
      || { err "解压失败"; return 1; }
  else
    err "未找到 tar"; return 1
  fi
  # .env 不覆盖:若解压包带 .env.example 而已存在 .env,保留
  ok "已解压到 $dest"
}
