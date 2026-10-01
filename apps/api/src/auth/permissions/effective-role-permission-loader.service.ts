import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TENANT_PRINCIPAL_ROLES } from '../principal-scope.js';
import type { RolePermissionAssignment } from './permission-resolver.service.js';

export interface RoleReference {
  roleId: number;
  roleName: string;
}

@Injectable()
export class EffectiveRolePermissionLoaderService {
  private readonly tenantRoles = new Set<string>(TENANT_PRINCIPAL_ROLES);

  constructor(private readonly prisma: PrismaService) {}

  async load(
    roleReferences: readonly RoleReference[],
    nhaXeId: number | null,
  ): Promise<RolePermissionAssignment[]> {
    const roleIds = [
      ...new Set(
        roleReferences
          .map(({ roleId }) => roleId)
          .filter((roleId) => Number.isSafeInteger(roleId) && roleId > 0),
      ),
    ];
    if (roleIds.length === 0) {
      return roleReferences.map(({ roleName }) => ({
        roleName,
        permissions: [],
      }));
    }

    const globalMappings = await this.prisma.vaiTroQuyen.findMany({
      where: { vaiTroId: { in: roleIds } },
      select: {
        vaiTroId: true,
        quyen: { select: { tenQuyen: true } },
      },
    });
    const globalPermissions = new Map<number, string[]>();
    for (const mapping of globalMappings) {
      const permissions = globalPermissions.get(mapping.vaiTroId) ?? [];
      permissions.push(mapping.quyen.tenQuyen);
      globalPermissions.set(mapping.vaiTroId, permissions);
    }

    const tenantRoleIds =
      Number.isSafeInteger(nhaXeId) && (nhaXeId ?? 0) > 0
        ? [
            ...new Set(
              roleReferences
                .filter(
                  ({ roleId, roleName }) =>
                    Number.isSafeInteger(roleId) &&
                    roleId > 0 &&
                    this.tenantRoles.has(roleName),
                )
                .map(({ roleId }) => roleId),
            ),
          ]
        : [];

    const tenantOverrides = new Map<number, string[]>();
    if (tenantRoleIds.length > 0) {
      const overrideRows = await this.prisma.cauHinhQuyenVaiTroNhaXe.findMany({
        where: {
          nhaXeId: nhaXeId as number,
          vaiTroId: { in: tenantRoleIds },
        },
        select: {
          vaiTroId: true,
          chiTiets: {
            select: { quyen: { select: { tenQuyen: true } } },
          },
        },
      });
      for (const override of overrideRows) {
        tenantOverrides.set(
          override.vaiTroId,
          override.chiTiets.map(({ quyen }) => quyen.tenQuyen),
        );
      }
    }

    return roleReferences.map(({ roleId, roleName }) => ({
      roleName,
      permissions: tenantOverrides.has(roleId)
        ? (tenantOverrides.get(roleId) ?? [])
        : (globalPermissions.get(roleId) ?? []),
    }));
  }
}
