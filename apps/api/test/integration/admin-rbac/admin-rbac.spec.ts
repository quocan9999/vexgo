import {
  type ExecutionContext,
  type INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request, { type Test as SupertestRequest } from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_PERMISSION_CATALOG } from '../../../src/auth/permissions/permission-catalog.js';
import { AccessTokenGuard } from '../../../src/auth/guards/access-token.guard.js';
import { AuthorizationGuard } from '../../../src/auth/guards/authorization.guard.js';
import { configureApi } from '../../../src/common/configure-api.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';
import { AdminRbacController } from '../../../src/admin-rbac/admin-rbac.controller.js';
import { AdminRbacService } from '../../../src/admin-rbac/admin-rbac.service.js';

const SUPER_ADMIN_TOKEN = 'Bearer test-super-admin';
const TENANT_ADMIN_TOKEN = 'Bearer test-tenant-admin';
const ACCESS_TOKEN_ERROR = {
  error: 'ACCESS_TOKEN_INVALID',
  message: 'Cần đăng nhập để thực hiện thao tác này.',
};

const permissionRows = ADMIN_PERMISSION_CATALOG.map(({ key }, index) => ({
  quyenId: index + 1,
  tenQuyen: key,
}));

const permissionIdByKey = new Map(
  permissionRows.map(({ quyenId, tenQuyen }) => [tenQuyen, quyenId]),
);

const roleRows = [
  {
    vaiTroId: 1,
    tenVaiTro: 'SUPER_ADMIN',
    moTa: 'Quản trị hệ thống',
    vaiTroQuyens: ['bus-company:read', 'vehicle:read'].map((key) => ({
      quyen: { tenQuyen: key },
    })),
  },
  {
    vaiTroId: 2,
    tenVaiTro: 'NHA_XE_ADMIN',
    moTa: 'Quản trị nhà xe',
    vaiTroQuyens: ['vehicle:read', 'admin-account:read'].map((key) => ({
      quyen: { tenQuyen: key },
    })),
  },
  ...[
    ['NHAN_VIEN_BAN_VE', 'Nhân viên bán vé'],
    ['NHAN_VIEN_CSKH', 'Nhân viên chăm sóc khách hàng'],
    ['NHAN_VIEN_PHU_XE', 'Nhân viên phụ xe'],
    ['NHAN_VIEN_KINH_DOANH', 'Nhân viên kinh doanh'],
  ].map(([tenVaiTro, moTa], index) => ({
    vaiTroId: index + 3,
    tenVaiTro,
    moTa,
    vaiTroQuyens: [],
  })),
];

const txMock = {
  $queryRaw: vi.fn(async () => []),
  vaiTro: {
    findUnique: vi.fn(),
  },
  quyen: {
    findMany: vi.fn(),
  },
  vaiTroQuyen: {
    deleteMany: vi.fn(async () => ({ count: 0 })),
    createMany: vi.fn(async () => ({ count: 0 })),
  },
};

const prismaMockImpl = {
  $transaction: vi.fn(
    async (work: (tx: typeof txMock) => Promise<unknown>) => work(txMock),
  ),
  vaiTro: {
    findMany: vi.fn(),
  },
  quyen: {
    findMany: vi.fn(),
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

    if (request.headers.authorization === SUPER_ADMIN_TOKEN) {
      request.user = {
        taiKhoanId: 1,
        sessionId: 'test-super-admin-session',
        roles: ['SUPER_ADMIN'],
        permissions: [],
        nhanVienId: null,
        nhaXeId: null,
      };
      return true;
    }

    if (request.headers.authorization === TENANT_ADMIN_TOKEN) {
      request.user = {
        taiKhoanId: 2,
        sessionId: 'test-tenant-admin-session',
        roles: ['NHA_XE_ADMIN'],
        permissions: [],
        nhanVienId: 22,
        nhaXeId: 7,
      };
      return true;
    }

    throw new UnauthorizedException(ACCESS_TOKEN_ERROR);
  },
};

