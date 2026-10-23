import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { EffectiveRolePermissionLoaderService } from '../../../src/auth/permissions/effective-role-permission-loader.service.js';
import { PermissionResolverService } from '../../../src/auth/permissions/permission-resolver.service.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';

const migration = readFileSync(new URL(
  '../../../../../prisma/migrations/20261023023000_add_revenue_read_to_existing_admin_overrides/migration.sql', import.meta.url,
), 'utf8').replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').trim();

describe('revenue permission rollout for existing overrides', () => {
  it('inserts only the new admin permission into existing headers without replacing other permissions', () => {
    // Unit-level SQL contract, not a MySQL migration execution test.
    expect(migration).toBe("START TRANSACTION; INSERT IGNORE INTO `CauHinhQuyenVaiTroNhaXeChiTiet` (`nhaXeId`, `vaiTroId`, `quyenId`) SELECT `config`.`nhaXeId`, `config`.`vaiTroId`, `permission`.`quyenId` FROM `CauHinhQuyenVaiTroNhaXe` AS `config` JOIN `VaiTro` AS `role` ON `role`.`vaiTroId` = `config`.`vaiTroId` JOIN `Quyen` AS `permission` ON `permission`.`tenQuyen` = 'revenue:read' WHERE `role`.`tenVaiTro` = 'NHA_XE_ADMIN'; COMMIT;");
  });

  it.each([{ previousKeys: [] as string[] }, { previousKeys: ['route:read'] }])('loads revenue after rollout for an admin override that existed before F12: $previousKeys', async ({ previousKeys }) => {
    const override = { vaiTroId: 2, chiTiets: previousKeys.map((tenQuyen) => ({ quyen: { tenQuyen } })) };
    const prisma = {
      vaiTroQuyen: { findMany: vi.fn().mockResolvedValue([
        { vaiTroId: 2, quyen: { tenQuyen: 'revenue:read' } },
        { vaiTroId: 2, quyen: { tenQuyen: 'vehicle:create' } },
      ]) },
      cauHinhQuyenVaiTroNhaXe: { findMany: vi.fn().mockImplementation(async ({ where }) => where.nhaXeId === 21 ? [override] : []) },
    };
    const loader = new EffectiveRolePermissionLoaderService(prisma as unknown as PrismaService);
    const role = [{ roleId: 2, roleName: 'NHA_XE_ADMIN' }];
    const resolver = new PermissionResolverService();
    const identity = { nhaXeId: 21, nhanVienId: 77 };
    expect(resolver.resolve(await loader.load(role, 21), identity)).not.toContain('revenue:read');
    // Fixture after the INSERT projection above: the existing override is
    // retained and only the new F12 permission is appended.
    override.chiTiets.push({ quyen: { tenQuyen: 'revenue:read' } });
    const permissions = resolver.resolve(await loader.load(role, 21), identity);
    expect(permissions).toContain('revenue:read');
    expect(permissions).toEqual(expect.arrayContaining(previousKeys));
    expect(permissions).not.toContain('vehicle:create');
    expect(prisma.cauHinhQuyenVaiTroNhaXe.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { nhaXeId: 21, vaiTroId: { in: [2] } },
    }));
  });
});
