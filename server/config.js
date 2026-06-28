// yacd-server 配置管理模块
// 处理 config.yaml 和 subscription.yaml 的读写、合并、重载

import fs from 'fs/promises';
import path from 'path';
import * as yaml from 'js-yaml';

const MIHOMO_DIR = '/root/.config/mihomo';
const CONFIG_PATH = path.join(MIHOMO_DIR, 'config.yaml');
const SUBSCRIPTION_PATH = path.join(MIHOMO_DIR, 'subscription.yaml');
const META_PATH = path.join(MIHOMO_DIR, 'subscription-meta.json');

// 从订阅中提取的字段（合并时只替换这些）
const SUBSCRIPTION_FIELDS = ['proxies', 'proxy-groups', 'rules', 'rule-providers'];

// ── 辅助 ────────────────────────────────────────────────────

async function readYaml(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return yaml.load(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

async function writeYaml(filePath, data) {
  const raw = yaml.dump(data, { indent: 2, lineWidth: 120, noRefs: true });
  await fs.writeFile(filePath, raw, 'utf-8');
}

async function readMeta() {
  try {
    const raw = await fs.readFile(META_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

async function writeMeta(data) {
  await fs.writeFile(META_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// ── 配置读取 ─────────────────────────────────────────────────

export async function getConfig() {
  const config = await readYaml(CONFIG_PATH);
  return config || {};
}

export async function getConfigRaw() {
  try {
    return await fs.readFile(CONFIG_PATH, 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

export async function getSubscription() {
  const sub = await readYaml(SUBSCRIPTION_PATH);
  if (!sub) return null;

  const meta = await readMeta();
  const proxies = sub.proxies || [];
  const groups = sub['proxy-groups'] || [];
  return {
    imported: true,
    url: meta?.url || null,
    updatedAt: meta?.updatedAt || null,
    proxiesCount: proxies.length,
    groupsCount: groups.length,
    fields: SUBSCRIPTION_FIELDS.filter((f) => f in sub),
    proxyNames: proxies.map((p) => p.name),
    groupNames: groups.map((g) => g.name),
  };
}

// ── 订阅抓取 ─────────────────────────────────────────────────

export async function fetchSubscribe(url) {
  console.log(`Fetching subscription: ${url}`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'yacd-server/1.0',
      Accept: 'application/yaml, text/plain, */*',
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`Subscription fetch failed: ${response.status} ${response.statusText}`);
  }

  const raw = await response.text();

  // 尝试解析为 YAML
  let parsed;
  try {
    parsed = yaml.load(raw);
  } catch (err) {
    throw new Error(`Failed to parse subscription as YAML: ${err.message}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Subscription content is not a valid YAML object');
  }

  // 保存完整订阅内容
  await writeYaml(SUBSCRIPTION_PATH, parsed);
  await writeMeta({ url, updatedAt: new Date().toISOString() });
  console.log(`Subscription saved: ${Object.keys(parsed).length} top-level keys`);

  // 合并到 config.yaml
  await applySubscription(true);

  return {
    keys: Object.keys(parsed),
    proxiesCount: (parsed.proxies || []).length,
    groupsCount: (parsed['proxy-groups'] || []).length,
  };
}

// ── 合并并应用 ───────────────────────────────────────────────

export async function applySubscription(isSubscribe = false) {
  const config = await readYaml(CONFIG_PATH);
  const sub = await readYaml(SUBSCRIPTION_PATH);

  if (!config) {
    throw new Error('config.yaml not found. Please upload a config first.');
  }
  if (!sub) {
    throw new Error('subscription.yaml not found. Please import a subscription first.');
  }

  // 深拷贝，避免修改原始对象
  const merged = JSON.parse(JSON.stringify(config));

  // 检查订阅是否有需要合并的字段
  let mergedCount = 0;
  for (const field of SUBSCRIPTION_FIELDS) {
    if (field in sub) {
      merged[field] = JSON.parse(JSON.stringify(sub[field]));
      mergedCount++;
    }
  }

  // 写入 config.yaml
  await writeYaml(CONFIG_PATH, merged);
  console.log(`Config merged and saved (${mergedCount} fields updated from subscription)`);

  // 触发 Mihomo 重载
  await reloadMihomo();

  return {
    mergedFields: mergedCount,
    proxiesCount: (merged.proxies || []).length,
    groupsCount: (merged['proxy-groups'] || []).length,
  };
}

// ── 触发 Mihomo 重载 ────────────────────────────────────────

async function reloadMihomo() {
  const target = process.env.MIHOMO_TARGET || 'http://127.0.0.1:9090';

  try {
    // 读取当前配置并 PUT 到 Mihomo API
    const config = await readYaml(CONFIG_PATH);
    const response = await fetch(`${target}/configs?force=true`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Mihomo reload failed: ${response.status} ${text}`);
    }

    console.log('Mihomo config reloaded successfully');
    return true;
  } catch (err) {
    // 如果 API reload 失败，回退提示
    console.error(`Mihomo reload error: ${err.message}`);
    console.log('Try: docker restart yacd-mihomo');
    throw err;
  }
}

// ── 导出 MIHOMO_DIR 给其他模块使用 ──────────────────────────

export { MIHOMO_DIR };
