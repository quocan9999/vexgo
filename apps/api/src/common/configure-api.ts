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

function getAllowedOrigins(config: ConfigService): string[] {
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

export function configureApi(app: INestApplication): void {
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: getAllowedOrigins(config) });
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
