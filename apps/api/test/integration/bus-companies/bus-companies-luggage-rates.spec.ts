import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  UnauthorizedException,
  type ExecutionContext,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../../src/app.module.js';
import { AccessTokenGuard } from '../../../src/auth/guards/access-token.guard.js';
import { Reflector } from '@nestjs/core';
import {
  AUTH_MODE_KEY,
  type EndpointAuthMode,
} from '../../../src/auth/decorators/public.decorator.js';
import { ADMIN_ROLE_DEFAULT_PERMISSION_KEYS } from '../../../src/auth/permissions/permission-catalog.js';
import { EffectiveRolePermissionLoaderService } from '../../../src/auth/permissions/effective-role-permission-loader.service.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';
import { configureApi } from '../../../src/common/configure-api.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';

const LUGGAGE_RATE_MIGRATION_SQL = readFileSync(
  new URL(
    '../../../../../prisma/migrations/20261110010000_add_luggage_rate_permissions/migration.sql',
    import.meta.url,
  ),
  'utf8',
);

async function applyLuggageRateMigrationSql(prisma: PrismaService): Promise<void> {
  const statements = LUGGAGE_RATE_MIGRATION_SQL.split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }
}

const VALID_PAYLOAD = {
  default: {
    packageS: 45_000,
    packageSMaxKg: 5,
    packageM: 75_000,
    packageMMaxKg: 10,
    packageL: 115_000,
    packageLMaxKg: 20,
    packageXL: 175_000,
    packageXLMaxKg: 35,
    motorcycleWave: 185_000,
    motorcycleScooter: 225_000,
    motorcycleBig: 255_000,
    bicycle: 85_000,
    fragileSurcharge: 25_000,
    valuableSurcharge: 55_000,
    maxFreeWeightKg: 8,
  },
  routes: {},
};

const TENANT_B_INITIAL_CONFIG = JSON.stringify({
  default: {
    packageS: 60_000,
    packageSMaxKg: 6,
    packageM: 90_000,
    packageMMaxKg: 12,
    packageL: 130_000,
    packageLMaxKg: 22,
    packageXL: 190_000,
    packageXLMaxKg: 38,
    motorcycleWave: 190_000,
    motorcycleScooter: 230_000,
    motorcycleBig: 260_000,
    bicycle: 90_000,
    fragileSurcharge: 30_000,
    valuableSurcharge: 60_000,
    maxFreeWeightKg: 9,
  },
  routes: {},
});

