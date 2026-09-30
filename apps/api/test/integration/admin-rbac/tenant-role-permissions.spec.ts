import {
  type ExecutionContext,
  type INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
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
import { ADMIN_PERMISSION_CATALOG } from '../../../src/auth/permissions/permission-catalog.js';
import { AccessTokenGuard } from '../../../src/auth/guards/access-token.guard.js';
import { AuthorizationGuard } from '../../../src/auth/guards/authorization.guard.js';
import { configureApi } from '../../../src/common/configure-api.js';
import { PlatformTenantRbacController } from '../../../src/admin-rbac/platform-tenant-rbac.controller.js';
import { TenantAdminRbacController } from '../../../src/admin-rbac/tenant-admin-rbac.controller.js';
import { TenantRolePermissionsService } from '../../../src/admin-rbac/tenant-role-permissions.service.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';

const TOKENS = {
  tenantAdmin: 'Bearer tenant-rbac-reader',
  tenantAdminWithoutRead: 'Bearer tenant-rbac-no-read',
  employee: 'Bearer tenant-rbac-employee',
  superAdmin: 'Bearer tenant-rbac-super-admin',
  mixedScope: 'Bearer tenant-rbac-mixed-scope',
  missingTenant: 'Bearer tenant-rbac-missing-tenant',
} as const;

type TestPrincipal = {
  taiKhoanId: number;
  sessionId: string;
  roles: string[];
  permissions: string[];
  nhanVienId: number | null;
  nhaXeId: number | null;
};

const principalsByToken: Record<string, TestPrincipal> = {
  [TOKENS.tenantAdmin]: {
    taiKhoanId: 1,
    sessionId: 'tenant-rbac-reader-session',
    roles: ['NHA_XE_ADMIN'],
    permissions: ['role:read', 'permission:assign'],
    nhanVienId: 10,
    nhaXeId: 7,
  },
  [TOKENS.tenantAdminWithoutRead]: {
    taiKhoanId: 2,
    sessionId: 'tenant-rbac-no-read-session',
    roles: ['NHA_XE_ADMIN'],
    permissions: ['permission:assign'],
    nhanVienId: 11,
    nhaXeId: 7,
  },
  [TOKENS.employee]: {
    taiKhoanId: 3,
    sessionId: 'tenant-rbac-employee-session',
    roles: ['NHAN_VIEN_CSKH'],
    permissions: ['role:read', 'permission:assign'],
    nhanVienId: 12,
    nhaXeId: 7,
  },
  [TOKENS.superAdmin]: {
    taiKhoanId: 4,
    sessionId: 'tenant-rbac-super-admin-session',
    roles: ['SUPER_ADMIN'],
    permissions: [],
    nhanVienId: null,
    nhaXeId: null,
  },
  [TOKENS.mixedScope]: {
    taiKhoanId: 5,
    sessionId: 'tenant-rbac-mixed-scope-session',
    roles: ['SUPER_ADMIN', 'NHA_XE_ADMIN'],
    permissions: ['role:read', 'permission:assign'],
    nhanVienId: 13,
    nhaXeId: 7,
  },
  [TOKENS.missingTenant]: {
    taiKhoanId: 6,
    sessionId: 'tenant-rbac-missing-tenant-session',
    roles: ['NHA_XE_ADMIN'],
    permissions: ['role:read'],
    nhanVienId: 14,
    nhaXeId: null,
  },
};

const roleRows = [
  {
    vaiTroId: 1,
    tenVaiTro: 'NHA_XE_ADMIN',
    moTa: 'Quản trị nhà xe',
    vaiTroQuyens: [
      'vehicle:read',
      'bus-company:read',
      'role:read',
      'permission:assign',
    ].map((tenQuyen) => ({ quyen: { tenQuyen } })),
  },
  {
    vaiTroId: 2,
    tenVaiTro: 'NHAN_VIEN_BAN_VE',
    moTa: 'Nhân viên bán vé',
    vaiTroQuyens: [],
  },
  {
    vaiTroId: 3,
    tenVaiTro: 'NHAN_VIEN_CSKH',
    moTa: 'Nhân viên chăm sóc khách hàng',
    vaiTroQuyens: ['route:read', 'admin-account:read'].map((tenQuyen) => ({
      quyen: { tenQuyen },
    })),
  },
  {
    vaiTroId: 4,
    tenVaiTro: 'NHAN_VIEN_PHU_XE',
    moTa: 'Nhân viên phụ xe',
    vaiTroQuyens: [],
  },
  {
    vaiTroId: 5,
    tenVaiTro: 'NHAN_VIEN_KINH_DOANH',
    moTa: 'Nhân viên kinh doanh',
    vaiTroQuyens: [],
  },
];

const tenantOverrideRows = [
  {
    nhaXeId: 7,
    vaiTroId: 1,
    chiTiets: [
      { quyen: { tenQuyen: 'route:read' } },
      { quyen: { tenQuyen: 'bus-company:read' } },
    ],
  },
  { nhaXeId: 7, vaiTroId: 3, chiTiets: [] },
  {
    nhaXeId: 8,
    vaiTroId: 1,
    chiTiets: [{ quyen: { tenQuyen: 'vehicle-type:read' } }],
  },
];

const prismaMockImpl = {
  vaiTro: {
    findMany: vi.fn(),
  },
  quyen: {
    findMany: vi.fn(),
  },
  cauHinhQuyenVaiTroNhaXe: {
    findMany: vi.fn(),
  },
  nhaXe: {
    findUnique: vi.fn(),
  },
};
const prismaMock = prismaMockImpl as unknown as PrismaService;

const testAccessTokenGuard = {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: {
        taiKhoanId: number;
        sessionId: string;
        roles: string[];
        permissions: string[];
        nhanVienId: number | null;
        nhaXeId: number | null;
      };
    }>();

    const principal = request.headers.authorization
      ? principalsByToken[request.headers.authorization]
      : undefined;
    if (!principal) {
      throw new UnauthorizedException({
        error: 'ACCESS_TOKEN_INVALID',
        message: 'Cần đăng nhập để thực hiện thao tác này.',
      });
    }

    request.user = principal;
    return true;
  },
};

