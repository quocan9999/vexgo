import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ADMIN_PERMISSION_CATALOG,
  ADMIN_ROLE_PERMISSION_SCOPE_BY_NAME,
  isPermissionAllowedForRole,
  type AdminManagedRoleName,
  type AdminPermissionScope,
} from '../auth/permissions/permission-catalog.js';
import { PrismaService } from '../prisma/prisma.service.js';

const ROLE_NAMES = Object.keys(
  ADMIN_ROLE_PERMISSION_SCOPE_BY_NAME,
) as AdminManagedRoleName[];

@Injectable()
export class AdminRbacService {
  constructor(private readonly prisma: PrismaService) {}

  async getDefaultRolePermissions() {
    const permissionKeys = ADMIN_PERMISSION_CATALOG.map(({ key }) => key);
    const [roles, permissions] = await Promise.all([
      this.prisma.vaiTro.findMany({
        where: { tenVaiTro: { in: ROLE_NAMES } },
        select: {
          tenVaiTro: true,
          moTa: true,
          vaiTroQuyens: {
            select: { quyen: { select: { tenQuyen: true } } },
          },
        },
      }),
      this.prisma.quyen.findMany({
        where: { tenQuyen: { in: permissionKeys } },
        select: { tenQuyen: true },
      }),
    ]);

    if (roles.length !== ROLE_NAMES.length || permissions.length !== permissionKeys.length) {
      this.throwConfigurationIncomplete();
    }

    const rolesByName = new Map(
      roles.map((role) => [role.tenVaiTro, role] as const),
    );

    return {
      permissions: ADMIN_PERMISSION_CATALOG,
      roles: ROLE_NAMES.map((roleName) => {
        const role = rolesByName.get(roleName);
        if (!role) this.throwConfigurationIncomplete();

        const assignedPermissionKeys = new Set(
          role.vaiTroQuyens.map(({ quyen }) => quyen.tenQuyen),
        );

        return {
          roleName,
          description: role.moTa,
          scope: ADMIN_ROLE_PERMISSION_SCOPE_BY_NAME[roleName],
          isProtected: roleName === 'SUPER_ADMIN',
          permissionKeys: ADMIN_PERMISSION_CATALOG.filter(
            ({ key }) =>
              assignedPermissionKeys.has(key) &&
              isPermissionAllowedForRole(roleName, key),
          ).map(({ key }) => key),
        };
      }),
    };
  }

  async replaceDefaultRolePermissions(
    roleName: string,
    permissionKeys: readonly string[],
  ) {
    const scope = this.getManagedRoleScope(roleName);
    this.validatePermissionKeys(roleName, permissionKeys);

    return this.prisma.$transaction(async (tx) => {
      const role = await tx.vaiTro.findUnique({
        where: { tenVaiTro: roleName },
        select: { vaiTroId: true, tenVaiTro: true, moTa: true },
      });
      if (!role) this.throwConfigurationIncomplete();

      // Serialize complete replacements for one role so the last committed
      // request cannot interleave its delete and insert with another request.
      await tx.$queryRaw<{ vaiTroId: number }[]>`
        SELECT vaiTroId
        FROM VaiTro
        WHERE vaiTroId = ${role.vaiTroId}
        FOR UPDATE
      `;

      const permissionRows = permissionKeys.length
        ? await tx.quyen.findMany({
            where: { tenQuyen: { in: [...permissionKeys] } },
            select: { quyenId: true, tenQuyen: true },
          })
        : [];

      if (permissionRows.length !== permissionKeys.length) {
        this.throwConfigurationIncomplete();
      }

      await tx.vaiTroQuyen.deleteMany({ where: { vaiTroId: role.vaiTroId } });
      if (permissionRows.length > 0) {
        await tx.vaiTroQuyen.createMany({
          data: permissionRows.map(({ quyenId }) => ({
            vaiTroId: role.vaiTroId,
            quyenId,
          })),
        });
      }

      return {
        roleName: role.tenVaiTro,
        description: role.moTa,
        scope,
        isProtected: roleName === 'SUPER_ADMIN',
        permissionKeys: [...permissionKeys],
      };
    });
  }

  private getManagedRoleScope(roleName: string): AdminPermissionScope {
    if (!Object.hasOwn(ADMIN_ROLE_PERMISSION_SCOPE_BY_NAME, roleName)) {
      throw new BadRequestException({
        error: 'ROLE_NOT_MANAGEABLE',
        message: 'Vai trò này không thuộc phạm vi cấu hình Admin RBAC.',
      });
    }

    return ADMIN_ROLE_PERMISSION_SCOPE_BY_NAME[
      roleName as AdminManagedRoleName
    ];
  }

  private validatePermissionKeys(
    roleName: string,
    permissionKeys: readonly string[],
  ): void {
    if (!Array.isArray(permissionKeys)) {
      throw new BadRequestException({
        error: 'INVALID_PERMISSION_LIST',
        message: 'Danh sách quyền phải là một mảng.',
      });
    }

    if (new Set(permissionKeys).size !== permissionKeys.length) {
      throw new BadRequestException({
        error: 'DUPLICATE_PERMISSION',
        message: 'Danh sách quyền không được chứa phần tử trùng lặp.',
      });
    }

    for (const permissionKey of permissionKeys) {
      if (
        !ADMIN_PERMISSION_CATALOG.some(({ key }) => key === permissionKey)
      ) {
        throw new BadRequestException({
          error: 'PERMISSION_NOT_IN_CATALOG',
          message: 'Quyền không tồn tại trong danh mục Admin RBAC.',
        });
      }
      if (!isPermissionAllowedForRole(roleName, permissionKey)) {
        throw new BadRequestException({
          error: 'PERMISSION_SCOPE_MISMATCH',
          message: 'Quyền không thuộc phạm vi của vai trò được chọn.',
        });
      }
    }
  }

  private throwConfigurationIncomplete(): never {
    throw new ServiceUnavailableException({
      error: 'RBAC_CONFIGURATION_INCOMPLETE',
      message:
        'Danh mục vai trò hoặc quyền chưa được khởi tạo đầy đủ. Hãy triển khai migration Admin RBAC.',
    });
  }
}
