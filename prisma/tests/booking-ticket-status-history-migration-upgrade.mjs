import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../../apps/api/dist/generated/prisma/client.js';
import { BACKFILL_REASON, UUID_V1_PATTERN } from './booking-ticket-status-history-invariants.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');
const migrationsRoot = path.join(repoRoot, 'prisma/migrations');
const prismaCli = path.join(repoRoot, 'node_modules/prisma/build/index.js');
const migrationName = '20261008040000_add_booking_and_ticket_status_histories';
const harnessAdminUrlEnv = 'BOOKING_TICKET_STATUS_HISTORY_HARNESS_ADMIN_DATABASE_URL';
const targetDatabasePattern =
  /^vexgo_booking_ticket_status_history_(?:empty|cohort)_[a-f0-9]{8}_test$/;
const shadowDatabasePattern = /^vexgo_history_shadow_[a-f0-9]{8}$/;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseMySqlUrl(value, name) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid MySQL URL.`);
  }
  if (url.protocol !== 'mysql:') throw new Error(`${name} must use mysql:`);
  return {
    url,
    host: url.hostname.toLowerCase(),
    port: Number(url.port || 3306),
    database: decodeURIComponent(url.pathname.replace(/^\/+/, '')),
  };
}

function connectionConfig(url) {
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\/+/, '')),
    allowPublicKeyRetrieval: true,
  };
}

function urlForDatabase(connectionUrl, database) {
  const url = new URL(connectionUrl);
  url.pathname = `/${database}`;
  return url.toString();
}

function scratchDatabaseName(label) {
  return `vexgo_booking_ticket_status_history_${label}_${randomBytes(4).toString('hex')}_test`;
}

function newPrisma(connectionUrl) {
  return new PrismaClient({
    adapter: new PrismaMariaDb(connectionConfig(new URL(connectionUrl))),
  });
}

async function createDatabase(admin, database) {
  assert(
    targetDatabasePattern.test(database) || shadowDatabasePattern.test(database),
    `Refusing to create unexpected schema ${database}.`,
  );
  await admin.$executeRawUnsafe(
    `CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
}

async function dropDatabase(admin, database) {
  assert(
    targetDatabasePattern.test(database) || shadowDatabasePattern.test(database),
    `Refusing to drop unexpected schema ${database}.`,
  );
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS \`${database}\``);
}

async function cleanupCase({ prisma, admin, database, databaseCreated, shadow, shadowCreated, tempRoot }) {
  const failures = [];
  try {
    if (prisma) await prisma.$disconnect();
  } catch (error) {
    failures.push(error);
  }
  try {
    if (databaseCreated) await dropDatabase(admin, database);
  } catch (error) {
    failures.push(error);
  }
  try {
    if (shadowCreated) await dropDatabase(admin, shadow);
  } catch (error) {
    failures.push(error);
  }
  try {
    await admin.$disconnect();
  } catch (error) {
    failures.push(error);
  }
  try {
    if (
      path.dirname(tempRoot) === path.join(repoRoot, 'prisma') &&
      path.basename(tempRoot).startsWith('.booking-ticket-status-history-upgrade-')
    ) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  } catch (error) {
    failures.push(error);
  }
  if (failures.length > 0) {
    throw new AggregateError(failures, 'Could not clean up all booking/ticket history harness resources.');
  }
}

function migrationConfigText(schemaMigrationsPath) {
  const schemaPath = path.join(repoRoot, 'prisma/schema.prisma').replaceAll('\\', '/');
  const migrationsPath = schemaMigrationsPath.replaceAll('\\', '/');
  return `import { defineConfig, env } from 'prisma/config';\n\nexport default defineConfig({\n  schema: ${JSON.stringify(schemaPath)},\n  migrations: { path: ${JSON.stringify(migrationsPath)} },\n  datasource: { url: env('MIGRATION_URL'), shadowDatabaseUrl: env('SHADOW_DATABASE_URL') },\n});\n`;
}