describe('Tenant role-permission read API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TenantAdminRbacController, PlatformTenantRbacController],
      providers: [
        TenantRolePermissionsService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: ConfigService,
          useValue: { get: () => 'test' },
        },
        Reflector,
        { provide: AccessTokenGuard, useValue: testAccessTokenGuard },
        { provide: APP_GUARD, useExisting: AccessTokenGuard },
        AuthorizationGuard,
        { provide: APP_GUARD, useExisting: AuthorizationGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApi(app);
    await app.init();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMockImpl.vaiTro.findMany.mockResolvedValue(roleRows);
    prismaMockImpl.quyen.findMany.mockResolvedValue(
      ADMIN_PERMISSION_CATALOG.filter(({ scope }) => scope === 'tenant').map(
        ({ key }) => ({ tenQuyen: key }),
      ) as never,
    );
    prismaMockImpl.cauHinhQuyenVaiTroNhaXe.findMany.mockImplementation(
      async (args: {
        where: { nhaXeId: number; vaiTroId: { in: number[] } };
      }) =>
        tenantOverrideRows.filter(
          ({ nhaXeId, vaiTroId }) =>
            nhaXeId === args.where.nhaXeId &&
            args.where.vaiTroId.in.includes(vaiTroId),
        ),
    );
    prismaMockImpl.nhaXe.findUnique.mockImplementation(
      async ({ where }: { where: { nhaXeId: number } }) =>
        where.nhaXeId === 7 || where.nhaXeId === 8
          ? { nhaXeId: where.nhaXeId }
          : null,
    );
  });

  afterAll(async () => {
    await app?.close();
  });

  it('returns defaults and tenant overrides only for the signed-in tenant', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin-rbac/tenant-role-permissions')
      .query({ nhaXeId: 8 })
      .set('Authorization', TOKENS.tenantAdmin)
      .expect(200);

    expect(response.body.data.permissions).toEqual(
      ADMIN_PERMISSION_CATALOG.filter(({ scope }) => scope === 'tenant'),
    );
    const roles = response.body.data.roles;
    const busCompanyAdmin = roles.find(
      ({ roleName }: { roleName: string }) => roleName === 'NHA_XE_ADMIN',
    );
    expect(busCompanyAdmin.defaultPermissionKeys).toContain('vehicle:read');
    expect(busCompanyAdmin.defaultPermissionKeys).not.toContain(
      'bus-company:read',
    );
    expect(busCompanyAdmin.overridePermissionKeys).toEqual(['route:read']);
    expect(busCompanyAdmin.effectivePermissionKeys).toEqual(['route:read']);
    expect(busCompanyAdmin.source).toBe('override');

    const customerSupport = roles.find(
      ({ roleName }: { roleName: string }) => roleName === 'NHAN_VIEN_CSKH',
    );
    expect(customerSupport).toMatchObject({
      defaultPermissionKeys: ['route:read'],
      overridePermissionKeys: [],
      effectivePermissionKeys: [],
      source: 'override',
    });

    const attendant = roles.find(
      ({ roleName }: { roleName: string }) => roleName === 'NHAN_VIEN_PHU_XE',
    );
    expect(attendant).toMatchObject({
      overridePermissionKeys: null,
      effectivePermissionKeys: [],
      source: 'global',
    });
    expect(response.body.data.roles).toHaveLength(5);
    expect(
      prismaMockImpl.cauHinhQuyenVaiTroNhaXe.findMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ nhaXeId: 7 }),
      }),
    );
  });

  it('allows Super Admin to read a validated tenant target without operational permissions', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin-rbac/tenants/7/role-permissions')
      .set('Authorization', TOKENS.superAdmin)
      .expect(200);

    expect(prismaMockImpl.nhaXe.findUnique).toHaveBeenCalledWith({
      where: { nhaXeId: 7 },
      select: { nhaXeId: true },
    });
    expect(
      prismaMockImpl.cauHinhQuyenVaiTroNhaXe.findMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ nhaXeId: 7 }),
      }),
    );
  });

  it('rejects tenant self-management when the tenant admin lacks role:read', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin-rbac/tenant-role-permissions')
      .set('Authorization', TOKENS.tenantAdminWithoutRead)
      .expect(403);
    expect(response.body.error).toBe('PERMISSION_FORBIDDEN');
  });

  it('keeps RBAC management structurally limited to NHA_XE_ADMIN', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin-rbac/tenant-role-permissions')
      .set('Authorization', TOKENS.employee)
      .expect(403);
    expect(response.body.error).toBe('ROLE_FORBIDDEN');
  });

  it('rejects tenant admins from the Super Admin target-tenant endpoint', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin-rbac/tenants/8/role-permissions')
      .set('Authorization', TOKENS.tenantAdmin)
      .expect(403);
    expect(response.body.error).toBe('ROLE_FORBIDDEN');
  });

  it('fails closed for a tenant principal without a tenant identity', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin-rbac/tenant-role-permissions')
      .set('Authorization', TOKENS.missingTenant)
      .expect(403);
    expect(response.body.error).toBe('TENANT_SCOPE_REQUIRED');
  });

  it('rejects mixed platform and tenant scope before serving configuration', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin-rbac/tenant-role-permissions')
      .set('Authorization', TOKENS.mixedScope)
      .expect(403);
    expect(response.body.error).toBe('ROLE_SCOPE_CONFLICT');
  });

  it('validates Super Admin tenant target IDs and returns 404 for missing tenants', async () => {
    const invalid = await request(app.getHttpServer())
      .get('/api/v1/admin-rbac/tenants/0/role-permissions')
      .set('Authorization', TOKENS.superAdmin)
      .expect(400);
    expect(invalid.body.error).toBe('VALIDATION_ERROR');

    const missing = await request(app.getHttpServer())
      .get('/api/v1/admin-rbac/tenants/999/role-permissions')
      .set('Authorization', TOKENS.superAdmin)
      .expect(404);
    expect(missing.body.error).toBe('BUS_COMPANY_NOT_FOUND');
  });

  it('fails closed when the canonical tenant role catalog is incomplete', async () => {
    prismaMockImpl.vaiTro.findMany.mockResolvedValueOnce(roleRows.slice(0, 4));

    const response = await request(app.getHttpServer())
      .get('/api/v1/admin-rbac/tenant-role-permissions')
      .set('Authorization', TOKENS.tenantAdmin)
      .expect(503);

    expect(response.body.error).toBe('SERVICE_UNAVAILABLE');
    expect(
      prismaMockImpl.cauHinhQuyenVaiTroNhaXe.findMany,
    ).not.toHaveBeenCalled();
  });
});
