import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  INestApplication,
  Logger,
  Query,
} from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service.js';
import { AppModule } from './app.module.js';
import { configureApi } from './common/configure-api.js';
import { PaginationQueryDto } from './common/dto/pagination-query.dto.js';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

@Controller('__test')
class ApiFoundationTestController {
  @Get('pagination')
  getPagination(@Query() query: PaginationQueryDto) {
    return {
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      sortBy: query.sortBy,
      sortDirection: query.sortDirection,
    };
  }

  @Get('already-wrapped')
  getAlreadyWrapped() {
    return { data: { value: 'already wrapped' } };
  }

  @Get('no-content')
  @HttpCode(204)
  getNoContent() {
    return undefined;
  }

  @Get('unexpected')
  getUnexpectedError(): never {
    throw new Error('database password must not reach the client');
  }

  @Get('unstructured-http-error')
  getUnstructuredHttpError(): never {
    throw new BadRequestException(
      'database password must not reach the client',
    );
  }
}

describe('API foundation', () => {
  let app: INestApplication;
  let originalCorsOrigins: string | undefined;

  beforeAll(async () => {
    originalCorsOrigins = process.env.CORS_ALLOWED_ORIGINS;
    process.env.CORS_ALLOWED_ORIGINS =
      'http://localhost:3000,http://localhost:3001';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ApiFoundationTestController],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    app = moduleRef.createNestApplication();
    configureApi(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    if (originalCorsOrigins === undefined) {
      delete process.env.CORS_ALLOWED_ORIGINS;
    } else {
      process.env.CORS_ALLOWED_ORIGINS = originalCorsOrigins;
    }
  });

  it('serves the database-independent health endpoint under the API prefix', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);

    expect(response.body).toEqual({ data: { status: 'ok' } });
    await request(app.getHttpServer()).get('/health').expect(404);
  });

  it('transforms valid pagination query strings into numbers', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/__test/pagination')
      .query({
        page: '2',
        pageSize: '25',
        search: 'phuong',
        sortBy: 'name',
        sortDirection: 'asc',
      })
      .expect(200);

    expect(response.body).toEqual({
      data: {
        page: 2,
        pageSize: 25,
        search: 'phuong',
        sortBy: 'name',
        sortDirection: 'asc',
      },
    });
  });

  it('rejects invalid pagination values and unknown query fields', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/__test/pagination')
      .query({ page: '0', pageSize: '101', sortDirection: 'up', extra: '1' })
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      error: 'VALIDATION_ERROR',
      message: 'Dữ liệu không hợp lệ.',
    });
    expect(response.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'page' }),
        expect.objectContaining({ field: 'pageSize' }),
        expect.objectContaining({ field: 'sortDirection' }),
        expect.objectContaining({ field: 'extra' }),
      ]),
    );
  });

  it('does not double-wrap a success envelope', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/__test/already-wrapped')
      .expect(200);

    expect(response.body).toEqual({ data: { value: 'already wrapped' } });
  });

  it('leaves no-content responses empty', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/__test/no-content')
      .expect(204);

    expect(response.text).toBe('');
  });

  it('returns stable HTTP errors without exposing unexpected exceptions', async () => {
    const missing = await request(app.getHttpServer())
      .get('/api/v1/__test/missing')
      .expect(404);

    expect(missing.body).toMatchObject({
      statusCode: 404,
      error: 'NOT_FOUND',
      message: 'Không tìm thấy tài nguyên.',
    });

    const loggerSpy = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const unexpected = await request(app.getHttpServer())
      .get('/api/v1/__test/unexpected')
      .expect(500);
    loggerSpy.mockRestore();

    expect(unexpected.body).toEqual({
      statusCode: 500,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Đã xảy ra lỗi hệ thống.',
    });
    expect(JSON.stringify(unexpected.body)).not.toContain('database password');
  });

  it('does not expose unstructured HttpException messages', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/__test/unstructured-http-error')
      .expect(400);

    expect(response.body).toEqual({
      statusCode: 400,
      error: 'BAD_REQUEST',
      message: 'Yêu cầu không hợp lệ.',
    });
    expect(JSON.stringify(response.body)).not.toContain('database password');
  });

  it.each(['http://localhost:3000', 'http://localhost:3001'])(
    'allows the configured local frontend origin %s',
    async (origin) => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .set('Origin', origin)
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe(origin);
    },
  );

  it('does not allow an unconfigured CORS origin', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('Origin', 'https://untrusted.example')
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