function copyMigrationSet(destination, includeHistoryMigration) {
  fs.mkdirSync(destination, { recursive: true });
  fs.copyFileSync(
    path.join(migrationsRoot, 'migration_lock.toml'),
    path.join(destination, 'migration_lock.toml'),
  );
  const migrationDirectories = fs
    .readdirSync(migrationsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name < migrationName)
    .map((entry) => entry.name)
    .sort();
  assert(migrationDirectories.length > 0, 'No migrations were found before the history migration.');

  for (const name of migrationDirectories) {
    fs.cpSync(path.join(migrationsRoot, name), path.join(destination, name), { recursive: true });
  }
  if (includeHistoryMigration) {
    fs.cpSync(
      path.join(migrationsRoot, migrationName),
      path.join(destination, migrationName),
      { recursive: true },
    );
  }
}

function prepareMigrationConfig(tempRoot) {
  const beforePath = path.join(tempRoot, 'migrations-before-history');
  const throughPath = path.join(tempRoot, 'migrations-through-history');
  copyMigrationSet(beforePath, false);
  copyMigrationSet(throughPath, true);
  const beforeConfig = path.join(tempRoot, 'before.prisma.config.ts');
  const throughConfig = path.join(tempRoot, 'through.prisma.config.ts');
  fs.writeFileSync(beforeConfig, migrationConfigText(beforePath), 'utf8');
  fs.writeFileSync(throughConfig, migrationConfigText(throughPath), 'utf8');
  return { beforeConfig, throughConfig };
}

