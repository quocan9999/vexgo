import { getApiBaseUrl } from '@/lib/api-url';
import {
  getAdminAccessToken,
  invalidateAdminSession,
  refreshAdminAccessToken,
} from '@/features/admin-auth/services/admin-auth';

function getRequestUrl(input: RequestInfo | URL): URL {
  const value =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  return new URL(value, getApiBaseUrl());
}

function buildRequestInit(
  init: RequestInit,
  input: RequestInfo | URL,
  accessToken: string | null,
): RequestInit {
  const headers = new Headers(
    input instanceof Request ? input.headers : undefined,
  );
  new Headers(init.headers).forEach((value, name) => headers.set(name, value));
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  return { ...init, headers, credentials: 'include' };
}

function isAuthEndpoint(url: URL): boolean {
  return /\/api\/v1\/auth\/(login|refresh|logout|session)$/.test(url.pathname);
}

export async function adminApiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const url = getRequestUrl(input);
  const apiOrigin = new URL(getApiBaseUrl()).origin;
  if (url.origin !== apiOrigin) {
    return fetch(input, init);
  }

  const tokenUsed = getAdminAccessToken();
  const retryInput = input instanceof Request ? input.clone() : input;
  const firstResponse = await fetch(
    input,
    buildRequestInit(init, input, tokenUsed),
  );
  if (firstResponse.status !== 401 || isAuthEndpoint(url)) {
    return firstResponse;
  }
  if (init.signal?.aborted) return firstResponse;

  const tokenAfterResponse = getAdminAccessToken();
  const retryToken =
    tokenAfterResponse && tokenAfterResponse !== tokenUsed
      ? tokenAfterResponse
      : await refreshAdminAccessToken(tokenUsed ?? undefined);
  if (!retryToken) return firstResponse;

  const retryResponse = await fetch(
    retryInput,
    buildRequestInit(init, input, retryToken),
  );
  if (retryResponse.status === 401) invalidateAdminSession();
  return retryResponse;
}
