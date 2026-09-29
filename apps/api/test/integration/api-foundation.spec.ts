import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  INestApplication,
  Logger,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { AppModule } from '../../src/app.module.js';
import { AccessTokenGuard } from '../../src/auth/guards/access-token.guard.js';
import { BusCompaniesService } from '../../src/bus-companies/bus-companies.service.js';
import { RoutesService } from '../../src/routes/routes.service.js';
import { configureApi } from '../../src/common/configure-api.js';
import { PaginationQueryDto } from '../../src/common/dto/pagination-query.dto.js';
import { Public } from '../../src/auth/decorators/public.decorator.js';
import { RequireRoles } from '../../src/auth/decorators/require-roles.decorator.js';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

@Controller('__test')
class ApiFoundationTestController {
  @Get('pagination')
  @Public()
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
  @Public()
  getAlreadyWrapped() {
    return { data: { value: 'already wrapped' } };
  }

  @Get('no-content')
  @Public()
  @HttpCode(204)
  getNoContent() {
    return undefined;
  }

  @Get('unexpected')
  @Public()
  getUnexpectedError(): never {
    throw new Error('database password must not reach the client');
  }

  @Get('unstructured-http-error')
  @Public()
  getUnstructuredHttpError(): never {
    throw new BadRequestException(
      'database password must not reach the client',
    );
  }

  @Get('business-error')
  @Public()
  getBusinessError(): never {
    throw new NotFoundException({
      error: 'TEST_RESOURCE_NOT_FOUND',
      message: 'Không tìm thấy tài nguyên test.',
    });
  }

  @Get('protected')
  getProtected() {
    return { status: 'protected' };
  }

  @Get('super-admin')
  @RequireRoles('SUPER_ADMIN')
  getSuperAdmin() {
    return { status: 'super-admin' };
  }
}

