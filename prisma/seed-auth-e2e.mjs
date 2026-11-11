import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../apps/api/dist/generated/prisma/client.js';
import { databaseConfig } from './lib/db-config.mjs';

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(databaseConfig(process.env.DATABASE_URL)),
});

try {
  await prisma.vaiTro.upsert({
    where: { tenVaiTro: 'KHACH_HANG' },
    create: { tenVaiTro: 'KHACH_HANG', moTa: 'Khách hàng' },
    update: {},
  });
} finally {
  await prisma.$disconnect();
}
