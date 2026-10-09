import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../apps/api/dist/generated/prisma/client.js';
import {
  ADMIN_PERMISSION_CATALOG,
  ADMIN_ROLE_DEFAULT_PERMISSION_KEYS,
} from '../apps/api/dist/auth/permissions/permission-catalog.js';

export async function syncPermissions(prismaClient) {
  const db = prismaClient ?? new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL) });
  const results = {
    permissionsUpserted: 0,
    rolePermissionsUpserted: 0,
  };

  try {
    for (const definition of ADMIN_PERMISSION_CATALOG) {
      await db.quyen.upsert({
        where: { tenQuyen: definition.key },
        create: { tenQuyen: definition.key, moTa: definition.description },
        update: { moTa: definition.description },
      });
      results.permissionsUpserted += 1;
    }

    const roles = await db.vaiTro.findMany();
    const roleByName = new Map(roles.map((r) => [r.tenVaiTro, r]));

    for (const [roleName, permissionKeys] of Object.entries(ADMIN_ROLE_DEFAULT_PERMISSION_KEYS)) {
      const role = roleByName.get(roleName);
      if (!role || permissionKeys.length === 0) continue;

      for (const key of permissionKeys) {
        const permission = await db.quyen.findUnique({ where: { tenQuyen: key } });
        if (!permission) continue;

        await db.vaiTroQuyen.upsert({
          where: {
            vaiTroId_quyenId: {
              vaiTroId: role.vaiTroId,
              quyenId: permission.quyenId,
            },
          },
          create: {
            vaiTroId: role.vaiTroId,
            quyenId: permission.quyenId,
          },
          update: {},
        });
        results.rolePermissionsUpserted += 1;
      }
    }

    return results;
  } finally {
    if (!prismaClient) {
      await db.$disconnect();
    }
  }
}

if (process.argv[1]?.endsWith('sync-permissions.mjs')) {
  syncPermissions()
    .then((res) => {
      console.log('Permission sync completed successfully:', res);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Permission sync failed:', err);
      process.exit(1);
    });
}
