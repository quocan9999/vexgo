import 'dotenv/config';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../../apps/api/dist/generated/prisma/client.js';
import { syncPermissions } from '../sync-permissions.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');
const migrationsRoot = path.join(repoRoot, 'prisma/migrations');
const prismaCli = path.join(repoRoot, 'node_modules/prisma/build/index.js');
const fixtureSqlPath = path.join(scriptDir, 'fixtures/shipment-migration-before-correction.sql');
const rbacFixtureSqlPath = path.join(scriptDir, 'fixtures/shipment-permissions-before-migration.sql');
const baselineMigrationName = '20261007010000_shipment_migration_harness_baseline';
const migrationNames = [
  '20261007020000_correct_shipment_capacity_and_validate_invariants',
  '20261007100000_add_shipment_cargo_type_fees',
  '20261009010000_add_shipment_management_permissions',
];

function connectionConfig(connectionUrl) {
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

function urlForDatabase(connectionUrl, database) {
  const url = new URL(connectionUrl);
  url.pathname = `/${database}`;
  return url.toString();
}

function databaseName(label) {
  return `vexgo_shipfee_${label}_${process.pid}_${Date.now().toString(36)}`.slice(0, 60);
}

function newPrisma(connectionUrl) {
  return new PrismaClient({ adapter: new PrismaMariaDb(connectionConfig(connectionUrl)) });
}

async function createDatabase(admin, name) {
  await admin.$executeRawUnsafe(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
}

async function dropDatabase(admin, name) {
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS \`${name}\``);
}

async function setupFixture(prisma, { mismatchTrip = false, missingRate = false, ambiguousBoundaryRate = false, financialMismatch = false } = {}) {
  const statements = [fixtureSqlPath, rbacFixtureSqlPath]
    .flatMap((filePath) => fs.readFileSync(filePath, 'utf8').split(';'))
    .map((sql) => sql.trim())
    .filter(Boolean);
  for (const statement of statements) await prisma.$executeRawUnsafe(statement);

  if (missingRate) {
    await prisma.$executeRawUnsafe('DELETE FROM `BangCuocGuiHang` WHERE `bangCuocGuiHangId`=2');
  }
  if (ambiguousBoundaryRate) {
    await prisma.$executeRawUnsafe("INSERT INTO `BangCuocGuiHang` (`bangCuocGuiHangId`, `khoiLuongTu`, `khoiLuongDen`, `mucCuoc`, `tuNgay`, `denNgay`, `trangThai`, `diemGuiId`, `diemNhanId`, `loaiHangHoaId`) VALUES (3, 5.00, 10.00, 55.00, '2026-01-01', '2026-12-31', 'HET_HIEU_LUC', 10, 20, 1)");
  }
  if (financialMismatch) {
    await prisma.$executeRawUnsafe('UPDATE `PhieuGuiHang` SET `cuocChinh`=80.00, `tongPhi`=80.00 WHERE `phieuGuiHangId`=1');
  }
  if (mismatchTrip) {
    await prisma.$executeRawUnsafe('INSERT INTO `PhieuDatVe` (`phieuDatVeId`, `donGiaoDichId`) VALUES (100, 500)');
    await prisma.$executeRawUnsafe('INSERT INTO `GheChuyenXe` (`gheChuyenXeId`, `chuyenXeId`) VALUES (100, 2)');
    await prisma.$executeRawUnsafe('INSERT INTO `Ve` (`veId`, `phieuDatVeId`, `gheChuyenXeId`) VALUES (100, 100, 100)');
  }
}

function migrationConfigText(migrationsPath) {
  const schemaPath = path.join(repoRoot, 'prisma/schema.prisma').replaceAll('\\', '/');
  const absoluteMigrationsPath = migrationsPath.replaceAll('\\', '/');
  return `import { defineConfig, env } from 'prisma/config';\n\nexport default defineConfig({\n  schema: ${JSON.stringify(schemaPath)},\n  migrations: { path: ${JSON.stringify(absoluteMigrationsPath)} },\n  datasource: { url: env('MIGRATION_URL'), shadowDatabaseUrl: env('SHADOW_DATABASE_URL') },\n});\n`;
}

function prepareMigrationDirectory(tempRoot) {
  const migrationPath = path.join(tempRoot, 'migrations');
  fs.mkdirSync(migrationPath, { recursive: true });
  fs.copyFileSync(path.join(migrationsRoot, 'migration_lock.toml'), path.join(migrationPath, 'migration_lock.toml'));

  const baselinePath = path.join(migrationPath, baselineMigrationName);
  fs.mkdirSync(baselinePath, { recursive: true });
  fs.writeFileSync(path.join(baselinePath, 'migration.sql'), '-- Existing schema fixture used as the baseline for this upgrade test.\n', 'utf8');

  for (const migrationName of migrationNames) {
    const source = path.join(migrationsRoot, migrationName);
    if (fs.existsSync(source)) fs.cpSync(source, path.join(migrationPath, migrationName), { recursive: true });
  }

  fs.writeFileSync(path.join(tempRoot, 'prisma.config.ts'), migrationConfigText(migrationPath), 'utf8');
  return path.join(tempRoot, 'prisma.config.ts');
}

function deployMigrations(configPath, migrationUrl, shadowUrl) {
  const childEnv = { ...process.env, MIGRATION_URL: migrationUrl, SHADOW_DATABASE_URL: shadowUrl };
  const baseline = spawnSync(process.execPath, [prismaCli, 'migrate', 'resolve', '--applied', baselineMigrationName, '--config', configPath], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: childEnv,
  });

  if (baseline.error) throw baseline.error;
  if (baseline.status !== 0) {
    return {
      exitCode: baseline.status ?? 1,
      output: `${baseline.stdout ?? ''}\n${baseline.stderr ?? ''}`.trim(),
    };
  }

  const result = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy', '--config', configPath], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: childEnv,
  });
  if (result.error) throw result.error;
  return {
    exitCode: result.status ?? 1,
    output: `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim(),
  };
}

async function scalar(prisma, sql) {
  const rows = await prisma.$queryRawUnsafe(sql);
  return Number(rows[0]?.value ?? 0);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function runUpgradeCase(admin, label, { fixture = {}, expectedFailureMigration = null, expectedDiagnostic = null } = {}) {
  const dbName = databaseName(label);
  const shadowName = databaseName(`${label}_shadow`);
  const migrationUrl = urlForDatabase(process.env.MIGRATION_URL ?? process.env.DATABASE_URL, dbName);
  const shadowUrl = urlForDatabase(process.env.SHADOW_DATABASE_URL ?? process.env.DATABASE_URL, shadowName);
  const tempRoot = fs.mkdtempSync(path.join(repoRoot, 'prisma/.shipment-fee-upgrade-'));
  const configPath = prepareMigrationDirectory(tempRoot);
  let prisma;

  try {
    await createDatabase(admin, dbName);
    await createDatabase(admin, shadowName);
    prisma = newPrisma(migrationUrl);
    await setupFixture(prisma, fixture);

    const migrationResult = deployMigrations(configPath, migrationUrl, shadowUrl);
    if (expectedFailureMigration) {
      assert(migrationResult.exitCode !== 0, `${label}: expected migration to fail`);
      const failedRows = await prisma.$queryRawUnsafe("SELECT `migration_name`, `logs` FROM `_prisma_migrations` WHERE `finished_at` IS NULL AND `rolled_back_at` IS NULL ORDER BY `started_at` DESC");
      assert(failedRows[0]?.migration_name === expectedFailureMigration, `${label}: expected ${expectedFailureMigration} to fail, got ${failedRows[0]?.migration_name ?? 'no failed migration'} (${migrationResult.output.slice(-900)})`);
      assert(String(failedRows[0]?.logs ?? '').includes(expectedDiagnostic), `${label}: failure did not come from ${expectedDiagnostic} (${String(failedRows[0]?.logs ?? migrationResult.output).slice(-900)})`);
      const cargoTypes = await prisma.$queryRawUnsafe('SELECT `loaiHangHoaId` FROM `HangHoa` ORDER BY `hangHoaId`');
      assert(cargoTypes.map((row) => Number(row.loaiHangHoaId)).join(',') === '1,2', `${label}: migration changed original cargo types`);
      const capacity = await prisma.$queryRawUnsafe('SELECT `sucChuaHangNhe`, `sucChuaXeMay` FROM `ChuyenXe` WHERE `chuyenXeId`=1');
      const failedBeforeCapacity = expectedFailureMigration === migrationNames[0];
      assert(Number(capacity[0].sucChuaHangNhe) === (failedBeforeCapacity ? 0 : 2), `${label}: unexpected light cargo capacity after failed migration`);
      assert(Number(capacity[0].sucChuaXeMay) === (failedBeforeCapacity ? 0 : 1), `${label}: unexpected motorcycle capacity after failed migration`);
      const detailsTable = await scalar(prisma, "SELECT COUNT(*) AS value FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='ChiTietCuocGuiHang'");
      assert(detailsTable === 0, `${label}: preflight failure left a partially created fee detail table`);
      const oldColumn = await scalar(prisma, "SELECT COUNT(*) AS value FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='PhieuGuiHang' AND column_name='bangCuocApDungId'");
      assert(oldColumn === 1, `${label}: preflight failure dropped the legacy fare column`);
      const parent = await prisma.$queryRawUnsafe('SELECT `cuocChinh`, `tongPhi` FROM `PhieuGuiHang` WHERE `phieuGuiHangId`=1');
      const expectedOldFee = fixture.financialMismatch ? 80 : 70;
      assert(Number(parent[0].cuocChinh) === expectedOldFee && Number(parent[0].tongPhi) === expectedOldFee, `${label}: failed migration changed shipment fee snapshots`);
      await assertFinancialSnapshotsUnchanged(prisma, label);
      console.log(`OK ${label}: ${expectedFailureMigration} failed before fee DDL/data changes`);
      return;
    }

    assert(migrationResult.exitCode === 0, `${label}: migration failed (${migrationResult.output.slice(-1600)})`);

    const cargoTypes = await prisma.$queryRawUnsafe('SELECT `loaiHangHoaId` FROM `HangHoa` ORDER BY `hangHoaId`');
    assert(cargoTypes.map((row) => Number(row.loaiHangHoaId)).join(',') === '1,2', `${label}: migration did not preserve original cargo types`);

    const capacity = await prisma.$queryRawUnsafe('SELECT `sucChuaHangNhe`, `sucChuaXeMay`, `sucChuaHangCongKenh` FROM `ChuyenXe` WHERE `chuyenXeId`=1');
    assert(Number(capacity[0].sucChuaHangNhe) === 2, `${label}: active light cargo capacity was not backfilled`);
    assert(Number(capacity[0].sucChuaXeMay) === 1, `${label}: active motorcycle cargo capacity was not backfilled`);
    assert(Number(capacity[0].sucChuaHangCongKenh) === 0, `${label}: unrelated capacity was changed`);

    const detailsTable = await scalar(prisma, "SELECT COUNT(*) AS value FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='ChiTietCuocGuiHang'");
    assert(detailsTable === 1, `${label}: ChiTietCuocGuiHang was not created`);

    const details = await prisma.$queryRawUnsafe('SELECT `loaiHangHoaId`, `bangCuocGuiHangId`, `khoiLuongTinhCuoc`, `soTienCuoc` FROM `ChiTietCuocGuiHang` ORDER BY `loaiHangHoaId`');
    assert(details.length === 2, `${label}: expected exactly one fee detail for each cargo type`);
    assert(Number(details[0].loaiHangHoaId) === 1 && Number(details[0].bangCuocGuiHangId) === 1, `${label}: first cargo type did not retain its matching historical rate`);
    assert(Number(details[0].khoiLuongTinhCuoc) === 5 && Number(details[0].soTienCuoc) === 30, `${label}: first cargo type fee snapshot is incorrect`);
    assert(Number(details[1].loaiHangHoaId) === 2 && Number(details[1].bangCuocGuiHangId) === 2, `${label}: second cargo type did not receive its own rate`);
    assert(Number(details[1].khoiLuongTinhCuoc) === 3 && Number(details[1].soTienCuoc) === 40, `${label}: second cargo type fee snapshot is incorrect`);

    const parent = await prisma.$queryRawUnsafe('SELECT `cuocChinh`, `tongPhi` FROM `PhieuGuiHang` WHERE `phieuGuiHangId`=1');
    assert(Number(parent[0].cuocChinh) === 70 && Number(parent[0].tongPhi) === 70, `${label}: shipment financial snapshots changed`);

    const shipmentPermissions = await prisma.$queryRawUnsafe(
      "SELECT `tenQuyen` FROM `Quyen` WHERE `tenQuyen` IN ('shipment:read', 'shipment:update') ORDER BY `tenQuyen`",
    );
    assert(
      shipmentPermissions.map(({ tenQuyen }) => tenQuyen).join(',') === 'shipment:read,shipment:update',
      `${label}: migrate deploy did not install both shipment permissions on an existing database`,
    );
    const shipmentRoleGrants = await prisma.$queryRawUnsafe(
      "SELECT `permission`.`tenQuyen` FROM `VaiTroQuyen` AS `grant` JOIN `VaiTro` AS `role` ON `role`.`vaiTroId` = `grant`.`vaiTroId` JOIN `Quyen` AS `permission` ON `permission`.`quyenId` = `grant`.`quyenId` WHERE `role`.`tenVaiTro` = 'NHA_XE_ADMIN' AND `permission`.`tenQuyen` IN ('shipment:read', 'shipment:update') ORDER BY `permission`.`tenQuyen`",
    );
    assert(
      shipmentRoleGrants.map(({ tenQuyen }) => tenQuyen).join(',') === 'shipment:read,shipment:update',
      `${label}: migrate deploy did not grant the shipment defaults to NHA_XE_ADMIN`,
    );
    const overrideBeforeSync = await prisma.$queryRawUnsafe(
      'SELECT `nhaXeId`, `vaiTroId`, `quyenId` FROM `CauHinhQuyenVaiTroNhaXeChiTiet` ORDER BY `nhaXeId`, `vaiTroId`, `quyenId`',
    );
    assert(overrideBeforeSync.length === 1, `${label}: migration changed the pre-existing tenant permission override`);

    await syncPermissions(prisma);
    const roleGrantsAfterFirstSync = await prisma.$queryRawUnsafe(
      'SELECT `vaiTroId`, `quyenId` FROM `VaiTroQuyen` ORDER BY `vaiTroId`, `quyenId`',
    );
    await syncPermissions(prisma);
    const roleGrantsAfterSecondSync = await prisma.$queryRawUnsafe(
      'SELECT `vaiTroId`, `quyenId` FROM `VaiTroQuyen` ORDER BY `vaiTroId`, `quyenId`',
    );
    assert(
      JSON.stringify(roleGrantsAfterSecondSync) === JSON.stringify(roleGrantsAfterFirstSync),
      `${label}: repeated permission sync changed the global role grants`,
    );
    const overrideAfterSync = await prisma.$queryRawUnsafe(
      'SELECT `nhaXeId`, `vaiTroId`, `quyenId` FROM `CauHinhQuyenVaiTroNhaXeChiTiet` ORDER BY `nhaXeId`, `vaiTroId`, `quyenId`',
    );
    assert(
      JSON.stringify(overrideAfterSync) === JSON.stringify(overrideBeforeSync),
      `${label}: permission sync changed the pre-existing tenant override`,
    );

    await prisma.$executeRawUnsafe('UPDATE `BangCuocGuiHang` SET `mucCuoc`=999.00 WHERE `bangCuocGuiHangId`=1');
    const snapshotAfterRateEdit = await prisma.$queryRawUnsafe('SELECT `soTienCuoc` FROM `ChiTietCuocGuiHang` WHERE `phieuGuiHangId`=1 AND `loaiHangHoaId`=1');
    assert(Number(snapshotAfterRateEdit[0]?.soTienCuoc) === 30, `${label}: editing a rate changed a confirmed fee snapshot`);
    const oldColumn = await scalar(prisma, "SELECT COUNT(*) AS value FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='PhieuGuiHang' AND column_name='bangCuocApDungId'");
    assert(oldColumn === 0, `${label}: obsolete single-rate column still exists`);
    await assertFinancialSnapshotsUnchanged(prisma, label);

    console.log(`OK ${label}: mixed cargo rates, historical status, capacity and immutable financial snapshots`);
  } finally {
    if (prisma) await prisma.$disconnect();
    await dropDatabase(admin, dbName);
    await dropDatabase(admin, shadowName);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function assertFinancialSnapshotsUnchanged(prisma, label) {
  const transaction = await prisma.$queryRawUnsafe('SELECT `tongTien` AS value FROM `DonGiaoDich` WHERE `donGiaoDichId`=500');
  const invoice = await prisma.$queryRawUnsafe('SELECT `tongTien` AS value FROM `HoaDon` WHERE `donGiaoDichId`=500');
  const payment = await prisma.$queryRawUnsafe('SELECT `soTien` AS value FROM `ThanhToan` WHERE `donGiaoDichId`=500');
  assert(Number(transaction[0].value) === 150, `${label}: migration changed transaction history`);
  assert(Number(invoice[0].value) === 150, `${label}: migration changed invoice history`);
  assert(Number(payment[0].value) === 150, `${label}: migration changed payment history`);
}

async function main() {
  const adminUrl = process.env.MIGRATION_URL ?? process.env.DATABASE_URL;
  if (!adminUrl) throw new Error('Set MIGRATION_URL or DATABASE_URL to a MySQL 8.4 database with CREATE/DROP DATABASE privileges.');
  if (!fs.existsSync(prismaCli)) throw new Error('Prisma CLI was not found; run the API build (which generates Prisma Client) before this harness.');
  if (!fs.existsSync(fixtureSqlPath) || !fs.existsSync(rbacFixtureSqlPath)) throw new Error('Shipment migration fixtures are missing.');

  const admin = newPrisma(adminUrl);
  try {
    const cases = [
      ['valid-mixed-cargo', {}],
      ['trip-mismatch', { fixture: { mismatchTrip: true }, expectedFailureMigration: migrationNames[0], expectedDiagnostic: '_Shipment002ForwardPreflight_transactionTrip_check' }],
      ['missing-rate', { fixture: { missingRate: true }, expectedFailureMigration: migrationNames[1], expectedDiagnostic: '_ShipmentCargoFeeRatePreflight_check' }],
      ['inclusive-boundary-overlap', { fixture: { ambiguousBoundaryRate: true }, expectedFailureMigration: migrationNames[1], expectedDiagnostic: '_ShipmentCargoFeeRatePreflight_check' }],
      ['financial-snapshot-mismatch', { fixture: { financialMismatch: true }, expectedFailureMigration: migrationNames[1], expectedDiagnostic: '_ShipmentCargoFeePreflight_financial_check' }],
    ];
    const failures = [];
    for (const [label, options] of cases) {
      try {
        await runUpgradeCase(admin, label, options);
      } catch (error) {
        failures.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
        console.error(`FAIL ${label}: ${failures.at(-1)}`);
      }
    }
    if (failures.length > 0) throw new Error(`Shipment migration regression failures:\n${failures.join('\n')}`);
  } finally {
    await admin.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