describe('Bus companies luggage rates RBAC & tenant scope enforcement', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let reflector: Reflector;
  let currentPrincipal: AuthPrincipal | null = null;

  let companyAId: number;
  let companyBId: number;
  let routeAId: number;
  let tripAId: number;
  let vehicleTypeAId: number;
  let vehicleAId: number;

  const suffix = randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase();
  const companyACode = `LUG-A-${suffix}`;
  const companyBCode = `LUG-B-${suffix}`;

  beforeAll(async () => {
    reflector = new Reflector();
    const accessTokenGuard = {
      canActivate(context: ExecutionContext) {
        const authMode = reflector.getAllAndOverride<EndpointAuthMode>(
          AUTH_MODE_KEY,
          [context.getHandler(), context.getClass()],
        );
        const req = context.switchToHttp().getRequest<{
          headers: { authorization?: string };
          user?: AuthPrincipal;
        }>();

        if (!currentPrincipal && req.headers.authorization !== 'Bearer valid') {
          if (authMode === 'public' || authMode === 'optional') {
            return true;
          }
          throw new UnauthorizedException({
            error: 'ACCESS_TOKEN_INVALID',
            message: 'Cần đăng nhập để thực hiện thao tác này.',
          });
        }

        if (currentPrincipal) {
          req.user = currentPrincipal;
        }
        return true;
      },
    };

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AccessTokenGuard)
      .useValue(accessTokenGuard)
      .compile();

    app = moduleRef.createNestApplication();
    configureApi(app);
    await app.init();

    prisma = app.get(PrismaService);

    await applyLuggageRateMigrationSql(prisma);

    const companyA = await prisma.nhaXe.create({
      data: {
        maNhaXe: companyACode,
        tenNhaXe: `Nhà xe Hành Lý A ${suffix}`,
        trangThai: 'HOAT_DONG',
        cauHinhHanhLy: null,
      },
      select: { nhaXeId: true },
    });
    const companyB = await prisma.nhaXe.create({
      data: {
        maNhaXe: companyBCode,
        tenNhaXe: `Nhà xe Hành Lý B ${suffix}`,
        trangThai: 'HOAT_DONG',
        cauHinhHanhLy: TENANT_B_INITIAL_CONFIG,
      },
      select: { nhaXeId: true },
    });

    companyAId = companyA.nhaXeId;
    companyBId = companyB.nhaXeId;

    const routeA = await prisma.tuyenXe.create({
      data: {
        maTuyenXe: `RT-LUG-${suffix}`,
        diemDi: 'TP.HCM',
        diemDen: 'Đà Lạt',
        trangThai: 'HOAT_DONG',
        nhaXeId: companyAId,
      },
      select: { tuyenXeId: true },
    });
    routeAId = routeA.tuyenXeId;

    const vehicleTypeA = await prisma.loaiXe.create({
      data: {
        nhaXeId: companyAId,
        tenLoai: `Limousine ${suffix}`,
      },
      select: { loaiXeId: true },
    });
    vehicleTypeAId = vehicleTypeA.loaiXeId;

    const vehicleA = await prisma.xe.create({
      data: {
        nhaXeId: companyAId,
        loaiXeId: vehicleTypeAId,
        bienSoXe: `51B-${suffix.slice(0, 6)}`,
        trangThai: 'HOAT_DONG',
      },
      select: { xeId: true },
    });
    vehicleAId = vehicleA.xeId;

    const tripA = await prisma.chuyenXe.create({
      data: {
        maChuyenXe: `TR-LUG-${suffix}`,
        nhaXeId: companyAId,
        tuyenXeId: routeAId,
        xeId: vehicleAId,
        ngayKhoiHanh: new Date('2026-12-01T00:00:00.000Z'),
        gioKhoiHanh: new Date('1970-01-01T08:00:00.000Z'),
        sucChuaXeMay: 2,
        sucChuaHangCongKenh: 5,
        sucChuaHangNhe: 10,
        trangThai: 'CHUA_KHOI_HANH',
      },
      select: { chuyenXeId: true },
    });
    tripAId = tripA.chuyenXeId;
  }, 30_000);

  beforeEach(async () => {
    currentPrincipal = null;
    await prisma.nhaXe.update({
      where: { nhaXeId: companyAId },
      data: { cauHinhHanhLy: null },
    });
    await prisma.nhaXe.update({
      where: { nhaXeId: companyBId },
      data: { cauHinhHanhLy: TENANT_B_INITIAL_CONFIG },
    });
  });

  afterAll(async () => {
    try {
      if (prisma) {
        if (tripAId) {
          await prisma.chuyenXe.deleteMany({ where: { chuyenXeId: tripAId } });
        }
        if (vehicleAId) {
          await prisma.xe.deleteMany({ where: { xeId: vehicleAId } });
        }
        if (vehicleTypeAId) {
          await prisma.loaiXe.deleteMany({ where: { loaiXeId: vehicleTypeAId } });
        }
        if (routeAId) {
          await prisma.tuyenXe.deleteMany({ where: { tuyenXeId: routeAId } });
        }
        await prisma.cauHinhQuyenVaiTroNhaXe.deleteMany({
          where: { nhaXeId: { in: [companyAId, companyBId].filter(Boolean) } },
        });
        await prisma.nhaXe.deleteMany({
          where: { nhaXeId: { in: [companyAId, companyBId].filter(Boolean) } },
        });
      }
    } finally {
      await app?.close();
    }
  }, 30_000);

  async function expectTenantBUnchanged() {
    const companyB = await prisma.nhaXe.findUniqueOrThrow({
      where: { nhaXeId: companyBId },
      select: { cauHinhHanhLy: true },
    });
    expect(companyB.cauHinhHanhLy).toBe(TENANT_B_INITIAL_CONFIG);
  }

  it('Scenario 1: rejects unauthenticated requests across all 4 admin luggage-rate endpoints with 401', async () => {
    currentPrincipal = null;

    const getMy = await request(app.getHttpServer())
      .get('/api/v1/bus-companies/my/luggage-rates')
      .expect(401);
    expect(getMy.body.error).toBe('ACCESS_TOKEN_INVALID');

    const putMy = await request(app.getHttpServer())
      .put('/api/v1/bus-companies/my/luggage-rates')
      .send(VALID_PAYLOAD)
      .expect(401);
    expect(putMy.body.error).toBe('ACCESS_TOKEN_INVALID');

    const getById = await request(app.getHttpServer())
      .get(`/api/v1/bus-companies/${companyBId}/luggage-rates`)
      .expect(401);
    expect(getById.body.error).toBe('ACCESS_TOKEN_INVALID');

    const putById = await request(app.getHttpServer())
      .put(`/api/v1/bus-companies/${companyBId}/luggage-rates`)
      .send(VALID_PAYLOAD)
      .expect(401);
    expect(putById.body.error).toBe('ACCESS_TOKEN_INVALID');

    await expectTenantBUnchanged();
  });

  it('Scenario 2: rejects KHACH_HANG across all admin luggage-rate endpoints with 403 ROLE_FORBIDDEN', async () => {
    currentPrincipal = {
      taiKhoanId: 201,
      sessionId: 'customer-session',
      roles: ['KHACH_HANG'],
      permissions: [],
      nhanVienId: null,
      nhaXeId: null,
    };

    for (const call of [
      () => request(app.getHttpServer()).get('/api/v1/bus-companies/my/luggage-rates'),
      () =>
        request(app.getHttpServer())
          .put('/api/v1/bus-companies/my/luggage-rates')
          .send(VALID_PAYLOAD),
      () =>
        request(app.getHttpServer()).get(
          `/api/v1/bus-companies/${companyBId}/luggage-rates`,
        ),
      () =>
        request(app.getHttpServer())
          .put(`/api/v1/bus-companies/${companyBId}/luggage-rates`)
          .send(VALID_PAYLOAD),
    ]) {
      const res = await call().expect(403);
      expect(res.body.error).toBe('ROLE_FORBIDDEN');
    }

    await expectTenantBUnchanged();
  });

  it('Scenario 3: rejects SUPER_ADMIN on /my/luggage-rates and /:id/luggage-rates with 403 ROLE_FORBIDDEN even if permissions or queryCompanyId are present', async () => {
    currentPrincipal = {
      taiKhoanId: 1,
      sessionId: 'super-admin-session',
      roles: ['SUPER_ADMIN'],
      permissions: [
        ...ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.SUPER_ADMIN,
        'luggage-rate:read',
        'luggage-rate:update',
      ],
      nhanVienId: null,
      nhaXeId: null,
    };

    for (const call of [
      () =>
        request(app.getHttpServer())
          .get('/api/v1/bus-companies/my/luggage-rates')
          .query({ busCompanyId: companyBId }),
      () =>
        request(app.getHttpServer())
          .put('/api/v1/bus-companies/my/luggage-rates')
          .query({ busCompanyId: companyBId })
          .send(VALID_PAYLOAD),
      () =>
        request(app.getHttpServer()).get(
          `/api/v1/bus-companies/${companyBId}/luggage-rates`,
        ),
      () =>
        request(app.getHttpServer())
          .put(`/api/v1/bus-companies/${companyBId}/luggage-rates`)
          .send(VALID_PAYLOAD),
    ]) {
      const res = await call().expect(403);
      expect(res.body.error).toBe('ROLE_FORBIDDEN');
    }

    await expectTenantBUnchanged();
  });

  it('Scenario 4: allows NHA_XE_ADMIN of tenant A to read and update tenant A via both /my/luggage-rates and /:id/luggage-rates', async () => {
    currentPrincipal = {
      taiKhoanId: 101,
      sessionId: 'tenant-a-admin',
      roles: ['NHA_XE_ADMIN'],
      permissions: [...ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.NHA_XE_ADMIN],
      nhanVienId: 501,
      nhaXeId: companyAId,
    };

    const getMy = await request(app.getHttpServer())
      .get('/api/v1/bus-companies/my/luggage-rates')
      .expect(200);
    expect(getMy.body.data.busCompanyId).toBe(companyAId);
    expect(getMy.body.data.default.packageS).toBe(50_000);

    const putMy = await request(app.getHttpServer())
      .put('/api/v1/bus-companies/my/luggage-rates')
      .send(VALID_PAYLOAD)
      .expect(200);
    expect(putMy.body.data.busCompanyId).toBe(companyAId);
    expect(putMy.body.data.default.packageS).toBe(45_000);

    const getById = await request(app.getHttpServer())
      .get(`/api/v1/bus-companies/${companyAId}/luggage-rates`)
      .expect(200);
    expect(getById.body.data.busCompanyId).toBe(companyAId);
    expect(getById.body.data.default.packageS).toBe(45_000);

    const updatedPayloadById = {
      ...VALID_PAYLOAD,
      default: { ...VALID_PAYLOAD.default, packageS: 42_000 },
      routes: { [String(routeAId)]: { inherit: false, packageS: 32_000 } },
    };
    const putById = await request(app.getHttpServer())
      .put(`/api/v1/bus-companies/${companyAId}/luggage-rates`)
      .send(updatedPayloadById)
      .expect(200);
    expect(putById.body.data.busCompanyId).toBe(companyAId);
    expect(putById.body.data.default.packageS).toBe(42_000);
    expect(putById.body.data.availableRoutes).toContainEqual(
      expect.objectContaining({ routeId: routeAId, hasOverride: true }),
    );

    await expectTenantBUnchanged();
  });

  it('Scenario 5: rejects NHA_XE_ADMIN of tenant A reading or updating tenant B with 403 TENANT_SCOPE_VIOLATION', async () => {
    currentPrincipal = {
      taiKhoanId: 101,
      sessionId: 'tenant-a-admin',
      roles: ['NHA_XE_ADMIN'],
      permissions: [...ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.NHA_XE_ADMIN],
      nhanVienId: 501,
      nhaXeId: companyAId,
    };

    const getForeign = await request(app.getHttpServer())
      .get(`/api/v1/bus-companies/${companyBId}/luggage-rates`)
      .expect(403);
    expect(getForeign.body.error).toBe('TENANT_SCOPE_VIOLATION');

    const putForeign = await request(app.getHttpServer())
      .put(`/api/v1/bus-companies/${companyBId}/luggage-rates`)
      .send(VALID_PAYLOAD)
      .expect(403);
    expect(putForeign.body.error).toBe('TENANT_SCOPE_VIOLATION');

    await expectTenantBUnchanged();
  });

  it('Scenario 6: allows employee with luggage-rate:read to GET (200) but rejects PUT with 403 PERMISSION_FORBIDDEN', async () => {
    currentPrincipal = {
      taiKhoanId: 102,
      sessionId: 'tenant-a-emp-read',
      roles: ['NHAN_VIEN_DIEU_HANH'],
      permissions: ['luggage-rate:read'],
      nhanVienId: 502,
      nhaXeId: companyAId,
    };

    const getMy = await request(app.getHttpServer())
      .get('/api/v1/bus-companies/my/luggage-rates')
      .expect(200);
    expect(getMy.body.data.busCompanyId).toBe(companyAId);

    const getById = await request(app.getHttpServer())
      .get(`/api/v1/bus-companies/${companyAId}/luggage-rates`)
      .expect(200);
    expect(getById.body.data.busCompanyId).toBe(companyAId);

    const putMy = await request(app.getHttpServer())
      .put('/api/v1/bus-companies/my/luggage-rates')
      .send(VALID_PAYLOAD)
      .expect(403);
    expect(putMy.body.error).toBe('PERMISSION_FORBIDDEN');

    const putById = await request(app.getHttpServer())
      .put(`/api/v1/bus-companies/${companyAId}/luggage-rates`)
      .send(VALID_PAYLOAD)
      .expect(403);
    expect(putById.body.error).toBe('PERMISSION_FORBIDDEN');

    const companyA = await prisma.nhaXe.findUniqueOrThrow({
      where: { nhaXeId: companyAId },
      select: { cauHinhHanhLy: true },
    });
    expect(companyA.cauHinhHanhLy).toBeNull();
  });

  it('Scenario 7: allows employee with luggage-rate:update to PUT own company (200) and rejects foreign company with 403 TENANT_SCOPE_VIOLATION', async () => {
    currentPrincipal = {
      taiKhoanId: 103,
      sessionId: 'tenant-a-emp-update',
      roles: ['NHAN_VIEN_KINH_DOANH'],
      permissions: ['luggage-rate:update'],
      nhanVienId: 503,
      nhaXeId: companyAId,
    };

    const putOwnMy = await request(app.getHttpServer())
      .put('/api/v1/bus-companies/my/luggage-rates')
      .send(VALID_PAYLOAD)
      .expect(200);
    expect(putOwnMy.body.data.busCompanyId).toBe(companyAId);
    expect(putOwnMy.body.data.default.packageS).toBe(45_000);

    const putOwnById = await request(app.getHttpServer())
      .put(`/api/v1/bus-companies/${companyAId}/luggage-rates`)
      .send({
        ...VALID_PAYLOAD,
        default: { ...VALID_PAYLOAD.default, packageS: 48_000 },
      })
      .expect(200);
    expect(putOwnById.body.data.busCompanyId).toBe(companyAId);
    expect(putOwnById.body.data.default.packageS).toBe(48_000);

    const putForeign = await request(app.getHttpServer())
      .put(`/api/v1/bus-companies/${companyBId}/luggage-rates`)
      .send(VALID_PAYLOAD)
      .expect(403);
    expect(putForeign.body.error).toBe('TENANT_SCOPE_VIOLATION');

    await expectTenantBUnchanged();
  });

  it('Scenario 8: ignores ?busCompanyId=B on /my/luggage-rates so tenant A never reads or mutates tenant B', async () => {
    currentPrincipal = {
      taiKhoanId: 101,
      sessionId: 'tenant-a-admin',
      roles: ['NHA_XE_ADMIN'],
      permissions: [...ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.NHA_XE_ADMIN],
      nhanVienId: 501,
      nhaXeId: companyAId,
    };

    const getWithForeignQuery = await request(app.getHttpServer())
      .get(`/api/v1/bus-companies/my/luggage-rates?busCompanyId=${companyBId}`)
      .expect(200);
    expect(getWithForeignQuery.body.data.busCompanyId).toBe(companyAId);
    expect(getWithForeignQuery.body.data.default.packageS).toBe(50_000);

    const putWithForeignQuery = await request(app.getHttpServer())
      .put(`/api/v1/bus-companies/my/luggage-rates?busCompanyId=${companyBId}`)
      .send(VALID_PAYLOAD)
      .expect(200);
    expect(putWithForeignQuery.body.data.busCompanyId).toBe(companyAId);
    expect(putWithForeignQuery.body.data.default.packageS).toBe(45_000);

    await expectTenantBUnchanged();
  });

  it('Scenario 9: rejects same-tenant employee without luggage-rate permissions with 403 PERMISSION_FORBIDDEN', async () => {
    currentPrincipal = {
      taiKhoanId: 104,
      sessionId: 'tenant-a-emp-no-perm',
      roles: ['NHAN_VIEN_DIEU_HANH'],
      permissions: [...ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.NHAN_VIEN_DIEU_HANH],
      nhanVienId: 504,
      nhaXeId: companyAId,
    };

    for (const call of [
      () => request(app.getHttpServer()).get('/api/v1/bus-companies/my/luggage-rates'),
      () =>
        request(app.getHttpServer())
          .put('/api/v1/bus-companies/my/luggage-rates')
          .send(VALID_PAYLOAD),
      () =>
        request(app.getHttpServer()).get(
          `/api/v1/bus-companies/${companyAId}/luggage-rates`,
        ),
      () =>
        request(app.getHttpServer())
          .put(`/api/v1/bus-companies/${companyAId}/luggage-rates`)
          .send(VALID_PAYLOAD),
    ]) {
      const res = await call().expect(403);
      expect(res.body.error).toBe('PERMISSION_FORBIDDEN');
    }

    const companyA = await prisma.nhaXe.findUniqueOrThrow({
      where: { nhaXeId: companyAId },
      select: { cauHinhHanhLy: true },
    });
    expect(companyA.cauHinhHanhLy).toBeNull();
  });

  it('Scenario 10: rejects tenant A employee with luggage-rate permissions when calling tenant B with 403 TENANT_SCOPE_VIOLATION', async () => {
    currentPrincipal = {
      taiKhoanId: 105,
      sessionId: 'tenant-a-emp-with-perm',
      roles: ['NHAN_VIEN_DIEU_HANH'],
      permissions: ['luggage-rate:read', 'luggage-rate:update'],
      nhanVienId: 505,
      nhaXeId: companyAId,
    };

    const getForeign = await request(app.getHttpServer())
      .get(`/api/v1/bus-companies/${companyBId}/luggage-rates`)
      .expect(403);
    expect(getForeign.body.error).toBe('TENANT_SCOPE_VIOLATION');

    const putForeign = await request(app.getHttpServer())
      .put(`/api/v1/bus-companies/${companyBId}/luggage-rates`)
      .send(VALID_PAYLOAD)
      .expect(403);
    expect(putForeign.body.error).toBe('TENANT_SCOPE_VIOLATION');

    await expectTenantBUnchanged();
  });

  it('Scenario 11: rejects tenant account missing nhaXeId or nhanVienId with 403 TENANT_SCOPE_REQUIRED without falling back to company 1', async () => {
    const company1Before = await prisma.nhaXe.findUnique({
      where: { nhaXeId: 1 },
      select: { cauHinhHanhLy: true },
    });

    for (const invalidPrincipal of [
      {
        taiKhoanId: 106,
        sessionId: 'missing-nhaxe',
        roles: ['NHA_XE_ADMIN'],
        permissions: ['luggage-rate:read', 'luggage-rate:update'],
        nhanVienId: 506,
        nhaXeId: null,
      },
      {
        taiKhoanId: 107,
        sessionId: 'missing-nhanvien',
        roles: ['NHA_XE_ADMIN'],
        permissions: ['luggage-rate:read', 'luggage-rate:update'],
        nhanVienId: null,
        nhaXeId: companyAId,
      },
    ] satisfies AuthPrincipal[]) {
      currentPrincipal = invalidPrincipal;

      const getMy = await request(app.getHttpServer())
        .get('/api/v1/bus-companies/my/luggage-rates')
        .expect(403);
      expect(getMy.body.error).toBe('TENANT_SCOPE_REQUIRED');

      const putMy = await request(app.getHttpServer())
        .put('/api/v1/bus-companies/my/luggage-rates')
        .send(VALID_PAYLOAD)
        .expect(403);
      expect(putMy.body.error).toBe('TENANT_SCOPE_REQUIRED');

      const getById = await request(app.getHttpServer())
        .get(`/api/v1/bus-companies/${companyAId}/luggage-rates`)
        .expect(403);
      expect(getById.body.error).toBe('TENANT_SCOPE_REQUIRED');

      const putById = await request(app.getHttpServer())
        .put(`/api/v1/bus-companies/${companyAId}/luggage-rates`)
        .send(VALID_PAYLOAD)
        .expect(403);
      expect(putById.body.error).toBe('TENANT_SCOPE_REQUIRED');
    }

    const company1After = await prisma.nhaXe.findUnique({
      where: { nhaXeId: 1 },
      select: { cauHinhHanhLy: true },
    });
    expect(company1After).toEqual(company1Before);
  });

  it('Scenario 12: rejects accounts with role scope conflict with 403 ROLE_SCOPE_CONFLICT', async () => {
    for (const conflictingPrincipal of [
      {
        taiKhoanId: 108,
        sessionId: 'conflict-both-roles',
        roles: ['SUPER_ADMIN', 'NHA_XE_ADMIN'],
        permissions: ['luggage-rate:read', 'luggage-rate:update'],
        nhanVienId: 508,
        nhaXeId: companyAId,
      },
      {
        taiKhoanId: 109,
        sessionId: 'conflict-super-with-tenant',
        roles: ['SUPER_ADMIN'],
        permissions: ['luggage-rate:read', 'luggage-rate:update'],
        nhanVienId: 509,
        nhaXeId: companyAId,
      },
    ] satisfies AuthPrincipal[]) {
      currentPrincipal = conflictingPrincipal;

      const getMy = await request(app.getHttpServer())
        .get('/api/v1/bus-companies/my/luggage-rates')
        .expect(403);
      expect(getMy.body.error).toBe('ROLE_SCOPE_CONFLICT');

      const putById = await request(app.getHttpServer())
        .put(`/api/v1/bus-companies/${companyAId}/luggage-rates`)
        .send(VALID_PAYLOAD)
        .expect(403);
      expect(putById.body.error).toBe('ROLE_SCOPE_CONFLICT');
    }
  });

  it.each(['0', '-1', 'abc'])(
    'Scenario 13: rejects invalid :id parameter "%s" with 400 VALIDATION_ERROR',
    async (invalidId) => {
      currentPrincipal = {
        taiKhoanId: 101,
        sessionId: 'tenant-a-admin',
        roles: ['NHA_XE_ADMIN'],
        permissions: [...ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.NHA_XE_ADMIN],
        nhanVienId: 501,
        nhaXeId: companyAId,
      };

      const getRes = await request(app.getHttpServer())
        .get(`/api/v1/bus-companies/${invalidId}/luggage-rates`)
        .expect(400);
      expect(getRes.body.error).toBe('VALIDATION_ERROR');

      const putRes = await request(app.getHttpServer())
        .put(`/api/v1/bus-companies/${invalidId}/luggage-rates`)
        .send(VALID_PAYLOAD)
        .expect(400);
      expect(putRes.body.error).toBe('VALIDATION_ERROR');
    },
  );

  it('Scenario 14: rejects invalid PUT bodies with 400 VALIDATION_ERROR without mutating DB', async () => {
    currentPrincipal = {
      taiKhoanId: 101,
      sessionId: 'tenant-a-admin',
      roles: ['NHA_XE_ADMIN'],
      permissions: [...ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.NHA_XE_ADMIN],
      nhanVienId: 501,
      nhaXeId: companyAId,
    };

    const invalidBodies = [
      {},
      { default: null },
      {
        default: {
          packageS: -1000,
          packageM: 80_000,
          packageL: 120_000,
          packageXL: 180_000,
        },
      },
      {
        default: {
          packageS: 50_000,
          packageSMaxKg: 0,
          packageM: 80_000,
          packageL: 120_000,
          packageXL: 180_000,
        },
      },
      {
        ...VALID_PAYLOAD,
        unexpectedField: 'not-allowed',
      },
    ];

    for (const invalidBody of invalidBodies) {
      const resMy = await request(app.getHttpServer())
        .put('/api/v1/bus-companies/my/luggage-rates')
        .send(invalidBody)
        .expect(400);
      expect(resMy.body.error).toBe('VALIDATION_ERROR');

      const resById = await request(app.getHttpServer())
        .put(`/api/v1/bus-companies/${companyAId}/luggage-rates`)
        .send(invalidBody)
        .expect(400);
      expect(resById.body.error).toBe('VALIDATION_ERROR');
    }

    const companyA = await prisma.nhaXe.findUniqueOrThrow({
      where: { nhaXeId: companyAId },
      select: { cauHinhHanhLy: true },
    });
    expect(companyA.cauHinhHanhLy).toBeNull();
  });

  it('Scenario 15: returns 404 BUS_COMPANY_NOT_FOUND when the authenticated tenant company does not exist in DB', async () => {
    const nonExistentTenantId = 999_999_999;
    currentPrincipal = {
      taiKhoanId: 110,
      sessionId: 'non-existent-tenant-admin',
      roles: ['NHA_XE_ADMIN'],
      permissions: [...ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.NHA_XE_ADMIN],
      nhanVienId: 510,
      nhaXeId: nonExistentTenantId,
    };

    const getMy = await request(app.getHttpServer())
      .get('/api/v1/bus-companies/my/luggage-rates')
      .expect(404);
    expect(getMy.body.error).toBe('BUS_COMPANY_NOT_FOUND');

    const putMy = await request(app.getHttpServer())
      .put('/api/v1/bus-companies/my/luggage-rates')
      .send(VALID_PAYLOAD)
      .expect(404);
    expect(putMy.body.error).toBe('BUS_COMPANY_NOT_FOUND');

    const getById = await request(app.getHttpServer())
      .get(`/api/v1/bus-companies/${nonExistentTenantId}/luggage-rates`)
      .expect(404);
    expect(getById.body.error).toBe('BUS_COMPANY_NOT_FOUND');

    const putById = await request(app.getHttpServer())
      .put(`/api/v1/bus-companies/${nonExistentTenantId}/luggage-rates`)
      .send(VALID_PAYLOAD)
      .expect(404);
    expect(putById.body.error).toBe('BUS_COMPANY_NOT_FOUND');
  });

  it('Scenario 16: keeps GET /bus-companies/trips/:tripId/luggage-packages public without authentication', async () => {
    currentPrincipal = {
      taiKhoanId: 101,
      sessionId: 'tenant-a-admin',
      roles: ['NHA_XE_ADMIN'],
      permissions: [...ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.NHA_XE_ADMIN],
      nhanVienId: 501,
      nhaXeId: companyAId,
    };

    await request(app.getHttpServer())
      .put('/api/v1/bus-companies/my/luggage-rates')
      .send({
        ...VALID_PAYLOAD,
        routes: {
          [String(routeAId)]: {
            inherit: false,
            packageS: 33_000,
          },
        },
      })
      .expect(200);

    currentPrincipal = null;
    const publicRes = await request(app.getHttpServer())
      .get(`/api/v1/bus-companies/trips/${tripAId}/luggage-packages`)
      .expect(200);

    expect(publicRes.body.data).toMatchObject({
      tripId: tripAId,
      routeId: routeAId,
      busCompanyId: companyAId,
      rates: expect.objectContaining({
        packageS: 33_000,
        packageM: 75_000,
      }),
    });
  });

  it('preserves existing NHA_XE_ADMIN tenant overrides by granting luggage-rate permissions without auto-granting to employee overrides', async () => {
    const loader = app.get(EffectiveRolePermissionLoaderService);
    const adminRole = await prisma.vaiTro.findUniqueOrThrow({
      where: { tenVaiTro: 'NHA_XE_ADMIN' },
      select: { vaiTroId: true },
    });
    const employeeRole = await prisma.vaiTro.findUniqueOrThrow({
      where: { tenVaiTro: 'NHAN_VIEN_DIEU_HANH' },
      select: { vaiTroId: true },
    });
    const routeReadPerm = await prisma.quyen.findUniqueOrThrow({
      where: { tenQuyen: 'route:read' },
      select: { quyenId: true },
    });

    await prisma.cauHinhQuyenVaiTroNhaXe.create({
      data: {
        nhaXeId: companyAId,
        vaiTroId: adminRole.vaiTroId,
        chiTiets: {
          create: [{ quyenId: routeReadPerm.quyenId }],
        },
      },
    });
    await prisma.cauHinhQuyenVaiTroNhaXe.create({
      data: {
        nhaXeId: companyAId,
        vaiTroId: employeeRole.vaiTroId,
        chiTiets: {
          create: [{ quyenId: routeReadPerm.quyenId }],
        },
      },
    });

    await applyLuggageRateMigrationSql(prisma);

    const assignments = await loader.load(
      [
        { roleId: adminRole.vaiTroId, roleName: 'NHA_XE_ADMIN' },
        { roleId: employeeRole.vaiTroId, roleName: 'NHAN_VIEN_DIEU_HANH' },
      ],
      companyAId,
    );
    const adminKeys =
      assignments.find((a) => a.roleName === 'NHA_XE_ADMIN')?.permissions ?? [];
    expect(adminKeys).toContain('route:read');
    expect(adminKeys).toContain('luggage-rate:read');
    expect(adminKeys).toContain('luggage-rate:update');

    const employeeKeys =
      assignments.find((a) => a.roleName === 'NHAN_VIEN_DIEU_HANH')
        ?.permissions ?? [];
    expect(employeeKeys).toEqual(['route:read']);
  });
});