describe('Admin default role-permission API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminRbacController],
      providers: [
        AdminRbacService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'NODE_ENV' ? 'test' : undefined,
          },
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
    prismaMockImpl.quyen.findMany.mockResolvedValue(permissionRows);
    txMock.vaiTro.findUnique.mockImplementation(async ({ where }) =>
      roleRows.find(({ tenVaiTro }) => tenVaiTro === where.tenVaiTro) ?? null,
    );
    txMock.quyen.findMany.mockImplementation(async ({ where }) =>
      permissionRows.filter(({ tenQuyen }) =>
        where.tenQuyen.in.includes(tenQuyen),
      ),
    );
    prismaMockImpl.$transaction.mockImplementation(async (work) => work(txMock));
  });

  afterAll(async () => {
    await app?.close();
  });

  function asSuperAdmin(call: SupertestRequest) {
    return call.set('Authorization', SUPER_ADMIN_TOKEN);
  }

  function asTenantAdmin(call: SupertestRequest) {
    return call.set('Authorization', TENANT_ADMIN_TOKEN);
  }

  it('allows only authenticated Super Admins to read global defaults', async () => {
    const anonymous = await request(app.getHttpServer())
      .get('/api/v1/admin-rbac/default-role-permissions')
      .expect(401);
    expect(anonymous.body.error).toBe('ACCESS_TOKEN_INVALID');

    const tenant = await asTenantAdmin(
      request(app.getHttpServer()).get(
        '/api/v1/admin-rbac/default-role-permissions',
      ),
    ).expect(403);
    expect(tenant.body.error).toBe('ROLE_FORBIDDEN');

    const platform = await asSuperAdmin(
      request(app.getHttpServer()).get(
        '/api/v1/admin-rbac/default-role-permissions',
      ),
    ).expect(200);
    expect(platform.body.data.permissions).toHaveLength(
      ADMIN_PERMISSION_CATALOG.length,
    );
    expect(platform.body.data.roles).toHaveLength(6);
    expect(platform.body.data.roles[0]).toMatchObject({
      roleName: 'SUPER_ADMIN',
      scope: 'platform',
      isProtected: true,
      permissionKeys: ['bus-company:read'],
    });
    expect(platform.body.data.roles[1]).toMatchObject({
      roleName: 'NHA_XE_ADMIN',
      scope: 'tenant',
      isProtected: false,
      permissionKeys: ['vehicle:read'],
    });
    expect(
      platform.body.data.roles.some(
        ({ roleName }: { roleName: string }) => roleName === 'KHACH_HANG',
      ),
    ).toBe(false);
  });

  it('replaces a role mapping atomically after locking the role row', async () => {
    const response = await asSuperAdmin(
      request(app.getHttpServer()).put(
        '/api/v1/admin-rbac/default-role-permissions/NHAN_VIEN_CSKH',
      ),
    )
      .send({ permissionKeys: ['route:read', 'fare-price:read'] })
      .expect(200);

    const role = roleRows.find(
      ({ tenVaiTro }) => tenVaiTro === 'NHAN_VIEN_CSKH',
    );
    expect(prismaMockImpl.$transaction).toHaveBeenCalledTimes(1);
    expect(txMock.$queryRaw).toHaveBeenCalledTimes(1);
    expect(txMock.vaiTroQuyen.deleteMany).toHaveBeenCalledWith({
      where: { vaiTroId: role?.vaiTroId },
    });
    expect(txMock.vaiTroQuyen.createMany).toHaveBeenCalledWith({
      data: [
        {
          vaiTroId: role?.vaiTroId,
          quyenId: permissionIdByKey.get('route:read'),
        },
        {
          vaiTroId: role?.vaiTroId,
          quyenId: permissionIdByKey.get('fare-price:read'),
        },
      ],
    });
    expect(response.body.data).toMatchObject({
      roleName: 'NHAN_VIEN_CSKH',
      scope: 'tenant',
      permissionKeys: ['route:read', 'fare-price:read'],
    });
  });

  it('accepts an empty mapping and deletes current grants without creating rows', async () => {
    const response = await asSuperAdmin(
      request(app.getHttpServer()).put(
        '/api/v1/admin-rbac/default-role-permissions/NHAN_VIEN_CSKH',
      ),
    )
      .send({ permissionKeys: [] })
      .expect(200);

    expect(response.body.data.permissionKeys).toEqual([]);
    expect(txMock.vaiTroQuyen.deleteMany).toHaveBeenCalledTimes(1);
    expect(txMock.vaiTroQuyen.createMany).not.toHaveBeenCalled();
  });

  it('rejects every SUPER_ADMIN permission replacement before opening a transaction', async () => {
    for (const permissionKeys of [['bus-company:read'], []]) {
      const response = await asSuperAdmin(
        request(app.getHttpServer()).put(
          '/api/v1/admin-rbac/default-role-permissions/SUPER_ADMIN',
        ),
      )
        .send({ permissionKeys })
        .expect(403);

      expect(response.body.error).toBe('SUPER_ADMIN_PERMISSION_IMMUTABLE');
    }

    expect(prismaMockImpl.$transaction).not.toHaveBeenCalled();
    expect(txMock.vaiTroQuyen.deleteMany).not.toHaveBeenCalled();
    expect(txMock.vaiTroQuyen.createMany).not.toHaveBeenCalled();
  });

  it('rejects cross-scope assignments before opening a transaction', async () => {
    const tenantRoleWithPlatformKey = await asSuperAdmin(
      request(app.getHttpServer()).put(
        '/api/v1/admin-rbac/default-role-permissions/NHA_XE_ADMIN',
      ),
    )
      .send({ permissionKeys: ['admin-account:read'] })
      .expect(400);
    expect(tenantRoleWithPlatformKey.body.error).toBe(
      'PERMISSION_SCOPE_MISMATCH',
    );
    expect(prismaMockImpl.$transaction).not.toHaveBeenCalled();
  });

  it('rejects unsupported roles, unknown or duplicate keys, and client tenant IDs', async () => {
    const unsupportedRole = await asSuperAdmin(
      request(app.getHttpServer()).put(
        '/api/v1/admin-rbac/default-role-permissions/KHACH_HANG',
      ),
    )
      .send({ permissionKeys: [] })
      .expect(400);
    expect(unsupportedRole.body.error).toBe('VALIDATION_ERROR');

    const unknownKey = await asSuperAdmin(
      request(app.getHttpServer()).put(
        '/api/v1/admin-rbac/default-role-permissions/NHA_XE_ADMIN',
      ),
    )
      .send({ permissionKeys: ['vehicle:delete'] })
      .expect(400);
    expect(unknownKey.body.error).toBe('VALIDATION_ERROR');

    const duplicateKey = await asSuperAdmin(
      request(app.getHttpServer()).put(
        '/api/v1/admin-rbac/default-role-permissions/NHA_XE_ADMIN',
      ),
    )
      .send({ permissionKeys: ['vehicle:read', 'vehicle:read'] })
      .expect(400);
    expect(duplicateKey.body.error).toBe('VALIDATION_ERROR');

    const forgedTenant = await asSuperAdmin(
      request(app.getHttpServer()).put(
        '/api/v1/admin-rbac/default-role-permissions/NHA_XE_ADMIN',
      ),
    )
      .send({ permissionKeys: ['vehicle:read'], nhaXeId: 999 })
      .expect(400);
    expect(forgedTenant.body.error).toBe('VALIDATION_ERROR');
    expect(prismaMockImpl.$transaction).not.toHaveBeenCalled();
  });

  it('does not clear mappings if canonical DB permissions are missing', async () => {
    txMock.quyen.findMany.mockResolvedValueOnce([]);

    const response = await asSuperAdmin(
      request(app.getHttpServer()).put(
        '/api/v1/admin-rbac/default-role-permissions/NHA_XE_ADMIN',
      ),
    )
      .send({ permissionKeys: ['vehicle:read'] })
      .expect(503);

    expect(response.body.error).toBe('SERVICE_UNAVAILABLE');
    expect(txMock.vaiTroQuyen.deleteMany).not.toHaveBeenCalled();
    expect(txMock.vaiTroQuyen.createMany).not.toHaveBeenCalled();
  });
});
