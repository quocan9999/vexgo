import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../apps/api/dist/generated/prisma/client.js';
import { demoRevenueFields, isDemoRevenueOrder } from './demo-revenue.mjs';

// Explicit opt-in: this is demo data preparation, not a production migration.
const args = process.argv.slice(2);
const expectedDatabase = args.find((arg) => arg.startsWith('--database='))?.slice(11);
const backupDirectory = args.find((arg) => arg.startsWith('--backup-dir='))?.slice(13);
const apply = args.includes('--apply');
const url = new URL(process.env.DATABASE_URL);
const database = decodeURIComponent(url.pathname.slice(1));
if (url.protocol !== 'mysql:' || !['localhost', '127.0.0.1'].includes(url.hostname) ||
    database !== expectedDatabase || !['vexgo', 'vexgo_feature12'].includes(database)) {
  throw new Error('Provide --database matching an allowed local demo database.');
}
if (apply && (!backupDirectory || !path.isAbsolute(backupDirectory))) {
  throw new Error('--apply requires an absolute --backup-dir.');
}
const prisma = new PrismaClient({ adapter: new PrismaMariaDb({
  host: url.hostname, port: Number(url.port || 3306),
  user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
  database, allowPublicKeyRetrieval: true,
}) });

try {
  await prisma.$transaction(async (db) => {
    const orders = await db.donGiaoDich.findMany({ orderBy: { donGiaoDichId: 'asc' } });
    const changes = [];
    const skipped = [];
    for (const order of orders.filter((row) => isDemoRevenueOrder(row.maDonGiaoDich))) {
      if (apply) await db.$queryRaw`SELECT donGiaoDichId FROM DonGiaoDich WHERE donGiaoDichId = ${order.donGiaoDichId} FOR UPDATE`;
      const payments = await db.thanhToan.findMany({ where: { donGiaoDichId: order.donGiaoDichId }, orderBy: { thanhToanId: 'asc' } });
      for (const payment of payments) {
        if (payment.thoiDiemHoanTat || payment.laQuyetToanHopLe || payment.maGiaoDichSePay || payment.trangThai !== 'THANH_CONG') continue;
        const data = await demoRevenueFields(db, payment);
        if (!data.thoiDiemHoanTat) {
          skipped.push({ thanhToanId: payment.thanhToanId, order: order.maDonGiaoDich, reason: 'Không đủ điều kiện demo F12: kiểm tra tiền, đơn, vé hoặc giao dịch trùng.' });
          continue;
        }
        changes.push({ before: payment, data });
      }
    }
    let backup;
    if (apply && changes.length) {
      await mkdir(backupDirectory, { recursive: true });
      backup = path.join(backupDirectory, `demo-revenue-${database}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
      await writeFile(backup, JSON.stringify({ database, synthetic: true, changes }, null, 2), { flag: 'wx' });
      for (const { before, data } of changes) {
        const result = await db.thanhToan.updateMany({
          where: { thanhToanId: before.thanhToanId, updatedAt: before.updatedAt, trangThai: 'THANH_CONG', thoiDiemHoanTat: null, laQuyetToanHopLe: false, maGiaoDichSePay: null },
          data,
        });
        if (result.count !== 1) throw new Error('Concurrent payment change; transaction rolled back.');
      }
    }
    console.log(JSON.stringify({ mode: apply ? 'apply' : 'preview', database, sales: changes.filter((row) => row.data.laQuyetToanHopLe).length, refunds: changes.filter((row) => !row.data.laQuyetToanHopLe).length, skipped, backup }, null, 2));
  }, { timeout: 30_000 });
} finally {
  await prisma.$disconnect();
}
