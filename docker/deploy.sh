#!/bin/sh
# yacd-mihomo 部署脚本
# 在 NAS 上运行：bash docker/deploy.sh
# 前置：docker/ 和 public/ 已是最新（本地 pnpm build 后再上传）

set -e

IMAGE_NAME="yacd-mihomo:latest"
CONTAINER_NAME="yacd-mihomo"
NETWORK_NAME="macnet"
CONTAINER_IP="192.168.3.100"
VOLUME_NAME="mihomo-config"

echo "========================================="
echo " yacd-mihomo 部署脚本"
echo "========================================="

# 1. 构建 Docker 镜像
echo ""
echo "[1/4] 构建 Docker 镜像..."
docker build --network host -t ${IMAGE_NAME} -f docker/Dockerfile .
echo "  ✅ 镜像构建完成"

# 2. 创建配置卷（如不存在）
echo ""
echo "[2/4] 检查配置卷..."
if docker volume inspect ${VOLUME_NAME} > /dev/null 2>&1; then
  echo "  ✅ 卷 ${VOLUME_NAME} 已存在"
else
  docker volume create ${VOLUME_NAME}
  echo "  ✅ 卷 ${VOLUME_NAME} 已创建"
fi

# 3. 停掉旧容器
echo ""
echo "[3/4] 停止旧容器..."
if docker ps -a --filter name=${CONTAINER_NAME} --format '{{.Names}}' | grep -q ${CONTAINER_NAME}; then
  docker stop ${CONTAINER_NAME} 2>/dev/null || true
  docker rm ${CONTAINER_NAME} 2>/dev/null || true
  echo "  ✅ 旧容器已移除"
else
  echo "  ⏭️  无旧容器"
fi

# 4. 启动新容器
echo ""
echo "[4/4] 启动新容器..."
docker run -d --name ${CONTAINER_NAME} \
  --network ${NETWORK_NAME} --ip ${CONTAINER_IP} \
  --cap-add NET_ADMIN --cap-add NET_RAW --cap-add SYS_ADMIN \
  --device /dev/net/tun:/dev/net/tun \
  -v ${VOLUME_NAME}:/root/.config/mihomo \
  -e MIHOMO_TARGET=http://127.0.0.1:9090 \
  ${IMAGE_NAME}

echo "  ✅ 容器启动成功"
echo ""
echo "========================================="
echo " 访问地址: http://${CONTAINER_IP}"
echo " 容器日志: docker logs -f ${CONTAINER_NAME}"
echo "========================================="

# 等待启动并检查
sleep 3
if docker ps --filter name=${CONTAINER_NAME} --filter status=running --format '{{.Names}}' | grep -q ${CONTAINER_NAME}; then
  echo ""
  echo "  ✅ 容器运行中"
  docker logs ${CONTAINER_NAME} 2>&1 | tail -5
else
  echo ""
  echo "  ❌ 容器启动失败，查看日志："
  docker logs ${CONTAINER_NAME} 2>&1 | tail -20
  exit 1
fi
