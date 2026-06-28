// yacd Express Server
// Serves yacd SPA static files + proxies API/WS requests to Mihomo

import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '80', 10);
const MIHOMO_TARGET = process.env.MIHOMO_TARGET || 'http://127.0.0.1:9090';

const app = express();

// ── 1. Custom API ────────────────────────────────────────────
app.get('/api/status', (_req, res) => {
  res.json({ status: 'ok', name: 'yacd-server', target: MIHOMO_TARGET });
});

// ── 2. Static files (yacd SPA build output) ──────────────────
// Only serves files that actually exist in public/
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

// ── 4. Start ─────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`yacd-server running on :${PORT}`);
  console.log(`Proxying to Mihomo at ${MIHOMO_TARGET}`);
});

// WebSocket upgrade handling (for /logs, /connections, /traffic)
server.on('upgrade', mihomoProxy.upgrade);
