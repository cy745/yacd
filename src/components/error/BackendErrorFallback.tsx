import React from 'react';
import type { FallbackProps } from 'react-error-boundary';

import { SimplifiedResponse } from '$src/api/fetch';
import { FetchCtx } from '$src/types';

import { Sep } from '../shared/Basic';
import { ErrorFallbackLayout } from './ErrorFallbackLayout';

export function FetchNetworkErrorFallback(props: {
  ctx: FetchCtx;
  resetErrorBoundary: FallbackProps['resetErrorBoundary'];
}) {
  const { resetErrorBoundary } = props;
  return (
    <ErrorFallbackLayout>
      <p>无法连接到后端服务 (Mihomo API)</p>
      <p className="text-sm opacity-60">
        请确认 Mihomo 已在运行，且 API 端口可访问
      </p>
      <Sep />
      <button
        className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors cursor-pointer"
        onClick={resetErrorBoundary}
      >
        重试
      </button>
    </ErrorFallbackLayout>
  );
}

export function BackendUnauthorizedErrorFallback(props: {
  ctx: FetchCtx;
  resetErrorBoundary: FallbackProps['resetErrorBoundary'];
}) {
  const { resetErrorBoundary } = props;
  return (
    <ErrorFallbackLayout>
      <p>后端认证失败</p>
      <p className="text-sm opacity-60">
        Mihomo API 可能需要配置 secret，请检查 config.yaml 中的设置
      </p>
      <Sep />
      <button
        className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors cursor-pointer"
        onClick={resetErrorBoundary}
      >
        重试
      </button>
    </ErrorFallbackLayout>
  );
}

export function BackendGeneralErrorFallback(props: {
  ctx: FetchCtx & { response: SimplifiedResponse };
  resetErrorBoundary: FallbackProps['resetErrorBoundary'];
}) {
  const { resetErrorBoundary, ctx } = props;
  const { response } = ctx;
  return (
    <ErrorFallbackLayout>
      <p>后端返回了异常的响应</p>
      <Sep />
      <button
        className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors cursor-pointer"
        onClick={resetErrorBoundary}
      >
        重试
      </button>
      <Sep />
      <div className="text-left mx-auto" style={{ maxWidth: 800 }}>
        <h3 className="font-bold my-2 sm:truncate sm:text-m">响应状态</h3>
        <p>{response.status}</p>
        <h3 className="font-bold my-2 sm:truncate sm:text-m">响应头</h3>
        <ul>
          {response.headers.map((h) => {
            return <li key={h}>{h}</li>;
          })}
        </ul>
        {response.data ? (
          <>
            <h3 className="font-bold my-2 sm:truncate sm:text-m">响应体</h3>
            <pre>{response.data}</pre>
          </>
        ) : null}
      </div>
    </ErrorFallbackLayout>
  );
}
