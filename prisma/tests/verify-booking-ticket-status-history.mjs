import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../../apps/api/dist/generated/prisma/client.js';
import {
  assertHistoryDataValid,
  countBaselineShapedRecords,
} from './booking-ticket-status-history-invariants.mjs';

loadDotenv();
loadDotenv({ path: resolve(process.cwd(), '.env.test') });

const TEST_DATABASE_ENV = 'BOOKING_TICKET_STATUS_HISTORY_TEST_DATABASE_URL';
const TEST_DATABASE_NAME = /^vexgo_booking_ticket_status_history_[a-z0-9_]*_test$/i;

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

async function verify() {
  console.log('--- Verifying booking/ticket history data in an isolated test database ---');

  const [bookingCount, ticketCount, bookingHistory, ticketHistory] = await Promise.all([
    prisma.phieuDatVe.count(),
    prisma.ve.count(),
    prisma.lichSuTrangThaiPhieuDatVe.findMany(),
    prisma.lichSuTrangThaiVe.findMany(),
  ]);

  if (bookingCount === 0 || ticketCount === 0) {
    console.error(
      `Dataset is empty or incomplete for verification (PhieuDatVe=${bookingCount}, Ve=${ticketCount}); no migration/backfill correctness is established.`,
    );
    throw new Error('Verifier requires at least one booking and one ticket.');
  }
  if (bookingHistory.length === 0 || ticketHistory.length === 0) {
    throw new Error(
      `Dataset is incomplete for verification (booking histories=${bookingHistory.length}, ticket histories=${ticketHistory.length}); baseline/backfill correctness is not established.`,
    );
  }

  assertHistoryDataValid(bookingHistory, ticketHistory);

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
