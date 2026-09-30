import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import {
  ADMIN_PERMISSION_CATALOG,
  ADMIN_ROLE_PERMISSION_SCOPE_BY_NAME,
  isPermissionAllowedForRole,
} from '../auth/permissions/permission-catalog.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TENANT_RBAC_ROLE_NAMES } from './tenant-role-permissions.constants.js';

const TENANT_PERMISSION_CATALOG = ADMIN_PERMISSION_CATALOG.filter(
  ({ scope }) => scope === 'tenant',
);
const TENANT_PERMISSION_KEYS = TENANT_PERMISSION_CATALOG.map(({ key }) => key);

@Injectable()
export class TenantRolePermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPlatformTenantConfiguration(nhaXeId: number) {
    return this.getConfiguration(await this.requireExistingTenantId(nhaXeId));
  }

  async replaceOverride(
    nhaXeId: number,
    roleName: string,
    permissionKeys: readonly string[],
  ) {
    this.validateTenantRoleAndPermissions(roleName, permissionKeys);

    await this.prisma.$transaction(async (tx) => {
      const lockedTenants = await tx.$queryRaw<Array<{ nhaXeId: number }>>`
        SELECT nhaXeId
        FROM NhaXe
        WHERE nhaXeId = ${nhaXeId}
        FOR UPDATE
      `;
      if (lockedTenants.length !== 1) {
        throw new NotFoundException({
          error: 'BUS_COMPANY_NOT_FOUND',
          message: 'Không tìm thấy nhà xe.',
        });
      }

      const { role, permissions: canonicalPermissionRows } =
        await this.requireCanonicalTenantConfiguration(tx, roleName);
      const permissionRows = canonicalPermissionRows.filter(({ tenQuyen }) =>
        permissionKeys.includes(tenQuyen),
      );
      if (permissionRows.length !== permissionKeys.length) {
        this.throwConfigurationIncomplete();
      }

      await tx.cauHinhQuyenVaiTroNhaXe.upsert({
        where: {
          nhaXeId_vaiTroId: { nhaXeId, vaiTroId: role.vaiTroId },
        },
        create: { nhaXeId, vaiTroId: role.vaiTroId },
        update: {},
      });
      await tx.cauHinhQuyenVaiTroNhaXeChiTiet.deleteMany({
        where: { nhaXeId, vaiTroId: role.vaiTroId },
      });
      if (permissionRows.length > 0) {
        await tx.cauHinhQuyenVaiTroNhaXeChiTiet.createMany({
          data: permissionRows.map(({ quyenId }) => ({
            nhaXeId,
            vaiTroId: role.vaiTroId,
            quyenId,
          })),
        });
      }
    });

    return this.getRoleConfiguration(nhaXeId, roleName);
  }

  async replacePlatformTenantOverride(
    nhaXeId: number,
    roleName: string,
    permissionKeys: readonly string[],
  ) {
    const tenantId = await this.requireExistingTenantId(nhaXeId);
    return this.replaceOverride(tenantId, roleName, permissionKeys);
  }

  async resetOverride(nhaXeId: number, roleName: string) {
    this.validateTenantRoleAndPermissions(roleName, []);

    await this.prisma.$transaction(async (tx) => {
      const lockedTenants = await tx.$queryRaw<Array<{ nhaXeId: number }>>`
        SELECT nhaXeId
        FROM NhaXe
        WHERE nhaXeId = ${nhaXeId}
        FOR UPDATE
      `;
      if (lockedTenants.length !== 1) {
        throw new NotFoundException({
          error: 'BUS_COMPANY_NOT_FOUND',
          message: 'Không tìm thấy nhà xe.',
        });
      }

      const { role } = await this.requireCanonicalTenantConfiguration(
        tx,
        roleName,
      );

      await tx.cauHinhQuyenVaiTroNhaXe.deleteMany({
        where: { nhaXeId, vaiTroId: role.vaiTroId },
      });
    });

    return this.getRoleConfiguration(nhaXeId, roleName);
  }

  async resetPlatformTenantOverride(nhaXeId: number, roleName: string) {
    const tenantId = await this.requireExistingTenantId(nhaXeId);
    return this.resetOverride(tenantId, roleName);
  }

  async getConfiguration(nhaXeId: number) {
    const [roles, permissions] = await Promise.all([
      this.prisma.vaiTro.findMany({
        where: { tenVaiTro: { in: [...TENANT_RBAC_ROLE_NAMES] } },
        select: {
          vaiTroId: true,
          tenVaiTro: true,
          moTa: true,
          vaiTroQuyens: {
            select: { quyen: { select: { tenQuyen: true } } },
          },
        },
      }),
      this.prisma.quyen.findMany({
        where: { tenQuyen: { in: TENANT_PERMISSION_KEYS } },
        select: { tenQuyen: true },
      }),
    ]);

    if (
      roles.length !== TENANT_RBAC_ROLE_NAMES.length ||
      permissions.length !== TENANT_PERMISSION_KEYS.length
    ) {
      this.throwConfigurationIncomplete();
    }

    const roleIds = roles.map(({ vaiTroId }) => vaiTroId);
    const overrides = await this.prisma.cauHinhQuyenVaiTroNhaXe.findMany({
      where: { nhaXeId, vaiTroId: { in: roleIds } },
      select: {
        vaiTroId: true,
        chiTiets: {
          select: { quyen: { select: { tenQuyen: true } } },
        },
      },
    });
    const overridesByRoleId = new Map(
      overrides.map(
        ({ vaiTroId, chiTiets }) =>
          [
            vaiTroId,
            new Set(chiTiets.map(({ quyen }) => quyen.tenQuyen)),
          ] as const,
      ),
    );
    const rolesByName = new Map(
      roles.map((role) => [role.tenVaiTro, role] as const),
    );

    return {
      permissions: TENANT_PERMISSION_CATALOG,
      roles: TENANT_RBAC_ROLE_NAMES.map((roleName) => {
        const role = rolesByName.get(roleName);
        if (!role) this.throwConfigurationIncomplete();

        const defaultPermissionSet = new Set(
          role.vaiTroQuyens.map(({ quyen }) => quyen.tenQuyen),
        );
        const overridePermissionSet = overridesByRoleId.get(role.vaiTroId);
        const isOverridden = overridesByRoleId.has(role.vaiTroId);
        const defaultPermissionKeys = TENANT_PERMISSION_CATALOG.filter(
          ({ key }) =>
            defaultPermissionSet.has(key) &&
            isPermissionAllowedForRole(roleName, key),
        ).map(({ key }) => key);
        const overridePermissionKeys = isOverridden
          ? TENANT_PERMISSION_CATALOG.filter(
              ({ key }) =>
                overridePermissionSet?.has(key) &&
                isPermissionAllowedForRole(roleName, key),
            ).map(({ key }) => key)
          : null;

        return {
          roleName,
          description: role.moTa,
          scope: ADMIN_ROLE_PERMISSION_SCOPE_BY_NAME[roleName],
          isProtected: false,
          defaultPermissionKeys,
          overridePermissionKeys,
          effectivePermissionKeys:
            overridePermissionKeys ?? defaultPermissionKeys,
          source: isOverridden ? 'override' : 'global',
        };
      }),
    };
  }

  private throwConfigurationIncomplete(): never {
    throw new ServiceUnavailableException({
      error: 'RBAC_CONFIGURATION_INCOMPLETE',
      message:
        'Danh mục vai trò hoặc quyền chưa được khởi tạo đầy đủ. Hãy triển khai migration Admin RBAC.',
    });
  }

  private async getRoleConfiguration(nhaXeId: number, roleName: string) {
    const configuration = await this.getConfiguration(nhaXeId);
    const role = configuration.roles.find((item) => item.roleName === roleName);
    if (!role) this.throwConfigurationIncomplete();
    return role;
  }

  private async requireCanonicalTenantConfiguration(
    tx: Prisma.TransactionClient,
    roleName: string,
  ) {
    const [roles, permissions] = await Promise.all([
      tx.vaiTro.findMany({
        where: { tenVaiTro: { in: [...TENANT_RBAC_ROLE_NAMES] } },
        select: { vaiTroId: true, tenVaiTro: true },
      }),
      tx.quyen.findMany({
        where: { tenQuyen: { in: TENANT_PERMISSION_KEYS } },
        select: { quyenId: true, tenQuyen: true },
      }),
    ]);

    if (
      roles.length !== TENANT_RBAC_ROLE_NAMES.length ||
      permissions.length !== TENANT_PERMISSION_KEYS.length
    ) {
      this.throwConfigurationIncomplete();
    }

    const role = roles.find((item) => item.tenVaiTro === roleName);
    if (!role) this.throwConfigurationIncomplete();

    return { role, permissions };
  }

  private validateTenantRoleAndPermissions(
    roleName: string,
    permissionKeys: readonly string[],
  ): void {
    if (!TENANT_RBAC_ROLE_NAMES.includes(roleName as never)) {
      throw new BadRequestException({
        error: 'ROLE_NOT_MANAGEABLE',
        message: 'Vai trò này không thuộc phạm vi cấu hình RBAC nhà xe.',
      });
    }

    if (new Set(permissionKeys).size !== permissionKeys.length) {
      throw new BadRequestException({
        error: 'DUPLICATE_PERMISSION',
        message: 'Danh sách quyền không được chứa phần tử trùng lặp.',
      });
    }

    for (const permissionKey of permissionKeys) {
      const isTenantPermission = TENANT_PERMISSION_CATALOG.some(
        ({ key }) => key === permissionKey,
      );
      if (!isTenantPermission) {
        throw new BadRequestException({
          error: 'PERMISSION_SCOPE_MISMATCH',
          message: 'Quyền không thuộc phạm vi nhà xe.',
        });
      }
    }
  }

  private async requireExistingTenantId(nhaXeId: number): Promise<number> {
    const busCompany = await this.prisma.nhaXe.findUnique({
      where: { nhaXeId },
      select: { nhaXeId: true },
    });
    if (!busCompany) {
      throw new NotFoundException({
        error: 'BUS_COMPANY_NOT_FOUND',
        message: 'Không tìm thấy nhà xe.',
      });
    }
    return busCompany.nhaXeId;
  }
}
