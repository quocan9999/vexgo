'use client';

import { getApiBaseUrl } from '@/lib/api-url';
import { withAdminAuthTransportLock } from './auth-transport-lock';

export type AdminEmployeeSession = {
  employeeId: number;
  busCompanyId: number;
  busCompanyCode: string;
  busCompanyName: string;
};

export type AdminSession = {
  accountId: number;
  fullName: string;
  phoneNumber: string;
  email: string | null;
  roles: string[];
  permissions: string[];
  employee: AdminEmployeeSession | null;
  busCompanyId: number | null;
};

export type AdminAuthState =
  | { status: 'checking' }
  | { status: 'anonymous' }
  | { status: 'error'; message: string }
  | { status: 'authenticated'; session: AdminSession };

export type ValidationDetail = { field: string; message: string };

export class AdminAuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly details: ValidationDetail[] = [],
  ) {
    super(message);
    this.name = 'AdminAuthError';
  }
}

const REFRESH_TRANSPORT_HEADER = 'X-Refresh-Token-Transport';
const REFRESH_TRANSPORT_VALUE = 'cookie';
const SESSION_CHANNEL_NAME = 'vexgo-admin-auth';
const CHECKING_STATE: AdminAuthState = Object.freeze({ status: 'checking' });

let currentState: AdminAuthState = CHECKING_STATE;
let currentAccessToken: string | null = null;
let initialization: Promise<AdminSession | null> | null = null;
let sessionReloadInFlight: Promise<AdminSession> | null = null;
let refreshInFlight: Promise<string | null> | null = null;
const listeners = new Set<() => void>();
let broadcastChannel: BroadcastChannel | null = null;

