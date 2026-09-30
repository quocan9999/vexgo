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
import { VehicleTypesService } from '../../src/vehicle-types/vehicle-types.service.js';
import { configureApi } from '../../src/common/configure-api.js';
import { PaginationQueryDto } from '../../src/common/dto/pagination-query.dto.js';
import {
  OptionalAuth,
  Public,
} from '../../src/auth/decorators/public.decorator.js';
import { RequireRoles } from '../../src/auth/decorators/require-roles.decorator.js';
import { RequirePermissions } from '../../src/auth/decorators/require-permissions.decorator.js';
import { RequireTenantPermissionsIfAuthenticated } from '../../src/auth/decorators/require-tenant-permissions-if-authenticated.decorator.js';
import { AllowRoleScopeConflict } from '../../src/auth/decorators/allow-role-scope-conflict.decorator.js';
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

const optionalTenantPermissionHandler = vi.fn(() => ({
  status: 'optional-tenant-permission',
}));

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

  @Get('scope-session')
  @AllowRoleScopeConflict()
  getScopeSession() {
    return { status: 'scope-session' };
  }

  @Get('super-admin')
  @RequireRoles('SUPER_ADMIN')
  getSuperAdmin() {
    return { status: 'super-admin' };
  }

  @Get('permission-required')
  @RequirePermissions('route:read')
  getPermissionRequired() {
    return { status: 'permission-required' };
  }

  @Get('multiple-permissions-required')
  @RequirePermissions('route:read', 'fare-price:read')
  getMultiplePermissionsRequired() {
    return { status: 'multiple-permissions-required' };
  }

  @Get('role-and-permission-required')
  @RequireRoles('NHA_XE_ADMIN')
  @RequirePermissions('vehicle-type:read')
  getRoleAndPermissionRequired() {
    return { status: 'role-and-permission-required' };
  }

  @Get('public-permission-required')
  @Public()
  @RequirePermissions('route:read')
  getPublicPermissionRequired() {
    return { status: 'public-permission-required' };
  }

  @Get('tenant-permission-if-authenticated')
  @OptionalAuth()
  @RequireTenantPermissionsIfAuthenticated('route:read')
  getTenantPermissionIfAuthenticated() {
    return optionalTenantPermissionHandler();
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
  const vehicleTypesService = {
    create: vi.fn(),
    update: vi.fn(),
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
      .overrideProvider(VehicleTypesService)
      .useValue(vehicleTypesService)
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
    vehicleTypesService.findAll.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
    });
    vehicleTypesService.findOne.mockResolvedValue({
      data: { vehicleTypeId: 17 },
    });
    vehicleTypesService.create.mockResolvedValue({
      data: { vehicleTypeId: 17 },
    });
    vehicleTypesService.update.mockResolvedValue({
      data: { vehicleTypeId: 17 },
    });
    jwtVerify.mockResolvedValue({
      sub: 42,
      sid: 'integration-session',
      roles: ['STALE_ROLE'],
    });
    sessionFindUnique.mockResolvedValue(sessionWithRoles(['NHA_XE_ADMIN']));
  });

  function sessionWithRoles(
    roles: string[],
    withEmployee = roles.includes('NHA_XE_ADMIN'),
    permissionsByRole: Record<string, string[]> = {},
  ) {
    return {
      sessionId: 'integration-session',
      taiKhoanId: 42,
      thuHoiLuc: null,
      hetHanLuc: new Date(Date.now() + 60_000),
      taiKhoan: {
        taiKhoanId: 42,
        trangThai: 'HOAT_DONG',
        nhanVien: withEmployee ? { nhanVienId: 77, nhaXeId: 901 } : null,
        taiKhoanVaiTros: [
          ...roles.map((tenVaiTro) => ({
            vaiTro: {
              tenVaiTro,
              vaiTroQuyens: (permissionsByRole[tenVaiTro] ?? []).map(
                (tenQuyen) => ({ quyen: { tenQuyen } }),
              ),
            },
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
    sessionFindUnique.mockResolvedValueOnce(
      sessionWithRoles(['NHA_XE_ADMIN'], true, {
        NHA_XE_ADMIN: ['route:read'],
      }),
    );
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

  it('authenticates an employee on the production optional-auth routes endpoint', async () => {
    sessionFindUnique.mockResolvedValueOnce(
      sessionWithRoles(['NHAN_VIEN_CSKH'], true, {
        NHAN_VIEN_CSKH: ['route:read'],
      }),
    );

    await request(app.getHttpServer())
      .get('/api/v1/routes')
      .set('Authorization', 'Bearer signed-token')
      .expect(200);

    expect(routesService.findAll).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        roles: ['NHAN_VIEN_CSKH'],
        nhanVienId: 77,
        nhaXeId: 901,
      }),
    );
  });

  it('allows an employee to read vehicle types with vehicle-type:read', async () => {
    sessionFindUnique.mockResolvedValueOnce(
      sessionWithRoles(['NHAN_VIEN_CSKH'], true, {
        NHAN_VIEN_CSKH: ['vehicle-type:read'],
      }),
    );

    await request(app.getHttpServer())
      .get('/api/v1/vehicle-types')
      .set('Authorization', 'Bearer signed-token')
      .expect(200);

    expect(vehicleTypesService.findAll).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ roles: ['NHAN_VIEN_CSKH'], nhaXeId: 901 }),
    );
  });

  it('keeps NHA_XE_ADMIN access when the database has its default vehicle-type permissions', async () => {
    sessionFindUnique.mockResolvedValueOnce(
      sessionWithRoles(['NHA_XE_ADMIN'], true, {
        NHA_XE_ADMIN: [
          'vehicle-type:read',
          'vehicle-type:create',
          'vehicle-type:update',
        ],
      }),
    );

    await request(app.getHttpServer())
      .get('/api/v1/vehicle-types')
      .set('Authorization', 'Bearer signed-token')
      .expect(200);

    expect(vehicleTypesService.findAll).toHaveBeenCalled();
  });

  it('requires vehicle-type:read for vehicle-type detail before calling the service', async () => {
    sessionFindUnique.mockResolvedValueOnce(
      sessionWithRoles(['NHAN_VIEN_CSKH'], true),
    );

    const response = await request(app.getHttpServer())
      .get('/api/v1/vehicle-types/17')
      .set('Authorization', 'Bearer signed-token')
      .expect(403);

    expect(response.body.error).toBe('PERMISSION_FORBIDDEN');
    expect(vehicleTypesService.findOne).not.toHaveBeenCalled();
  });

  it('allows an employee to create a vehicle type with vehicle-type:create', async () => {
    sessionFindUnique.mockResolvedValueOnce(
      sessionWithRoles(['NHAN_VIEN_CSKH'], true, {
        NHAN_VIEN_CSKH: ['vehicle-type:create'],
      }),
    );

    await request(app.getHttpServer())
      .post('/api/v1/vehicle-types')
      .set('Authorization', 'Bearer signed-token')
      .send({ name: 'Ghế giường nằm', busCompanyId: 901 })
      .expect(201);

    expect(vehicleTypesService.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Ghế giường nằm', busCompanyId: 901 }),
      expect.objectContaining({ roles: ['NHAN_VIEN_CSKH'], nhaXeId: 901 }),
    );
  });

  it('denies vehicle-type creation when an employee only has the read permission', async () => {
    sessionFindUnique.mockResolvedValueOnce(
      sessionWithRoles(['NHAN_VIEN_CSKH'], true, {
        NHAN_VIEN_CSKH: ['vehicle-type:read'],
      }),
    );

    const response = await request(app.getHttpServer())
      .post('/api/v1/vehicle-types')
      .set('Authorization', 'Bearer signed-token')
      .send({ name: 'Ghế giường nằm', busCompanyId: 901 })
      .expect(403);

    expect(response.body.error).toBe('PERMISSION_FORBIDDEN');
    expect(vehicleTypesService.create).not.toHaveBeenCalled();
  });

  it('allows an employee to update a vehicle type with vehicle-type:update', async () => {
    sessionFindUnique.mockResolvedValueOnce(
      sessionWithRoles(['NHAN_VIEN_CSKH'], true, {
        NHAN_VIEN_CSKH: ['vehicle-type:update'],
      }),
    );

    await request(app.getHttpServer())
      .patch('/api/v1/vehicle-types/17')
      .set('Authorization', 'Bearer signed-token')
      .send({ name: 'Ghế limousine' })
      .expect(200);

    expect(vehicleTypesService.update).toHaveBeenCalledWith(
      17,
      expect.objectContaining({ name: 'Ghế limousine' }),
      expect.objectContaining({ roles: ['NHAN_VIEN_CSKH'], nhaXeId: 901 }),
    );
  });

  it('denies vehicle-type updates when an employee only has vehicle-type:create', async () => {
    sessionFindUnique.mockResolvedValueOnce(
      sessionWithRoles(['NHAN_VIEN_CSKH'], true, {
        NHAN_VIEN_CSKH: ['vehicle-type:create'],
      }),
    );

    const response = await request(app.getHttpServer())
      .patch('/api/v1/vehicle-types/17')
      .set('Authorization', 'Bearer signed-token')
      .send({ name: 'Ghế limousine' })
      .expect(403);

    expect(response.body.error).toBe('PERMISSION_FORBIDDEN');
    expect(vehicleTypesService.update).not.toHaveBeenCalled();
  });

  it('rejects Super Admin vehicle-type access even if the account has a tenant permission', async () => {
    sessionFindUnique.mockResolvedValueOnce(
      sessionWithRoles(['SUPER_ADMIN'], false, {
        SUPER_ADMIN: ['vehicle-type:read'],
      }),
    );

    await request(app.getHttpServer())
      .get('/api/v1/vehicle-types')
      .set('Authorization', 'Bearer signed-token')
      .expect(403);

    expect(vehicleTypesService.findAll).not.toHaveBeenCalled();
  });

  it('requires route:read for authenticated tenant principals on route list and detail reads', async () => {
    sessionFindUnique.mockResolvedValueOnce(
      sessionWithRoles(['NHAN_VIEN_CSKH'], true),
    );

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/routes')
      .set('Authorization', 'Bearer signed-token')
      .expect(403);

    expect(listResponse.body.error).toBe('PERMISSION_FORBIDDEN');
    expect(routesService.findAll).not.toHaveBeenCalled();

    sessionFindUnique.mockResolvedValueOnce(
      sessionWithRoles(['NHAN_VIEN_CSKH'], true),
    );

    const detailResponse = await request(app.getHttpServer())
      .get('/api/v1/routes/17')
      .set('Authorization', 'Bearer signed-token')
      .expect(403);

    expect(detailResponse.body.error).toBe('PERMISSION_FORBIDDEN');
    expect(routesService.findOne).not.toHaveBeenCalled();
  });

  it('preserves public route discovery for anonymous, customer, and Super Admin requests', async () => {
    await request(app.getHttpServer()).get('/api/v1/routes').expect(200);

    sessionFindUnique.mockResolvedValueOnce(
      sessionWithRoles(['KHACH_HANG'], false),
    );
    await request(app.getHttpServer())
      .get('/api/v1/routes')
      .set('Authorization', 'Bearer signed-token')
      .expect(200);

    sessionFindUnique.mockResolvedValueOnce(
      sessionWithRoles(['SUPER_ADMIN'], false),
    );
    await request(app.getHttpServer())
      .get('/api/v1/routes')
      .set('Authorization', 'Bearer signed-token')
      .expect(200);

    expect(routesService.findAll).toHaveBeenCalledTimes(3);
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

  it('rejects an authenticated principal without the required permission', async () => {
    sessionFindUnique.mockResolvedValueOnce(sessionWithRoles(['NHA_XE_ADMIN']));

    const response = await request(app.getHttpServer())
      .get('/api/v1/__test/permission-required')
      .set('Authorization', 'Bearer signed-token')
      .expect(403);

    expect(response.body.error).toBe('PERMISSION_FORBIDDEN');
  });

  it('allows an authenticated principal with the required database permission', async () => {
    sessionFindUnique.mockResolvedValueOnce(
      sessionWithRoles(['NHA_XE_ADMIN'], true, {
        NHA_XE_ADMIN: ['route:read'],
      }),
    );

    const response = await request(app.getHttpServer())
      .get('/api/v1/__test/permission-required')
      .set('Authorization', 'Bearer signed-token')
      .expect(200);

    expect(response.body.data).toEqual({ status: 'permission-required' });
  });

  it('requires every permission declared by a permission decorator', async () => {
    sessionFindUnique.mockResolvedValueOnce(
      sessionWithRoles(['NHA_XE_ADMIN'], true, {
        NHA_XE_ADMIN: ['route:read'],
      }),
    );
    const incomplete = await request(app.getHttpServer())
      .get('/api/v1/__test/multiple-permissions-required')
      .set('Authorization', 'Bearer signed-token')
      .expect(403);

    expect(incomplete.body.error).toBe('PERMISSION_FORBIDDEN');

    sessionFindUnique.mockResolvedValueOnce(
      sessionWithRoles(['NHA_XE_ADMIN'], true, {
        NHA_XE_ADMIN: ['route:read', 'fare-price:read'],
      }),
    );
    const complete = await request(app.getHttpServer())
      .get('/api/v1/__test/multiple-permissions-required')
      .set('Authorization', 'Bearer signed-token')
      .expect(200);

    expect(complete.body.data).toEqual({
      status: 'multiple-permissions-required',
    });
  });

  it('requires both the declared role and permission', async () => {
    sessionFindUnique.mockResolvedValueOnce(sessionWithRoles(['NHA_XE_ADMIN']));
    const missingPermission = await request(app.getHttpServer())
      .get('/api/v1/__test/role-and-permission-required')
      .set('Authorization', 'Bearer signed-token')
      .expect(403);

    expect(missingPermission.body.error).toBe('PERMISSION_FORBIDDEN');

    sessionFindUnique.mockResolvedValueOnce(
      sessionWithRoles(['NHAN_VIEN_CSKH'], true, {
        NHAN_VIEN_CSKH: ['vehicle-type:read'],
      }),
    );
    const missingRole = await request(app.getHttpServer())
      .get('/api/v1/__test/role-and-permission-required')
      .set('Authorization', 'Bearer signed-token')
      .expect(403);

    expect(missingRole.body.error).toBe('ROLE_FORBIDDEN');

    sessionFindUnique.mockResolvedValueOnce(
      sessionWithRoles(['NHA_XE_ADMIN'], true, {
        NHA_XE_ADMIN: ['vehicle-type:read'],
      }),
    );
    await request(app.getHttpServer())
      .get('/api/v1/__test/role-and-permission-required')
      .set('Authorization', 'Bearer signed-token')
      .expect(200);
  });

  it('validates principal scope before required permissions', async () => {
    sessionFindUnique.mockResolvedValueOnce(
      sessionWithRoles(['NHA_XE_ADMIN', 'KHACH_HANG'], true, {
        NHA_XE_ADMIN: ['route:read'],
      }),
    );

    const response = await request(app.getHttpServer())
      .get('/api/v1/__test/permission-required')
      .set('Authorization', 'Bearer signed-token')
      .expect(403);

    expect(response.body.error).toBe('ROLE_SCOPE_CONFLICT');
  });

  it('does not trust a permission claim supplied in the access token', async () => {
    jwtVerify.mockResolvedValueOnce({
      sub: 42,
      sid: 'integration-session',
      roles: ['NHA_XE_ADMIN'],
      permissions: ['route:read'],
    });
    sessionFindUnique.mockResolvedValueOnce(sessionWithRoles(['NHA_XE_ADMIN']));

    const response = await request(app.getHttpServer())
      .get('/api/v1/__test/permission-required')
      .set('Authorization', 'Bearer signed-token')
      .expect(403);

    expect(response.body.error).toBe('PERMISSION_FORBIDDEN');
  });

  it('uses database permission assignments even when JWT has a different permission claim', async () => {
    jwtVerify.mockResolvedValueOnce({
      sub: 42,
      sid: 'integration-session',
      roles: ['STALE_ROLE'],
      permissions: ['fare-price:read'],
    });
    sessionFindUnique.mockResolvedValueOnce(
      sessionWithRoles(['NHA_XE_ADMIN'], true, {
        NHA_XE_ADMIN: ['route:read'],
      }),
    );

    await request(app.getHttpServer())
      .get('/api/v1/__test/permission-required')
      .set('Authorization', 'Bearer signed-token')
      .expect(200);
  });

  it('requires authentication even when a test endpoint is marked public and permission-protected', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/__test/public-permission-required')
      .expect(401);

    expect(response.body.error).toBe('ACCESS_TOKEN_INVALID');
  });

  it('requires the tenant permission on optional-auth requests from a tenant principal', async () => {
    sessionFindUnique.mockResolvedValueOnce(
      sessionWithRoles(['NHAN_VIEN_CSKH'], true),
    );

    const response = await request(app.getHttpServer())
      .get('/api/v1/__test/tenant-permission-if-authenticated')
      .set('Authorization', 'Bearer signed-token')
      .expect(403);

    expect(response.body.error).toBe('PERMISSION_FORBIDDEN');
    expect(optionalTenantPermissionHandler).not.toHaveBeenCalled();
  });

  it('allows the tenant permission on optional-auth requests when assigned in the database', async () => {
    sessionFindUnique.mockResolvedValueOnce(
      sessionWithRoles(['NHAN_VIEN_CSKH'], true, {
        NHAN_VIEN_CSKH: ['route:read'],
      }),
    );

    const response = await request(app.getHttpServer())
      .get('/api/v1/__test/tenant-permission-if-authenticated')
      .set('Authorization', 'Bearer signed-token')
      .expect(200);

    expect(response.body.data).toEqual({
      status: 'optional-tenant-permission',
    });
    expect(optionalTenantPermissionHandler).toHaveBeenCalledOnce();
  });

  it('keeps optional public access for anonymous and non-tenant principals', async () => {
    const anonymous = await request(app.getHttpServer())
      .get('/api/v1/__test/tenant-permission-if-authenticated')
      .expect(200);

    expect(anonymous.body.data).toEqual({
      status: 'optional-tenant-permission',
    });
    expect(jwtVerify).not.toHaveBeenCalled();

    sessionFindUnique.mockResolvedValueOnce(
      sessionWithRoles(['KHACH_HANG'], false),
    );
    await request(app.getHttpServer())
      .get('/api/v1/__test/tenant-permission-if-authenticated')
      .set('Authorization', 'Bearer signed-token')
      .expect(200);

    sessionFindUnique.mockResolvedValueOnce(
      sessionWithRoles(['SUPER_ADMIN'], false),
    );
    await request(app.getHttpServer())
      .get('/api/v1/__test/tenant-permission-if-authenticated')
      .set('Authorization', 'Bearer signed-token')
      .expect(200);

    expect(optionalTenantPermissionHandler).toHaveBeenCalledTimes(3);
  });

  it('validates principal scope before the optional tenant permission', async () => {
    sessionFindUnique.mockResolvedValueOnce(
      sessionWithRoles(['NHAN_VIEN_CSKH', 'KHACH_HANG'], true),
    );

    const response = await request(app.getHttpServer())
      .get('/api/v1/__test/tenant-permission-if-authenticated')
      .set('Authorization', 'Bearer signed-token')
      .expect(403);

    expect(response.body.error).toBe('ROLE_SCOPE_CONFLICT');
    expect(optionalTenantPermissionHandler).not.toHaveBeenCalled();
  });

  it('rejects platform and tenant roles assigned to the same principal', async () => {
    sessionFindUnique.mockResolvedValueOnce(
      sessionWithRoles(['SUPER_ADMIN', 'NHA_XE_ADMIN']),
    );

    const response = await request(app.getHttpServer())
      .get('/api/v1/__test/super-admin')
      .set('Authorization', 'Bearer signed-token')
      .expect(403);

    expect(response.body.error).toBe('ROLE_SCOPE_CONFLICT');
  });

  it('fails closed for mixed tenant/customer roles on protected endpoints without role decorators', async () => {
    sessionFindUnique.mockResolvedValueOnce(
      sessionWithRoles(['NHA_XE_ADMIN', 'KHACH_HANG']),
    );

    const response = await request(app.getHttpServer())
      .get('/api/v1/__test/protected')
      .set('Authorization', 'Bearer signed-token')
      .expect(403);

    expect(response.body.error).toBe('ROLE_SCOPE_CONFLICT');
  });

  it('keeps customer-only sessions working on authenticated endpoints without role decorators', async () => {
    sessionFindUnique.mockResolvedValueOnce(
      sessionWithRoles(['KHACH_HANG'], false),
    );

    await request(app.getHttpServer())
      .get('/api/v1/__test/protected')
      .set('Authorization', 'Bearer signed-token')
      .expect(200);
  });

  it('lets the session-recovery endpoint expose a conflicted identity for logout', async () => {
    sessionFindUnique.mockResolvedValueOnce(
      sessionWithRoles(['NHA_XE_ADMIN', 'KHACH_HANG']),
    );

    await request(app.getHttpServer())
      .get('/api/v1/__test/scope-session')
      .set('Authorization', 'Bearer signed-token')
      .expect(200);
  });

  it('rejects a Super Admin role linked to an employee tenant identity', async () => {
    sessionFindUnique.mockResolvedValueOnce(
      sessionWithRoles(['SUPER_ADMIN'], true),
    );

    const response = await request(app.getHttpServer())
      .get('/api/v1/__test/super-admin')
      .set('Authorization', 'Bearer signed-token')
      .expect(403);

    expect(response.body.error).toBe('ROLE_SCOPE_CONFLICT');
  });

  it('rejects a tenant-admin role without an employee tenant assignment', async () => {
    sessionFindUnique.mockResolvedValueOnce(
      sessionWithRoles(['NHA_XE_ADMIN'], false),
    );

    const response = await request(app.getHttpServer())
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

    expect(response.body.error).toBe('TENANT_SCOPE_REQUIRED');
    expect(routesService.create).not.toHaveBeenCalled();
  });

  it('rejects an employee role without an employee tenant assignment', async () => {
    sessionFindUnique.mockResolvedValueOnce(
      sessionWithRoles(['NHAN_VIEN_KINH_DOANH'], false),
    );

    const response = await request(app.getHttpServer())
      .get('/api/v1/__test/protected')
      .set('Authorization', 'Bearer signed-token')
      .expect(403);

    expect(response.body.error).toBe('TENANT_SCOPE_REQUIRED');
  });

  it('allows an employee role with a valid employee tenant assignment', async () => {
    sessionFindUnique.mockResolvedValueOnce(
      sessionWithRoles(['NHAN_VIEN_KINH_DOANH'], true),
    );

    await request(app.getHttpServer())
      .get('/api/v1/__test/protected')
      .set('Authorization', 'Bearer signed-token')
      .expect(200);
  });

  it.each([
    {
      label: 'a customer role',
      roles: ['NHAN_VIEN_CSKH', 'KHACH_HANG'],
    },
    {
      label: 'a platform role',
      roles: ['NHAN_VIEN_PHU_XE', 'SUPER_ADMIN'],
    },
  ])('rejects an employee role combined with $label', async ({ roles }) => {
    sessionFindUnique.mockResolvedValueOnce(sessionWithRoles(roles, false));

    const response = await request(app.getHttpServer())
      .get('/api/v1/__test/protected')
      .set('Authorization', 'Bearer signed-token')
      .expect(403);

    expect(response.body.error).toBe('ROLE_SCOPE_CONFLICT');
  });

  it('passes the trusted tenant principal to route creation', async () => {
    sessionFindUnique.mockResolvedValueOnce(
      sessionWithRoles(['NHA_XE_ADMIN', 'NHAN_VIEN_BAN_VE'], true, {
        NHA_XE_ADMIN: ['route:create'],
      }),
    );
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
      expect.objectContaining(body),
      expect.objectContaining({
        roles: ['NHA_XE_ADMIN', 'NHAN_VIEN_BAN_VE'],
        nhaXeId: 901,
      }),
    );
  });

  it('blocks route writes for principals without the tenant-admin role', async () => {
    sessionFindUnique.mockResolvedValueOnce(sessionWithRoles(['KHACH_HANG']));

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

  it('allows an employee with route:create permission to create a tenant route', async () => {
    sessionFindUnique.mockResolvedValueOnce(
      sessionWithRoles(['NHAN_VIEN_CSKH'], true, {
        NHAN_VIEN_CSKH: ['route:create'],
      }),
    );
    routesService.create.mockResolvedValue({ data: { routeId: 17 } });

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
      .expect(201);

    expect(routesService.create).toHaveBeenCalledWith(
      expect.objectContaining({ busCompanyId: 901 }),
      expect.objectContaining({ roles: ['NHAN_VIEN_CSKH'], nhaXeId: 901 }),
    );
  });

  it('denies employee route creation without route:create permission', async () => {
    sessionFindUnique.mockResolvedValueOnce(
      sessionWithRoles(['NHAN_VIEN_CSKH'], true, {
        NHAN_VIEN_CSKH: ['route:update'],
      }),
    );

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

  it('requires route:update for route detail and status mutations', async () => {
    sessionFindUnique.mockResolvedValueOnce(
      sessionWithRoles(['NHAN_VIEN_CSKH'], true, {
        NHAN_VIEN_CSKH: ['route:update'],
      }),
    );
    routesService.update.mockResolvedValue({ data: { routeId: 17 } });

    await request(app.getHttpServer())
      .patch('/api/v1/routes/17')
      .set('Authorization', 'Bearer signed-token')
      .send({ origin: 'TP.HCM', destination: 'Đà Lạt' })
      .expect(200);

    expect(routesService.update).toHaveBeenCalledWith(
      17,
      expect.objectContaining({ origin: 'TP.HCM', destination: 'Đà Lạt' }),
      expect.objectContaining({ nhaXeId: 901 }),
    );

    sessionFindUnique.mockResolvedValueOnce(
      sessionWithRoles(['NHAN_VIEN_CSKH'], true, {
        NHAN_VIEN_CSKH: ['route:create'],
      }),
    );

    await request(app.getHttpServer())
      .patch('/api/v1/routes/17/status')
      .set('Authorization', 'Bearer signed-token')
      .send({ status: 'TAM_NGUNG' })
      .expect(403);

    expect(routesService.updateStatus).not.toHaveBeenCalled();

    sessionFindUnique.mockResolvedValueOnce(
      sessionWithRoles(['NHAN_VIEN_CSKH'], true, {
        NHAN_VIEN_CSKH: ['route:update'],
      }),
    );
    routesService.updateStatus.mockResolvedValue({ data: { routeId: 17 } });

    await request(app.getHttpServer())
      .patch('/api/v1/routes/17/status')
      .set('Authorization', 'Bearer signed-token')
      .send({ status: 'TAM_NGUNG' })
      .expect(200);

    expect(routesService.updateStatus).toHaveBeenCalledWith(
      17,
      'TAM_NGUNG',
      expect.objectContaining({ nhaXeId: 901 }),
    );
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

  it('requires Super Admin role and bus-company:update for bus-company status changes', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/bus-companies/901/status')
      .set('Authorization', 'Bearer signed-token')
      .send({ status: 'TAM_NGUNG' })
      .expect(403);
    expect(busCompaniesService.updateStatus).not.toHaveBeenCalled();

    sessionFindUnique.mockResolvedValueOnce(
      sessionWithRoles(['SUPER_ADMIN'], false, {
        SUPER_ADMIN: ['bus-company:update'],
      }),
    );
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
