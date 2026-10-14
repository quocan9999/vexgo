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

describe('Support chat schema migration with preflight archive and RBAC bootstrap', () => {
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

  it('2. Bảng tin nhắn cũ có nhiều bản ghi hợp lệ: executes smoothly and creates archive records without data loss', async () => {
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
      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.tinNhan)} (\`tinNhanId\`, \`noiDung\`, \`thoiGian\`, \`trangThai\`, \`khachHangId\`, \`createdAt\`, \`updatedAt\`) VALUES
          (1, 'Tin nhắn 1 cần đổi vé', '2026-10-10 08:00:00', 'DA_GUI', 201, '2026-10-10 08:00:00', '2026-10-10 08:00:00'),
          (2, 'Tin nhắn 2 hỏi giờ xe chạy', '2026-10-10 08:15:00', 'DA_DOC', 201, '2026-10-10 08:15:00', '2026-10-10 08:15:00'),
          (3, 'Tin nhắn 3 khiếu nại cước', '2026-10-11 09:30:00', 'DA_GUI', 202, '2026-10-11 09:30:00', '2026-10-11 09:30:00')`,
      );

      await executeMigrationScript(db, suffix, tableNames);

      const [archiveCount] = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*) AS count FROM ${quoted(tableNames.luuTru)}`,
      );
      expect(Number(archiveCount.count)).toBe(3);

      const [activeCount] = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*) AS count FROM ${quoted(tableNames.tinNhan)}`,
      );
      expect(Number(activeCount.count)).toBe(0);
    } finally {
      await teardownTestSchema(db, tableNames);
    }
  });

  it('3. thoiGian khác với createdAt: syncs thoiGian into createdAt accurately before dropping thoiGian', async () => {
    const db = createMigrationTestClient();
    prisma = db;
    await db.$connect();
    const { suffix, tableNames, quoted } = generateTestContext();

    try {
      await createLegacyBaseSchema(db, suffix, tableNames);

      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.taiKhoan)} (\`taiKhoanId\`, \`email\`) VALUES (10, 'cust10@vexgo.vn')`,
      );
      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.khachHang)} (\`khachHangId\`, \`maKhachHang\`, \`taiKhoanId\`) VALUES (5, 'KH05', 10)`,
      );

      // thoiGian gốc là 2026-04-01 08:00:00, trong khi createdAt mặc định là 2026-10-10 12:00:00
      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.tinNhan)} (\`tinNhanId\`, \`noiDung\`, \`thoiGian\`, \`trangThai\`, \`khachHangId\`, \`createdAt\`, \`updatedAt\`) VALUES
          (10, 'Tin nhắn gửi tháng 4', '2026-04-01 08:00:00', 'DA_GUI', 5, '2026-10-10 12:00:00', '2026-10-10 12:00:00')`,
      );

      await executeMigrationScript(db, suffix, tableNames);

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

  it('5. Khách hàng đã giao dịch với nhiều nhà xe hoặc chưa từng giao dịch: preserves tenant isolation without guessing', async () => {
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

      // Dữ liệu cũ được bảo toàn trong archive
      const archived = await db.$queryRawUnsafe<Array<{ tinNhanId: number; khachHangIdCu: number }>>(
        `SELECT \`tinNhanId\`, \`khachHangIdCu\` FROM ${quoted(tableNames.luuTru)} ORDER BY \`tinNhanId\` ASC`,
      );
      expect(archived).toHaveLength(2);
      expect(archived[0].khachHangIdCu).toBe(1);
      expect(archived[1].khachHangIdCu).toBe(2);

      // Tuyệt đối không sinh hội thoại tenant-scoped gán bừa cho nhà xe 10 hoặc 20
      const convs = await db.$queryRawUnsafe<Array<{ cuocTroChuyenId: number }>>(
        `SELECT \`cuocTroChuyenId\` FROM ${quoted(tableNames.cuocTroChuyen)}`,
      );
      expect(convs).toHaveLength(0);

      // Bảng TinNhanHoTro không còn bản ghi vi phạm constraint NOT NULL
      const activeMessages = await db.$queryRawUnsafe<Array<{ tinNhanId: number }>>(
        `SELECT \`tinNhanId\` FROM ${quoted(tableNames.tinNhan)}`,
      );
      expect(activeMessages).toHaveLength(0);
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

  it('8. Dữ liệu lưu trữ trong LuuTruTinNhanHoTroCu bảo toàn đầy đủ các trường cũ: validates full schema fidelity', async () => {
    const db = createMigrationTestClient();
    prisma = db;
    await db.$connect();
    const { suffix, tableNames, quoted } = generateTestContext();

    try {
      await createLegacyBaseSchema(db, suffix, tableNames);

      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.taiKhoan)} (\`taiKhoanId\`, \`email\`) VALUES (10, 'cust10@vexgo.vn')`,
      );
      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.khachHang)} (\`khachHangId\`, \`maKhachHang\`, \`taiKhoanId\`) VALUES (5, 'KH05', 10)`,
      );
      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.tinNhan)} (\`tinNhanId\`, \`noiDung\`, \`thoiGian\`, \`trangThai\`, \`khachHangId\`, \`createdAt\`, \`updatedAt\`) VALUES
          (42, 'Nội dung chi tiết kiểm tra archive', '2026-08-15 14:22:33', 'DA_GUI', 5, '2026-08-15 14:20:00', '2026-08-15 14:25:00')`,
      );

      await executeMigrationScript(db, suffix, tableNames);

      const [archiveRecord] = await db.$queryRawUnsafe<
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
         FROM ${quoted(tableNames.luuTru)} WHERE \`tinNhanId\` = 42`,
      );

      expect(archiveRecord).toBeDefined();
      expect(archiveRecord.tinNhanId).toBe(42);
      expect(archiveRecord.noiDung).toBe('Nội dung chi tiết kiểm tra archive');
      expect(archiveRecord.trangThaiCu).toBe('DA_GUI');
      expect(archiveRecord.khachHangIdCu).toBe(5);
      expect(archiveRecord.thoiGianCu).toBeInstanceOf(Date);
      expect(archiveRecord.createdAtCu).toBeInstanceOf(Date);
      expect(archiveRecord.updatedAtCu).toBeInstanceOf(Date);
      expect(archiveRecord.archivedAt).toBeInstanceOf(Date);
      expect(new Date(archiveRecord.thoiGianCu).toISOString()).toContain('2026-08-15T14:22:33');
    } finally {
      await teardownTestSchema(db, tableNames);
    }
  });
});