function apiUrl(path: string): string {
  return `${getApiBaseUrl()}/api/v1${path}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isEmployeeSession(value: unknown): value is AdminEmployeeSession {
  return (
    isRecord(value) &&
    isPositiveInteger(value.employeeId) &&
    isPositiveInteger(value.busCompanyId) &&
    typeof value.busCompanyCode === 'string' &&
    typeof value.busCompanyName === 'string'
  );
}

function parseSession(value: unknown): AdminSession | null {
  if (
    !isRecord(value) ||
    !isPositiveInteger(value.accountId) ||
    typeof value.fullName !== 'string' ||
    typeof value.phoneNumber !== 'string' ||
    !(value.email === null || typeof value.email === 'string') ||
    !Array.isArray(value.roles) ||
    !value.roles.every((role) => typeof role === 'string') ||
    !Array.isArray(value.permissions) ||
    !value.permissions.every((permission) => typeof permission === 'string') ||
    !(value.employee === null || isEmployeeSession(value.employee)) ||
    !(value.busCompanyId === null || isPositiveInteger(value.busCompanyId))
  ) {
    return null;
  }
  if (
    (value.employee === null && value.busCompanyId !== null) ||
    (value.employee !== null &&
      value.employee.busCompanyId !== value.busCompanyId)
  ) {
    return null;
  }

  return {
    accountId: value.accountId,
    fullName: value.fullName,
    phoneNumber: value.phoneNumber,
    email: value.email,
    roles: value.roles,
    permissions: value.permissions,
    employee: value.employee,
    busCompanyId: value.busCompanyId,
  };
}

function getErrorDetails(value: unknown): ValidationDetail[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): ValidationDetail[] =>
    isRecord(item) &&
    typeof item.field === 'string' &&
    typeof item.message === 'string'
      ? [{ field: item.field, message: item.message }]
      : [],
  );
}

async function makeAuthError(response: Response): Promise<AdminAuthError> {
  const body: unknown = await response.json().catch(() => null);
  const message =
    isRecord(body) && typeof body.message === 'string'
      ? body.message
      : `Yêu cầu xác thực thất bại (HTTP ${response.status}).`;
  return new AdminAuthError(
    message,
    response.status,
    isRecord(body) && typeof body.error === 'string' ? body.error : undefined,
    isRecord(body) ? getErrorDetails(body.details) : [],
  );
}

function emitChange() {
  listeners.forEach((listener) => listener());
}

function setState(nextState: AdminAuthState) {
  currentState = nextState;
  emitChange();
}

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) {
    return null;
  }
  if (broadcastChannel) return broadcastChannel;

  broadcastChannel = new BroadcastChannel(SESSION_CHANNEL_NAME);
  broadcastChannel.addEventListener(
    'message',
    (event: MessageEvent<unknown>) => {
      if (!isRecord(event.data)) return;
      if (event.data.type === 'sync-request') {
        if (currentAccessToken) broadcastToken(currentAccessToken);
        else broadcastChannel?.postMessage({ type: 'sync-empty' });
        return;
      }
      if (event.data.type === 'cleared') {
        currentAccessToken = null;
        setState({ status: 'anonymous' });
        return;
      }
      if (
        event.data.type === 'token' &&
        typeof event.data.accessToken === 'string' &&
        event.data.accessToken.length > 0
      ) {
        currentAccessToken = event.data.accessToken;
        if (event.data.session) {
          const session = parseSession(event.data.session);
          if (session) setState({ status: 'authenticated', session });
        }
      }
    },
  );
  return broadcastChannel;
}

function synchronizeAccessTokenAcrossTabs(): Promise<
  'token' | 'empty' | 'cleared' | 'timeout'
> {
  const channel = getBroadcastChannel();
  if (!channel || typeof window === 'undefined')
    return Promise.resolve('timeout');

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: 'token' | 'empty' | 'cleared' | 'timeout') => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      channel.removeEventListener('message', onMessage);
      resolve(result);
    };
    const onMessage = (event: MessageEvent<unknown>) => {
      if (!isRecord(event.data)) return;
      if (event.data.type === 'token') finish('token');
      else if (event.data.type === 'sync-empty') finish('empty');
      else if (event.data.type === 'cleared') finish('cleared');
    };
    const timeoutId = window.setTimeout(() => finish('timeout'), 50);

    channel.addEventListener('message', onMessage);
    channel.postMessage({ type: 'sync-request' });
  });
}

function broadcastToken(accessToken: string) {
  const channel = getBroadcastChannel();
  if (!channel) return;
  channel.postMessage({
    type: 'token',
    accessToken,
    session:
      currentState.status === 'authenticated'
        ? currentState.session
        : undefined,
  });
}

function clearLocalSession(shouldBroadcast = false) {
  currentAccessToken = null;
  setState({ status: 'anonymous' });
  if (shouldBroadcast) getBroadcastChannel()?.postMessage({ type: 'cleared' });
}

function readAccessToken(value: unknown): string | null {
  return isRecord(value) &&
    isRecord(value.data) &&
    typeof value.data.accessToken === 'string' &&
    value.data.accessToken.length > 0
    ? value.data.accessToken
    : null;
}

async function refreshAccessTokenOnce(): Promise<string | null> {
  const response = await fetch(apiUrl('/auth/refresh'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      [REFRESH_TRANSPORT_HEADER]: REFRESH_TRANSPORT_VALUE,
    },
    body: JSON.stringify({}),
    cache: 'no-store',
  });

  if (response.status === 401 || response.status === 403) {
    clearLocalSession(true);
    return null;
  }
  if (!response.ok) throw await makeAuthError(response);

  const body: unknown = await response.json().catch(() => null);
  const accessToken = readAccessToken(body);
  if (!accessToken) {
    throw new AdminAuthError('API trả về phiên đăng nhập không hợp lệ.', 502);
  }
  currentAccessToken = accessToken;
  try {
    const session = await fetchCurrentSession(accessToken);
    setState({ status: 'authenticated', session });
  } catch (error) {
    if (
      error instanceof AdminAuthError &&
      (error.status === 401 || error.status === 403)
    ) {
      clearLocalSession(true);
    }
    throw error;
  }
  broadcastToken(accessToken);
  return accessToken;
}

export function refreshAdminAccessToken(
  rejectedAccessToken?: string,
): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = withAdminAuthTransportLock(async () => {
    const synchronized = await synchronizeAccessTokenAcrossTabs();
    if (
      synchronized === 'token' &&
      currentAccessToken &&
      currentAccessToken !== rejectedAccessToken
    ) {
      return currentAccessToken;
    }
    return refreshAccessTokenOnce();
  }).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function fetchCurrentSession(accessToken: string): Promise<AdminSession> {
  const response = await fetch(apiUrl('/auth/session'), {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: 'include',
    cache: 'no-store',
  });
  if (!response.ok) throw await makeAuthError(response);

  const body: unknown = await response.json().catch(() => null);
  const session = isRecord(body) ? parseSession(body.data) : null;
  if (!session) {
    throw new AdminAuthError(
      'API trả về thông tin tài khoản không hợp lệ.',
      502,
    );
  }
  return session;
}

async function fetchCurrentSessionWithRefresh(
  accessToken: string,
): Promise<{ accessToken: string; session: AdminSession }> {
  try {
    return { accessToken, session: await fetchCurrentSession(accessToken) };
  } catch (error) {
    if (!(error instanceof AdminAuthError) || error.status !== 401) throw error;

    const refreshedAccessToken = await refreshAdminAccessToken(accessToken);
    if (!refreshedAccessToken) throw error;
    if (
      currentAccessToken === refreshedAccessToken &&
      currentState.status === 'authenticated'
    ) {
      return {
        accessToken: refreshedAccessToken,
        session: currentState.session,
      };
    }
    return {
      accessToken: refreshedAccessToken,
      session: await fetchCurrentSession(refreshedAccessToken),
    };
  }
}

export function getAdminAuthSnapshot(): AdminAuthState {
  return currentState;
}

export function getAdminAuthServerSnapshot(): AdminAuthState {
  return CHECKING_STATE;
}

export function subscribeToAdminAuth(listener: () => void) {
  listeners.add(listener);
  getBroadcastChannel();
  return () => {
    listeners.delete(listener);
  };
}

export function getAdminAccessToken(): string | null {
  return currentAccessToken;
}

export async function initializeAdminSession(): Promise<AdminSession | null> {
  if (currentState.status === 'authenticated') return currentState.session;
  if (initialization) return initialization;

  initialization = (async () => {
    setState(CHECKING_STATE);
    try {
      const accessToken =
        currentAccessToken ?? (await refreshAdminAccessToken());
      if (!accessToken) {
        clearLocalSession();
        return null;
      }
      const refreshedState = getAdminAuthSnapshot();
      if (
        currentAccessToken === accessToken &&
        refreshedState.status === 'authenticated'
      ) {
        return refreshedState.session;
      }

      const resolved = await fetchCurrentSessionWithRefresh(accessToken);
      currentAccessToken = resolved.accessToken;
      const session = resolved.session;
      setState({ status: 'authenticated', session });
      broadcastToken(resolved.accessToken);
      return session;
    } catch (error) {
      setState({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Không thể kiểm tra phiên đăng nhập.',
      });
      throw error;
    }
  })().finally(() => {
    initialization = null;
  });
  return initialization;
}

export function reloadAdminSession(): Promise<AdminSession> {
  if (sessionReloadInFlight) return sessionReloadInFlight;

  sessionReloadInFlight = (async () => {
    const accessTokenAtStart = currentAccessToken;
    const accessToken =
      accessTokenAtStart ?? (await refreshAdminAccessToken());
    if (!accessToken) {
      throw new AdminAuthError('Phiên đăng nhập không còn hợp lệ.', 401);
    }

    if (!accessTokenAtStart) {
      const refreshedState = getAdminAuthSnapshot();
      if (
        currentAccessToken === accessToken &&
        refreshedState.status === 'authenticated'
      ) {
        return refreshedState.session;
      }
    }

    const resolved = await fetchCurrentSessionWithRefresh(accessToken);
    if (
      accessTokenAtStart &&
      currentAccessToken !== accessTokenAtStart &&
      currentAccessToken !== resolved.accessToken
    ) {
      const latestState = getAdminAuthSnapshot();
      if (latestState.status === 'authenticated') return latestState.session;
      throw new AdminAuthError(
        'Phiên đăng nhập đã thay đổi trong khi làm mới thông tin.',
        401,
      );
    }

    currentAccessToken = resolved.accessToken;
    setState({ status: 'authenticated', session: resolved.session });
    broadcastToken(resolved.accessToken);
    return resolved.session;
  })().finally(() => {
    sessionReloadInFlight = null;
  });

  return sessionReloadInFlight;
}

export async function signInAdmin(
  identifier: string,
  password: string,
): Promise<AdminSession> {
  return withAdminAuthTransportLock(async () => {
    const response = await fetch(apiUrl('/auth/login'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        [REFRESH_TRANSPORT_HEADER]: REFRESH_TRANSPORT_VALUE,
      },
      body: JSON.stringify({ identifier, password }),
      cache: 'no-store',
    });
    if (!response.ok) throw await makeAuthError(response);

    const body: unknown = await response.json().catch(() => null);
    const accessToken = readAccessToken(body);
    if (!accessToken) {
      throw new AdminAuthError('API trả về token đăng nhập không hợp lệ.', 502);
    }

    currentAccessToken = accessToken;
    try {
      const resolved = await fetchCurrentSessionWithRefresh(accessToken);
      currentAccessToken = resolved.accessToken;
      const session = resolved.session;
      setState({ status: 'authenticated', session });
      broadcastToken(resolved.accessToken);
      return session;
    } catch (error) {
      setState({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Không thể đọc thông tin tài khoản.',
      });
      throw error;
    }
  });
}

export async function signOutAdmin(): Promise<void> {
  await withAdminAuthTransportLock(async () => {
    const response = await fetch(apiUrl('/auth/logout'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        [REFRESH_TRANSPORT_HEADER]: REFRESH_TRANSPORT_VALUE,
      },
      body: JSON.stringify({}),
      cache: 'no-store',
    });
    if (response.status !== 204 && !response.ok) {
      throw await makeAuthError(response);
    }
    clearLocalSession(true);
  });
}

export function clearAdminAccessToken() {
  currentAccessToken = null;
}

export function invalidateAdminSession() {
  clearLocalSession(true);
}

export function getAdminAuthErrorMessage(error: unknown): string {
  if (error instanceof AdminAuthError) {
    if (error.code === 'INVALID_CREDENTIALS') {
      return 'Email/số điện thoại hoặc mật khẩu không chính xác.';
    }
    return error.message;
  }
  return error instanceof Error ? error.message : 'Đã xảy ra lỗi xác thực.';
}
