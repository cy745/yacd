// yacd-server 配置管理模块
// 处理 config.yaml 和 subscription.yaml 的读写、合并、重载

import fs from 'fs/promises';
import path from 'path';
import * as yaml from 'js-yaml';

// 配置目录:默认为 mihomo 容器内路径,测试时可通过 MIHOMO_DIR 环境变量注入临时目录
const MIHOMO_DIR = process.env.MIHOMO_DIR || '/root/.config/mihomo';
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
    proxyForSubscribe: meta?.proxyForSubscribe || null,
  };
}

// ── 订阅拉取代理选择 ─────────────────────────────────────────

/** 设置订阅拉取使用的节点/策略组名(存于 subscription-meta.json) */
export async function setSubscriptionProxy(proxy) {
  const meta = (await readMeta()) || {};
  meta.proxyForSubscribe = proxy || null;
  await writeMeta(meta);
  return meta.proxyForSubscribe;
}

// ── 订阅抓取 ─────────────────────────────────────────────────

/**
 * 确保订阅域名的流量走指定节点/策略组(而非 DIRECT 直连)。
 *
 * 背景:部分机场的订阅 URL 只有通过其专用节点代理拉取,才会返回完整节点列表;
 *      直连拉取只返回占位提示节点(如"请连接订阅专用节点并更新订阅")。
 *
 * 实现:
 *  - 目标 = meta.proxyForSubscribe(用户选择的节点/组名),未设置时回退到「订阅更新」组
 *  - 确保 `DOMAIN-SUFFIX,<订阅域名>,<目标>` 与 `IP-CIDR,<真实IP>/32,<目标>` 规则存在
 *  - 清理旧的 DIRECT 残留规则(此前版本注入的 `IP-CIDR,...,DIRECT` 与 `DOMAIN-KEYWORD,...,DIRECT`)
 *
 * 注意:订阅域名是 IP(如 <机场服务器 IP>)时,走 TUN 后由 mihomo 按 IP-CIDR 规则分流到目标。
 */
async function ensureSubscriptionProxyRules(config, url, target) {
  if (!Array.isArray(config.rules)) return;
  const urlObj = new URL(url);
  const host = urlObj.hostname;
  const rootDomain = host.split('.').slice(-2).join('.');
  const proxy = target || '订阅更新';

  // 1. 清理旧的 DIRECT 残留(订阅域名相关)
  const directRules = config.rules.filter(
    (r) => r.includes(rootDomain) && r.includes('DIRECT'),
  );
  if (directRules.length > 0) {
    config.rules = config.rules.filter((r) => !directRules.includes(r));
    console.log(`Removed ${directRules.length} stale DIRECT rules for ${rootDomain}`);
  }

  // 2. 确保域名规则指向目标
  const domainRule = `DOMAIN-SUFFIX,${rootDomain},${proxy}`;
  if (!config.rules.includes(domainRule)) {
    config.rules.unshift(domainRule);
  }

  // 3. 若 host 是 IP,确保 IP-CIDR 规则指向目标
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const ipRule = `IP-CIDR,${host}/32,${proxy}`;
    if (!config.rules.includes(ipRule)) {
      config.rules.unshift(ipRule);
    }
  }
}

export async function fetchSubscribe(url) {
  console.log(`Fetching subscription: ${url}`);

  // 确保订阅域名走目标节点/组(而非 DIRECT),并清理 DIRECT 残留
  try {
    const [config, meta] = await Promise.all([readYaml(CONFIG_PATH), readMeta()]);
    if (config) {
      await ensureSubscriptionProxyRules(config, url, meta?.proxyForSubscribe || null);
      await writeYaml(CONFIG_PATH, config);
      await reloadMihomo();
      console.log(`Subscription rules ensured for ${new URL(url).hostname}`);
    }
  } catch (err) {
    console.warn('Could not ensure subscription proxy rules (non-fatal):', err.message);
  }

  // 抓取订阅(走 mihomo TUN,由规则分流到指定节点)
  const response = await fetch(url, {
    headers: {
      // 真实订阅客户端 UA,部分机场依赖 UA 区分返回内容
      'User-Agent': 'clash-verge/v2.2.1',
      Accept: 'application/yaml, text/plain, */*',
    },
    signal: AbortSignal.timeout(60000),
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

  // 确保订阅域名走目标节点/组(而非 DIRECT),并清理 DIRECT 残留
  try {
    const meta = await readMeta();
    if (meta?.url && Array.isArray(merged.rules)) {
      await ensureSubscriptionProxyRules(merged, meta.url, meta.proxyForSubscribe || null);
    }
  } catch (_) { /* non-fatal */ }

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

  // 尝试 PUT /configs API 热重载（对规则更新可能有限）
  try {
    const config = await readYaml(CONFIG_PATH);
    const response = await fetch(`${target}/configs?force=true`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      console.log('Mihomo config reloaded via API');
      // 热重载对规则更新可能无效，等一秒后检查是否生效
      await new Promise((r) => setTimeout(r, 1000));
      // 如果不再报错，认为成功
      return true;
    }
  } catch (_) {
    // API reload failed, fall through to restart
  }

  // Fallback: 通过 Kill + 重启 Mihomo 进程来加载新配置
  // Express 是前台进程（exec node），不受影响
  try {
    console.log('Restarting Mihomo process for config reload...');
    const { execSync } = await import('node:child_process');

    // 杀掉旧 Mihomo 进程
    execSync('kill -TERM $(pidof mihomo) 2>/dev/null || kill $(cat /tmp/mihomo.pid 2>/dev/null) 2>/dev/null || true', { stdio: 'ignore' });
    await new Promise((r) => setTimeout(r, 1000));

    // 重新启动 Mihomo
    execSync('/mihomo -d /root/.config/mihomo &', { stdio: 'ignore' });
    await new Promise((r) => setTimeout(r, 2000));

    console.log('Mihomo process restarted');
    return true;
  } catch (err) {
    console.error(`Mihomo restart failed: ${err.message}`);
    throw err;
  }
}

// ── 导出 MIHOMO_DIR 给其他模块使用 ──────────────────────────

export { MIHOMO_DIR };