function deployMigrations(configPath, migrationUrl, shadowUrl) {
  const childEnv = {
    ...process.env,
    MIGRATION_URL: migrationUrl,
    SHADOW_DATABASE_URL: shadowUrl,
  };
  const result = spawnSync(
    process.execPath,
    [prismaCli, 'migrate', 'deploy', '--config', configPath],
    { cwd: repoRoot, encoding: 'utf8', env: childEnv },
  );
  if (result.error) throw result.error;
  return {
    exitCode: result.status ?? 1,
    output: `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim(),
  };
}

function assertSuccessfulMigration(result, label) {
  assert(
    result.exitCode === 0,
    `${label}: prisma migrate deploy failed (${result.output.slice(-1800)})`,
  );
}

async function scalar(prisma, sql) {
  const rows = await prisma.$queryRawUnsafe(sql);
  return Number(rows[0]?.value ?? 0);
}

async function createAccount(prisma, phone, name) {
  const account = await prisma.taiKhoan.create({
    data: {
      hoTen: name,
      soDienThoai: phone,
      matKhau: 'history-migration-fixture-password-hash',
      daXacThucSoDienThoai: true,
      trangThai: 'HOAT_DONG',
    },
    select: { taiKhoanId: true },
  });
  return account.taiKhoanId;
}

async function seedPreMigrationCohort(prisma) {
  const suffix = `${Date.now().toString(36).slice(-4)}${randomBytes(3).toString('hex')}`;
  const customerPhone = `9${Date.now().toString().slice(-14)}`;
  const staffPhone = `8${Date.now().toString().slice(-14)}`;
  const nhaXe = await prisma.nhaXe.create({
    data: { maNhaXe: `HIST-NX-${suffix}`, tenNhaXe: `History fixture ${suffix}`, trangThai: 'HOAT_DONG' },
    select: { nhaXeId: true },
  });
  const customerAccountId = await createAccount(prisma, customerPhone, `History customer ${suffix}`);
  const staffAccountId = await createAccount(prisma, staffPhone, `History staff ${suffix}`);
  const khachHang = await prisma.khachHang.create({
    data: { maKhachHang: `HIST-KH-${suffix}`, taiKhoanId: customerAccountId },
    select: { khachHangId: true },
  });
  const loaiXe = await prisma.loaiXe.create({
    data: { nhaXeId: nhaXe.nhaXeId, tenLoai: `History coach ${suffix}` },
    select: { loaiXeId: true },
  });
  const xe = await prisma.xe.create({
    data: {
      bienSoXe: `HST-${suffix}`,
      trangThai: 'HOAT_DONG',
      nhaXeId: nhaXe.nhaXeId,
      loaiXeId: loaiXe.loaiXeId,
    },
    select: { xeId: true },
  });
  const tuyenXe = await prisma.tuyenXe.create({
    data: {
      maTuyenXe: `HIST-TX-${suffix}`,
      diemDi: 'History fixture origin',
      diemDen: 'History fixture destination',
      trangThai: 'HOAT_DONG',
      nhaXeId: nhaXe.nhaXeId,
    },
    select: { tuyenXeId: true },
  });
  const seats = [];
  for (let index = 0; index < 3; index += 1) {
    const seat = await prisma.ghe.create({
      data: { soGhe: `H${index + 1}`, xeId: xe.xeId },
      select: { gheId: true },
    });
    seats.push(seat.gheId);
  }
  const chuyenXe = await prisma.chuyenXe.create({
    data: {
      maChuyenXe: `HIST-CX-${suffix}`,
      ngayKhoiHanh: new Date('2035-01-01T00:00:00.000Z'),
      gioKhoiHanh: new Date('1970-01-01T09:00:00.000Z'),
      sucChuaXeMay: 0,
      sucChuaHangCongKenh: 0,
      sucChuaHangNhe: 0,
      trangThai: 'CHUA_KHOI_HANH',
      nhaXeId: nhaXe.nhaXeId,
      tuyenXeId: tuyenXe.tuyenXeId,
      xeId: xe.xeId,
    },
    select: { chuyenXeId: true },
  });
  const tripSeats = [];
  for (const gheId of seats) {
    const tripSeat = await prisma.gheChuyenXe.create({
      data: { trangThai: 'DA_DAT', chuyenXeId: chuyenXe.chuyenXeId, gheId },
      select: { gheChuyenXeId: true },
    });
    tripSeats.push(tripSeat.gheChuyenXeId);
  }
  const bangGia = await prisma.bangGia.create({
    data: {
      giaNiemYet: 100000,
      tuNgay: new Date('2034-01-01T00:00:00.000Z'),
      trangThai: 'HOAT_DONG',
      nhaXeId: nhaXe.nhaXeId,
      tuyenXeId: tuyenXe.tuyenXeId,
      loaiXeId: loaiXe.loaiXeId,
    },
    select: { bangGiaId: true },
  });

  const bookings = [];
  const tickets = [];
  for (let bookingIndex = 0; bookingIndex < 2; bookingIndex += 1) {
    const ticketIndexes = bookingIndex === 0 ? [0, 1] : [2];
    const transaction = await prisma.donGiaoDich.create({
      data: {
        maDonGiaoDich: `HIST-DGD-${suffix}-${bookingIndex + 1}`,
        ngayTao: new Date('2034-12-01T00:00:00.000Z'),
        tongTien: ticketIndexes.length * 100000,
        trangThai: 'CHO_THANH_TOAN',
        tenKhachHang: `History customer ${suffix}`,
        soDienThoaiKhachHang: customerPhone,
        khachHangId: khachHang.khachHangId,
        nhaXeId: nhaXe.nhaXeId,
      },
      select: { donGiaoDichId: true },
    });
    const booking = await prisma.phieuDatVe.create({
      data: {
        maPhieuDatVe: `HIST-PDV-${suffix}-${bookingIndex + 1}`,
        ngayDat: new Date('2034-12-01T00:00:00.000Z'),
        soLuongVeBanDau: ticketIndexes.length,
        tongTienBanDau: ticketIndexes.length * 100000,
        trangThai: 'CHO_THANH_TOAN',
        donGiaoDichId: transaction.donGiaoDichId,
      },
      select: { phieuDatVeId: true, trangThai: true },
    });
    bookings.push(booking);

    for (const ticketIndex of ticketIndexes) {
      const ticket = await prisma.ve.create({
        data: {
          maVe: `HIST-VE-${suffix}-${ticketIndex + 1}`,
          giaNiemYet: 100000,
          giaThucTe: 100000,
          trangThai: 'CHO_THANH_TOAN',
          phieuDatVeId: booking.phieuDatVeId,
          gheChuyenXeId: tripSeats[ticketIndex],
          bangGiaApDungId: bangGia.bangGiaId,
        },
        select: { veId: true, trangThai: true },
      });
      tickets.push(ticket);
    }
  }

  return { bookings, tickets, staffAccountId };
}

async function assertEmptyMigration(prisma) {
  const [bookingCount, ticketCount, bookingHistoryCount, ticketHistoryCount] = await Promise.all([
    prisma.phieuDatVe.count(),
    prisma.ve.count(),
    prisma.lichSuTrangThaiPhieuDatVe.count(),
    prisma.lichSuTrangThaiVe.count(),
  ]);
  assert(bookingCount === 0 && ticketCount === 0, 'Empty case unexpectedly created bookings or tickets.');
  assert(
    bookingHistoryCount === 0 && ticketHistoryCount === 0,
    'Empty migration case created fake booking/ticket history rows.',
  );
}

async function assertHistoryConstraints(prisma) {
  const checks = await scalar(
    prisma,
    "SELECT COUNT(*) AS value FROM information_schema.check_constraints WHERE constraint_schema=DATABASE() AND constraint_name LIKE 'chk_LSTT%'",
  );
  assert(checks === 8, `Expected 8 history CHECK constraints, found ${checks}.`);

  const uniqueIndexes = await scalar(
    prisma,
    "SELECT COUNT(DISTINCT index_name) AS value FROM information_schema.statistics WHERE table_schema=DATABASE() AND non_unique=0 AND ((table_name='LichSuTrangThaiPhieuDatVe' AND index_name='LichSuTrangThaiPhieuDatVe_maThaoTac_phieuDatVeId_key') OR (table_name='LichSuTrangThaiVe' AND index_name='LichSuTrangThaiVe_maThaoTac_veId_key'))",
  );
  assert(uniqueIndexes === 2, `Expected both per-entity composite unique indexes, found ${uniqueIndexes}.`);

  const restrictedForeignKeys = await scalar(
    prisma,
    "SELECT COUNT(*) AS value FROM information_schema.referential_constraints WHERE constraint_schema=DATABASE() AND constraint_name IN ('LichSuTrangThaiPhieuDatVe_phieuDatVeId_fkey', 'LichSuTrangThaiPhieuDatVe_taiKhoanId_fkey', 'LichSuTrangThaiVe_veId_fkey', 'LichSuTrangThaiVe_taiKhoanId_fkey') AND delete_rule='RESTRICT' AND update_rule='RESTRICT'",
  );
  assert(restrictedForeignKeys === 4, `Expected 4 RESTRICT history foreign keys, found ${restrictedForeignKeys}.`);
}

function runVerifier(adminUrl, database) {
  const verifier = path.join(repoRoot, 'prisma/tests/verify-booking-ticket-status-history.mjs');
  const result = spawnSync(process.execPath, [verifier], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      BOOKING_TICKET_STATUS_HISTORY_TEST_DATABASE_URL: urlForDatabase(adminUrl, database),
    },
  });
  if (result.error) throw result.error;
  return {
    status: result.status ?? 1,
    output: `${result.stdout ?? ''}\n${result.stderr ?? ''}`,
  };
}

async function assertBackfill(prisma, cohort) {
  const bookingIds = cohort.bookings.map((row) => row.phieuDatVeId);
  const ticketIds = cohort.tickets.map((row) => row.veId);
  const bookingHistory = await prisma.lichSuTrangThaiPhieuDatVe.findMany({
    where: { phieuDatVeId: { in: bookingIds } },
    orderBy: { phieuDatVeId: 'asc' },
  });
  const ticketHistory = await prisma.lichSuTrangThaiVe.findMany({
    where: { veId: { in: ticketIds } },
    orderBy: { veId: 'asc' },
  });
  assert(bookingHistory.length === bookingIds.length, 'Booking cohort did not receive exactly one baseline per row.');
  assert(ticketHistory.length === ticketIds.length, 'Ticket cohort did not receive exactly one baseline per row.');
  assert(
    bookingHistory.every((row, index) => row.phieuDatVeId === bookingIds.slice().sort((a, b) => a - b)[index]),
    'Booking baseline IDs do not match the captured pre-migration cohort.',
  );
  assert(
    ticketHistory.every((row, index) => row.veId === ticketIds.slice().sort((a, b) => a - b)[index]),
    'Ticket baseline IDs do not match the captured pre-migration cohort.',
  );

  const originalBookings = new Map(cohort.bookings.map((row) => [row.phieuDatVeId, row.trangThai]));
  const originalTickets = new Map(cohort.tickets.map((row) => [row.veId, row.trangThai]));
  const bookingCurrent = await prisma.phieuDatVe.findMany({
    where: { phieuDatVeId: { in: bookingIds } },
    select: { phieuDatVeId: true, trangThai: true },
  });
  const ticketCurrent = await prisma.ve.findMany({
    where: { veId: { in: ticketIds } },
    select: { veId: true, trangThai: true },
  });
  assert(
    bookingCurrent.every((row) => originalBookings.get(row.phieuDatVeId) === row.trangThai),
    'Booking status changed during the history migration.',
  );
  assert(
    ticketCurrent.every((row) => originalTickets.get(row.veId) === row.trangThai),
    'Ticket status changed during the history migration.',
  );

  const rows = [...bookingHistory, ...ticketHistory];
  const operations = rows.map((row) => row.maThaoTac);
  assert(operations.every((operation) => UUID_V1_PATTERN.test(operation)), 'A baseline operation ID is not UUID v1.');
  assert(new Set(operations).size === rows.length, 'Baseline UUID v1 values are not distinct per row.');
  const timestamps = new Set(rows.map((row) => row.thoiDiem.toISOString()));
  assert(timestamps.size === 1, 'Backfill rows do not share one migration timestamp.');

  for (const [historyRows, entityIdField, originalStatuses] of [
    [bookingHistory, 'phieuDatVeId', originalBookings],
    [ticketHistory, 'veId', originalTickets],
  ]) {
    for (const row of historyRows) {
      assert(row.trangThaiCu === null, `${entityIdField} baseline trangThaiCu must be NULL.`);
      assert(row.trangThaiMoi === originalStatuses.get(row[entityIdField]), `${entityIdField} baseline status is incorrect.`);
      assert(row.nguonThayDoi === 'SYSTEM', `${entityIdField} baseline source must be SYSTEM.`);
      assert(row.taiKhoanId === null, `${entityIdField} baseline taiKhoanId must be NULL.`);
      assert(row.laOverride === false, `${entityIdField} baseline laOverride must be false.`);
      assert(row.lyDo === BACKFILL_REASON, `${entityIdField} baseline reason is incorrect.`);
    }
  }

  await assertHistoryConstraints(prisma);
  console.log('OK cohort-backfill: 2 bookings, 3 tickets, one baseline each, statuses preserved, UUID v1 distinct, shared timestamp, and constraints present.');
}

async function addValidTransitionsAndRunVerifier(prisma, adminUrl, database) {
  const cohortBookingId = (await prisma.phieuDatVe.findFirstOrThrow({
    orderBy: { phieuDatVeId: 'asc' },
    select: { phieuDatVeId: true },
  })).phieuDatVeId;
  const cohortTicketIds = await prisma.ve.findMany({
    orderBy: { veId: 'asc' },
    take: 2,
    select: { veId: true },
  });
  const staff = await prisma.taiKhoan.findFirstOrThrow({
    where: { hoTen: { startsWith: 'History staff ' } },
    select: { taiKhoanId: true },
  });
  const [operationRow] = await prisma.$queryRaw`SELECT UUID() AS maThaoTac`;
  const operationId = operationRow.maThaoTac;
  assert(UUID_V1_PATTERN.test(operationId), 'MySQL UUID() did not produce a UUID v1 operation ID.');
  const thoiDiem = new Date();
  const transition = {
    trangThaiCu: 'CHO_THANH_TOAN',
    trangThaiMoi: 'DA_XAC_NHAN',
    thoiDiem,
    nguonThayDoi: 'STAFF',
    taiKhoanId: staff.taiKhoanId,
    lyDo: 'Harness transition',
    laOverride: false,
    maThaoTac: operationId,
  };
  await prisma.phieuDatVe.update({
    where: { phieuDatVeId: cohortBookingId },
    data: { trangThai: transition.trangThaiMoi },
  });
  await prisma.lichSuTrangThaiPhieuDatVe.create({
    data: { ...transition, phieuDatVeId: cohortBookingId },
  });
  for (const { veId } of cohortTicketIds) {
    await prisma.ve.update({ where: { veId }, data: { trangThai: transition.trangThaiMoi } });
    await prisma.lichSuTrangThaiVe.create({ data: { ...transition, veId } });
  }

  const bookingUse = await prisma.lichSuTrangThaiPhieuDatVe.count({
    where: { maThaoTac: operationId },
  });
  const ticketUse = await prisma.lichSuTrangThaiVe.count({
    where: { maThaoTac: operationId },
  });
  assert(bookingUse === 1 && ticketUse === 2, 'A single operation must be shared across the booking and two ticket entities.');
  assert(
    (await prisma.lichSuTrangThaiPhieuDatVe.count()) > (await prisma.phieuDatVe.count()) &&
      (await prisma.lichSuTrangThaiVe.count()) > (await prisma.ve.count()),
    'Verifier fixture must include multiple valid histories per entity over its lifecycle.',
  );

  const result = runVerifier(adminUrl, database);
  assert(
    result.status === 0,
    `Verifier rejected valid baseline + multi-entity transition rows (${result.output.slice(-1800)}).`,
  );
  assert(
    result.output.includes('History counts may exceed entity counts.'),
    'Verifier did not report lifecycle-aware count semantics.',
  );
  console.log('OK verifier-positive: baselines and a shared STAFF operation across a booking and two tickets verified.');
}

async function runEmptyCase(adminUrl) {
  const database = scratchDatabaseName('empty');
  const shadow = `vexgo_history_shadow_${randomBytes(4).toString('hex')}`;
  const migrationUrl = urlForDatabase(adminUrl, database);
  const shadowUrl = urlForDatabase(adminUrl, shadow);
  const tempRoot = fs.mkdtempSync(
    path.join(repoRoot, 'prisma/.booking-ticket-status-history-upgrade-'),
  );
  let databaseCreated = false;
  let shadowCreated = false;
  let prisma;
  const admin = newPrisma(adminUrl);

  try {
    const configs = prepareMigrationConfig(tempRoot);
    await createDatabase(admin, database);
    databaseCreated = true;
    await createDatabase(admin, shadow);
    shadowCreated = true;
    const result = deployMigrations(configs.throughConfig, migrationUrl, shadowUrl);
    assertSuccessfulMigration(result, 'empty-schema');
    prisma = newPrisma(migrationUrl);
    await assertEmptyMigration(prisma);
    await assertHistoryConstraints(prisma);
    const verifierResult = runVerifier(adminUrl, database);
    assert(verifierResult.status !== 0, 'Verifier incorrectly accepted an empty dataset as successful verification.');
    assert(
      verifierResult.output.includes('Dataset is empty or incomplete for verification'),
      `Verifier did not clearly report that an empty dataset is insufficient (${verifierResult.output.slice(-1200)}).`,
    );
    assert(
      verifierResult.output.includes('no migration/backfill correctness is established'),
      'Verifier did not state that an empty dataset provides no migration/backfill correctness evidence.',
    );
    console.log('OK empty-schema: full migration succeeds without creating fake history.');
    console.log('OK verifier-empty-negative: an empty dataset is clearly rejected as insufficient evidence.');
  } finally {
    await cleanupCase({ prisma, admin, database, databaseCreated, shadow, shadowCreated, tempRoot });
  }
}

async function runCohortCase(adminUrl) {
  const database = scratchDatabaseName('cohort');
  const shadow = `vexgo_history_shadow_${randomBytes(4).toString('hex')}`;
  const migrationUrl = urlForDatabase(adminUrl, database);
  const shadowUrl = urlForDatabase(adminUrl, shadow);
  const tempRoot = fs.mkdtempSync(
    path.join(repoRoot, 'prisma/.booking-ticket-status-history-upgrade-'),
  );
  let databaseCreated = false;
  let shadowCreated = false;
  let prisma;
  const admin = newPrisma(adminUrl);

  try {
    const configs = prepareMigrationConfig(tempRoot);
    await createDatabase(admin, database);
    databaseCreated = true;
    await createDatabase(admin, shadow);
    shadowCreated = true;
    assertSuccessfulMigration(
      deployMigrations(configs.beforeConfig, migrationUrl, shadowUrl),
      'pre-history-schema',
    );
    prisma = newPrisma(migrationUrl);
    const cohort = await seedPreMigrationCohort(prisma);
    assert(cohort.bookings.length === 2, 'Fixture must include at least two pre-migration bookings.');
    assert(cohort.tickets.length === 3, 'Fixture must include at least three pre-migration tickets.');

    assertSuccessfulMigration(
      deployMigrations(configs.throughConfig, migrationUrl, shadowUrl),
      'history-migration-with-pre-existing-data',
    );
    await assertBackfill(prisma, cohort);
    await addValidTransitionsAndRunVerifier(prisma, adminUrl, database);
  } finally {
    await cleanupCase({ prisma, admin, database, databaseCreated, shadow, shadowCreated, tempRoot });
  }
}

async function main() {
  const adminUrlValue = process.env[harnessAdminUrlEnv];
  if (!adminUrlValue) {
    throw new Error(
      `${harnessAdminUrlEnv} is required; migration harness never falls back to an application database URL.`,
    );
  }
  const adminTarget = parseMySqlUrl(adminUrlValue, harnessAdminUrlEnv);
  if (!['localhost', '127.0.0.1', '::1'].includes(adminTarget.host)) {
    throw new Error('Migration harness only allows a local disposable MySQL server.');
  }
  if (/(?:^|[_-])(?:prod|production)(?:$|[_-])/i.test(adminTarget.database)) {
    throw new Error(`${harnessAdminUrlEnv} must not select a production database.`);
  }
  assert(fs.existsSync(prismaCli), 'Prisma CLI was not found; run the API build first.');
  assert(fs.existsSync(path.join(migrationsRoot, migrationName, 'migration.sql')), 'History migration is missing.');

  const failures = [];
  for (const [label, runCase] of [
    ['empty-schema', runEmptyCase],
    ['cohort-backfill', runCohortCase],
  ]) {
    try {
      await runCase(adminUrlValue);
    } catch (error) {
      failures.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
      console.error(`FAIL ${label}: ${failures.at(-1)}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(`Booking/ticket history migration regression failures:\n${failures.join('\n')}`);
  }
}

main().catch((error) => {
  console.error('Booking/ticket history migration regression harness failed:', error);
  process.exitCode = 1;
});
