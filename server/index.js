// yacd Express Server
// Serves yacd SPA static files + proxies API/WS requests to Mihomo
//
// 本模块导出 `app`(express 实例)供测试(supertest)直接使用;
// 仅当作为主模块直接运行时才 listen(见文件末尾 import.meta.url 判断)。

import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import * as cfg from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '80', 10);
const MIHOMO_TARGET = process.env.MIHOMO_TARGET || 'http://127.0.0.1:9090';

export function createApp() {
  const app = express();

  // Parse JSON request bodies (仅用于 /api/* 路由,不影响代理转发)
  app.use('/api', express.json({ limit: '10mb' }));

  // ── 1. Custom API / Config Management ────────────────────────
  app.get('/api/status', (_req, res) => {
    res.json({ status: 'ok', name: 'yacd-server', target: MIHOMO_TARGET });
  });

  // 1a. Config / subscription status
  app.get('/api/config', async (_req, res) => {
    try {
      const config = await cfg.getConfig();
      res.json({ exists: true, keys: Object.keys(config) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/config/status', async (_req, res) => {
    try {
      const [config, sub] = await Promise.all([
        cfg.getConfig(),
        cfg.getSubscription(),
      ]);
      res.json({
        configKeys: Object.keys(config),
        subscription: sub, // null if not imported
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 1b. Subscription management
  app.get('/api/subscription', async (_req, res) => {
    try {
      const sub = await cfg.getSubscription();
      res.json(sub || { imported: false });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/config — read full config.yaml
  app.get('/api/config/read', async (_req, res) => {
    try {
      const raw = await cfg.getConfigRaw();
      res.type('yaml').send(raw);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/subscribe', async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) return res.status(400).json({ error: 'Missing subscription URL' });

      const result = await cfg.fetchSubscribe(url);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/config/apply', async (_req, res) => {
    try {
      const result = await cfg.applySubscription();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── 2. Static files (yacd SPA build output) ──────────────────
  app.use(express.static(path.resolve(__dirname, '../public')));

  // ── 3. Proxy remaining requests to Mihomo API ────────────────
  // Covers: /proxies, /configs, /rules, /logs, /connections,
  //         /traffic, /version, /providers, / (returns {"hello":"clash"})
  const mihomoProxy = createProxyMiddleware({
    target: MIHOMO_TARGET,
    changeOrigin: true,
    ws: true,
  });
  app.use(mihomoProxy);

  return { app, mihomoProxy };
}

// ── 启动:仅当作为主模块直接运行(node server/index.js)时才 listen ──
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const { app: runningApp, mihomoProxy } = createApp();
  const server = runningApp.listen(PORT, () => {
    console.log(`yacd-server running on :${PORT}`);
    console.log(`Proxying to Mihomo at ${MIHOMO_TARGET}`);
  });

  // WebSocket upgrade handling (for /logs, /connections, /traffic)
  server.on('upgrade', mihomoProxy.upgrade);
}
