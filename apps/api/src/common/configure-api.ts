import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ValidationError } from 'class-validator';
import { ApiExceptionFilter } from './filters/api-exception.filter.js';
import { ApiResponseInterceptor } from './interceptors/api-response.interceptor.js';

const DEFAULT_DEVELOPMENT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
];

function flattenValidationErrors(
  errors: ValidationError[],
  parent = '',
): Array<{ field: string; message: string }> {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const ownErrors = Object.values(error.constraints ?? {}).map((message) => ({
      field,
      message,
    }));

    return [
      ...ownErrors,
      ...flattenValidationErrors(error.children ?? [], field),
    ];
  });
}

export function getAllowedOrigins(config: ConfigService): string[] {
  const configuredOrigins = config.get<string>('CORS_ALLOWED_ORIGINS');

  if (configuredOrigins !== undefined) {
    return configuredOrigins
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  return config.get<string>('NODE_ENV') === 'production'
    ? []
    : DEFAULT_DEVELOPMENT_ORIGINS;
}

/**
 * Sanitizes URLs for global HTTP logging to prevent leaking sensitive credentials,
 * such as signed bearer seat-hold tokens or sensitive query tokens (discussion_r4226252855).
 */
export function sanitizeRequestUrl(url: string): string {
  if (!url) return '';
  let sanitized = url;

  // Redact seat-holds bearer token in URL path: /api/v1/seat-holds/<signedHoldToken>
  sanitized = sanitized.replace(
    /(\/seat-holds\/)([^/?#]+)/gi,
    '$1[REDACTED_HOLD_TOKEN]',
  );

  // Redact potential sensitive tokens in query params
  sanitized = sanitized.replace(
    /([?&](?:holdToken|token|access_token|secret)=)[^&]+/gi,
    '$1[REDACTED]',
  );

  return sanitized;
}

export function configureApi(app: INestApplication): void {
  const config = app.get(ConfigService);
  const allowedOrigins = getAllowedOrigins(config);
  if (allowedOrigins.includes('*')) {
    throw new Error(
      'CORS_ALLOWED_ORIGINS must list exact origins when credentialed auth is enabled.',
    );
  }

  // Incoming HTTP Request Logger for debugging mobile/web calls
  app.use((req: any, res: any, next: () => void) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      const sanitizedUrl = sanitizeRequestUrl(req.originalUrl || req.url || '');
      console.log(
        `\x1b[36m[API REQUEST]\x1b[0m ${req.method} ${sanitizedUrl} -> \x1b[32m${res.statusCode}\x1b[0m (${duration}ms)`,
      );
    });
    next();
  });

  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: allowedOrigins, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors) =>
        new BadRequestException({
          error: 'VALIDATION_ERROR',
          message: 'Dữ liệu không hợp lệ.',
          details: flattenValidationErrors(errors),
        }),
    }),
  );
  app.useGlobalInterceptors(new ApiResponseInterceptor());
  app.useGlobalFilters(new ApiExceptionFilter());
}
