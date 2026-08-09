// 订阅管理组件 — 管理订阅 URL、导入、合并、重载

import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';

const API_BASE = '';

type SubStatus = {
  imported: boolean;
  url?: string | null;
  updatedAt?: string | null;
  proxiesCount?: number;
  groupsCount?: number;
  proxyNames?: string[];
};

export default function SubscriptionManager() {
  const [status, setStatus] = useState<SubStatus | null>(null);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [viewNodes, setViewNodes] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/subscription`);
      const data = await res.json();
      setStatus(data);
      if (data.url) setUrl(data.url);
    } catch (err) {
      console.error('Failed to fetch subscription status:', err);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const showMsg = (type: 'ok' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleSubscribe = async () => {
    if (!url.trim()) {
      showMsg('error', '请输入订阅 URL');
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        showMsg('error', data.error || '导入失败');
      } else {
        showMsg('ok', `导入成功！节点: ${data.proxiesCount}, 策略组: ${data.groupsCount}`);
        fetchStatus();
      }
    } catch (err) {
      showMsg('error', `网络错误: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/config/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const data = await res.json();
      if (!res.ok) {
        showMsg('error', data.error || '应用失败');
      } else {
        showMsg('ok', `配置已合并并重载！节点: ${data.proxiesCount}, 策略组: ${data.groupsCount}`);
      }
    } catch (err) {
      showMsg('error', `网络错误: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (isoString: string | null | undefined) => {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleString('zh-CN');
  };

  return (
    <div style={{ padding: '24px 0' }}>
      <h3 style={{ marginBottom: 16, fontSize: 18, fontWeight: 600 }}>订阅管理</h3>

      {/* 当前状态 */}
      {status && (
        <div
          style={{
            background: 'var(--color-card-bg, #1e1e2e)',
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
            fontSize: 14,
            lineHeight: 1.8,
          }}
        >
          <div>
            <strong>状态：</strong>
            {status.imported ? (
              <span style={{ color: '#4ade80' }}>已导入</span>
            ) : (
              <span style={{ color: '#f87171' }}>未导入</span>
            )}
          </div>
          {status.imported && (
            <>
              <div>
                <strong>节点数量：</strong>
                {status.proxiesCount ?? '-'}
              </div>
              <div>
                <strong>策略组数量：</strong>
                {status.groupsCount ?? '-'}
              </div>
              <div>
                <strong>最近更新：</strong>
                {formatDate(status.updatedAt)}
              </div>
              {status.proxyNames && status.proxyNames.length > 0 && (
                <div>
                  <button
                    type="button"
                    style={{
                      cursor: 'pointer',
                      color: '#60a5fa',
                      textDecoration: 'underline',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      fontSize: 'inherit',
                    }}
                    onClick={() => setViewNodes(!viewNodes)}
                  >
                    {viewNodes ? '收起节点列表' : `查看节点列表 (${status.proxyNames.length}个)`}
                  </button>
                  {viewNodes && (
                    <div style={{ marginTop: 8, maxHeight: 200, overflowY: 'auto' }}>
                      {status.proxyNames.map((name) => (
                        <div key={name} style={{ padding: '2px 8px', fontSize: 12, opacity: 0.7 }}>
                          {name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* URL 输入 */}
      <div style={{ marginBottom: 12 }}>
        <label
          htmlFor="subscription-url"
          style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500 }}
        >
          订阅链接
        </label>
        <input
          id="subscription-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/subscribe?token=..."
          disabled={loading}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 6,
            border: '1px solid var(--color-border, #374151)',
            background: 'var(--color-input-bg, #1e1e2e)',
            color: 'var(--color-text, #e5e7eb)',
            fontSize: 14,
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* 操作按钮 */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button
          onClick={handleSubscribe}
          disabled={loading}
          style={{
            padding: '10px 20px',
            borderRadius: 6,
            border: 'none',
            background: loading ? '#6b7280' : '#3b82f6',
            color: '#fff',
            fontSize: 14,
            fontWeight: 500,
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
          }}
        >
          {loading ? '处理中...' : status?.imported ? '更新订阅' : '导入订阅'}
        </button>

        {status?.imported && (
          <button
            onClick={handleApply}
            disabled={loading}
            style={{
              padding: '10px 20px',
              borderRadius: 6,
              border: 'none',
              background: loading ? '#6b7280' : '#22c55e',
              color: '#fff',
              fontSize: 14,
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            保存并应用
          </button>
        )}
      </div>

      {/* 消息提示 */}
      {message && (
        <div
          style={{
            marginTop: 16,
            padding: '10px 16px',
            borderRadius: 6,
            background: message.type === 'ok' ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)',
            color: message.type === 'ok' ? '#4ade80' : '#f87171',
            fontSize: 14,
          }}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
