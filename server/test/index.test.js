// yacd-server API 路由测试(node:test + supertest)
// 用临时 MIHOMO_DIR 隔离配置写入,不触碰真实 /root/.config/mihomo

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';

// 关键:必须在 import index.js 之前设置 MIHOMO_DIR(config.js 模块加载时读取)
let tmpDir;
before(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'yacd-test-'));
  process.env.MIHOMO_DIR = tmpDir;
  process.env.MIHOMO_TARGET = 'http://127.0.0.1:19090';
});

after(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.MIHOMO_DIR;
});

const { createApp } = await import('../index.js');
const { app } = createApp();

test('GET /api/status 返回 ok 与 target', async () => {
  const res = await request(app).get('/api/status');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
  assert.equal(res.body.name, 'yacd-server');
  assert.equal(res.body.target, 'http://127.0.0.1:19090');
});

test('POST /api/subscribe 缺 url 返回 400', async () => {
  const res = await request(app).post('/api/subscribe').send({});
  assert.equal(res.status, 400);
  assert.match(res.body.error, /Missing subscription URL/);
});

test('GET /api/config 在无 config 时返回空对象', async () => {
  const res = await request(app).get('/api/config');
  assert.equal(res.status, 200);
  assert.equal(res.body.exists, true);
  assert.deepEqual(res.body.keys, []);
});

test('GET /api/config/status 无订阅时返回 imported=false', async () => {
  const res = await request(app).get('/api/config/status');
  assert.equal(res.status, 200);
  assert.equal(res.body.subscription, null);
  assert.ok(Array.isArray(res.body.configKeys));
});

test('GET /api/subscription 无订阅时返回 imported=false', async () => {
  const res = await request(app).get('/api/subscription');
  assert.equal(res.status, 200);
  assert.equal(res.body.imported, false);
});

test('GET /api/config/read 无 config 时返回 200 空(无异常)', async () => {
  const res = await request(app).get('/api/config/read');
  assert.equal(res.status, 200);
});
