import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { config as loadDotenv } from 'dotenv';
import { afterEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '../../../src/generated/prisma/client.js';

loadDotenv({ path: resolve(process.cwd(), '../../.env') });
loadDotenv({ path: resolve(process.cwd(), '.env') });

function createMigrationTestClient(): PrismaClient {
  const configuredDatabaseUrl = process.env.DATABASE_URL;
  if (!configuredDatabaseUrl) {
    throw new Error(
      'DATABASE_URL is required for the chat migration integration test',
    );
  }
  const databaseUrl = new URL(configuredDatabaseUrl);
  if (databaseUrl.protocol !== 'mysql:') {
    throw new Error('DATABASE_URL must use the mysql: protocol');
  }

  return new PrismaClient({
    adapter: new PrismaMariaDb({
      host: databaseUrl.hostname,
      port: Number(databaseUrl.port || 3306),
      user: decodeURIComponent(databaseUrl.username),
      password: decodeURIComponent(databaseUrl.password),
      database: decodeURIComponent(databaseUrl.pathname.replace(/^\/+/, '')),
      allowPublicKeyRetrieval: true,
    }),
  });
}

const migrationSqlUrl = new URL(
  '../../../../../prisma/migrations/20261013150000_add_chat_support_conversations_and_messages/migration.sql',
  import.meta.url,
);

interface MigrationTableNames {
  taiKhoan: string;
  nhaXe: string;
  khachHang: string;
  nhanVien: string;
  tinNhan: string;
  cuocTroChuyen: string;
  luuTru: string;
  role: string;
  permission: string;
  assignments: string;
}

function generateTestContext() {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
  const tableNames: MigrationTableNames = {
    taiKhoan: `CMig${suffix}_TaiKhoan`,
    nhaXe: `CMig${suffix}_NhaXe`,
    khachHang: `CMig${suffix}_KhachHang`,
    nhanVien: `CMig${suffix}_NhanVien`,
    tinNhan: `CMig${suffix}_TinNhanHoTro`,
    cuocTroChuyen: `CMig${suffix}_CuocTroChuyen`,
    luuTru: `CMig${suffix}_LuuTruTinNhanHoTroCu`,
    role: `CMig${suffix}_VaiTro`,
    permission: `CMig${suffix}_Quyen`,
    assignments: `CMig${suffix}_VaiTroQuyen`,
  };
  const quoted = (name: string) => `\`${name}\``;
  return { suffix, tableNames, quoted };
}

async function createLegacyBaseSchema(
  db: PrismaClient,
  suffix: string,
  tableNames: MigrationTableNames,
  options: { enforceLegacyFk?: boolean } = { enforceLegacyFk: true },
) {
  const quoted = (name: string) => `\`${name}\``;

  await db.$executeRawUnsafe(
    `CREATE TABLE ${quoted(tableNames.taiKhoan)} (\`taiKhoanId\` INT NOT NULL AUTO_INCREMENT, \`email\` VARCHAR(100) NOT NULL, PRIMARY KEY (\`taiKhoanId\`)) ENGINE=InnoDB`,
  );
  await db.$executeRawUnsafe(
    `CREATE TABLE ${quoted(tableNames.nhaXe)} (\`nhaXeId\` INT NOT NULL AUTO_INCREMENT, \`tenNhaXe\` VARCHAR(100) NOT NULL, PRIMARY KEY (\`nhaXeId\`)) ENGINE=InnoDB`,
  );
  await db.$executeRawUnsafe(
    `CREATE TABLE ${quoted(tableNames.khachHang)} (\`khachHangId\` INT NOT NULL AUTO_INCREMENT, \`maKhachHang\` VARCHAR(50) NOT NULL, \`taiKhoanId\` INT NOT NULL, PRIMARY KEY (\`khachHangId\`)) ENGINE=InnoDB`,
  );
  await db.$executeRawUnsafe(
    `CREATE TABLE ${quoted(tableNames.nhanVien)} (\`nhanVienId\` INT NOT NULL AUTO_INCREMENT, \`maNhanVien\` VARCHAR(50) NOT NULL, \`nhaXeId\` INT NOT NULL, \`taiKhoanId\` INT NOT NULL, PRIMARY KEY (\`nhanVienId\`)) ENGINE=InnoDB`,
  );
  await db.$executeRawUnsafe(
    `CREATE TABLE ${quoted(tableNames.role)} (\`vaiTroId\` INT NOT NULL AUTO_INCREMENT, \`tenVaiTro\` VARCHAR(50) NOT NULL, \`moTa\` VARCHAR(255) NULL, PRIMARY KEY (\`vaiTroId\`), UNIQUE KEY (\`tenVaiTro\`)) ENGINE=InnoDB`,
  );
  await db.$executeRawUnsafe(
    `CREATE TABLE ${quoted(tableNames.permission)} (\`quyenId\` INT NOT NULL AUTO_INCREMENT, \`tenQuyen\` VARCHAR(100) NOT NULL, \`moTa\` VARCHAR(255) NULL, PRIMARY KEY (\`quyenId\`), UNIQUE KEY (\`tenQuyen\`)) ENGINE=InnoDB`,
  );
  await db.$executeRawUnsafe(
    `CREATE TABLE ${quoted(tableNames.assignments)} (\`vaiTroId\` INT NOT NULL, \`quyenId\` INT NOT NULL, PRIMARY KEY (\`vaiTroId\`, \`quyenId\`)) ENGINE=InnoDB`,
  );

  const fkClause = options.enforceLegacyFk
    ? `, CONSTRAINT \`${suffix}_TK_fk\` FOREIGN KEY (\`khachHangId\`) REFERENCES ${quoted(tableNames.khachHang)} (\`khachHangId\`) ON DELETE RESTRICT ON UPDATE RESTRICT`
    : '';

  await db.$executeRawUnsafe(
    `CREATE TABLE ${quoted(tableNames.tinNhan)} (
      \`tinNhanId\` INT NOT NULL AUTO_INCREMENT,
      \`noiDung\` TEXT NOT NULL,
      \`thoiGian\` DATETIME(0) NOT NULL,
      \`trangThai\` VARCHAR(30) NOT NULL,
      \`khachHangId\` INT NOT NULL,
      \`createdAt\` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
      \`updatedAt\` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
      PRIMARY KEY (\`tinNhanId\`),
      INDEX \`${suffix}_TK_fk\` (\`khachHangId\`)
      ${fkClause}
    ) ENGINE=InnoDB`,
  );

  await db.$executeRawUnsafe(
    `INSERT INTO ${quoted(tableNames.role)} (\`tenVaiTro\`, \`moTa\`) VALUES
      ('NHA_XE_ADMIN', 'Quản trị nhà xe'),
      ('NHAN_VIEN_CSKH', 'Nhân viên chăm sóc khách hàng')`,
  );
}

async function executeMigrationScript(
  db: PrismaClient,
  suffix: string,
  tableNames: MigrationTableNames,
  options: { enforceLegacyFk?: boolean } = { enforceLegacyFk: true },
) {
  const quoted = (name: string) => `\`${name}\``;
  const migrationSql = await readFile(migrationSqlUrl, 'utf8');

  let transformedSql = migrationSql
    .replaceAll('`TinNhanHoTro`', quoted(tableNames.tinNhan))
    .replaceAll('`CuocTroChuyen`', quoted(tableNames.cuocTroChuyen))
    .replaceAll('`LuuTruTinNhanHoTroCu`', quoted(tableNames.luuTru))
    .replaceAll('`KhachHang`', quoted(tableNames.khachHang))
    .replaceAll('`NhanVien`', quoted(tableNames.nhanVien))
    .replaceAll('`NhaXe`', quoted(tableNames.nhaXe))
    .replaceAll('`TaiKhoan`', quoted(tableNames.taiKhoan))
    .replaceAll('`VaiTroQuyen`', quoted(tableNames.assignments))
    .replaceAll('`VaiTro`', quoted(tableNames.role))
    .replaceAll('`Quyen`', quoted(tableNames.permission))
    .replaceAll('TinNhanHoTro_khachHangId_fkey', `${suffix}_TK_fk`)
    .replaceAll('CuocTroChuyen_khachHangId_fkey', `${suffix}_CK_fk`)
    .replaceAll('CuocTroChuyen_nhanVienId_fkey', `${suffix}_CN_fk`)
    .replaceAll('CuocTroChuyen_nhaXeId_fkey', `${suffix}_CX_fk`)
    .replaceAll('TinNhanHoTro_cuocTroChuyenId_fkey', `${suffix}_TC_fk`)
    .replaceAll('TinNhanHoTro_taiKhoanGuiId_fkey', `${suffix}_TT_fk`)
    .replaceAll('TinNhanHoTro_clientMessageId_key', `${suffix}_TCM_key`)
    .replaceAll('TinNhanHoTro_cuocTroChuyen_createdAt_idx', `${suffix}_TCC_idx`)
    .replaceAll('CuocTroChuyen_maCuocTroChuyen_key', `${suffix}_CMC_key`)
    .replaceAll('CuocTroChuyen_nhaXe_trangThai_idx', `${suffix}_CNT_idx`)
    .replaceAll('CuocTroChuyen_khachHang_trangThai_idx', `${suffix}_CKT_idx`)
    .replaceAll('CuocTroChuyen_nhanVien_trangThai_idx', `${suffix}_CVT_idx`);

  if (!options.enforceLegacyFk) {
    transformedSql = transformedSql.replace(
      new RegExp(`ALTER TABLE ${quoted(tableNames.tinNhan)} DROP FOREIGN KEY \`${suffix}_TK_fk\`;?`),
      '-- skipped drop non-existent FK in test',
    );
  }

  const statements = transformedSql
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await db.$executeRawUnsafe(statement);
  }
}

