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

const { getConfig, getSubscription, applySubscription, setSubscriptionProxy } = await import('../config.js');
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

test('setSubscriptionProxy 持久化到 meta', async () => {
  // 先导入订阅(确保 getSubscription 有 meta)
  writeConfig({ port: 7890, rules: ['MATCH,proxy'] });
  writeFileSync(SUB, JSON.stringify({
    proxies: [{ name: '节点A' }],
    'proxy-groups': [{ name: '订阅更新', type: 'select', proxies: ['节点A'] }],
    rules: ['MATCH,proxy'],
  }));
  await applySubscription();

  // 设置拉取代理
  const proxy = await setSubscriptionProxy('节点A');
  assert.equal(proxy, '节点A');

  // getSubscription 应返回它
  const sub = await getSubscription();
  assert.equal(sub.proxyForSubscribe, '节点A');

  // 清除
  await setSubscriptionProxy(null);
  const sub2 = await getSubscription();
  assert.equal(sub2.proxyForSubscribe, null);
});

test('applySubscription 确保订阅域名走目标节点(非 DIRECT)', async () => {
  writeConfig({
    port: 7890,
    rules: ['MATCH,proxy'],
  });
  writeFileSync(SUB, JSON.stringify({
    proxies: [{ name: '订阅专用节点' }],
    'proxy-groups': [{ name: '订阅更新', type: 'select', proxies: ['订阅专用节点'] }],
    rules: ['MATCH,proxy'],
  }));
  // 设置 meta.url + proxyForSubscribe
  const { writeFileSync: w } = await import('node:fs');
  const metaPath = join(tmpDir, 'subscription-meta.json');
  w(metaPath, JSON.stringify({ url: 'https://example.com/api/sub', proxyForSubscribe: '订阅专用节点' }));

  await applySubscription();

  const cfg = await getConfig();
  const rules = cfg.rules;
  // 域名规则指向订阅专用节点,而非 DIRECT
  const domainRule = rules.find((r) => r.startsWith('DOMAIN-SUFFIX,example.com,'));
  assert.ok(domainRule, '应存在 example.com 的域名规则');
  assert.equal(domainRule, 'DOMAIN-SUFFIX,example.com,订阅专用节点');
  // 不应有 DIRECT 残留
  assert.ok(!rules.some((r) => r.includes('example.com') && r.includes('DIRECT')), '不应有 DIRECT 残留');
});
