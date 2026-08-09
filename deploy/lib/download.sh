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

# 下载 release 资产(yacd-release.tar.gz)或 master 分支源码到指定路径
# 参数:$1 = 输出文件路径;可选 YACD_USE_MAIN=1 强制用 master 分支源码
# 若 release 资产不存在(首次发布前),自动 fallback 到 GitHub 源码 tarball
download_release() {
  local out="$1"
  local tag="" url_assets url_fallback
  if [ "${YACD_USE_MAIN:-0}" = "1" ]; then
    url_assets=""
    url_fallback="https://codeload.github.com/$REPO/tar.gz/refs/heads/master"
    info "从 master 分支拉取源码: $url_fallback"
  else
    tag="$(fetch_latest_tag)"
    [ -z "$tag" ] && { err "无法解析最新 release tag"; return 1; }
    # release 资产是 GitHub Release 附件,从 releases/download 端点下载
    url_assets="https://github.com/$REPO/releases/download/$tag/yacd-release.tar.gz"
    url_fallback="https://codeload.github.com/$REPO/tar.gz/refs/tags/$tag"
    info "从 release $tag 下载: $url_assets"
  fi
  if [ -z "$url_assets" ] || ! curl -fsSL -o "$out" "$url_assets" 2>/dev/null; then
    warn "release 资产不存在(可能尚未发布),回退到源码 tarball: $url_fallback"
    curl -fsSL -o "$out" "$url_fallback" 2>/dev/null || { err "下载失败"; return 1; }
  fi
  ok "下载完成: $(du -h "$out" 2>/dev/null | cut -f1)"
}

# 解压 release 包到安装目录(幂等覆盖;不触碰用户 .env)
extract_release() {
  local tarball="$1" dest="$2"
  mkdir -p "$dest"
  if command -v tar >/dev/null 2>&1; then
    # release 包解压后即 deploy/docker/server/public/VERSION 等,无外层目录
    # 源码 tarball 有 yacd-main/ 顶层目录,用 --strip-components 处理两种情况
    tar -xzf "$tarball" -C "$dest" --strip-components=1 2>/dev/null \
      || tar -xzf "$tarball" -C "$dest" 2>/dev/null \
      || { err "解压失败"; return 1; }
  else
    err "未找到 tar"; return 1
  fi
  ok "已解压到 $dest"
}
