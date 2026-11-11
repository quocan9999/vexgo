import { randomUUID } from 'node:crypto';
import type { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../../src/app.module.js';
import { AccessTokenGuard } from '../../../src/auth/guards/access-token.guard.js';
import { ADMIN_PERMISSION_CATALOG } from '../../../src/auth/permissions/permission-catalog.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';
import { configureApi } from '../../../src/common/configure-api.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';

const suffix = randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase();
const companyACode = `RBAC-A-${suffix}`;
const companyBCode = `RBAC-B-${suffix}`;
const tenantAToken = 'Bearer tenant-rbac-db-a';
const tenantBToken = 'Bearer tenant-rbac-db-b';
const superAdminToken = 'Bearer tenant-rbac-db-super';

describe('Tenant role-permission writes with Prisma/MySQL', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let companyAId: number;
  let companyBId: number;
  let employeeRoleId: number;

  const principalByToken: Record<string, AuthPrincipal> = {
    [tenantAToken]: {
      taiKhoanId: 9101,
      sessionId: 'tenant-rbac-db-a-session',
      roles: ['NHA_XE_ADMIN'],
      permissions: ['role:read', 'permission:assign'],
      nhanVienId: 9101,
      nhaXeId: 0,
    },
    [tenantBToken]: {
      taiKhoanId: 9102,
      sessionId: 'tenant-rbac-db-b-session',
      roles: ['NHA_XE_ADMIN'],
      permissions: ['role:read', 'permission:assign'],
      nhanVienId: 9102,
      nhaXeId: 0,
    },
    [superAdminToken]: {
      taiKhoanId: 9103,
      sessionId: 'tenant-rbac-db-super-session',
      roles: ['SUPER_ADMIN'],
      permissions: [],
      nhanVienId: null,
      nhaXeId: null,
    },
  };

  beforeAll(async () => {
    const accessTokenGuard = {
      canActivate(context: ExecutionContext) {
        const req = context.switchToHttp().getRequest<{
          headers: { authorization?: string };
          user?: AuthPrincipal;
        }>();
        const principal = req.headers.authorization
          ? principalByToken[req.headers.authorization]
          : undefined;
        if (!principal) throw new Error('Unexpected test authorization token.');
        req.user = principal;
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

    const companyA = await prisma.nhaXe.create({
      data: {
        maNhaXe: companyACode,
        tenNhaXe: `RBAC Tenant A ${suffix}`,
        trangThai: 'HOAT_DONG',
      },
      select: { nhaXeId: true },
    });
    const companyB = await prisma.nhaXe.create({
      data: {
        maNhaXe: companyBCode,
        tenNhaXe: `RBAC Tenant B ${suffix}`,
        trangThai: 'HOAT_DONG',
      },
      select: { nhaXeId: true },
    });
    companyAId = companyA.nhaXeId;
    companyBId = companyB.nhaXeId;
    principalByToken[tenantAToken] = {
      ...principalByToken[tenantAToken],
      nhaXeId: companyAId,
    };
    principalByToken[tenantBToken] = {
      ...principalByToken[tenantBToken],
      nhaXeId: companyBId,
    };

    const employeeRole = await prisma.vaiTro.findUnique({
      where: { tenVaiTro: 'NHAN_VIEN_CSKH' },
      select: { vaiTroId: true },
    });
    if (!employeeRole) throw new Error('Canonical employee role is missing.');
    employeeRoleId = employeeRole.vaiTroId;
  }, 30000);

  afterAll(async () => {
    try {
      if (prisma) {
        const fixtureCompanies = await prisma.nhaXe.findMany({
          where: { maNhaXe: { in: [companyACode, companyBCode] } },
          select: { nhaXeId: true },
        });
        const fixtureTenantIds = fixtureCompanies.map(({ nhaXeId }) => nhaXeId);
        if (fixtureTenantIds.length > 0) {
          await prisma.$transaction(async (tx) => {
            await tx.cauHinhQuyenVaiTroNhaXe.deleteMany({
              where: { nhaXeId: { in: fixtureTenantIds } },
            });
            await tx.nhaXe.deleteMany({
              where: { nhaXeId: { in: fixtureTenantIds } },
            });
          });
        }
      }
    } finally {
      await app?.close();
    }
  });

  async function clearOverrides() {
    await prisma.cauHinhQuyenVaiTroNhaXe.deleteMany({
      where: {
        nhaXeId: { in: [companyAId, companyBId] },
        vaiTroId: employeeRoleId,
      },
    });
  }

  async function assignmentKeys(nhaXeId: number): Promise<string[]> {
    const assignment = await prisma.cauHinhQuyenVaiTroNhaXe.findUnique({
      where: {
        nhaXeId_vaiTroId: { nhaXeId, vaiTroId: employeeRoleId },
      },
      select: {
        chiTiets: {
          select: { quyen: { select: { tenQuyen: true } } },
        },
      },
    });
    return assignment?.chiTiets.map(({ quyen }) => quyen.tenQuyen) ?? [];
  }

  async function effectiveKeys(token: string, path: string): Promise<string[]> {
    const response = await request(app.getHttpServer())
      .get(path)
      .set('Authorization', token)
      .expect(200);
    const role = response.body.data.roles.find(
      ({ roleName }: { roleName: string }) => roleName === 'NHAN_VIEN_CSKH',
    );
    return role.effectivePermissionKeys;
  }

  it('atomically replaces one tenant mapping without changing global defaults', async () => {
    await clearOverrides();
    const globalBefore = await prisma.vaiTroQuyen.findMany({
      where: { vaiTroId: employeeRoleId },
      select: { quyen: { select: { tenQuyen: true } } },
    });

    const response = await request(app.getHttpServer())
      .put('/api/v1/admin-rbac/tenant-role-permissions/NHAN_VIEN_CSKH')
      .set('Authorization', tenantAToken)
      .send({ permissionKeys: ['route:read', 'fare-price:read'] })
      .expect(200);

    expect(response.body.data).toMatchObject({
      overridePermissionKeys: ['route:read', 'fare-price:read'],
      effectivePermissionKeys: ['route:read', 'fare-price:read'],
      source: 'override',
    });
    expect(await assignmentKeys(companyAId)).toEqual([
      'route:read',
      'fare-price:read',
    ]);
    expect(
      await prisma.vaiTroQuyen.findMany({
        where: { vaiTroId: employeeRoleId },
        select: { quyen: { select: { tenQuyen: true } } },
      }),
    ).toEqual(globalBefore);
  });

  it('persists an empty override separately from an absent override', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/admin-rbac/tenant-role-permissions/NHAN_VIEN_CSKH')
      .set('Authorization', tenantAToken)
      .send({ permissionKeys: [] })
      .expect(200);

    const role = await prisma.cauHinhQuyenVaiTroNhaXe.findUnique({
      where: {
        nhaXeId_vaiTroId: { nhaXeId: companyAId, vaiTroId: employeeRoleId },
      },
      select: { chiTiets: { select: { quyenId: true } } },
    });
    expect(role).not.toBeNull();
    expect(role?.chiTiets).toEqual([]);
    expect(
      await effectiveKeys(
        tenantAToken,
        '/api/v1/admin-rbac/tenant-role-permissions',
      ),
    ).toEqual([]);
  });

  it('resets to global inheritance and deletes only the selected tenant override', async () => {
    const globalRows = await prisma.vaiTroQuyen.findMany({
      where: { vaiTroId: employeeRoleId },
      select: { quyen: { select: { tenQuyen: true } } },
    });
    const expectedGlobalKeys = ADMIN_PERMISSION_CATALOG.filter(
      ({ key, scope }) =>
        scope === 'tenant' &&
        globalRows.some(({ quyen }) => quyen.tenQuyen === key),
    ).map(({ key }) => key);

    const response = await request(app.getHttpServer())
      .delete('/api/v1/admin-rbac/tenant-role-permissions/NHAN_VIEN_CSKH')
      .set('Authorization', tenantAToken)
      .expect(200);
    expect(response.body.data).toMatchObject({
      overridePermissionKeys: null,
      effectivePermissionKeys: expectedGlobalKeys,
      source: 'global',
    });
    expect(
      await prisma.cauHinhQuyenVaiTroNhaXe.findUnique({
        where: {
          nhaXeId_vaiTroId: {
            nhaXeId: companyAId,
            vaiTroId: employeeRoleId,
          },
        },
      }),
    ).toBeNull();

    await request(app.getHttpServer())
      .delete('/api/v1/admin-rbac/tenant-role-permissions/NHAN_VIEN_CSKH')
      .set('Authorization', tenantAToken)
      .expect(200);
    expect(await assignmentKeys(companyBId)).toEqual([]);
  });

  it('isolates concurrent complete replacements and reset from another tenant', async () => {
    await clearOverrides();
    const replacementA = ['route:read'];
    const replacementB = ['fare-price:read'];
    const results = await Promise.allSettled([
      request(app.getHttpServer())
        .put('/api/v1/admin-rbac/tenant-role-permissions/NHAN_VIEN_CSKH')
        .set('Authorization', tenantAToken)
        .send({ permissionKeys: replacementA })
        .expect(200),
      request(app.getHttpServer())
        .put('/api/v1/admin-rbac/tenant-role-permissions/NHAN_VIEN_CSKH')
        .set('Authorization', tenantAToken)
        .send({ permissionKeys: replacementB })
        .expect(200),
    ]);
    expect(results.every((result) => result.status === 'fulfilled')).toBe(true);

    const finalAssignment = await prisma.cauHinhQuyenVaiTroNhaXe.findUnique({
      where: {
        nhaXeId_vaiTroId: { nhaXeId: companyAId, vaiTroId: employeeRoleId },
      },
      select: {
        chiTiets: { select: { quyen: { select: { tenQuyen: true } } } },
      },
    });
    const finalKeys =
      finalAssignment?.chiTiets.map(({ quyen }) => quyen.tenQuyen) ?? [];
    expect([replacementA, replacementB]).toContainEqual(finalKeys);

    const replacementBeforeReset = ['route:read', 'fare-price:read'];
    const putAndReset = await Promise.allSettled([
      request(app.getHttpServer())
        .put('/api/v1/admin-rbac/tenant-role-permissions/NHAN_VIEN_CSKH')
        .set('Authorization', tenantAToken)
        .send({ permissionKeys: replacementBeforeReset })
        .expect(200),
      request(app.getHttpServer())
        .delete('/api/v1/admin-rbac/tenant-role-permissions/NHAN_VIEN_CSKH')
        .set('Authorization', tenantAToken)
        .expect(200),
    ]);
    expect(putAndReset.every((result) => result.status === 'fulfilled')).toBe(
      true,
    );

    const finalAfterPutAndReset =
      await prisma.cauHinhQuyenVaiTroNhaXe.findUnique({
        where: {
          nhaXeId_vaiTroId: {
            nhaXeId: companyAId,
            vaiTroId: employeeRoleId,
          },
        },
      });
    if (finalAfterPutAndReset) {
      expect(await assignmentKeys(companyAId)).toEqual(replacementBeforeReset);
    }

    await request(app.getHttpServer())
      .put(
        '/api/v1/admin-rbac/tenants/' +
          companyBId +
          '/role-permissions/NHAN_VIEN_CSKH',
      )
      .set('Authorization', superAdminToken)
      .send({ permissionKeys: ['vehicle:read'] })
      .expect(200);
    await request(app.getHttpServer())
      .delete('/api/v1/admin-rbac/tenant-role-permissions/NHAN_VIEN_CSKH')
      .set('Authorization', tenantAToken)
      .expect(200);
    expect(await assignmentKeys(companyBId)).toEqual(['vehicle:read']);
  });
});
