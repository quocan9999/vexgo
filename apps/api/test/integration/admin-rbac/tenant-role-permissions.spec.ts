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
  tenantAdminWithoutAssign: 'Bearer tenant-rbac-no-assign',
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
  [TOKENS.tenantAdminWithoutAssign]: {
    taiKhoanId: 7,
    sessionId: 'tenant-rbac-no-assign-session',
    roles: ['NHA_XE_ADMIN'],
    permissions: ['role:read'],
    nhanVienId: 15,
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

const initialTenantOverrideRows = [
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

const permissionRows = ADMIN_PERMISSION_CATALOG.map(({ key }, index) => ({
  quyenId: index + 1,
  tenQuyen: key,
}));

type MutableTenantOverride = {
  nhaXeId: number;
  vaiTroId: number;
  chiTiets: Array<{ quyen: { tenQuyen: string } }>;
};

let tenantOverrideState: MutableTenantOverride[] = [];

const transactionMockImpl = {
  $queryRaw: vi.fn(),
  vaiTro: { findUnique: vi.fn(), findMany: vi.fn() },
  quyen: { findMany: vi.fn() },
  cauHinhQuyenVaiTroNhaXe: {
    upsert: vi.fn(),
    deleteMany: vi.fn(),
  },
  cauHinhQuyenVaiTroNhaXeChiTiet: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
};

const prismaMockImpl = {
  $transaction: vi.fn(),
  vaiTro: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  quyen: {
    findMany: vi.fn(),
  },
  cauHinhQuyenVaiTroNhaXe: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  nhaXe: {
    findUnique: vi.fn(),
  },
  vaiTroQuyen: {
    createMany: vi.fn(),
    deleteMany: vi.fn(),
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

describe('Tenant role-permission API', () => {
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
    tenantOverrideState = initialTenantOverrideRows.map(
      ({ nhaXeId, vaiTroId, chiTiets }) => ({
        nhaXeId,
        vaiTroId,
        chiTiets: chiTiets.map(({ quyen }) => ({
          quyen: { tenQuyen: quyen.tenQuyen },
        })),
      }),
    );
    prismaMockImpl.vaiTro.findMany.mockResolvedValue(roleRows);
    const findPermissions = async (args: {
      where: { tenQuyen: { in: string[] } };
    }) =>
      permissionRows.filter(({ tenQuyen }) =>
        args.where.tenQuyen.in.includes(tenQuyen),
      );
    prismaMockImpl.quyen.findMany.mockImplementation(findPermissions);
    prismaMockImpl.cauHinhQuyenVaiTroNhaXe.findMany.mockImplementation(
      async (args: {
        where: { nhaXeId: number; vaiTroId: { in: number[] } };
      }) =>
        tenantOverrideState.filter(
          ({ nhaXeId, vaiTroId }) =>
            nhaXeId === args.where.nhaXeId &&
            args.where.vaiTroId.in.includes(vaiTroId),
        ),
    );
    prismaMockImpl.vaiTro.findUnique.mockImplementation(
      async ({ where }: { where: { tenVaiTro: string } }) =>
        roleRows.find(({ tenVaiTro }) => tenVaiTro === where.tenVaiTro) ?? null,
    );
    transactionMockImpl.vaiTro.findUnique.mockImplementation(
      async ({ where }: { where: { tenVaiTro: string } }) =>
        roleRows.find(({ tenVaiTro }) => tenVaiTro === where.tenVaiTro) ?? null,
    );
    transactionMockImpl.vaiTro.findMany.mockImplementation(
      async (args: { where: { tenVaiTro: { in: string[] } } }) =>
        roleRows.filter(({ tenVaiTro }) =>
          args.where.tenVaiTro.in.includes(tenVaiTro),
        ),
    );
    transactionMockImpl.$queryRaw.mockResolvedValue([{ nhaXeId: 7 }]);
    transactionMockImpl.quyen.findMany.mockImplementation(findPermissions);
    transactionMockImpl.cauHinhQuyenVaiTroNhaXe.upsert.mockImplementation(
      async ({
        where,
        create,
      }: {
        where: { nhaXeId_vaiTroId: { nhaXeId: number; vaiTroId: number } };
        create: { nhaXeId: number; vaiTroId: number };
      }) => {
        const { nhaXeId, vaiTroId } = where.nhaXeId_vaiTroId;
        if (
          !tenantOverrideState.some(
            (row) => row.nhaXeId === nhaXeId && row.vaiTroId === vaiTroId,
          )
        ) {
          tenantOverrideState.push({ ...create, chiTiets: [] });
        }
        return { nhaXeId, vaiTroId };
      },
    );
    transactionMockImpl.cauHinhQuyenVaiTroNhaXeChiTiet.deleteMany.mockImplementation(
      async ({ where }: { where: { nhaXeId: number; vaiTroId: number } }) => {
        const existing = tenantOverrideState.find(
          (row) =>
            row.nhaXeId === where.nhaXeId && row.vaiTroId === where.vaiTroId,
        );
        const count = existing?.chiTiets.length ?? 0;
        if (existing) existing.chiTiets = [];
        return { count };
      },
    );
    transactionMockImpl.cauHinhQuyenVaiTroNhaXeChiTiet.createMany.mockImplementation(
      async ({
        data,
      }: {
        data: Array<{ nhaXeId: number; vaiTroId: number; quyenId: number }>;
      }) => {
        for (const item of data) {
          const override = tenantOverrideState.find(
            (row) =>
              row.nhaXeId === item.nhaXeId && row.vaiTroId === item.vaiTroId,
          );
          const permission = permissionRows.find(
            ({ quyenId }) => quyenId === item.quyenId,
          );
          if (override && permission) {
            override.chiTiets.push({
              quyen: { tenQuyen: permission.tenQuyen },
            });
          }
        }
        return { count: data.length };
      },
    );
    transactionMockImpl.cauHinhQuyenVaiTroNhaXe.deleteMany.mockImplementation(
      async ({ where }: { where: { nhaXeId: number; vaiTroId: number } }) => {
        const previousLength = tenantOverrideState.length;
        tenantOverrideState = tenantOverrideState.filter(
          (row) =>
            row.nhaXeId !== where.nhaXeId || row.vaiTroId !== where.vaiTroId,
        );
        return { count: previousLength - tenantOverrideState.length };
      },
    );
    prismaMockImpl.cauHinhQuyenVaiTroNhaXe.deleteMany.mockImplementation(
      async ({ where }: { where: { nhaXeId: number; vaiTroId: number } }) => {
        const { nhaXeId, vaiTroId } = where;
        const previousLength = tenantOverrideState.length;
        tenantOverrideState = tenantOverrideState.filter(
          (row) => row.nhaXeId !== nhaXeId || row.vaiTroId !== vaiTroId,
        );
        return { count: previousLength - tenantOverrideState.length };
      },
    );
    prismaMockImpl.$transaction.mockImplementation(
      async (
        work: (transaction: typeof transactionMockImpl) => Promise<unknown>,
      ) => {
        const previousState = tenantOverrideState.map((row) => ({
          ...row,
          chiTiets: [...row.chiTiets],
        }));
        try {
          return await work(transactionMockImpl);
        } catch (error) {
          tenantOverrideState = previousState;
          throw error;
        }
      },
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

  it('replaces a tenant role assignment without accepting a client tenant ID', async () => {
    const response = await request(app.getHttpServer())
      .put('/api/v1/admin-rbac/tenant-role-permissions/NHAN_VIEN_CSKH')
      .set('Authorization', TOKENS.tenantAdmin)
      .send({ permissionKeys: ['route:read'] })
      .expect(200);

    expect(response.body.data).toMatchObject({
      roleName: 'NHAN_VIEN_CSKH',
      overridePermissionKeys: ['route:read'],
      effectivePermissionKeys: ['route:read'],
      source: 'override',
    });
    expect(prismaMockImpl.vaiTroQuyen.createMany).not.toHaveBeenCalled();
    expect(prismaMockImpl.vaiTroQuyen.deleteMany).not.toHaveBeenCalled();
  });

  it('stores an empty PUT as an intentional empty override', async () => {
    const response = await request(app.getHttpServer())
      .put('/api/v1/admin-rbac/tenant-role-permissions/NHAN_VIEN_CSKH')
      .set('Authorization', TOKENS.tenantAdmin)
      .send({ permissionKeys: [] })
      .expect(200);

    expect(response.body.data).toMatchObject({
      overridePermissionKeys: [],
      effectivePermissionKeys: [],
      source: 'override',
    });
  });

  it('resets a tenant role to global inheritance and is idempotent', async () => {
    const response = await request(app.getHttpServer())
      .delete('/api/v1/admin-rbac/tenant-role-permissions/NHAN_VIEN_CSKH')
      .set('Authorization', TOKENS.tenantAdmin)
      .expect(200);

    expect(response.body.data).toMatchObject({
      overridePermissionKeys: null,
      effectivePermissionKeys: ['route:read'],
      source: 'global',
    });
  });

  it('requires both role:read and permission:assign for writes', async () => {
    for (const token of [
      TOKENS.tenantAdminWithoutRead,
      TOKENS.tenantAdminWithoutAssign,
    ]) {
      const response = await request(app.getHttpServer())
        .put('/api/v1/admin-rbac/tenant-role-permissions/NHAN_VIEN_CSKH')
        .set('Authorization', token)
        .send({ permissionKeys: ['route:read'] })
        .expect(403);
      expect(response.body.error).toBe('PERMISSION_FORBIDDEN');
    }
  });

  it('rejects invalid tenant role-permission payloads before a write', async () => {
    const cases = [
      { roleName: 'SUPER_ADMIN', body: { permissionKeys: [] } },
      {
        roleName: 'NHAN_VIEN_CSKH',
        body: { permissionKeys: ['bus-company:read'] },
      },
      {
        roleName: 'NHAN_VIEN_CSKH',
        body: { permissionKeys: ['route:read', 'route:read'] },
      },
      {
        roleName: 'NHAN_VIEN_CSKH',
        body: { permissionKeys: ['route:read'], nhaXeId: 8 },
      },
    ];

    for (const { roleName, body } of cases) {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/admin-rbac/tenant-role-permissions/${roleName}`)
        .set('Authorization', TOKENS.tenantAdmin)
        .send(body)
        .expect(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    }
  });

  it('fails closed when a requested canonical permission is missing', async () => {
    transactionMockImpl.quyen.findMany.mockResolvedValueOnce([]);

    const response = await request(app.getHttpServer())
      .put('/api/v1/admin-rbac/tenant-role-permissions/NHAN_VIEN_CSKH')
      .set('Authorization', TOKENS.tenantAdmin)
      .send({ permissionKeys: ['route:read'] })
      .expect(503);

    expect(response.body.error).toBe('SERVICE_UNAVAILABLE');
    expect(
      transactionMockImpl.cauHinhQuyenVaiTroNhaXe.upsert,
    ).not.toHaveBeenCalled();
    expect(
      transactionMockImpl.cauHinhQuyenVaiTroNhaXeChiTiet.deleteMany,
    ).not.toHaveBeenCalled();
  });

  it('fails before PUT mutation when another canonical tenant permission is missing', async () => {
    transactionMockImpl.quyen.findMany.mockImplementationOnce(
      async (args: { where: { tenQuyen: { in: string[] } } }) =>
        permissionRows.filter(
          ({ tenQuyen }) =>
            tenQuyen !== 'vehicle:read' &&
            args.where.tenQuyen.in.includes(tenQuyen),
        ),
    );

    const response = await request(app.getHttpServer())
      .put('/api/v1/admin-rbac/tenant-role-permissions/NHAN_VIEN_CSKH')
      .set('Authorization', TOKENS.tenantAdmin)
      .send({ permissionKeys: ['route:read'] })
      .expect(503);

    expect(response.body.error).toBe('SERVICE_UNAVAILABLE');
    expect(
      transactionMockImpl.cauHinhQuyenVaiTroNhaXe.upsert,
    ).not.toHaveBeenCalled();
    expect(
      transactionMockImpl.cauHinhQuyenVaiTroNhaXeChiTiet.deleteMany,
    ).not.toHaveBeenCalled();
  });

  it('preserves the override when another canonical role is missing before reset', async () => {
    transactionMockImpl.vaiTro.findMany.mockResolvedValueOnce(
      roleRows.filter(({ tenVaiTro }) => tenVaiTro !== 'NHAN_VIEN_BAN_VE'),
    );
    const before = tenantOverrideState.map((row) => ({
      ...row,
      chiTiets: [...row.chiTiets],
    }));

    const response = await request(app.getHttpServer())
      .delete('/api/v1/admin-rbac/tenant-role-permissions/NHAN_VIEN_CSKH')
      .set('Authorization', TOKENS.tenantAdmin)
      .expect(503);

    expect(response.body.error).toBe('SERVICE_UNAVAILABLE');
    expect(tenantOverrideState).toEqual(before);
    expect(
      transactionMockImpl.cauHinhQuyenVaiTroNhaXe.deleteMany,
    ).not.toHaveBeenCalled();
  });

  it('does not write when the tenant disappears before the transaction locks it', async () => {
    transactionMockImpl.$queryRaw.mockResolvedValueOnce([]);

    const response = await request(app.getHttpServer())
      .put('/api/v1/admin-rbac/tenant-role-permissions/NHAN_VIEN_CSKH')
      .set('Authorization', TOKENS.tenantAdmin)
      .send({ permissionKeys: ['route:read'] })
      .expect(404);

    expect(response.body.error).toBe('BUS_COMPANY_NOT_FOUND');
    expect(
      transactionMockImpl.cauHinhQuyenVaiTroNhaXe.upsert,
    ).not.toHaveBeenCalled();
  });

  it('lets only Super Admin write a validated target tenant', async () => {
    const response = await request(app.getHttpServer())
      .put('/api/v1/admin-rbac/tenants/8/role-permissions/NHAN_VIEN_CSKH')
      .set('Authorization', TOKENS.superAdmin)
      .send({ permissionKeys: ['fare-price:read'] })
      .expect(200);

    expect(response.body.data).toMatchObject({
      roleName: 'NHAN_VIEN_CSKH',
      overridePermissionKeys: ['fare-price:read'],
      source: 'override',
    });
  });

  it('rejects target-tenant writes by tenant users and unknown tenant IDs', async () => {
    const tenantUser = await request(app.getHttpServer())
      .put('/api/v1/admin-rbac/tenants/8/role-permissions/NHAN_VIEN_CSKH')
      .set('Authorization', TOKENS.tenantAdmin)
      .send({ permissionKeys: ['fare-price:read'] })
      .expect(403);
    expect(tenantUser.body.error).toBe('ROLE_FORBIDDEN');

    const missingTenant = await request(app.getHttpServer())
      .put('/api/v1/admin-rbac/tenants/999/role-permissions/NHAN_VIEN_CSKH')
      .set('Authorization', TOKENS.superAdmin)
      .send({ permissionKeys: ['fare-price:read'] })
      .expect(404);
    expect(missingTenant.body.error).toBe('BUS_COMPANY_NOT_FOUND');
  });
});
