---
layout: home

hero:
  name: yacd
  text: 旁路由代理网关
  tagline: yacd 面板 + mihomo 透明代理,一条命令部署到你的 NAS
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/quick-start
    - theme: alt
      text: GitHub
      link: https://github.com/cy745/yacd
    - theme: alt
      text: 查看源码
      link: https://github.com/cy745/yacd

features:
  - icon: 🚀
    title: 一键安装
    details: curl|sh 安装 yacd CLI,一条命令完成网络、镜像、容器部署
  - icon: 🌐
    title: 透明代理
    details: mihomo TUN + Fake-IP,局域网设备把网关指向容器即可全屋代理
  - icon: 🔌
    title: 跨端口 macvlan
    details: 利用 USB 网卡实现宿主机与容器互通,摆脱 macvlan 隔离限制
  - icon: 📦
    title: 数据安全
    details: 命名卷持久化配置,重建容器不丢订阅与规则
---
