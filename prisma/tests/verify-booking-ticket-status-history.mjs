import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../../apps/api/dist/generated/prisma/client.js';

function config() {
  const url = new URL(process.env.DATABASE_URL ?? process.env.MIGRATION_URL);
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\/+/, '')),
    allowPublicKeyRetrieval: true,
  };
}

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(config()) });

async function verify() {
  console.log('--- Verifying Booking & Ticket Status History DB Foundation ---');

  const [bookingCount, bHistoryCount, ticketCount, tHistoryCount] = await Promise.all([
    prisma.phieuDatVe.count(),
    prisma.lichSuTrangThaiPhieuDatVe.count(),
    prisma.ve.count(),
    prisma.lichSuTrangThaiVe.count(),
  ]);

  console.log(`PhieuDatVe count: ${bookingCount}, History count: ${bHistoryCount}`);
  console.log(`Ve count: ${ticketCount}, History count: ${tHistoryCount}`);

  if (bookingCount !== bHistoryCount) {
    throw new Error(`Booking history count mismatch: ${bHistoryCount} vs ${bookingCount}`);
  }
  if (ticketCount !== tHistoryCount) {
    throw new Error(`Ticket history count mismatch: ${tHistoryCount} vs ${ticketCount}`);
  }

  // Verify baseline fields for PhieuDatVe
  const invalidBookings = await prisma.lichSuTrangThaiPhieuDatVe.findMany({
    where: {
      OR: [
        { trangThaiCu: { not: null } },
        { nguonThayDoi: { not: 'SYSTEM' } },
        { taiKhoanId: { not: null } },
        { laOverride: true },
        { lyDo: { not: 'Khởi tạo lịch sử trạng thái từ dữ liệu hiện có' } },
      ],
    },
  });

  if (invalidBookings.length > 0) {
    throw new Error(`Found ${invalidBookings.length} invalid booking baseline records`);
  }

  // Verify baseline fields for Ve
  const invalidTickets = await prisma.lichSuTrangThaiVe.findMany({
    where: {
      OR: [
        { trangThaiCu: { not: null } },
        { nguonThayDoi: { not: 'SYSTEM' } },
        { taiKhoanId: { not: null } },
        { laOverride: true },
        { lyDo: { not: 'Khởi tạo lịch sử trạng thái từ dữ liệu hiện có' } },
      ],
    },
  });

  if (invalidTickets.length > 0) {
    throw new Error(`Found ${invalidTickets.length} invalid ticket baseline records`);
  }

  // Check unique maThaoTac
  const bDistinctOps = await prisma.$queryRawUnsafe(
    'SELECT COUNT(DISTINCT maThaoTac) as c FROM LichSuTrangThaiPhieuDatVe',
  );
  const tDistinctOps = await prisma.$queryRawUnsafe(
    'SELECT COUNT(DISTINCT maThaoTac) as c FROM LichSuTrangThaiVe',
  );

  const bOpCount = Number(bDistinctOps[0].c);
  const tOpCount = Number(tDistinctOps[0].c);

  if (bOpCount !== bookingCount) {
    throw new Error(`Booking maThaoTac uniqueness violated: ${bOpCount} unique vs ${bookingCount} total`);
  }
  if (tOpCount !== ticketCount) {
    throw new Error(`Ticket maThaoTac uniqueness violated: ${tOpCount} unique vs ${ticketCount} total`);
  }

  console.log('✔ All baseline records, counts, and invariants verified successfully!');
}

verify()
  .catch((err) => {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
