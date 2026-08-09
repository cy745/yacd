import{_ as s,o as n,c as e,a2 as t}from"./chunks/framework.BHRgmlt_.js";const m=JSON.parse('{"title":"架构","description":"","frontmatter":{},"headers":[],"relativePath":"guide/architecture.md","filePath":"guide/architecture.md","lastUpdated":1786257024000}'),p={name:"guide/architecture.md"};function l(i,a,o,c,d,r){return n(),e("div",null,[...a[0]||(a[0]=[t(`<h1 id="架构" tabindex="-1">架构 <a class="header-anchor" href="#架构" aria-label="Permalink to &quot;架构&quot;">​</a></h1><h2 id="整体拓扑" tabindex="-1">整体拓扑 <a class="header-anchor" href="#整体拓扑" aria-label="Permalink to &quot;整体拓扑&quot;">​</a></h2><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>浏览器(宿主/局域网)</span></span>
<span class="line"><span>   │</span></span>
<span class="line"><span>   ▼ http://192.168.3.100</span></span>
<span class="line"><span>Express (:80) ──────────────────────────────────────────┐</span></span>
<span class="line"><span>   │ ① 静态文件(yacd SPA)                               │</span></span>
<span class="line"><span>   │ ② /api/* 自定义端点                                 │</span></span>
<span class="line"><span>   │ ③ 其余 → 反向代理                                   │</span></span>
<span class="line"><span>   │                                                     ▼</span></span>
<span class="line"><span>   │                                     Mihomo REST API (:9090)</span></span>
<span class="line"><span>   │</span></span>
<span class="line"><span>Mihomo</span></span>
<span class="line"><span>   ├── :7890  mixed-port(HTTP/SOCKS 代理)</span></span>
<span class="line"><span>   ├── :9090  RESTful API</span></span>
<span class="line"><span>   ├── :53    DNS(Fake-IP)</span></span>
<span class="line"><span>   └── TUN    透明代理(auto-route + dns-hijack)</span></span></code></pre></div><h2 id="请求流转" tabindex="-1">请求流转 <a class="header-anchor" href="#请求流转" aria-label="Permalink to &quot;请求流转&quot;">​</a></h2><p><strong>浏览器请求</strong>:同源 <code>http://192.168.3.100</code> → Express:</p><ol><li><code>/api/*</code> → Express 自定义逻辑(订阅管理、配置读写)</li><li>静态文件 → yacd SPA</li><li>其余(如 <code>/proxies</code>、<code>/configs</code>)→ 反向代理到 Mihomo REST API</li><li>WebSocket(<code>/logs</code>、<code>/connections</code>、<code>/traffic</code>)→ 自动升级代理</li></ol><p><strong>局域网设备流量</strong>:设备 →(网关)→ Mihomo TUN → mihomo 分流规则:</p><ul><li>国外流量 → 代理节点</li><li>国内流量 → DIRECT 直连</li></ul><h2 id="macvlan-网络与宿主机互通" tabindex="-1">macvlan 网络与宿主机互通 <a class="header-anchor" href="#macvlan-网络与宿主机互通" aria-label="Permalink to &quot;macvlan 网络与宿主机互通&quot;">​</a></h2><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>┌─ 宿主 ──────────────────────┐</span></span>
<span class="line"><span>│  eth0 (10GbE, 192.168.3.6)  │──┐</span></span>
<span class="line"><span>│                             │  │ 跨端口 L2 转发</span></span>
<span class="line"><span>│  eth1 (USB, 192.168.3.72)   │◄─┘</span></span>
<span class="line"><span>└─────────────────────────────┘</span></span>
<span class="line"><span>         │ macvlan parent</span></span>
<span class="line"><span>         ▼</span></span>
<span class="line"><span>   yacd-mihomo 容器 (192.168.3.100)</span></span></code></pre></div><p><strong>关键设计</strong>:容器 macvlan 挂在 <code>eth1</code>(USB 网卡),宿主机从 <code>eth0</code> 访问。 macvlan 的宿主机隔离只发生在&quot;同一物理端口进出&quot;,跨端口经交换机 L2 转发天然互通。</p><h2 id="数据持久化" tabindex="-1">数据持久化 <a class="header-anchor" href="#数据持久化" aria-label="Permalink to &quot;数据持久化&quot;">​</a></h2><table tabindex="0"><thead><tr><th>数据</th><th>存储</th><th>重建容器</th></tr></thead><tbody><tr><td>mihomo 配置/订阅</td><td>命名卷 <code>mihomo-config</code></td><td>✅ 保留</td></tr><tr><td>容器定义</td><td>compose 文件</td><td>✅ 保留</td></tr><tr><td>镜像</td><td>Docker 镜像</td><td>✅ 重建</td></tr></tbody></table>`,13)])])}const u=s(p,[["render",l]]);export{m as __pageData,u as default};
