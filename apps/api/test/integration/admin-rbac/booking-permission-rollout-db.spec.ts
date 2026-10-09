import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { ConfigService } from '@nestjs/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthService } from '../../../src/auth/auth.service.js';
import { EffectiveRolePermissionLoaderService } from '../../../src/auth/permissions/effective-role-permission-loader.service.js';
import { PermissionResolverService } from '../../../src/auth/permissions/permission-resolver.service.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';
import { TenantRolePermissionsService } from '../../../src/admin-rbac/tenant-role-permissions.service.js';
import type { OtpService } from '../../../src/auth/otp/otp.service.js';
import type { TokenService } from '../../../src/auth/tokens/token.service.js';

function readLocalEnvValue(name: string): string | undefined {
  const envPath = path.resolve(process.cwd(), '../../.env');
  if (!existsSync(envPath)) return undefined;
  const line = readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .find((entry) => entry.startsWith(`${name}=`));
  return line?.slice(name.length + 1).trim();
}

const testDatabaseUrl =
  process.env.FEATURE07_TEST_DATABASE_URL ??
  readLocalEnvValue('FEATURE07_TEST_DATABASE_URL');

function databaseTarget(value: string) {
  const url = new URL(value);
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    database: decodeURIComponent(url.pathname.replace(/^\/+/, '')),
  };
}

const testTarget = testDatabaseUrl ? databaseTarget(testDatabaseUrl) : null;
if (testTarget) {
  const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
  if (!localHosts.has(testTarget.host)) {
    throw new Error('Feature 07 RBAC DB tests must target localhost.');
  }
  if (!/^vexgo_feature07.*test$/i.test(testTarget.database)) {
    throw new Error(
      'Feature 07 RBAC DB tests only allow a dedicated test database (e.g. vexgo_feature07_test or vexgo_feature07_ci_test).',
    );
  }
  const isCi = process.env.CI === 'true';
  const allowedPort = isCi
    ? testTarget.port === 3306 || testTarget.port === 3307
    : testTarget.port === 3307;
  if (!allowedPort) {
    throw new Error(
      isCi
        ? 'CI Feature 07 test database port must be 3306 or 3307.'
        : 'Local Feature 07 test database must use port 3307.',
    );
  }
}

const featureTestDescribe = testTarget ? describe : describe.skip;
const suffix = randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase();
const companyACode = `F07-RBAC-A-${suffix}`;
const companyBCode = `F07-RBAC-B-${suffix}`;
const rolloutPath = path.resolve(
  process.cwd(),
  '../../prisma/rollouts/add-booking-read-permission.mjs',
);
const projectRoot = path.resolve(process.cwd(), '../..');

