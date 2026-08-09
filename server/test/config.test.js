// config.js 的配置合并/订阅逻辑测试(node:test)
// 用临时 MIHOMO_DIR 验证 YAML 读写、字段合并、注入规则清理

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmpDir;
before(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'yacd-cfg-test-'));
  process.env.MIHOMO_DIR = tmpDir;
});

after(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.MIHOMO_DIR;
});

const { getConfig, getSubscription, applySubscription } = await import('../config.js');
const CFG = join(tmpDir, 'config.yaml');
const SUB = join(tmpDir, 'subscription.yaml');

function writeConfig(data) {
  mkdirSync(tmpDir, { recursive: true });
  writeFileSync(CFG, JSON.stringify(data)); // JSON 是合法 YAML,便于断言
}

test('getConfig 在无 config 时返回空对象', async () => {
  const cfg = await getConfig();
  assert.deepEqual(cfg, {});
});

test('getConfig 读取已写入的 config', async () => {
  writeConfig({ port: 7890, mode: 'rule' });
  const cfg = await getConfig();
  assert.equal(cfg.port, 7890);
  assert.equal(cfg.mode, 'rule');
});

test('applySubscription 合并订阅字段到 config', async () => {
  writeConfig({
    port: 7890,
    proxies: [{ name: 'old' }],
    rules: ['DOMAIN-SUFFIX,cn,DIRECT'],
  });
  writeFileSync(SUB, JSON.stringify({
    proxies: [{ name: 'new1' }, { name: 'new2' }],
    'proxy-groups': [{ name: 'G1' }],
    rules: ['MATCH,proxy'],
  }));

  const result = await applySubscription();
  assert.equal(result.mergedFields, 3);
  assert.equal(result.proxiesCount, 2);

  // 验证合并后的 config 被覆盖为订阅字段
  const cfg = await getConfig();
  assert.equal(cfg.proxies.length, 2);
  assert.equal(cfg.proxies[0].name, 'new1');
  assert.deepEqual(cfg['proxy-groups'], [{ name: 'G1' }]);
  assert.deepEqual(cfg.rules, ['MATCH,proxy']);
  // 非订阅字段保留
  assert.equal(cfg.port, 7890);
});

test('getSubscription 无订阅时返回 null', async () => {
  // 清掉前面测试写入的订阅,验证"未导入"场景
  rmSync(SUB, { force: true });
  const sub = await getSubscription();
  assert.equal(sub, null);
});
