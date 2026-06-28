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

  // 解析订阅域名的真实 IP，注入 IP-CIDR 直连规则
  // TUN 模式会劫持所有流量，必须用 IP 规则确保直连
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;

    // DNS 解析获取订阅服务器的真实 IP
    const { execSync } = await import('node:child_process');
    const digOutput = execSync(
      `nslookup ${domain} 2>/dev/null || host ${domain} 2>/dev/null || echo ""`,
      { timeout: 5000, encoding: 'utf-8' }
    );

    // 从输出中提取 IPv4 地址
    const ipv4Regex = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
    const ipMatches = digOutput.match(ipv4Regex) || [];

    const config = await readYaml(CONFIG_PATH);
    if (config && Array.isArray(config.rules) && ipMatches.length > 0) {
      const uniqueIPs = [...new Set(ipMatches)].filter(
        (ip) => !ip.startsWith('127.') && !ip.startsWith('10.') &&
               !ip.startsWith('192.168.') && !ip.startsWith('198.18.')
      );
      let addedCount = 0;
      for (const ip of uniqueIPs) {
        const rule = `IP-CIDR,${ip}/32,DIRECT`;
        if (!config.rules.includes(rule)) {
          config.rules.unshift(rule);
          addedCount++;
        }
      }
      if (addedCount > 0) {
        await writeYaml(CONFIG_PATH, config);
        await reloadMihomo();
        console.log(`Added ${addedCount} IP DIRECT rules for ${domain}: ${uniqueIPs.join(', ')}`);
      }
    }
  } catch (err) {
    console.warn('Could not inject IP DIRECT rules (non-fatal):', err.message);
  }

  // 抓取订阅
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'yacd-server/1.0',
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

  // 根据元数据中的订阅 URL 注入域名直连规则
  try {
    const meta = await readMeta();
    if (meta?.url) {
      const urlObj = new URL(meta.url);
      const parts = urlObj.hostname.split('.');
      const rootDomain = parts.length > 2 ? parts.slice(-2).join('.') : urlObj.hostname;
      const directRule = `DOMAIN-KEYWORD,${rootDomain},DIRECT`;
      if (Array.isArray(merged.rules) && !merged.rules.includes(directRule)) {
        merged.rules.unshift(directRule);
      }
    }
  } catch (_) { /* non-fatal */ }

  // 检查订阅是否有需要合并的字段
  let mergedCount = 0;
  for (const field of SUBSCRIPTION_FIELDS) {
    if (field in sub) {
      merged[field] = JSON.parse(JSON.stringify(sub[field]));
      mergedCount++;
    }
  }

  // 在合并后补回订阅域名的 IP 直连规则（确保下次更新能直连）
  try {
    const meta = await readMeta();
    if (meta?.url && Array.isArray(merged.rules)) {
      const urlObj = new URL(meta.url);
      const domain = urlObj.hostname;
      const { execSync } = await import('node:child_process');
      const digOutput = execSync(`nslookup ${domain} 2>/dev/null || host ${domain} 2>/dev/null || echo ""`, { timeout: 5000, encoding: 'utf-8' });
      const ipv4Regex = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
      const ipMatches = digOutput.match(ipv4Regex) || [];
      const uniqueIPs = [...new Set(ipMatches)].filter(
        (ip) => !ip.startsWith('127.') && !ip.startsWith('10.') && !ip.startsWith('192.168.') && !ip.startsWith('198.18.')
      );
      for (const ip of uniqueIPs) {
        const rule = `IP-CIDR,${ip}/32,DIRECT`;
        if (!merged.rules.includes(rule)) {
          merged.rules.unshift(rule);
        }
      }
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
