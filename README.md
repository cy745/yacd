<h1 align="center">
  <img src="https://user-images.githubusercontent.com/1166872/47954055-97e6cb80-dfc0-11e8-991f-230fd40481e5.png" alt="yacd">
</h1>

> Yet Another [Clash](https://github.com/Dreamacro/clash) [Dashboard](https://github.com/Dreamacro/clash-dashboard)

## 本 Fork 的部署方式(NAS 旁路由代理网关)

本仓库已定制为 **yacd + mihomo 组合镜像**,用于在 NAS 上部署旁路由代理网关。

一键部署见 [`deploy/README.md`](deploy/README.md):

```bash
cd deploy
cp .env.example .env   # 编辑确认 PARENT_IFACE / SUBNET / MIHOMO_IP
./manage.sh up         # 一键启动(自动建网/构建/接管旧容器)
```

架构与原理见 [`docs/mihomo-gateway-network.md`](docs/mihomo-gateway-network.md)。
以下为上游 yacd 的原始说明,仅作参考。

## Usage

The site [http://yacd.haishan.me](http://yacd.haishan.me) is served with HTTP not HTTPS is because many browsers block requests to HTTP resources from a HTTPS website. If you think it's not safe, you could just download the [zip of the gh-pages](https://github.com/haishanh/yacd/archive/gh-pages.zip), unzip and serve those static files with a web server(like Nginx).

**Docker image**

- Docker Hub [`haishanh/yacd`](https://hub.docker.com/r/haishanh/yacd)
- GitHub Container Registry [`ghcr.io/haishanh/yacd`](https://github.com/haishanh/yacd/pkgs/container/yacd)

```sh
docker run -p 1234:80 -d --name yacd --rm ghcr.io/haishanh/yacd:master

# and then open http://localhost:1234 in your browser
```

**Supported URL query params**

| Param    | Description                                                                        |
| -------- | ---------------------------------------------------------------------------------- |
| hostname | Hostname of the clash backend API (usually the host part of `external-controller`) |
| port     | Port of the clash backend API (usually the port part of `external-controller`)     |
| secret   | Clash API secret (`secret` in your config.yaml)                                    |
| theme    | UI color scheme (dark, light, auto)                                                |

## Development

```sh
# install dependencies
# you may install pnpm with `npm i -g pnpm`
pnpm i

# start the dev server
# then go to the url printed on the screen
pnpm start


# build optimized assets
# ready to deploy assets will be in the directory `public`
pnpm build
```
