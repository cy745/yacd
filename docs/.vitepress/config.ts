import { defineConfig } from 'vitepress'

// 文档站配置
// 部署在 GitHub Pages 的 gh-pages 分支 docs/ 子目录 → base 必须带子路径
// SPA(yacd 面板)在 gh-pages 根,文档在 /docs/,互不冲突
export default defineConfig({
  title: 'yacd docs',
  description: 'yacd + mihomo 旁路由代理网关 — 部署、配置与参考文档',
  base: '/yacd/docs/',
  lastUpdated: true,
  ignoreDeadLinks: true, // legacy/ 目录保留历史文档,容忍其相对链接
  themeConfig: {
    logo: '/yacd/docs/yacd-128.png',
    nav: [
      { text: '首页', link: '/' },
      { text: '指南', link: '/guide/quick-start' },
      { text: '开发', link: '/development/api-endpoints' },
      { text: '参考', link: '/reference/cli' },
      { text: 'FAQ', link: '/faq' },
      { text: 'GitHub', link: 'https://github.com/cy745/yacd' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: '指南',
          items: [
            { text: '快速开始', link: '/guide/quick-start' },
            { text: '部署', link: '/guide/deployment' },
            { text: '架构', link: '/guide/architecture' },
          ],
        },
      ],
      '/development/': [
        {
          text: '开发',
          items: [
            { text: '本地开发', link: '/development/local-dev' },
            { text: 'API 端点', link: '/development/api-endpoints' },
          ],
        },
      ],
      '/reference/': [
        {
          text: '参考',
          items: [
            { text: 'CLI 命令', link: '/reference/cli' },
            { text: '配置', link: '/reference/configuration' },
          ],
        },
      ],
    },
    search: {
      provider: 'local',
    },
    editLink: {
      pattern: 'https://github.com/cy745/yacd/edit/main/docs/:path',
      text: '在 GitHub 上编辑此页',
    },
    footer: {
      message: '基于 Apache-2.0 许可发布',
      copyright: 'Copyright © 2026 yacd',
    },
  },
})
