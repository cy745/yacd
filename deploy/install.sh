#!/bin/sh
# =============================================================================
#  yacd 一键安装 / 升级脚本(curl | sh 入口)
#
#  用法:
#    curl -fsSL https://raw.githubusercontent.com/cy745/yacd/master/deploy/install.sh | sh
#
#  行为(幂等,重跑即升级):
#    1. 确定安装目录(INSTALL_DIR):root 默认 /opt/yacd,非 root 默认 ~/.yacd
#    2. NAS 无 git → 通过 GitHub API 解析最新 release,下载 yacd-release.tar.gz
#       (若 YACD_USE_MAIN=1 则从 master 分支拉取,方便开发预览)
#    3. tar 解压到 INSTALL_DIR(幂等覆盖 deploy/docker/server/public/VERSION)
#    4. .env 不存在则从模板复制;已存在则保留(不覆盖用户配置)
#    5. 建全局入口:ln -sf $INSTALL_DIR/deploy/manage.sh $PREFIX/bin/yacd
#    6. 末尾自检:command -v yacd && yacd version
#
#  可覆盖环境变量:
#    YACD_INSTALL_DIR  安装目录
#    YACD_PREFIX       bin 所在目录(默认 /usr/local;非 root 用 $HOME/.local)
#    YACD_USE_MAIN     设为 1 则从 master 分支源码拉取(而非 release 包)
#    YACD_SKIP_LINK    设为 1 则跳过创建 yacd 软链
# =============================================================================

set -e

REPO="cy745/yacd"
RAW_BASE="https://raw.githubusercontent.com/$REPO"
API_BASE="https://api.github.com/repos/$REPO"

# ── 安装目录 ───────────────────────────────────────────────────────────────
if [ -n "${YACD_INSTALL_DIR:-}" ]; then
  INSTALL_DIR="$YACD_INSTALL_DIR"
elif [ "$(id -u)" = "0" ]; then
  INSTALL_DIR="/opt/yacd"
else
  INSTALL_DIR="$HOME/.yacd"
fi

# ── bin 目录 ───────────────────────────────────────────────────────────────
if [ -n "${YACD_PREFIX:-}" ]; then
  PREFIX="$YACD_PREFIX"
elif [ "$(id -u)" = "0" ]; then
  PREFIX="/usr/local"
else
  PREFIX="$HOME/.local"
fi
BIN_DIR="$PREFIX/bin"

echo "=============================================="
echo " yacd 安装程序"
echo " 仓库:      $REPO"
echo " 安装目录:  $INSTALL_DIR"
echo " 命令入口:  $BIN_DIR/yacd"
echo "=============================================="

# ── 下载源选择:release 资产 或 master 分支源码 ──────────────────────────────
if [ "${YACD_USE_MAIN:-0}" = "1" ]; then
  echo "[1/4] 从 master 分支拉取源码..."
  TMP_TAR="$(mktemp -t yacd-master.XXXXXX.tar.gz)"
  curl -fsSL -o "$TMP_TAR" "https://codeload.github.com/$REPO/tar.gz/refs/heads/master" \
    || { echo "错误:无法从 master 分支下载" >&2; exit 1; }
else
  echo "[1/4] 解析最新 release..."
  LATEST_TAG="$(curl -fsSL "$API_BASE/releases/latest" 2>/dev/null | grep -o '"tag_name": *"[^"]*"' | head -1 | sed 's/.*: *"//;s/"//')"
  TMP_TAR="$(mktemp -t yacd.XXXXXX.tar.gz)"
  if [ -n "$LATEST_TAG" ]; then
    echo "  最新版本: $LATEST_TAG"
    echo "[2/4] 下载 release 资产..."
    # release 资产是 GitHub Release 附件,从 releases/download 端点下载
    if ! curl -fsSL -o "$TMP_TAR" "https://github.com/$REPO/releases/download/$LATEST_TAG/yacd-release.tar.gz" 2>/dev/null; then
      echo "  (release 资产未发布,回退源码 tarball)"
      curl -fsSL -o "$TMP_TAR" "https://codeload.github.com/$REPO/tar.gz/refs/tags/$LATEST_TAG" \
        || { echo "错误:下载失败" >&2; exit 1; }
    fi
  else
    # 尚无 release(首次安装):降级到 master 分支源码,保证 curl|sh 可用
    echo "  (暂无 release,降级到 master 分支源码)"
    curl -fsSL -o "$TMP_TAR" "https://codeload.github.com/$REPO/tar.gz/refs/heads/master" \
      || { echo "错误:无法从 master 分支下载" >&2; exit 1; }
  fi
fi

# ── 解压安装 ───────────────────────────────────────────────────────────────
echo "[3/4] 解压到 $INSTALL_DIR ..."
mkdir -p "$INSTALL_DIR"
if command -v tar >/dev/null 2>&1; then
  # 优先用系统 tar
  tar -xzf "$TMP_TAR" -C "$INSTALL_DIR" --strip-components=1 2>/dev/null \
    || tar -xzf "$TMP_TAR" -C "$INSTALL_DIR"
else
  echo "错误:未找到 tar,无法解压" >&2
  exit 1
fi
rm -f "$TMP_TAR"

# 确保脚本可执行(源码 tarball 可能丢可执行位)
chmod 755 "$INSTALL_DIR/deploy/manage.sh" "$INSTALL_DIR/deploy/install.sh" \
  "$INSTALL_DIR"/deploy/cmd/*.sh "$INSTALL_DIR"/deploy/lib/*.sh \
  "$INSTALL_DIR/docker/entrypoint.sh" 2>/dev/null || true

# ── .env:不存在则从模板复制 ───────────────────────────────────────────────
if [ ! -f "$INSTALL_DIR/deploy/.env" ]; then
  cp "$INSTALL_DIR/deploy/.env.example" "$INSTALL_DIR/deploy/.env"
  echo "  .env 已从模板创建,请编辑确认(PARENT_IFACE / SUBNET / MIHOMO_IP)"
else
  echo "  .env 已存在,保留(不覆盖)"
fi

# ── 创建全局入口 ───────────────────────────────────────────────────────────
if [ "${YACD_SKIP_LINK:-0}" != "1" ]; then
  mkdir -p "$BIN_DIR"
  ln -sf "$INSTALL_DIR/deploy/manage.sh" "$BIN_DIR/yacd"
  echo "  yacd 已链接到 $BIN_DIR/yacd"
fi

# ── 自检 ───────────────────────────────────────────────────────────────────
echo "[4/4] 自检..."
if command -v yacd >/dev/null 2>&1; then
  yacd version || true
else
  # PATH 里没有,显式调用
  "$INSTALL_DIR/deploy/manage.sh" version || true
fi

echo ""
echo "安装完成!"
echo "  命令:  yacd <命令>(如 yacd up / yacd status / yacd logs)"
echo "  帮助:  yacd help"
echo "  首次使用: 编辑 $INSTALL_DIR/deploy/.env 后运行 yacd up"
echo ""

# 前端产物检查:源码 tarball 不含 public/ 需提示
if [ ! -f "$INSTALL_DIR/public/index.html" ]; then
  echo "──────────────────────────────────────────────"
  echo "⚠️  未检测到前端构建产物 (public/index.html)"
  echo "  方式一:本地构建后上传"
  echo "    pnpm install && pnpm build"
  echo "    scp -r public/ <user>@<nas>:$INSTALL_DIR/"
  echo "  方式二:等 release 发布后重新运行 yacd install"
  echo "    (release 资产会包含构建好的 public/)"
  echo "──────────────────────────────────────────────"
fi
