import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../../apps/api/dist/generated/prisma/client.js';

export const LUGGAGE_RATE_PERMISSIONS = [
  {
    key: 'luggage-rate:read',
    description: 'Xem cấu hình cước hành lý nhà xe.',
  },
  {
    key: 'luggage-rate:update',
    description: 'Cập nhật cấu hình cước hành lý nhà xe.',
  },
];

function config() {
  const connectionUrl = process.env.DATABASE_URL ?? process.env.MIGRATION_URL;
  if (!connectionUrl) {
    throw new Error('DATABASE_URL or MIGRATION_URL is required.');
  }

  const url = new URL(connectionUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\/+/, '')),
    allowPublicKeyRetrieval: true,
  };
}

export async function rolloutLuggageRatePermissions(prisma) {
  return prisma.$transaction(async (tx) => {
    const permissions = [];
    for (const p of LUGGAGE_RATE_PERMISSIONS) {
      const permission = await tx.quyen.upsert({
        where: { tenQuyen: p.key },
        update: { moTa: p.description },
        create: {
          tenQuyen: p.key,
          moTa: p.description,
        },
        select: { quyenId: true, tenQuyen: true },
      });
      permissions.push(permission);
    }

    const adminRole = await tx.vaiTro.findUnique({
      where: { tenVaiTro: 'NHA_XE_ADMIN' },
      select: { vaiTroId: true },
    });

    if (!adminRole) {
      throw new Error('Canonical role NHA_XE_ADMIN was not found.');
    }

    await tx.vaiTroQuyen.createMany({
      data: permissions.map((p) => ({
        vaiTroId: adminRole.vaiTroId,
        quyenId: p.quyenId,
      })),
      skipDuplicates: true,
    });

    const existingAdminOverrides = await tx.cauHinhQuyenVaiTroNhaXe.findMany({
      where: { vaiTroId: adminRole.vaiTroId },
      select: { nhaXeId: true, vaiTroId: true },
    });

    let updatedOverrideCount = 0;
    if (existingAdminOverrides.length > 0) {
      const overrideData = [];
      for (const configRow of existingAdminOverrides) {
        for (const p of permissions) {
          overrideData.push({
            nhaXeId: configRow.nhaXeId,
            vaiTroId: configRow.vaiTroId,
            quyenId: p.quyenId,
          });
        }
      }
      const result = await tx.cauHinhQuyenVaiTroNhaXeChiTiet.createMany({
        data: overrideData,
        skipDuplicates: true,
      });
      updatedOverrideCount = result.count;
    }

    return {
      permissionIds: permissions.map((p) => p.quyenId),
      adminRoleId: adminRole.vaiTroId,
      existingAdminOverrides: existingAdminOverrides.length,
      insertedAdminOverrideDetails: updatedOverrideCount,
    };
  });
}

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaMariaDb(config()) });
  try {
    await prisma.$connect();
    const result = await rolloutLuggageRatePermissions(prisma);
    console.log('Rolled out luggage-rate permissions:', result);
  } finally {
    await prisma.$disconnect();
  }
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