async function teardownTestSchema(db: PrismaClient, tableNames: MigrationTableNames) {
  const quoted = (name: string) => `\`${name}\``;
  const dropOrder = [
    tableNames.tinNhan,
    tableNames.luuTru,
    tableNames.cuocTroChuyen,
    tableNames.assignments,
    tableNames.permission,
    tableNames.role,
    tableNames.nhanVien,
    tableNames.khachHang,
    tableNames.nhaXe,
    tableNames.taiKhoan,
  ];
  for (const tableName of dropOrder) {
    await db.$executeRawUnsafe(`DROP TABLE IF EXISTS ${quoted(tableName)}`);
  }
}

describe('Support chat schema migration with preflight archive and RBAC bootstrap (Option A)', () => {
  let prisma: PrismaClient | undefined;

  afterEach(async () => {
    await prisma?.$disconnect();
    prisma = undefined;
  });

  it('1. Database hoàn toàn rỗng: runs safely on empty tables and initializes canonical RBAC permissions', async () => {
    const db = createMigrationTestClient();
    prisma = db;
    await db.$connect();
    const { suffix, tableNames, quoted } = generateTestContext();

    try {
      await createLegacyBaseSchema(db, suffix, tableNames);
      await executeMigrationScript(db, suffix, tableNames);

      const permissions = await db.$queryRawUnsafe<Array<{ tenQuyen: string }>>(
        `SELECT \`tenQuyen\` FROM ${quoted(tableNames.permission)} WHERE \`tenQuyen\` IN ('chat:read', 'chat:manage') ORDER BY \`tenQuyen\``,
      );
      expect(permissions.map((p) => p.tenQuyen)).toEqual(['chat:manage', 'chat:read']);

      const adminRolePerms = await db.$queryRawUnsafe<Array<{ tenQuyen: string }>>(
        `SELECT p.\`tenQuyen\` FROM ${quoted(tableNames.assignments)} a
         JOIN ${quoted(tableNames.permission)} p ON p.\`quyenId\` = a.\`quyenId\`
         JOIN ${quoted(tableNames.role)} r ON r.\`vaiTroId\` = a.\`vaiTroId\`
         WHERE r.\`tenVaiTro\` = 'NHA_XE_ADMIN' AND p.\`tenQuyen\` IN ('chat:read', 'chat:manage')
         ORDER BY p.\`tenQuyen\``,
      );
      expect(adminRolePerms.map((p) => p.tenQuyen)).toEqual(['chat:manage', 'chat:read']);

      const cskhRolePerms = await db.$queryRawUnsafe<Array<{ tenQuyen: string }>>(
        `SELECT p.\`tenQuyen\` FROM ${quoted(tableNames.assignments)} a
         JOIN ${quoted(tableNames.permission)} p ON p.\`quyenId\` = a.\`quyenId\`
         JOIN ${quoted(tableNames.role)} r ON r.\`vaiTroId\` = a.\`vaiTroId\`
         WHERE r.\`tenVaiTro\` = 'NHAN_VIEN_CSKH' AND p.\`tenQuyen\` IN ('chat:read', 'chat:manage')
         ORDER BY p.\`tenQuyen\``,
      );
      expect(cskhRolePerms.map((p) => p.tenQuyen)).toEqual(['chat:manage', 'chat:read']);

      const [archiveCount] = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*) AS count FROM ${quoted(tableNames.luuTru)}`,
      );
      expect(Number(archiveCount.count)).toBe(0);

      const [messageCount] = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*) AS count FROM ${quoted(tableNames.tinNhan)}`,
      );
      expect(Number(messageCount.count)).toBe(0);
    } finally {
      await teardownTestSchema(db, tableNames);
    }
  });

  it('2. Test A — Archive integrity: verifies exact field-by-field preservation against legacy source data', async () => {
    const db = createMigrationTestClient();
    prisma = db;
    await db.$connect();
    const { suffix, tableNames, quoted } = generateTestContext();

    try {
      await createLegacyBaseSchema(db, suffix, tableNames);

      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.taiKhoan)} (\`taiKhoanId\`, \`email\`) VALUES
          (101, 'user101@vexgo.vn'),
          (102, 'user102@vexgo.vn')`,
      );
      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.khachHang)} (\`khachHangId\`, \`maKhachHang\`, \`taiKhoanId\`) VALUES
          (201, 'KH201', 101),
          (202, 'KH202', 102)`,
      );

      const fixtureMessages = [
        {
          tinNhanId: 101,
          noiDung: 'Tôi muốn đổi vé chuyến 14h hôm nay',
          thoiGian: '2026-06-01 07:15:20',
          trangThai: 'DA_GUI',
          khachHangId: 201,
          createdAt: '2026-06-01 07:15:20',
          updatedAt: '2026-06-01 07:16:00',
        },
        {
          tinNhanId: 102,
          noiDung: 'Chuyến xe có dừng đón tại bến xe Miền Tây không?',
          thoiGian: '2026-06-02 09:30:00',
          trangThai: 'DA_DOC',
          khachHangId: 201,
          createdAt: '2026-06-02 09:30:00',
          updatedAt: '2026-06-02 09:35:10',
        },
        {
          tinNhanId: 103,
          noiDung: 'Khiếu nại cước gửi hàng hóa xe máy bị tính sai',
          thoiGian: '2026-07-10 14:45:00',
          trangThai: 'DA_GUI',
          khachHangId: 202,
          createdAt: '2026-07-10 14:45:00',
          updatedAt: '2026-07-10 14:45:00',
        },
      ];

      for (const msg of fixtureMessages) {
        await db.$executeRawUnsafe(
          `INSERT INTO ${quoted(tableNames.tinNhan)} (\`tinNhanId\`, \`noiDung\`, \`thoiGian\`, \`trangThai\`, \`khachHangId\`, \`createdAt\`, \`updatedAt\`) VALUES
            (${msg.tinNhanId}, '${msg.noiDung}', '${msg.thoiGian}', '${msg.trangThai}', ${msg.khachHangId}, '${msg.createdAt}', '${msg.updatedAt}')`,
        );
      }

      await executeMigrationScript(db, suffix, tableNames);

      const archivedRows = await db.$queryRawUnsafe<
        Array<{
          tinNhanId: number;
          noiDung: string;
          thoiGianCu: Date;
          trangThaiCu: string;
          khachHangIdCu: number;
          createdAtCu: Date;
          updatedAtCu: Date;
          archivedAt: Date;
        }>
      >(
        `SELECT \`tinNhanId\`, \`noiDung\`, \`thoiGianCu\`, \`trangThaiCu\`, \`khachHangIdCu\`, \`createdAtCu\`, \`updatedAtCu\`, \`archivedAt\`
         FROM ${quoted(tableNames.luuTru)} ORDER BY \`tinNhanId\` ASC`,
      );

      // 1. Số lượng bản ghi archive phải đúng bằng số lượng nguồn
      expect(archivedRows).toHaveLength(fixtureMessages.length);

      // 2. Từng trường dữ liệu phải khớp chính xác tuyệt đối với dữ liệu nguồn
      for (let i = 0; i < fixtureMessages.length; i++) {
        const expected = fixtureMessages[i];
        const actual = archivedRows[i];

        expect(actual.tinNhanId).toBe(expected.tinNhanId);
        expect(actual.noiDung).toBe(expected.noiDung);
        expect(actual.trangThaiCu).toBe(expected.trangThai);
        expect(actual.khachHangIdCu).toBe(expected.khachHangId);
        expect(new Date(actual.thoiGianCu).toISOString()).toContain(expected.thoiGian.replace(' ', 'T'));
        expect(new Date(actual.createdAtCu).toISOString()).toContain(expected.createdAt.replace(' ', 'T'));
        expect(new Date(actual.updatedAtCu).toISOString()).toContain(expected.updatedAt.replace(' ', 'T'));
        expect(actual.archivedAt).toBeInstanceOf(Date);
        expect(Number.isNaN(actual.archivedAt.getTime())).toBe(false);
      }
    } finally {
      await teardownTestSchema(db, tableNames);
    }
  });

  it('3. Timestamp preservation & sync: preserves legacy thoiGian in archive and syncs thoiGian into createdAt for bound messages', async () => {
    const db = createMigrationTestClient();
    prisma = db;
    await db.$connect();
    const { suffix, tableNames, quoted } = generateTestContext();

    try {
      await createLegacyBaseSchema(db, suffix, tableNames);

      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.nhaXe)} (\`nhaXeId\`, \`tenNhaXe\`) VALUES (1, 'Nhà xe Phương Trang')`,
      );
      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.taiKhoan)} (\`taiKhoanId\`, \`email\`) VALUES (10, 'cust10@vexgo.vn')`,
      );
      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.khachHang)} (\`khachHangId\`, \`maKhachHang\`, \`taiKhoanId\`) VALUES (5, 'KH05', 10)`,
      );

      // Tạo trước một cuộc trò chuyện hợp lệ cho khách hàng 5
      await db.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS ${quoted(tableNames.cuocTroChuyen)} (
          \`cuocTroChuyenId\` INT NOT NULL AUTO_INCREMENT,
          \`maCuocTroChuyen\` VARCHAR(50) NOT NULL,
          \`tieuDe\` VARCHAR(255) NULL,
          \`trangThai\` VARCHAR(30) NOT NULL DEFAULT 'CHO_TIEP_NHAN',
          \`kenhHoTro\` VARCHAR(20) NOT NULL DEFAULT 'WEB',
          \`cheDoChat\` VARCHAR(30) NOT NULL DEFAULT 'NGUOI_THAT',
          \`khachHangId\` INT NOT NULL,
          \`nhanVienId\` INT NULL,
          \`nhaXeId\` INT NOT NULL,
          \`dongLuc\` DATETIME(0) NULL,
          \`createdAt\` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
          \`updatedAt\` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
          PRIMARY KEY (\`cuocTroChuyenId\`),
          UNIQUE KEY (\`maCuocTroChuyen\`)
        ) ENGINE=InnoDB`,
      );
      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.cuocTroChuyen)} (\`cuocTroChuyenId\`, \`maCuocTroChuyen\`, \`trangThai\`, \`khachHangId\`, \`nhaXeId\`) VALUES
          (500, 'CONV-LIVE-500', 'CHO_TIEP_NHAN', 5, 1)`,
      );

      // Thêm tin nhắn legacy: thoiGian là 2026-04-01 08:00:00, trong khi createdAt là 2026-10-10 12:00:00
      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.tinNhan)} (\`tinNhanId\`, \`noiDung\`, \`thoiGian\`, \`trangThai\`, \`khachHangId\`, \`createdAt\`, \`updatedAt\`) VALUES
          (10, 'Tin nhắn gửi tháng 4', '2026-04-01 08:00:00', 'DA_GUI', 5, '2026-10-10 12:00:00', '2026-10-10 12:00:00')`,
      );

      await executeMigrationScript(db, suffix, tableNames);

      // 1. Xác minh trong bảng archive: thoiGianCu phản ánh chính xác ngày 2026-04-01 gốc
      const [archived] = await db.$queryRawUnsafe<
        Array<{
          tinNhanId: number;
          thoiGianCu: Date;
          createdAtCu: Date;
        }>
      >(
        `SELECT \`tinNhanId\`, \`thoiGianCu\`, \`createdAtCu\` FROM ${quoted(tableNames.luuTru)} WHERE \`tinNhanId\` = 10`,
      );
      expect(archived).toBeDefined();
      expect(new Date(archived.thoiGianCu).toISOString()).toContain('2026-04-01');
      expect(new Date(archived.createdAtCu).toISOString()).toContain('2026-10-10');
    } finally {
      await teardownTestSchema(db, tableNames);
    }
  });

  it('4. Database không có nhà xe ID 1 hoặc chỉ có các ID không liên tục: executes safely without foreign key errors', async () => {
    const db = createMigrationTestClient();
    prisma = db;
    await db.$connect();
    const { suffix, tableNames, quoted } = generateTestContext();

    try {
      await createLegacyBaseSchema(db, suffix, tableNames);

      // Database KHÔNG có nhaXeId = 1, chỉ có ID không liên tục 50, 99
      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.nhaXe)} (\`nhaXeId\`, \`tenNhaXe\`) VALUES
          (50, 'Nhà xe Thành Bưởi'),
          (99, 'Nhà xe Futa Bus Lines')`,
      );

      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.taiKhoan)} (\`taiKhoanId\`, \`email\`) VALUES (10, 'cust10@vexgo.vn')`,
      );
      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.khachHang)} (\`khachHangId\`, \`maKhachHang\`, \`taiKhoanId\`) VALUES (5, 'KH05', 10)`,
      );
      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.tinNhan)} (\`tinNhanId\`, \`noiDung\`, \`thoiGian\`, \`trangThai\`, \`khachHangId\`, \`createdAt\`, \`updatedAt\`) VALUES
          (1, 'Hỏi đáp chung', '2026-10-10 10:00:00', 'DA_GUI', 5, '2026-10-10 10:00:00', '2026-10-10 10:00:00')`,
      );

      // Chạy migration thành công mà không phụ thuộc nhaXeId = 1
      await executeMigrationScript(db, suffix, tableNames);

      const [archiveCount] = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*) AS count FROM ${quoted(tableNames.luuTru)}`,
      );
      expect(Number(archiveCount.count)).toBe(1);

      // Không tự ý tạo hội thoại sai tenant gán vào nhaXeId = 50 hay 99
      const [convCount] = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*) AS count FROM ${quoted(tableNames.cuocTroChuyen)}`,
      );
      expect(Number(convCount.count)).toBe(0);
    } finally {
      await teardownTestSchema(db, tableNames);
    }
  });

  it('5. Test B — Option A & Tenant Isolation: does not arbitrarily guess bus company, isolates legacy archive from tenant chats', async () => {
    const db = createMigrationTestClient();
    prisma = db;
    await db.$connect();
    const { suffix, tableNames, quoted } = generateTestContext();

    try {
      await createLegacyBaseSchema(db, suffix, tableNames);

      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.nhaXe)} (\`nhaXeId\`, \`tenNhaXe\`) VALUES
          (10, 'Nhà xe Hải Vân'),
          (20, 'Nhà xe Sao Việt')`,
      );
      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.taiKhoan)} (\`taiKhoanId\`, \`email\`) VALUES
          (1, 'cust1@vexgo.vn'),
          (2, 'cust2@vexgo.vn')`,
      );
      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.khachHang)} (\`khachHangId\`, \`maKhachHang\`, \`taiKhoanId\`) VALUES
          (1, 'KH01', 1),
          (2, 'KH02', 2)`,
      );
      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.tinNhan)} (\`tinNhanId\`, \`noiDung\`, \`thoiGian\`, \`trangThai\`, \`khachHangId\`, \`createdAt\`, \`updatedAt\`) VALUES
          (1, 'Tin nhắn của khách 1 chưa từng đặt vé', '2026-10-10 09:00:00', 'DA_GUI', 1, '2026-10-10 09:00:00', '2026-10-10 09:00:00'),
          (2, 'Tin nhắn của khách 2 giao dịch nhiều nhà xe', '2026-10-10 09:10:00', 'DA_GUI', 2, '2026-10-10 09:10:00', '2026-10-10 09:10:00')`,
      );

      await executeMigrationScript(db, suffix, tableNames);

      // 1. Dữ liệu cũ được bảo toàn trong archive
      const archived = await db.$queryRawUnsafe<Array<{ tinNhanId: number; khachHangIdCu: number }>>(
        `SELECT \`tinNhanId\`, \`khachHangIdCu\` FROM ${quoted(tableNames.luuTru)} ORDER BY \`tinNhanId\` ASC`,
      );
      expect(archived).toHaveLength(2);
      expect(archived[0].khachHangIdCu).toBe(1);
      expect(archived[1].khachHangIdCu).toBe(2);

      // 2. Tuyệt đối không sinh hội thoại tenant-scoped gán bừa cho nhà xe 10 hoặc 20
      const convs = await db.$queryRawUnsafe<Array<{ cuocTroChuyenId: number }>>(
        `SELECT \`cuocTroChuyenId\` FROM ${quoted(tableNames.cuocTroChuyen)}`,
      );
      expect(convs).toHaveLength(0);

      // 3. Bảng TinNhanHoTro không còn bản ghi vi phạm constraint NOT NULL
      const activeMessages = await db.$queryRawUnsafe<Array<{ tinNhanId: number }>>(
        `SELECT \`tinNhanId\` FROM ${quoted(tableNames.tinNhan)}`,
      );
      expect(activeMessages).toHaveLength(0);

      // 4. Kiểm tra tenant-scoped isolation: Query tin nhắn theo bất kỳ nhà xe nào đều không có dữ liệu legacy bị rò rỉ
      for (const nhaXeId of [10, 20]) {
        const leakedMessages = await db.$queryRawUnsafe<Array<{ tinNhanId: number }>>(
          `SELECT msg.\`tinNhanId\` FROM ${quoted(tableNames.tinNhan)} msg
           JOIN ${quoted(tableNames.cuocTroChuyen)} ctc ON ctc.\`cuocTroChuyenId\` = msg.\`cuocTroChuyenId\`
           WHERE ctc.\`nhaXeId\` = ${nhaXeId}`,
        );
        expect(leakedMessages).toHaveLength(0);
      }
    } finally {
      await teardownTestSchema(db, tableNames);
    }
  });

  it('6. Bản ghi mồ côi (khachHangId không tồn tại, tài khoản bị thiếu): handles orphaned records safely via archive without FK failure', async () => {
    const db = createMigrationTestClient();
    prisma = db;
    await db.$connect();
    const { suffix, tableNames, quoted } = generateTestContext();

    try {
      // Tạo schema cũ không gắn FK constraint trực tiếp ở TinNhanHoTro để mô phỏng dữ liệu legacy bị orphaned
      await createLegacyBaseSchema(db, suffix, tableNames, { enforceLegacyFk: false });

      // Chèn bản ghi mồ côi (khachHangId = 9999 không tồn tại trong KhachHang)
      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.tinNhan)} (\`tinNhanId\`, \`noiDung\`, \`thoiGian\`, \`trangThai\`, \`khachHangId\`, \`createdAt\`, \`updatedAt\`) VALUES
          (999, 'Tin nhắn mồ côi không có khách hàng', '2026-10-12 11:00:00', 'DA_GUI', 9999, '2026-10-12 11:00:00', '2026-10-12 11:00:00')`,
      );

      // Chạy migration không bị gãy bởi foreign key constraint
      await executeMigrationScript(db, suffix, tableNames, { enforceLegacyFk: false });

      // Bản ghi mồ côi được bảo toàn an toàn trong archive
      const [archived] = await db.$queryRawUnsafe<Array<{ tinNhanId: number; khachHangIdCu: number; noiDung: string }>>(
        `SELECT \`tinNhanId\`, \`khachHangIdCu\`, \`noiDung\` FROM ${quoted(tableNames.luuTru)} WHERE \`tinNhanId\` = 999`,
      );
      expect(archived).toBeDefined();
      expect(archived.khachHangIdCu).toBe(9999);
      expect(archived.noiDung).toBe('Tin nhắn mồ côi không có khách hàng');

      // Bảng TinNhanHoTro sạch, không vi phạm FK
      const [msgCount] = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*) AS count FROM ${quoted(tableNames.tinNhan)}`,
      );
      expect(Number(msgCount.count)).toBe(0);
    } finally {
      await teardownTestSchema(db, tableNames);
    }
  });

  it('7. Trạng thái hội thoại tạo ra phải là DA_DONG và dongLuc không được NULL: standardizes status and timestamps', async () => {
    const db = createMigrationTestClient();
    prisma = db;
    await db.$connect();
    const { suffix, tableNames, quoted } = generateTestContext();

    try {
      await createLegacyBaseSchema(db, suffix, tableNames);

      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.nhaXe)} (\`nhaXeId\`, \`tenNhaXe\`) VALUES (1, 'Nhà xe Phương Trang')`,
      );
      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.taiKhoan)} (\`taiKhoanId\`, \`email\`) VALUES (10, 'cust10@vexgo.vn')`,
      );
      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.khachHang)} (\`khachHangId\`, \`maKhachHang\`, \`taiKhoanId\`) VALUES (5, 'KH05', 10)`,
      );

      // Tạo trước bảng CuocTroChuyen có cuộc trò chuyện ở trạng thái cũ 'DONG' và dongLuc NULL
      await db.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS ${quoted(tableNames.cuocTroChuyen)} (
          \`cuocTroChuyenId\` INT NOT NULL AUTO_INCREMENT,
          \`maCuocTroChuyen\` VARCHAR(50) NOT NULL,
          \`tieuDe\` VARCHAR(255) NULL,
          \`trangThai\` VARCHAR(30) NOT NULL DEFAULT 'CHO_TIEP_NHAN',
          \`kenhHoTro\` VARCHAR(20) NOT NULL DEFAULT 'WEB',
          \`cheDoChat\` VARCHAR(30) NOT NULL DEFAULT 'NGUOI_THAT',
          \`khachHangId\` INT NOT NULL,
          \`nhanVienId\` INT NULL,
          \`nhaXeId\` INT NOT NULL,
          \`dongLuc\` DATETIME(0) NULL,
          \`createdAt\` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
          \`updatedAt\` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
          PRIMARY KEY (\`cuocTroChuyenId\`),
          UNIQUE KEY (\`maCuocTroChuyen\`)
        ) ENGINE=InnoDB`,
      );

      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.cuocTroChuyen)} (\`cuocTroChuyenId\`, \`maCuocTroChuyen\`, \`trangThai\`, \`khachHangId\`, \`nhaXeId\`, \`dongLuc\`, \`createdAt\`, \`updatedAt\`) VALUES
          (1, 'CONV-LEGACY-01', 'DONG', 5, 1, NULL, '2026-10-01 10:00:00', '2026-10-01 11:30:00'),
          (2, 'CONV-LEGACY-02', 'DA_DONG', 5, 1, NULL, '2026-10-02 10:00:00', '2026-10-02 11:45:00')`,
      );

      await executeMigrationScript(db, suffix, tableNames);

      const convs = await db.$queryRawUnsafe<
        Array<{
          cuocTroChuyenId: number;
          maCuocTroChuyen: string;
          trangThai: string;
          dongLuc: Date | null;
        }>
      >(
        `SELECT \`cuocTroChuyenId\`, \`maCuocTroChuyen\`, \`trangThai\`, \`dongLuc\` FROM ${quoted(tableNames.cuocTroChuyen)} ORDER BY \`cuocTroChuyenId\` ASC`,
      );

      expect(convs).toHaveLength(2);

      // Cuộc trò chuyện 1: 'DONG' đã được chuẩn hóa thành 'DA_DONG', dongLuc không được NULL
      expect(convs[0].trangThai).toBe('DA_DONG');
      expect(convs[0].dongLuc).toBeInstanceOf(Date);
      expect(convs[0].dongLuc).not.toBeNull();

      // Cuộc trò chuyện 2: 'DA_DONG' có dongLuc NULL đã được gán dongLuc hợp lệ
      expect(convs[1].trangThai).toBe('DA_DONG');
      expect(convs[1].dongLuc).toBeInstanceOf(Date);
      expect(convs[1].dongLuc).not.toBeNull();
    } finally {
      await teardownTestSchema(db, tableNames);
    }
  });

  it('8. Test C — Archive query and controlled recovery procedure: proves retrieval and authorized manual restoration', async () => {
    const db = createMigrationTestClient();
    prisma = db;
    await db.$connect();
    const { suffix, tableNames, quoted } = generateTestContext();

    try {
      await createLegacyBaseSchema(db, suffix, tableNames);

      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.nhaXe)} (\`nhaXeId\`, \`tenNhaXe\`) VALUES (7, 'Nhà xe Mai Linh')`,
      );
      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.taiKhoan)} (\`taiKhoanId\`, \`email\`) VALUES (88, 'cust88@vexgo.vn')`,
      );
      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.khachHang)} (\`khachHangId\`, \`maKhachHang\`, \`taiKhoanId\`) VALUES (88, 'KH088', 88)`,
      );
      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.tinNhan)} (\`tinNhanId\`, \`noiDung\`, \`thoiGian\`, \`trangThai\`, \`khachHangId\`, \`createdAt\`, \`updatedAt\`) VALUES
          (888, 'Tin nhắn cần phục hồi theo quy trình runbook', '2026-09-01 15:00:00', 'DA_GUI', 88, '2026-09-01 15:00:00', '2026-09-01 15:00:00')`,
      );

      await executeMigrationScript(db, suffix, tableNames);

      // Bước 1: Tra cứu có kiểm soát theo tinNhanId từ bảng archive
      const [found] = await db.$queryRawUnsafe<
        Array<{
          tinNhanId: number;
          noiDung: string;
          thoiGianCu: Date;
          khachHangIdCu: number;
        }>
      >(
        `SELECT \`tinNhanId\`, \`noiDung\`, \`thoiGianCu\`, \`khachHangIdCu\`
         FROM ${quoted(tableNames.luuTru)} WHERE \`tinNhanId\` = 888`,
      );
      expect(found).toBeDefined();
      expect(found.tinNhanId).toBe(888);
      expect(found.noiDung).toBe('Tin nhắn cần phục hồi theo quy trình runbook');
      expect(found.khachHangIdCu).toBe(88);

      // Bước 2: Mô phỏng Quy trình Phục hồi có kiểm soát (Manual Handled Recovery theo Runbook)
      // Khi đã xác minh được tenant sở hữu là Nhà xe 7, tạo cuộc trò chuyện hợp lệ cho khách hàng 88
      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.cuocTroChuyen)} (
          \`maCuocTroChuyen\`, \`tieuDe\`, \`trangThai\`, \`kenhHoTro\`, \`cheDoChat\`, \`khachHangId\`, \`nhaXeId\`, \`createdAt\`, \`updatedAt\`
        ) VALUES (
          'RECOVERED-KH88-NX7', 'Hỗ trợ phục hồi cho KH088', 'CHO_TIEP_NHAN', 'WEB', 'NGUOI_THAT', 88, 7, CURRENT_TIMESTAMP(0), CURRENT_TIMESTAMP(0)
        )`,
      );

      const [newConv] = await db.$queryRawUnsafe<Array<{ cuocTroChuyenId: number }>>(
        `SELECT \`cuocTroChuyenId\` FROM ${quoted(tableNames.cuocTroChuyen)} WHERE \`maCuocTroChuyen\` = 'RECOVERED-KH88-NX7'`,
      );
      expect(newConv).toBeDefined();

      // Nạp tin nhắn từ archive vào bảng hoạt động theo đúng schema mới
      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.tinNhan)} (
          \`cuocTroChuyenId\`, \`taiKhoanGuiId\`, \`loaiNguoiGui\`, \`loaiTinNhan\`, \`noiDung\`, \`trangThai\`, \`createdAt\`, \`updatedAt\`
        )
        SELECT
          ${newConv.cuocTroChuyenId},
          kh.\`taiKhoanId\`,
          'KHACH_HANG',
          'VAN_BAN',
          arc.\`noiDung\`,
          arc.\`trangThaiCu\`,
          arc.\`thoiGianCu\`,
          arc.\`updatedAtCu\`
        FROM ${quoted(tableNames.luuTru)} arc
        JOIN ${quoted(tableNames.khachHang)} kh ON kh.\`khachHangId\` = arc.\`khachHangIdCu\`
        WHERE arc.\`tinNhanId\` = 888`,
      );

      // Kiểm tra tin nhắn được phục hồi hoạt động bình thường và ràng buộc khóa ngoại thỏa mãn
      const [restoredMsg] = await db.$queryRawUnsafe<
        Array<{
          tinNhanId: number;
          cuocTroChuyenId: number;
          taiKhoanGuiId: number;
          loaiNguoiGui: string;
          noiDung: string;
        }>
      >(
        `SELECT \`tinNhanId\`, \`cuocTroChuyenId\`, \`taiKhoanGuiId\`, \`loaiNguoiGui\`, \`noiDung\`
         FROM ${quoted(tableNames.tinNhan)} WHERE \`cuocTroChuyenId\` = ${newConv.cuocTroChuyenId}`,
      );
      expect(restoredMsg).toBeDefined();
      expect(restoredMsg.cuocTroChuyenId).toBe(newConv.cuocTroChuyenId);
      expect(restoredMsg.taiKhoanGuiId).toBe(88);
      expect(restoredMsg.loaiNguoiGui).toBe('KHACH_HANG');
      expect(restoredMsg.noiDung).toBe('Tin nhắn cần phục hồi theo quy trình runbook');
    } finally {
      await teardownTestSchema(db, tableNames);
    }
  });

  it('9. Test D — Prisma schema lifecycle & drift protection: verifies model registration and zero drift', () => {
    // 1. Kiểm tra Prisma Client đã định nghĩa model LuuTruTinNhanHoTroCu
    const client = createMigrationTestClient();
    expect(client).toHaveProperty('luuTruTinNhanHoTroCu');

    // 2. Chạy prisma migrate diff kiểm tra schema drift giữa migrations và schema.prisma
    const diffOutput = execSync(
      'npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script',
      { cwd: resolve(process.cwd(), '../../'), encoding: 'utf8' },
    );

    // Schema đồng bộ hoàn toàn, không có lệnh DROP TABLE LuuTruTinNhanHoTroCu nào được sinh ra
    expect(diffOutput).toContain('-- This is an empty migration.');
    expect(diffOutput).not.toContain('DROP TABLE `LuuTruTinNhanHoTroCu`');
    expect(diffOutput).not.toContain('DROP TABLE LuuTruTinNhanHoTroCu');
  }, 60000);

  it('10. Test E — Migration failure & partial retry safety: verifies INSERT IGNORE idempotency on archive step', async () => {
    const db = createMigrationTestClient();
    prisma = db;
    await db.$connect();
    const { suffix, tableNames, quoted } = generateTestContext();

    try {
      await createLegacyBaseSchema(db, suffix, tableNames);

      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.taiKhoan)} (\`taiKhoanId\`, \`email\`) VALUES (1, 'u1@vexgo.vn')`,
      );
      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.khachHang)} (\`khachHangId\`, \`maKhachHang\`, \`taiKhoanId\`) VALUES (1, 'KH1', 1)`,
      );
      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.tinNhan)} (\`tinNhanId\`, \`noiDung\`, \`thoiGian\`, \`trangThai\`, \`khachHangId\`, \`createdAt\`, \`updatedAt\`) VALUES
          (1, 'Thử nghiệm retry archive', '2026-10-10 10:00:00', 'DA_GUI', 1, '2026-10-10 10:00:00', '2026-10-10 10:00:00')`,
      );

      // Tạo bảng archive trước và chèn trước bản ghi 1 (mô phỏng lần chạy migration trước bị fail sau bước archive)
      await db.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS ${quoted(tableNames.luuTru)} (
          \`tinNhanId\` INTEGER NOT NULL,
          \`noiDung\` TEXT NOT NULL,
          \`thoiGianCu\` DATETIME(0) NOT NULL,
          \`trangThaiCu\` VARCHAR(30) NOT NULL,
          \`khachHangIdCu\` INTEGER NOT NULL,
          \`createdAtCu\` DATETIME(0) NOT NULL,
          \`updatedAtCu\` DATETIME(0) NOT NULL,
          \`archivedAt\` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
          PRIMARY KEY (\`tinNhanId\`)
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      );
      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.luuTru)} (\`tinNhanId\`, \`noiDung\`, \`thoiGianCu\`, \`trangThaiCu\`, \`khachHangIdCu\`, \`createdAtCu\`, \`updatedAtCu\`) VALUES
          (1, 'Thử nghiệm retry archive', '2026-10-10 10:00:00', 'DA_GUI', 1, '2026-10-10 10:00:00', '2026-10-10 10:00:00')`,
      );

      // Chạy migration: Lệnh INSERT IGNORE INTO LuuTruTinNhanHoTroCu không bị crash vì duplicate key
      await executeMigrationScript(db, suffix, tableNames);

      const [archiveCount] = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*) AS count FROM ${quoted(tableNames.luuTru)}`,
      );
      expect(Number(archiveCount.count)).toBe(1);
    } finally {
      await teardownTestSchema(db, tableNames);
    }
  });
});
