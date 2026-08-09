# 上游 yacd 原始说明

本文件为上游 [haishanh/yacd](https://github.com/haishanh/yacd) 的原始 README 存档。

## Usage

The site [http://yacd.haishan.me](http://yacd.haishan.me) is served with HTTP not HTTPS is because many browsers block requests to HTTP resources from a HTTPS website. If you think it's not safe, you could just download the [zip of the gh-pages](https://github.com/haishanh/yacd/archive/gh-pages.zip), unzip and serve those static files with a web server(like Nginx).

**Docker image**

- Docker Hub [`haishanh/yacd`](https://hub.docker.com/r/haishanh/yacd)
- GitHub Container Registry [`ghcr.io/haishanh/yacd`](https://github.com/haishanh/yacd/pkgs/container/yacd)

```sh
docker run -p 1234:80 -d --name yacd --rm ghcr.io/haishanh/yacd:master
```

**Supported URL query params**

| Param    | Description |
| -------- | ----------- |
| hostname | Hostname of the clash backend API (usually the host part of `external-controller`) |
| port     | Port of the clash backend API (usually the port part of `external-controller`) |
| secret   | Clash API secret (`secret` in your config.yaml) |
| theme    | UI color scheme (dark, light, auto) |
