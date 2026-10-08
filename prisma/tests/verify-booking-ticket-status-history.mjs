import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../../apps/api/dist/generated/prisma/client.js';

loadDotenv();
loadDotenv({ path: resolve(process.cwd(), '.env.test') });

const TEST_DATABASE_ENV = 'BOOKING_TICKET_STATUS_HISTORY_TEST_DATABASE_URL';
const TEST_DATABASE_NAME = /^vexgo_booking_ticket_status_history_[a-z0-9_]*_test$/i;
const UUID_V1_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-1[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BACKFILL_REASON = 'Khởi tạo lịch sử trạng thái từ dữ liệu hiện có';

function testDatabaseConfig() {
  const configuredUrl = process.env[TEST_DATABASE_ENV];
  if (!configuredUrl) {
    throw new Error(`${TEST_DATABASE_ENV} is required; verifier never uses DATABASE_URL.`);
  }

  let url;
  try {
    url = new URL(configuredUrl);
  } catch {
    throw new Error(`${TEST_DATABASE_ENV} must be a valid MySQL URL.`);
  }

  const database = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
  if (url.protocol !== 'mysql:' || !TEST_DATABASE_NAME.test(database)) {
    throw new Error(
      `${TEST_DATABASE_ENV} must target a dedicated vexgo_booking_ticket_status_history_*_test schema.`,
    );
  }

  const host = url.hostname.toLowerCase();
  const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
  if (
    !localHosts.has(host) &&
    process.env.BOOKING_TICKET_STATUS_HISTORY_ALLOW_REMOTE_TEST_DATABASE !== 'true'
  ) {
    throw new Error(
      'Remote test database blocked. Set BOOKING_TICKET_STATUS_HISTORY_ALLOW_REMOTE_TEST_DATABASE=true only for a dedicated test server.',
    );
  }

  const target = {
    host,
    port: Number(url.port || 3306),
    database: database.toLowerCase(),
  };
  for (const name of ['DATABASE_URL', 'MIGRATION_URL', 'SHADOW_DATABASE_URL']) {
    const value = process.env[name];
    if (!value) continue;
    const other = new URL(value);
    if (
      target.host === other.hostname.toLowerCase() &&
      target.port === Number(other.port || 3306) &&
      target.database === decodeURIComponent(other.pathname.replace(/^\/+/, '')).toLowerCase()
    ) {
      throw new Error(`${TEST_DATABASE_ENV} must not point to ${name}.`);
    }
  }

  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    allowPublicKeyRetrieval: true,
  };
}

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(testDatabaseConfig()),
});

function isValidHistory(record) {
  const actorMatchesSource =
    ['CUSTOMER', 'STAFF'].includes(record.nguonThayDoi)
      ? record.taiKhoanId !== null
      : record.nguonThayDoi === 'SYSTEM' && record.taiKhoanId === null;

  return (
    UUID_V1_PATTERN.test(record.maThaoTac) &&
    ['CUSTOMER', 'STAFF', 'SYSTEM'].includes(record.nguonThayDoi) &&
    actorMatchesSource &&
    (!record.laOverride || record.nguonThayDoi === 'STAFF') &&
    (record.trangThaiCu === null || record.trangThaiCu !== record.trangThaiMoi)
  );
}

function countBaselineShapedRecords(records) {
  return records.filter(
    (record) =>
      record.trangThaiCu === null &&
      record.nguonThayDoi === 'SYSTEM' &&
      record.taiKhoanId === null &&
      !record.laOverride &&
      record.lyDo === BACKFILL_REASON,
  ).length;
}

function assertUniqueWithinEntity(records, entityIdField, label) {
  const seen = new Set();
  for (const record of records) {
    const key = `${record[entityIdField]}\u0000${record.maThaoTac}`;
    if (seen.has(key)) {
      throw new Error(`${label} repeats maThaoTac for the same entity.`);
    }
    seen.add(key);
  }
}

async function verify() {
  console.log('--- Verifying booking/ticket history data in an isolated test database ---');

  const [bookingCount, ticketCount, bookingHistory, ticketHistory] = await Promise.all([
    prisma.phieuDatVe.count(),
    prisma.ve.count(),
    prisma.lichSuTrangThaiPhieuDatVe.findMany(),
    prisma.lichSuTrangThaiVe.findMany(),
  ]);

  assertUniqueWithinEntity(
    bookingHistory,
    'phieuDatVeId',
    'LichSuTrangThaiPhieuDatVe',
  );
  assertUniqueWithinEntity(ticketHistory, 'veId', 'LichSuTrangThaiVe');

  const invalidBookings = bookingHistory.filter((record) => !isValidHistory(record));
  const invalidTickets = ticketHistory.filter((record) => !isValidHistory(record));
  if (invalidBookings.length > 0 || invalidTickets.length > 0) {
    throw new Error(
      `Invalid history rows: ${invalidBookings.length} booking, ${invalidTickets.length} ticket.`,
    );
  }

  console.log(
    `PhieuDatVe=${bookingCount}; booking histories=${bookingHistory.length}; baseline-shaped=${countBaselineShapedRecords(bookingHistory)}; transitions=${bookingHistory.filter((record) => record.trangThaiCu !== null).length}`,
  );
  console.log(
    `Ve=${ticketCount}; ticket histories=${ticketHistory.length}; baseline-shaped=${countBaselineShapedRecords(ticketHistory)}; transitions=${ticketHistory.filter((record) => record.trangThaiCu !== null).length}`,
  );
  console.log(
    'Verified UUID v1, source/account, override, transition, and per-entity operation uniqueness for every history row.',
  );
  console.log(
    'History counts may exceed entity counts. Baseline-shaped counts are informational; migration cohort assertions run against captured pre-migration fixture IDs.',
  );
}

verify()
  .catch((error) => {
    console.error('❌ Verification failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
