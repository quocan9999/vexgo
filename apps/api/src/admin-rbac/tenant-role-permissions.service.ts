import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
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

    return this.getConfiguration(busCompany.nhaXeId);
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
}
