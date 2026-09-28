import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../apps/api/dist/generated/prisma/client.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for auth E2E seed');

const url = new URL(databaseUrl);
if (url.protocol !== 'mysql:') {
  throw new Error('Auth E2E seed URL must use mysql: protocol');
}

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\/+/, '')),
    allowPublicKeyRetrieval: true,
  }),
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