featureTestDescribe(
  'booking:read rollout and session permissions with Prisma/MySQL',
  () => {
    let prisma: PrismaService;
    let authService: AuthService;
    let tenantPermissions: TenantRolePermissionsService;
    let adminRoleId: number;
    let superAdminRoleId: number;
    let companyAId: number;
    let companyBId: number;
    let accountAId: number;
    let accountBId: number;
    let originalPermissionDescription: string | null | undefined;
    let permissionId: number;
    let originalAdminPermissionKeys: string[];

    function runRollout() {
      const result = spawnSync(process.execPath, [rolloutPath], {
        cwd: projectRoot,
        env: {
          ...process.env,
          DATABASE_URL: testDatabaseUrl,
          MIGRATION_URL: testDatabaseUrl,
          BOOKING_READ_PERMISSION_ROLLOUT_CONFIRM_DATABASE:
            testTarget?.database,
        },
        encoding: 'utf8',
      });
      expect(
        result.status,
        `rollout process exit status (${result.status})`,
      ).toBe(0);
    }

    beforeAll(async () => {
      if (!testDatabaseUrl)
        throw new Error('Dedicated Feature 07 test DB is missing.');
      prisma = new PrismaService(
        new ConfigService({ DATABASE_URL: testDatabaseUrl }),
      );
      await prisma.$connect();

      const [adminRole, superAdminRole] = await Promise.all([
        prisma.vaiTro.findUnique({ where: { tenVaiTro: 'NHA_XE_ADMIN' } }),
        prisma.vaiTro.findUnique({ where: { tenVaiTro: 'SUPER_ADMIN' } }),
      ]);
      if (!adminRole || !superAdminRole) {
        throw new Error('Canonical Admin roles are missing from the test DB.');
      }
      adminRoleId = adminRole.vaiTroId;
      superAdminRoleId = superAdminRole.vaiTroId;
      originalAdminPermissionKeys = (
        await prisma.vaiTroQuyen.findMany({
          where: { vaiTroId: adminRoleId },
          select: { quyen: { select: { tenQuyen: true } } },
        })
      ).map(({ quyen }) => quyen.tenQuyen);

      runRollout();

      const permission = await prisma.quyen.findUnique({
        where: { tenQuyen: 'booking:read' },
        select: { quyenId: true, moTa: true },
      });
      if (!permission) throw new Error('Rollout did not create booking:read.');
      permissionId = permission.quyenId;
      originalPermissionDescription = permission.moTa;

      const companyA = await prisma.nhaXe.create({
        data: {
          maNhaXe: companyACode,
          tenNhaXe: `Feature 07 RBAC A ${suffix}`,
          trangThai: 'HOAT_DONG',
        },
        select: { nhaXeId: true },
      });
      const companyB = await prisma.nhaXe.create({
        data: {
          maNhaXe: companyBCode,
          tenNhaXe: `Feature 07 RBAC B ${suffix}`,
          trangThai: 'HOAT_DONG',
        },
        select: { nhaXeId: true },
      });
      companyAId = companyA.nhaXeId;
      companyBId = companyB.nhaXeId;

      const [accountA, accountB] = await Promise.all([
        prisma.taiKhoan.create({
          data: {
            hoTen: `Feature 07 Admin A ${suffix}`,
            soDienThoai: `+849${suffix.slice(0, 8)}01`,
            matKhau: 'test-only-not-a-login-secret',
            daXacThucSoDienThoai: true,
            trangThai: 'HOAT_DONG',
          },
          select: { taiKhoanId: true },
        }),
        prisma.taiKhoan.create({
          data: {
            hoTen: `Feature 07 Admin B ${suffix}`,
            soDienThoai: `+849${suffix.slice(0, 8)}02`,
            matKhau: 'test-only-not-a-login-secret',
            daXacThucSoDienThoai: true,
            trangThai: 'HOAT_DONG',
          },
          select: { taiKhoanId: true },
        }),
      ]);
      accountAId = accountA.taiKhoanId;
      accountBId = accountB.taiKhoanId;

      await prisma.$transaction([
        prisma.nhanVien.create({
          data: {
            maNhanVien: `F07-ADMIN-A-${suffix}`,
            trangThaiLamViec: 'DANG_LAM',
            nhaXeId: companyAId,
            taiKhoanId: accountAId,
          },
        }),
        prisma.nhanVien.create({
          data: {
            maNhanVien: `F07-ADMIN-B-${suffix}`,
            trangThaiLamViec: 'DANG_LAM',
            nhaXeId: companyBId,
            taiKhoanId: accountBId,
          },
        }),
        prisma.taiKhoanVaiTro.createMany({
          data: [
            { taiKhoanId: accountAId, vaiTroId: adminRoleId },
            { taiKhoanId: accountBId, vaiTroId: adminRoleId },
          ],
        }),
      ]);

      tenantPermissions = new TenantRolePermissionsService(prisma);
      authService = new AuthService(
        prisma,
        {} as OtpService,
        {} as TokenService,
        new PermissionResolverService(),
        new EffectiveRolePermissionLoaderService(prisma),
      );
      await tenantPermissions.replaceOverride(companyBId, 'NHA_XE_ADMIN', [
        'route:read',
      ]);
    }, 30000);

    afterAll(async () => {
      if (!prisma) return;
      try {
        if (permissionId && originalPermissionDescription !== undefined) {
          await prisma.quyen.update({
            where: { quyenId: permissionId },
            data: { moTa: originalPermissionDescription },
          });
        }
        const tenantIds = [companyAId, companyBId].filter((id): id is number =>
          Number.isSafeInteger(id),
        );
        const accountIds = [accountAId, accountBId].filter((id): id is number =>
          Number.isSafeInteger(id),
        );
        if (tenantIds.length || accountIds.length) {
          await prisma.$transaction(async (tx) => {
            if (tenantIds.length) {
              await tx.cauHinhQuyenVaiTroNhaXe.deleteMany({
                where: { nhaXeId: { in: tenantIds } },
              });
            }
            if (accountIds.length) {
              await tx.taiKhoanVaiTro.deleteMany({
                where: { taiKhoanId: { in: accountIds } },
              });
              await tx.nhanVien.deleteMany({
                where: { taiKhoanId: { in: accountIds } },
              });
              await tx.taiKhoan.deleteMany({
                where: { taiKhoanId: { in: accountIds } },
              });
            }
            if (tenantIds.length) {
              await tx.nhaXe.deleteMany({
                where: { nhaXeId: { in: tenantIds } },
              });
            }
          });
        }
      } finally {
        await prisma.$disconnect();
      }
    });

    it('adds the default once, preserves overrides, and reloads effective permissions from DB', async () => {
      const firstMappingCount = await prisma.vaiTroQuyen.count({
        where: { vaiTroId: adminRoleId, quyenId: permissionId },
      });
      expect(firstMappingCount).toBe(1);
      expect(
        await prisma.vaiTroQuyen.count({
          where: { vaiTroId: superAdminRoleId, quyenId: permissionId },
        }),
      ).toBe(0);

      const defaultSession = await authService.getCurrentSession(accountAId);
      expect(defaultSession.permissions).toContain('booking:read');

      const overriddenSession = await authService.getCurrentSession(accountBId);
      expect(overriddenSession.permissions).toEqual(['route:read']);

      await prisma.quyen.update({
        where: { quyenId: permissionId },
        data: { moTa: `preserved description ${suffix}` },
      });
      runRollout();
      runRollout();

      expect(
        await prisma.vaiTroQuyen
          .findMany({
            where: { vaiTroId: adminRoleId },
            select: { quyen: { select: { tenQuyen: true } } },
          })
          .then((rows) => rows.map(({ quyen }) => quyen.tenQuyen)),
      ).toEqual(expect.arrayContaining(originalAdminPermissionKeys));
      expect(
        await prisma.vaiTroQuyen.count({
          where: { vaiTroId: adminRoleId, quyenId: permissionId },
        }),
      ).toBe(1);
      expect(
        await prisma.quyen.findUnique({
          where: { quyenId: permissionId },
          select: { moTa: true },
        }),
      ).toEqual({ moTa: `preserved description ${suffix}` });
      expect(
        await prisma.cauHinhQuyenVaiTroNhaXeChiTiet
          .findMany({
            where: { nhaXeId: companyBId },
            select: { quyen: { select: { tenQuyen: true } } },
          })
          .then((rows) => rows.map(({ quyen }) => quyen.tenQuyen)),
      ).toEqual(['route:read']);

      await tenantPermissions.replaceOverride(companyAId, 'NHA_XE_ADMIN', [
        'route:read',
      ]);
      const refreshedSession = await authService.getCurrentSession(accountAId);
      expect(refreshedSession.permissions).toEqual(['route:read']);
    });
  },
);