describe('API foundation', () => {
  let app: INestApplication;
  let originalCorsOrigins: string | undefined;
  const jwtVerify = vi.fn();
  const sessionFindUnique = vi.fn();
  const routesService = {
    create: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
  };
  const busCompaniesService = {
    create: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
  };

  beforeAll(async () => {
    originalCorsOrigins = process.env.CORS_ALLOWED_ORIGINS;
    process.env.CORS_ALLOWED_ORIGINS =
      'http://localhost:3000,http://localhost:3001';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ApiFoundationTestController],
    })
      .overrideProvider(PrismaService)
      .useValue({ phienDangNhap: { findUnique: sessionFindUnique } })
      .overrideProvider(JwtService)
      .useValue({ verifyAsync: jwtVerify })
      .overrideProvider(RoutesService)
      .useValue(routesService)
      .overrideProvider(BusCompaniesService)
      .useValue(busCompaniesService)
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

  beforeEach(() => {
    vi.clearAllMocks();
    routesService.findAll.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
    });
    busCompaniesService.findAll.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
    });
    jwtVerify.mockResolvedValue({
      sub: 42,
      sid: 'integration-session',
      roles: ['STALE_ROLE'],
    });
    sessionFindUnique.mockResolvedValue(sessionWithRoles(['NHA_XE_ADMIN']));
  });

  function sessionWithRoles(roles: string[]) {
    return {
      sessionId: 'integration-session',
      taiKhoanId: 42,
      thuHoiLuc: null,
      hetHanLuc: new Date(Date.now() + 60_000),
      taiKhoan: {
        taiKhoanId: 42,
        trangThai: 'HOAT_DONG',
        nhanVien: { nhanVienId: 77, nhaXeId: 901 },
        taiKhoanVaiTros: [
          ...roles.map((tenVaiTro) => ({
            vaiTro: { tenVaiTro, vaiTroQuyens: [] },
          })),
        ],
      },
    };
  }

  it('requires a valid access token by default for non-public endpoints', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/__test/protected')
      .expect(401);

    expect(response.body.error).toBe('ACCESS_TOKEN_INVALID');
  });

  it('allows anonymous requests on the production public routes endpoint without querying auth state', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/routes')
      .expect(200);

    expect(response.body).toEqual({
      data: [],
      meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
    });
    expect(jwtVerify).not.toHaveBeenCalled();
    expect(sessionFindUnique).not.toHaveBeenCalled();
    expect(routesService.findAll).toHaveBeenCalledWith(
      expect.any(Object),
      undefined,
    );
  });

  it('authenticates an optional bearer token on the production public routes endpoint and keeps its tenant principal', async () => {
    let observedPrincipal: unknown;
    const guard = app.get(AccessTokenGuard);
    const originalCanActivate = guard.canActivate.bind(guard);
    const guardSpy = vi
      .spyOn(guard, 'canActivate')
      .mockImplementation(async (context) => {
        const allowed = await originalCanActivate(context);
        observedPrincipal = context
          .switchToHttp()
          .getRequest<{ user?: unknown }>().user;
        return allowed;
      });

    try {
      const response = await request(app.getHttpServer())
        .get('/api/v1/routes')
        .set('Authorization', 'Bearer signed-token')
        .expect(200);

      expect(response.body).toEqual({
        data: [],
        meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
      });
      expect(jwtVerify).toHaveBeenCalledWith('signed-token', {
        secret: expect.any(String),
        algorithms: ['HS256'],
      });
      expect(sessionFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sessionId: 'integration-session' },
        }),
      );
      expect(observedPrincipal).toMatchObject({
        taiKhoanId: 42,
        roles: ['NHA_XE_ADMIN'],
        nhanVienId: 77,
        nhaXeId: 901,
      });
      expect(routesService.findAll).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          roles: ['NHA_XE_ADMIN'],
          nhaXeId: 901,
        }),
      );
    } finally {
      guardSpy.mockRestore();
    }
  });

  it('passes the database-derived principal into the production public bus-company controller', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/bus-companies')
      .set('Authorization', 'Bearer signed-token')
      .query({ status: 'TAM_NGUNG' })
      .expect(200);

    expect(busCompaniesService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'TAM_NGUNG' }),
      expect.objectContaining({
        taiKhoanId: 42,
        roles: ['NHA_XE_ADMIN'],
        nhanVienId: 77,
        nhaXeId: 901,
      }),
    );
  });

  it('authorizes by database roles rather than stale JWT role claims', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/__test/super-admin')
      .set('Authorization', 'Bearer signed-token')
      .expect(403);

    sessionFindUnique.mockResolvedValueOnce(sessionWithRoles(['SUPER_ADMIN']));
    await request(app.getHttpServer())
      .get('/api/v1/__test/super-admin')
      .set('Authorization', 'Bearer signed-token')
      .expect(200);
  });

  it('passes the trusted tenant principal to route creation', async () => {
    routesService.create.mockResolvedValue({ data: { routeId: 17 } });
    const body = {
      code: 'FUTA-TX-0001',
      origin: 'TP.HCM',
      destination: 'Đà Lạt',
      busCompanyId: 901,
      status: 'HOAT_DONG',
    };

    await request(app.getHttpServer())
      .post('/api/v1/routes')
      .set('Authorization', 'Bearer signed-token')
      .send(body)
      .expect(201);

    expect(routesService.create).toHaveBeenCalledWith(
      body,
      expect.objectContaining({
        roles: ['NHA_XE_ADMIN'],
        nhaXeId: 901,
      }),
    );
  });

  it('blocks route writes for principals without the tenant-admin role', async () => {
    sessionFindUnique.mockResolvedValueOnce(sessionWithRoles(['CUSTOMER']));

    await request(app.getHttpServer())
      .post('/api/v1/routes')
      .set('Authorization', 'Bearer signed-token')
      .send({
        code: 'FUTA-TX-0001',
        origin: 'TP.HCM',
        destination: 'Đà Lạt',
        busCompanyId: 901,
        status: 'HOAT_DONG',
      })
      .expect(403);

    expect(routesService.create).not.toHaveBeenCalled();
  });

  it('does not grant Super Admin aggregate route writes', async () => {
    sessionFindUnique.mockResolvedValueOnce(sessionWithRoles(['SUPER_ADMIN']));

    await request(app.getHttpServer())
      .post('/api/v1/routes')
      .set('Authorization', 'Bearer signed-token')
      .send({
        code: 'FUTA-TX-0001',
        origin: 'TP.HCM',
        destination: 'Đà Lạt',
        busCompanyId: 901,
        status: 'HOAT_DONG',
      })
      .expect(403);

    expect(routesService.create).not.toHaveBeenCalled();
  });

  it('restricts bus-company mutations to Super Admin', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/bus-companies/901/status')
      .set('Authorization', 'Bearer signed-token')
      .send({ status: 'TAM_NGUNG' })
      .expect(403);
    expect(busCompaniesService.updateStatus).not.toHaveBeenCalled();

    sessionFindUnique.mockResolvedValueOnce(sessionWithRoles(['SUPER_ADMIN']));
    busCompaniesService.updateStatus.mockResolvedValue({
      data: { busCompanyId: 901 },
    });
    await request(app.getHttpServer())
      .patch('/api/v1/bus-companies/901/status')
      .set('Authorization', 'Bearer signed-token')
      .send({ status: 'TAM_NGUNG' })
      .expect(200);
    expect(busCompaniesService.updateStatus).toHaveBeenCalled();
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

  it('preserves custom business error codes and messages', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/__test/business-error')
      .expect(404);

    expect(response.body).toEqual({
      statusCode: 404,
      error: 'TEST_RESOURCE_NOT_FOUND',
      message: 'Không tìm thấy tài nguyên test.',
    });
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
