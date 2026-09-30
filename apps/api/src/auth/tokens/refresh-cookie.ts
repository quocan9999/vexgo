import { ForbiddenException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

export const ADMIN_REFRESH_COOKIE_NAME = 'vexgo_admin_refresh';
export const REFRESH_TOKEN_TRANSPORT_HEADER = 'x-refresh-token-transport';
export const REFRESH_TOKEN_TRANSPORT_COOKIE = 'cookie';
const REFRESH_COOKIE_PATH = '/api/v1/auth';
const DEFAULT_REFRESH_TOKEN_TTL_SECONDS = 2_592_000;
const DEFAULT_DEVELOPMENT_ADMIN_ORIGINS = ['http://localhost:3001'];

function getAllowedAdminCookieOrigins(config: ConfigService): string[] {
  const configuredOrigins = config.get<string>(
    'ADMIN_AUTH_COOKIE_ALLOWED_ORIGINS',
  );
  if (configuredOrigins !== undefined) {
    return configuredOrigins
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  return config.get<string>('NODE_ENV') === 'production'
    ? []
    : DEFAULT_DEVELOPMENT_ADMIN_ORIGINS;
}

export function usesRefreshCookie(request: Request): boolean {
  return (
    request.get(REFRESH_TOKEN_TRANSPORT_HEADER)?.toLowerCase() ===
    REFRESH_TOKEN_TRANSPORT_COOKIE
  );
}

export function assertTrustedCookieOrigin(
  request: Request,
  config: ConfigService,
): void {
  const origin = request.get('origin');
  const allowedOrigins = getAllowedAdminCookieOrigins(config);
  if (
    !origin ||
    allowedOrigins.includes('*') ||
    !allowedOrigins.includes(origin)
  ) {
    throw new ForbiddenException({
      error: 'AUTH_ORIGIN_FORBIDDEN',
      message: 'Nguồn gửi yêu cầu xác thực không được phép.',
    });
  }
}

export function readRefreshTokenCookie(request: Request): string | null {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return null;

  const matches = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${ADMIN_REFRESH_COOKIE_NAME}=`));
  if (matches.length !== 1) return null;

  const value = matches[0].slice(ADMIN_REFRESH_COOKIE_NAME.length + 1);
  if (!value || value.length > 128) return null;
  try {
    return decodeURIComponent(value) || null;
  } catch {
    return null;
  }
}

function getCookieLifetimeSeconds(config: ConfigService): number {
  const configured = Number(
    config.get<string>('REFRESH_TOKEN_TTL_SECONDS') ??
      DEFAULT_REFRESH_TOKEN_TTL_SECONDS,
  );
  return Number.isSafeInteger(configured) && configured > 0
    ? configured
    : DEFAULT_REFRESH_TOKEN_TTL_SECONDS;
}

function baseCookieOptions(config: ConfigService) {
  return {
    httpOnly: true,
    secure: config.get<string>('NODE_ENV') === 'production',
    sameSite: 'lax' as const,
    path: REFRESH_COOKIE_PATH,
  };
}

export function setRefreshTokenCookie(
  response: Response,
  config: ConfigService,
  token: string,
): void {
  response.cookie(ADMIN_REFRESH_COOKIE_NAME, token, {
    ...baseCookieOptions(config),
    maxAge: getCookieLifetimeSeconds(config) * 1000,
  });
}

export function clearRefreshTokenCookie(
  response: Response,
  config: ConfigService,
): void {
  response.clearCookie(ADMIN_REFRESH_COOKIE_NAME, baseCookieOptions(config));
}
