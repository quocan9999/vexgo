import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { config as loadDotenv } from 'dotenv';
import mariadb, { type Connection } from 'mariadb';
import { afterEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '../../../src/generated/prisma/client.js';

loadDotenv({ path: resolve(process.cwd(), '../../.env') });
loadDotenv({ path: resolve(process.cwd(), '.env') });

async function createDirectDatabaseConnection(): Promise<Connection> {
  const configuredDatabaseUrl = process.env.DATABASE_URL;
  if (!configuredDatabaseUrl) {
    throw new Error(
      'DATABASE_URL is required for the chat migration integration test',
    );
  }
  const databaseUrl = new URL(configuredDatabaseUrl);
  return mariadb.createConnection({
    host: databaseUrl.hostname,
    port: Number(databaseUrl.port || 3306),
    user: decodeURIComponent(databaseUrl.username),
    password: decodeURIComponent(databaseUrl.password),
    database: decodeURIComponent(databaseUrl.pathname.replace(/^\/+/, '')),
    multipleStatements: true,
  });
}

function createMigrationTestClient(options?: { connectionLimit?: number }): PrismaClient {
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
      ...(options?.connectionLimit ? { connectionLimit: options.connectionLimit } : {}),
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
    .replaceAll('CuocTroChuyen_nhanVien_trangThai_idx', `${suffix}_CVT_idx`)
    .replaceAll("'TinNhanHoTro'", `'${tableNames.tinNhan}'`);

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

async function createRecoveryProcedure(
  conn: Connection,
  procedureName: string,
  tableNames: MigrationTableNames,
  options?: { testFaultInjectPartialInsert?: boolean },
) {
  const quoted = (name: string) => `\`${name}\``;
  await conn.query(`DROP PROCEDURE IF EXISTS \`${procedureName}\`;`);

  const partialInsertClause = options?.testFaultInjectPartialInsert
    ? `AND arc.\`tinNhanId\` = 888`
    : '';

  const testPreGuardCheck = options?.testFaultInjectPartialInsert
    ? `IF v_insertedCount = 0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'TEST_SETUP_NO_ROWS_INSERTED'; END IF;`
    : '';

  const procedureSql = `
    CREATE PROCEDURE \`${procedureName}\`(
      IN p_targetKhachHangId INT,
      IN p_targetNhaXeId INT,
      IN p_tinNhanIdsJson JSON,
      IN p_expectedCount INT,
      OUT p_newCuocTroChuyenId INT
    )
    proc_body: BEGIN
      DECLARE v_verifiedCount INT DEFAULT 0;
      DECLARE v_insertedCount INT DEFAULT 0;
      DECLARE v_uniqueIdCount INT DEFAULT 0;
      DECLARE v_invalidIdCount INT DEFAULT 0;
      DECLARE v_maCuocTroChuyen VARCHAR(100);
      DECLARE v_taiKhoanId INT DEFAULT NULL;

      DECLARE EXIT HANDLER FOR SQLEXCEPTION
      BEGIN
        ROLLBACK;
        RESIGNAL;
      END;

      START TRANSACTION;

      -- 1. Validation tham số đầu vào
      IF p_targetKhachHangId IS NULL OR p_targetKhachHangId <= 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'INVALID_TARGET_KHACH_HANG_ID';
      END IF;

      IF p_targetNhaXeId IS NULL OR p_targetNhaXeId <= 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'INVALID_TARGET_NHA_XE_ID';
      END IF;

      IF p_tinNhanIdsJson IS NULL OR NOT JSON_VALID(p_tinNhanIdsJson) OR JSON_LENGTH(p_tinNhanIdsJson) = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'INVALID_OR_EMPTY_TIN_NHAN_IDS_JSON';
      END IF;

      -- Kiểm tra danh sách ID: từ chối ID không hợp lệ và từ chối danh sách chứa ID trùng lặp (Finding A)
      SELECT 
        COUNT(DISTINCT jt.\`tinNhanId\`),
        COUNT(CASE WHEN jt.\`tinNhanId\` IS NULL OR jt.\`tinNhanId\` <= 0 THEN 1 END)
      INTO 
        v_uniqueIdCount,
        v_invalidIdCount
      FROM JSON_TABLE(p_tinNhanIdsJson, '$[*]' COLUMNS (\`tinNhanId\` INT PATH '$')) jt;

      IF v_invalidIdCount > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'INVALID_TIN_NHAN_ID_IN_LIST';
      END IF;

      IF v_uniqueIdCount <> JSON_LENGTH(p_tinNhanIdsJson) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'DUPLICATE_TIN_NHAN_IDS_DETECTED';
      END IF;

      IF p_expectedCount IS NULL OR p_expectedCount <= 0 OR p_expectedCount <> v_uniqueIdCount THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'EXPECTED_COUNT_MISMATCH_WITH_JSON_LENGTH';
      END IF;

      -- 2. Kiểm tra tồn tại khách hàng và lấy tài khoản
      SELECT \`taiKhoanId\` INTO v_taiKhoanId
      FROM ${quoted(tableNames.khachHang)}
      WHERE \`khachHangId\` = p_targetKhachHangId;

      IF v_taiKhoanId IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'CUSTOMER_OR_ACCOUNT_NOT_FOUND';
      END IF;

      -- 3. Kiểm tra tồn tại nhà xe
      IF NOT EXISTS (SELECT 1 FROM ${quoted(tableNames.nhaXe)} WHERE \`nhaXeId\` = p_targetNhaXeId) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'BUS_COMPANY_NOT_FOUND';
      END IF;

      -- 4. Guard 1: Xác thực số lượng tin nhắn trong archive thuộc DUY NHẤT khách hàng đích
      SELECT COUNT(DISTINCT arc.\`tinNhanId\`) INTO v_verifiedCount
      FROM ${quoted(tableNames.luuTru)} arc
      JOIN JSON_TABLE(p_tinNhanIdsJson, '$[*]' COLUMNS (\`tinNhanId\` INT PATH '$')) jt
        ON jt.\`tinNhanId\` = arc.\`tinNhanId\`
      WHERE arc.\`khachHangIdCu\` = p_targetKhachHangId;

      IF v_verifiedCount <> p_expectedCount THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'CROSS_CUSTOMER_OR_MISSING_ARCHIVE_MESSAGES_DETECTED';
      END IF;

      -- 5. Tạo cuộc trò chuyện mới cho đúng khách hàng đích và nhà xe đã xác minh
      SET v_maCuocTroChuyen = CONCAT('RECOVERED-KH', p_targetKhachHangId, '-NX', p_targetNhaXeId, '-', UNIX_TIMESTAMP());
      INSERT INTO ${quoted(tableNames.cuocTroChuyen)} (
        \`maCuocTroChuyen\`, \`tieuDe\`, \`trangThai\`, \`kenhHoTro\`, \`cheDoChat\`,
        \`khachHangId\`, \`nhaXeId\`, \`createdAt\`, \`updatedAt\`
      ) VALUES (
        v_maCuocTroChuyen,
        CONCAT('Phục hồi hỗ trợ khách hàng KH', p_targetKhachHangId),
        'CHO_TIEP_NHAN',
        'WEB',
        'NGUOI_THAT',
        p_targetKhachHangId,
        p_targetNhaXeId,
        CURRENT_TIMESTAMP(0),
        CURRENT_TIMESTAMP(0)
      );

      SET p_newCuocTroChuyenId = LAST_INSERT_ID();

      -- 6. Nạp tin nhắn từ archive: Ràng buộc kép arc.khachHangIdCu = ctc.khachHangId
      INSERT INTO ${quoted(tableNames.tinNhan)} (
        \`cuocTroChuyenId\`, \`taiKhoanGuiId\`, \`loaiNguoiGui\`, \`loaiTinNhan\`,
        \`noiDung\`, \`trangThai\`, \`createdAt\`, \`updatedAt\`
      )
      SELECT
        ctc.\`cuocTroChuyenId\`,
        v_taiKhoanId,
        'KHACH_HANG',
        'VAN_BAN',
        arc.\`noiDung\`,
        arc.\`trangThaiCu\`,
        arc.\`thoiGianCu\`,
        arc.\`updatedAtCu\`
      FROM ${quoted(tableNames.luuTru)} arc
      JOIN JSON_TABLE(p_tinNhanIdsJson, '$[*]' COLUMNS (\`tinNhanId\` INT PATH '$')) jt
        ON jt.\`tinNhanId\` = arc.\`tinNhanId\`
      JOIN ${quoted(tableNames.cuocTroChuyen)} ctc
        ON ctc.\`cuocTroChuyenId\` = p_newCuocTroChuyenId
      WHERE arc.\`khachHangIdCu\` = ctc.\`khachHangId\`
        ${partialInsertClause};

      -- 7. Guard 2: Kiểm tra số lượng dòng thực tế đã ghi vào TinNhanHoTro
      SET v_insertedCount = ROW_COUNT();

      ${testPreGuardCheck}

      IF v_insertedCount <> p_expectedCount THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'INSERTED_ROW_COUNT_MISMATCH';
      END IF;

      -- 8. Hoàn tất giao dịch khi mọi điều kiện đều thỏa mãn
      COMMIT;
    END;
  `;

  await conn.query(procedureSql);
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

  it('8. Test C1 — Valid restoration via Stored Procedure: proves retrieval, atomic commit, and correct state transition', async () => {
    const db = createMigrationTestClient();
    prisma = db;
    await db.$connect();
    const { suffix, tableNames, quoted } = generateTestContext();
    const procName = `sp_RecoverLegacyMessages_${suffix}`;
    const conn = await createDirectDatabaseConnection();

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

      // Bước 2: Tạo Stored Procedure phục hồi chuẩn theo Runbook Mục 6
      await createRecoveryProcedure(conn, procName, tableNames);

      // Bước 3: Gọi Stored Procedure để khôi phục tin nhắn 888
      await conn.query(`SET @newConvId = NULL;`);
      await conn.query(`CALL \`${procName}\`(88, 7, '[888]', 1, @newConvId);`);

      const convIdRows = await conn.query(`SELECT @newConvId AS newConvId;`);
      const newConvId = Number(convIdRows[0]?.newConvId);
      expect(newConvId).toBeGreaterThan(0);

      // Bước 4: Kiểm tra CuocTroChuyen và TinNhanHoTro sau commit
      const [restoredConv] = await db.$queryRawUnsafe<
        Array<{
          cuocTroChuyenId: number;
          khachHangId: number;
          nhaXeId: number;
          trangThai: string;
        }>
      >(
        `SELECT \`cuocTroChuyenId\`, \`khachHangId\`, \`nhaXeId\`, \`trangThai\`
         FROM ${quoted(tableNames.cuocTroChuyen)} WHERE \`cuocTroChuyenId\` = ${newConvId}`,
      );
      expect(restoredConv).toBeDefined();
      expect(restoredConv.khachHangId).toBe(88);
      expect(restoredConv.nhaXeId).toBe(7);

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
         FROM ${quoted(tableNames.tinNhan)} WHERE \`cuocTroChuyenId\` = ${newConvId}`,
      );
      expect(restoredMsg).toBeDefined();
      expect(restoredMsg.cuocTroChuyenId).toBe(newConvId);
      expect(restoredMsg.taiKhoanGuiId).toBe(88);
      expect(restoredMsg.loaiNguoiGui).toBe('KHACH_HANG');
      expect(restoredMsg.noiDung).toBe('Tin nhắn cần phục hồi theo quy trình runbook');
    } finally {
      await conn.query(`DROP PROCEDURE IF EXISTS \`${procName}\`;`).catch(() => {});
      await conn.end();
      await teardownTestSchema(db, tableNames);
    }
  });

  it('9. Test C2 — Cross-Customer isolation protection via Stored Procedure: rejects recovery containing message IDs belonging to different customer, rolls back atomic transaction', async () => {
    const db = createMigrationTestClient();
    prisma = db;
    await db.$connect();
    const { suffix, tableNames, quoted } = generateTestContext();
    const procName = `sp_RecoverLegacyMessages_${suffix}`;
    const conn = await createDirectDatabaseConnection();

    try {
      await createLegacyBaseSchema(db, suffix, tableNames);

      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.nhaXe)} (\`nhaXeId\`, \`tenNhaXe\`) VALUES (7, 'Nhà xe Mai Linh')`,
      );
      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.taiKhoan)} (\`taiKhoanId\`, \`email\`) VALUES
          (88, 'cust88@vexgo.vn'),
          (99, 'cust99@vexgo.vn')`,
      );
      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.khachHang)} (\`khachHangId\`, \`maKhachHang\`, \`taiKhoanId\`) VALUES
          (88, 'KH088', 88),
          (99, 'KH099', 99)`,
      );
      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.tinNhan)} (\`tinNhanId\`, \`noiDung\`, \`thoiGian\`, \`trangThai\`, \`khachHangId\`, \`createdAt\`, \`updatedAt\`) VALUES
          (888, 'Tin nhắn của khách A', '2026-09-01 15:00:00', 'DA_GUI', 88, '2026-09-01 15:00:00', '2026-09-01 15:00:00'),
          (999, 'Tin nhắn riêng tư của khách B', '2026-09-01 16:00:00', 'DA_GUI', 99, '2026-09-01 16:00:00', '2026-09-01 16:00:00')`,
      );

      await executeMigrationScript(db, suffix, tableNames);

      await createRecoveryProcedure(conn, procName, tableNames);

      // Cố ý gọi procedure cho khách A (88) với danh sách ID chứa cả tin nhắn của khách B (999)
      let recoveryError: Error | undefined;
      try {
        await conn.query(`SET @newConvId = NULL;`);
        await conn.query(`CALL \`${procName}\`(88, 7, '[888, 999]', 2, @newConvId);`);
      } catch (err) {
        recoveryError = err instanceof Error ? err : new Error(String(err));
      }

      // Xác nhận Procedure đã SIGNAL lỗi và EXIT HANDLER đã bắt lỗi
      expect(recoveryError).toBeDefined();
      expect(recoveryError?.message).toMatch(/CROSS_CUSTOMER_OR_MISSING_ARCHIVE_MESSAGES_DETECTED|45000/);

      // BẢO VỆ CỐT LÕI:
      // 1. Không có bất kỳ cuộc trò chuyện nào bị tạo thừa
      const convs = await db.$queryRawUnsafe<Array<any>>(
        `SELECT * FROM ${quoted(tableNames.cuocTroChuyen)}`,
      );
      expect(convs.length).toBe(0);

      // 2. Không có bất kỳ tin nhắn nào của khách B bị trộn vào bảng hoạt động
      const activeMsgs = await db.$queryRawUnsafe<Array<any>>(
        `SELECT * FROM ${quoted(tableNames.tinNhan)}`,
      );
      expect(activeMsgs.length).toBe(0);

      // 3. Toàn bộ dữ liệu của cả 2 khách hàng trong archive vẫn an toàn nguyên vẹn
      const [arcA] = await db.$queryRawUnsafe<Array<any>>(
        `SELECT * FROM ${quoted(tableNames.luuTru)} WHERE \`tinNhanId\` = 888`,
      );
      const [arcB] = await db.$queryRawUnsafe<Array<any>>(
        `SELECT * FROM ${quoted(tableNames.luuTru)} WHERE \`tinNhanId\` = 999`,
      );
      expect(arcA.khachHangIdCu).toBe(88);
      expect(arcB.khachHangIdCu).toBe(99);
    } finally {
      await conn.query(`DROP PROCEDURE IF EXISTS \`${procName}\`;`).catch(() => {});
      await conn.end();
      await teardownTestSchema(db, tableNames);
    }
  });

  it('9b. Test C3 — Guard 2 failure after partial insert: rolls back atomic transaction, cleans up conversation and partially inserted messages', async () => {
    const db = createMigrationTestClient();
    prisma = db;
    await db.$connect();
    const { suffix, tableNames, quoted } = generateTestContext();
    const procName = `sp_RecoverLegacyMessages_${suffix}`;
    const conn = await createDirectDatabaseConnection();

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
          (888, 'Tin nhắn 1 của khách 88', '2026-09-01 15:00:00', 'DA_GUI', 88, '2026-09-01 15:00:00', '2026-09-01 15:00:00'),
          (889, 'Tin nhắn 2 của khách 88', '2026-09-01 15:05:00', 'DA_GUI', 88, '2026-09-01 15:05:00', '2026-09-01 15:05:00')`,
      );

      await executeMigrationScript(db, suffix, tableNames);

      // Tạo Stored Procedure với cờ testFaultInjectPartialInsert = true:
      // CuocTroChuyen và một phần TinNhanHoTro (1 dòng thực tế) ĐÃ ĐƯỢC INSERT thành công bên trong transaction,
      // sau đó Guard 2 kiểm tra số lượng dòng thực tế (1 <> 2) và kích hoạt SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'INSERTED_ROW_COUNT_MISMATCH'
      // để kiểm chứng hành vi rollback của EXIT HANDLER!
      await createRecoveryProcedure(conn, procName, tableNames, { testFaultInjectPartialInsert: true });

      let recoveryError: Error | undefined;
      try {
        await conn.query(`SET @newConvId = NULL;`);
        await conn.query(`CALL \`${procName}\`(88, 7, '[888, 889]', 2, @newConvId);`);
      } catch (err) {
        recoveryError = err instanceof Error ? err : new Error(String(err));
      }

      // Xác nhận Guard 2 đã kích hoạt SIGNAL và EXIT HANDLER ném lại lỗi
      expect(recoveryError).toBeDefined();
      expect(recoveryError?.message).toMatch(/INSERTED_ROW_COUNT_MISMATCH|45000/);

      // BẢO ĐẢM ATOMICITY CỐT LÕI (FINDING P1 & FINDING B VERIFICATION):
      // 1. Toàn bộ cuộc trò chuyện vừa tạo đã bị ROLLBACK hoàn toàn, không còn dòng nào
      const convs = await db.$queryRawUnsafe<Array<any>>(
        `SELECT * FROM ${quoted(tableNames.cuocTroChuyen)}`,
      );
      expect(convs.length).toBe(0);

      // 2. Toàn bộ các tin nhắn đã nạp một phần đã bị ROLLBACK hoàn toàn, không còn dòng nào
      const msgs = await db.$queryRawUnsafe<Array<any>>(
        `SELECT * FROM ${quoted(tableNames.tinNhan)}`,
      );
      expect(msgs.length).toBe(0);

      // 3. Toàn bộ dữ liệu archive ban đầu vẫn nguyên vẹn 100%
      const arcMsgs = await db.$queryRawUnsafe<Array<any>>(
        `SELECT * FROM ${quoted(tableNames.luuTru)} WHERE \`tinNhanId\` IN (888, 889)`,
      );
      expect(arcMsgs).toHaveLength(2);
    } finally {
      await conn.query(`DROP PROCEDURE IF EXISTS \`${procName}\`;`).catch(() => {});
      await conn.end();
      await teardownTestSchema(db, tableNames);
    }
  });

  it('9c. Test C4 — Input validation & missing archive message ID: rejects recovery before data creation', async () => {
    const db = createMigrationTestClient();
    prisma = db;
    await db.$connect();
    const { suffix, tableNames, quoted } = generateTestContext();
    const procName = `sp_RecoverLegacyMessages_${suffix}`;
    const conn = await createDirectDatabaseConnection();

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
          (888, 'Tin nhắn test', '2026-09-01 15:00:00', 'DA_GUI', 88, '2026-09-01 15:00:00', '2026-09-01 15:00:00')`,
      );

      await executeMigrationScript(db, suffix, tableNames);

      await createRecoveryProcedure(conn, procName, tableNames);

      // Gọi với ID 9999 không tồn tại trong archive
      let recoveryError: Error | undefined;
      try {
        await conn.query(`SET @newConvId = NULL;`);
        await conn.query(`CALL \`${procName}\`(88, 7, '[9999]', 1, @newConvId);`);
      } catch (err) {
        recoveryError = err instanceof Error ? err : new Error(String(err));
      }

      expect(recoveryError).toBeDefined();
      expect(recoveryError?.message).toMatch(/CROSS_CUSTOMER_OR_MISSING_ARCHIVE_MESSAGES_DETECTED|45000/);

      const convs = await db.$queryRawUnsafe<Array<any>>(
        `SELECT * FROM ${quoted(tableNames.cuocTroChuyen)}`,
      );
      expect(convs.length).toBe(0);

      const msgs = await db.$queryRawUnsafe<Array<any>>(
        `SELECT * FROM ${quoted(tableNames.tinNhan)}`,
      );
      expect(msgs.length).toBe(0);
    } finally {
      await conn.query(`DROP PROCEDURE IF EXISTS \`${procName}\`;`).catch(() => {});
      await conn.end();
      await teardownTestSchema(db, tableNames);
    }
  });

  it('9d. Test C5 — Duplicate message IDs in list (Finding A - Case A1): rejects input, prevents message duplication and rolls back atomically', async () => {
    const db = createMigrationTestClient();
    prisma = db;
    await db.$connect();
    const { suffix, tableNames, quoted } = generateTestContext();
    const procName = `sp_RecoverLegacyMessages_${suffix}`;
    const conn = await createDirectDatabaseConnection();

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
          (888, 'Tin nhắn đơn của khách 88', '2026-09-01 15:00:00', 'DA_GUI', 88, '2026-09-01 15:00:00', '2026-09-01 15:00:00')`,
      );

      await executeMigrationScript(db, suffix, tableNames);

      await createRecoveryProcedure(conn, procName, tableNames);

      // Gọi với danh sách ID trùng lặp [888, 888] và expectedCount = 2
      let recoveryError: Error | undefined;
      try {
        await conn.query(`SET @newConvId = NULL;`);
        await conn.query(`CALL \`${procName}\`(88, 7, '[888, 888]', 2, @newConvId);`);
      } catch (err) {
        recoveryError = err instanceof Error ? err : new Error(String(err));
      }

      // Xác nhận procedure từ chối với lỗi DUPLICATE_TIN_NHAN_IDS_DETECTED
      expect(recoveryError).toBeDefined();
      expect(recoveryError?.message).toMatch(/DUPLICATE_TIN_NHAN_IDS_DETECTED|45000/);

      // BẢO VỆ DỮ LIỆU:
      // 1. Không có cuộc trò chuyện nào được tạo
      const convs = await db.$queryRawUnsafe<Array<any>>(
        `SELECT * FROM ${quoted(tableNames.cuocTroChuyen)}`,
      );
      expect(convs.length).toBe(0);

      // 2. Không có tin nhắn nào được chèn vào bảng hoạt động (ngăn chặn duplicate message)
      const msgs = await db.$queryRawUnsafe<Array<any>>(
        `SELECT * FROM ${quoted(tableNames.tinNhan)}`,
      );
      expect(msgs.length).toBe(0);

      // 3. Dữ liệu trong archive vẫn nguyên vẹn
      const [arcMsg] = await db.$queryRawUnsafe<Array<any>>(
        `SELECT * FROM ${quoted(tableNames.luuTru)} WHERE \`tinNhanId\` = 888`,
      );
      expect(arcMsg.khachHangIdCu).toBe(88);
    } finally {
      await conn.query(`DROP PROCEDURE IF EXISTS \`${procName}\`;`).catch(() => {});
      await conn.end();
      await teardownTestSchema(db, tableNames);
    }
  });

  it('9e. Test C6 — Valid distinct message IDs list (Finding A - Case A2): creates conversation and restores all messages atomically', async () => {
    const db = createMigrationTestClient();
    prisma = db;
    await db.$connect();
    const { suffix, tableNames, quoted } = generateTestContext();
    const procName = `sp_RecoverLegacyMessages_${suffix}`;
    const conn = await createDirectDatabaseConnection();

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
          (888, 'Tin nhắn 1 của khách 88', '2026-09-01 15:00:00', 'DA_GUI', 88, '2026-09-01 15:00:00', '2026-09-01 15:00:00'),
          (889, 'Tin nhắn 2 của khách 88', '2026-09-01 15:05:00', 'DA_GUI', 88, '2026-09-01 15:05:00', '2026-09-01 15:05:00')`,
      );

      await executeMigrationScript(db, suffix, tableNames);

      await createRecoveryProcedure(conn, procName, tableNames);

      // Gọi với 2 ID hợp lệ phân biệt [888, 889] và expectedCount = 2
      await conn.query(`SET @newConvId = NULL;`);
      await conn.query(`CALL \`${procName}\`(88, 7, '[888, 889]', 2, @newConvId);`);

      const convIdRows = await conn.query(`SELECT @newConvId AS newConvId;`);
      const createdConvId = Number(convIdRows[0]?.newConvId);
      expect(createdConvId).toBeGreaterThan(0);

      // BẢO ĐẢM KẾT QUẢ RESTORE:
      // 1. Đúng 1 CuocTroChuyen được tạo
      const convs = await db.$queryRawUnsafe<Array<any>>(
        `SELECT * FROM ${quoted(tableNames.cuocTroChuyen)} WHERE \`cuocTroChuyenId\` = ${Number(createdConvId)}`,
      );
      expect(convs).toHaveLength(1);
      expect(convs[0].khachHangId).toBe(88);
      expect(convs[0].nhaXeId).toBe(7);

      // 2. Đúng 2 TinNhanHoTro được chèn vào cuộc trò chuyện mới
      const msgs = await db.$queryRawUnsafe<Array<any>>(
        `SELECT * FROM ${quoted(tableNames.tinNhan)} WHERE \`cuocTroChuyenId\` = ${Number(createdConvId)} ORDER BY \`createdAt\` ASC`,
      );
      expect(msgs).toHaveLength(2);
      expect(msgs[0].noiDung).toBe('Tin nhắn 1 của khách 88');
      expect(msgs[1].noiDung).toBe('Tin nhắn 2 của khách 88');
      expect(msgs[0].taiKhoanGuiId).toBe(88);
      expect(msgs[1].taiKhoanGuiId).toBe(88);
    } finally {
      await conn.query(`DROP PROCEDURE IF EXISTS \`${procName}\`;`).catch(() => {});
      await conn.end();
      await teardownTestSchema(db, tableNames);
    }
  });

  it('10. Test D — Prisma schema lifecycle & drift protection: verifies model registration and zero drift', async () => {
    // 1. Kiểm tra Prisma Client đã định nghĩa model LuuTruTinNhanHoTroCu
    const client = createMigrationTestClient();
    expect(client).toHaveProperty('luuTruTinNhanHoTroCu');

    // 2. Tự động đảm bảo shadow database tồn tại trước khi chạy prisma migrate diff
    const shadowUrlValue = process.env.SHADOW_DATABASE_URL;
    if (shadowUrlValue) {
      try {
        const shadowUrl = new URL(shadowUrlValue);
        const shadowDbName = decodeURIComponent(shadowUrl.pathname.replace(/^\/+/, ''));
        if (shadowDbName) {
          const db = createMigrationTestClient();
          await db.$connect();
          await db.$executeRawUnsafe(
            `CREATE DATABASE IF NOT EXISTS \`${shadowDbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
          );
          await db.$disconnect();
        }
      } catch (err) {
        console.warn('Could not auto-create shadow database in test helper:', err);
      }
    }

    // 3. Chạy prisma migrate diff kiểm tra schema drift giữa migrations và schema.prisma
    const diffOutput = execSync(
      'npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script',
      { cwd: resolve(process.cwd(), '../../'), encoding: 'utf8' },
    );

    // Schema đồng bộ hoàn toàn, không có lệnh DROP TABLE LuuTruTinNhanHoTroCu nào được sinh ra
    expect(diffOutput).toContain('-- This is an empty migration.');
    expect(diffOutput).not.toContain('DROP TABLE `LuuTruTinNhanHoTroCu`');
    expect(diffOutput).not.toContain('DROP TABLE LuuTruTinNhanHoTroCu');

    // 4. Smoke test: xác minh lệnh với cờ --exit-code của Prisma 7 trả về mã thoát 0 (No difference detected)
    const exitCodeOutput = execSync(
      'npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --exit-code',
      { cwd: resolve(process.cwd(), '../../'), encoding: 'utf8' },
    );
    expect(exitCodeOutput).toContain('No difference detected.');
  }, 60000);

  it('11. Test E1 — Migration failure & partial retry safety: verifies INSERT IGNORE idempotency on identical archive', async () => {
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

      // Tạo bảng archive trước và chèn trước bản ghi 1 với dữ liệu giống hệt nguồn
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

      // Chạy migration: Bước conflict check vượt qua, INSERT IGNORE bỏ qua bản ghi trùng một cách an toàn
      await executeMigrationScript(db, suffix, tableNames);

      const [archiveCount] = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*) AS count FROM ${quoted(tableNames.luuTru)}`,
      );
      expect(Number(archiveCount.count)).toBe(1);

      // Bảng hoạt động sau migration đã loại bỏ bản ghi legacy an toàn (vì đã có trong archive)
      const [activeCount] = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*) AS count FROM ${quoted(tableNames.tinNhan)}`,
      );
      expect(Number(activeCount.count)).toBe(0);
    } finally {
      await teardownTestSchema(db, tableNames);
    }
  });

  it('12. Test E2 — Archive conflict safety under non-strict SQL mode: aborts deterministically without mutating source primary key or deleting messages', async () => {
    // Client với connectionLimit: 1 để đảm bảo session sql_mode = '' tồn tại trên mọi câu lệnh
    const db = createMigrationTestClient({ connectionLimit: 1 });
    prisma = db;
    await db.$connect();
    const { suffix, tableNames, quoted } = generateTestContext();

    try {
      // 1. Ép chế độ SQL non-strict cho session
      await db.$executeRawUnsafe(`SET @@SESSION.sql_mode = '';`);

      await createLegacyBaseSchema(db, suffix, tableNames);

      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.taiKhoan)} (\`taiKhoanId\`, \`email\`) VALUES (1, 'u1@vexgo.vn')`,
      );
      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.khachHang)} (\`khachHangId\`, \`maKhachHang\`, \`taiKhoanId\`) VALUES (1, 'KH1', 1)`,
      );
      // Dữ liệu nguồn: tinNhanId = 1 với nội dung mới
      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.tinNhan)} (\`tinNhanId\`, \`noiDung\`, \`thoiGian\`, \`trangThai\`, \`khachHangId\`, \`createdAt\`, \`updatedAt\`) VALUES
          (1, 'Nội dung mới trong bảng nguồn', '2026-10-10 10:00:00', 'DA_GUI', 1, '2026-10-10 10:00:00', '2026-10-10 10:00:00')`,
      );

      // Archive đã có bản ghi 1 nhưng nội dung KHÁC BIỆT (Xung đột dữ liệu / data conflict)
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
          (1, 'Nội dung cũ trong archive', '2026-10-10 10:00:00', 'DA_GUI', 1, '2026-10-10 10:00:00', '2026-10-10 10:00:00')`,
      );

      // Thực thi migration: Phải ném lỗi phát hiện xung đột dữ liệu ngay cả khi sql_mode non-strict
      let migrationError: Error | undefined;
      try {
        await executeMigrationScript(db, suffix, tableNames);
      } catch (error) {
        migrationError = error instanceof Error ? error : new Error(String(error));
      }

      expect(migrationError).toBeDefined();
      expect(migrationError?.message).toMatch(/Subquery returns more than 1 row|1242/);

      // QUAN TRỌNG NHẤT:
      // 1. Khóa chính tinNhanId KHÔNG BỊ ĐỔI THÀNH 0 (zero mutation)!
      // 2. Toàn bộ bản ghi nguồn KHÔNG BỊ XÓA!
      const [sourceMessage] = await db.$queryRawUnsafe<
        Array<{ tinNhanId: number; noiDung: string }>
      >(
        `SELECT \`tinNhanId\`, \`noiDung\` FROM ${quoted(tableNames.tinNhan)} WHERE \`tinNhanId\` = 1`,
      );
      expect(sourceMessage).toBeDefined();
      expect(sourceMessage.tinNhanId).toBe(1);
      expect(sourceMessage.noiDung).toBe('Nội dung mới trong bảng nguồn');

      // 3. Không có bản ghi nào bị gán tinNhanId = 0
      const zeroRows = await db.$queryRawUnsafe<Array<any>>(
        `SELECT * FROM ${quoted(tableNames.tinNhan)} WHERE \`tinNhanId\` = 0`,
      );
      expect(zeroRows.length).toBe(0);

      // Archive vẫn giữ nguyên bản gốc
      const [archiveMessage] = await db.$queryRawUnsafe<
        Array<{ tinNhanId: number; noiDung: string }>
      >(
        `SELECT \`tinNhanId\`, \`noiDung\` FROM ${quoted(tableNames.luuTru)} WHERE \`tinNhanId\` = 1`,
      );
      expect(archiveMessage).toBeDefined();
      expect(archiveMessage.noiDung).toBe('Nội dung cũ trong archive');
    } finally {
      await teardownTestSchema(db, tableNames);
    }
  });

  it('13. Test E3 — Missing archive detection under non-strict SQL mode: aborts before delete without mutating source records', async () => {
    const db = createMigrationTestClient({ connectionLimit: 1 });
    prisma = db;
    await db.$connect();
    const { suffix, tableNames, quoted } = generateTestContext();

    try {
      await db.$executeRawUnsafe(`SET @@SESSION.sql_mode = '';`);
      await createLegacyBaseSchema(db, suffix, tableNames);

      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.taiKhoan)} (\`taiKhoanId\`, \`email\`) VALUES (1, 'u1@vexgo.vn')`,
      );
      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.khachHang)} (\`khachHangId\`, \`maKhachHang\`, \`taiKhoanId\`) VALUES (1, 'KH1', 1)`,
      );
      // Tạo tin nhắn legacy
      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.tinNhan)} (\`tinNhanId\`, \`noiDung\`, \`thoiGian\`, \`trangThai\`, \`khachHangId\`, \`createdAt\`, \`updatedAt\`) VALUES
          (99, 'Tin nhắn chưa có archive', '2026-10-10 10:00:00', 'DA_GUI', 1, '2026-10-10 10:00:00', '2026-10-10 10:00:00')`,
      );

      // Tạo bảng archive nhưng để RỖNG (không có bản ghi 99), và mô phỏng chạy đến bước 7.1
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
      await db.$executeRawUnsafe(`ALTER TABLE ${quoted(tableNames.tinNhan)} ADD COLUMN \`cuocTroChuyenId\` INT NULL;`);

      // Chạy câu lệnh kiểm tra bước 7.1
      let guardError: Error | undefined;
      try {
        await db.$executeRawUnsafe(`
          SET @unarchived_legacy_guard = (
            SELECT 1
            FROM (SELECT 1 UNION ALL SELECT 2) \`_unarchived_legacy_guard_fail_closed\`
            WHERE EXISTS (
              SELECT 1
              FROM ${quoted(tableNames.tinNhan)} src
              LEFT JOIN ${quoted(tableNames.luuTru)} arc ON arc.\`tinNhanId\` = src.\`tinNhanId\`
              WHERE src.\`cuocTroChuyenId\` IS NULL
                AND arc.\`tinNhanId\` IS NULL
            )
          );
        `);
      } catch (err) {
        guardError = err instanceof Error ? err : new Error(String(err));
      }

      expect(guardError).toBeDefined();
      expect(guardError?.message).toMatch(/Subquery returns more than 1 row|1242/);

      // Bản ghi nguồn KHÔNG BỊ MUTATE và KHÔNG BỊ XÓA
      const [sourceMessage] = await db.$queryRawUnsafe<Array<any>>(
        `SELECT * FROM ${quoted(tableNames.tinNhan)} WHERE \`tinNhanId\` = 99`,
      );
      expect(sourceMessage).toBeDefined();
      expect(sourceMessage.tinNhanId).toBe(99);
      expect(sourceMessage.noiDung).toBe('Tin nhắn chưa có archive');
    } finally {
      await teardownTestSchema(db, tableNames);
    }
  });

  it('14. Test F1 — Archive timestamp conflict: aborts migration when updatedAtCu differs', async () => {
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
      // Nguồn có updatedAt = 10:30:00
      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.tinNhan)} (\`tinNhanId\`, \`noiDung\`, \`thoiGian\`, \`trangThai\`, \`khachHangId\`, \`createdAt\`, \`updatedAt\`) VALUES
          (1, 'Tin nhắn test updatedAt', '2026-10-10 10:00:00', 'DA_GUI', 1, '2026-10-10 10:00:00', '2026-10-10 10:30:00')`,
      );

      // Archive: Mọi trường đều giống hệt, CHỈ RIÊNG updatedAtCu bị lệch (08:00:00)
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
          (1, 'Tin nhắn test updatedAt', '2026-10-10 10:00:00', 'DA_GUI', 1, '2026-10-10 10:00:00', '2026-10-10 08:00:00')`,
      );

      let migrationError: Error | undefined;
      try {
        await executeMigrationScript(db, suffix, tableNames);
      } catch (error) {
        migrationError = error instanceof Error ? error : new Error(String(error));
      }

      expect(migrationError).toBeDefined();
      expect(migrationError?.message).toMatch(/Subquery returns more than 1 row|1242/);

      // Bản ghi nguồn không bị xóa
      const [sourceMessage] = await db.$queryRawUnsafe<Array<any>>(
        `SELECT * FROM ${quoted(tableNames.tinNhan)} WHERE \`tinNhanId\` = 1`,
      );
      expect(sourceMessage).toBeDefined();
      expect(sourceMessage.tinNhanId).toBe(1);
    } finally {
      await teardownTestSchema(db, tableNames);
    }
  });

  it('15. Test F2 — Archive timestamp conflict: aborts migration when createdAtCu differs on fresh schema', async () => {
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
      // Nguồn có createdAt = 10:00:00
      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.tinNhan)} (\`tinNhanId\`, \`noiDung\`, \`thoiGian\`, \`trangThai\`, \`khachHangId\`, \`createdAt\`, \`updatedAt\`) VALUES
          (1, 'Tin nhắn test createdAt', '2026-10-10 10:00:00', 'DA_GUI', 1, '2026-10-10 10:00:00', '2026-10-10 10:00:00')`,
      );

      // Archive: createdAtCu bị sai lệch (09:00:00) trên schema gốc
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
          (1, 'Tin nhắn test createdAt', '2026-10-10 10:00:00', 'DA_GUI', 1, '2026-10-10 09:00:00', '2026-10-10 10:00:00')`,
      );

      let migrationError: Error | undefined;
      try {
        await executeMigrationScript(db, suffix, tableNames);
      } catch (error) {
        migrationError = error instanceof Error ? error : new Error(String(error));
      }

      expect(migrationError).toBeDefined();
      expect(migrationError?.message).toMatch(/Subquery returns more than 1 row|1242/);

      // Bản ghi nguồn không bị xóa
      const [sourceMessage] = await db.$queryRawUnsafe<Array<any>>(
        `SELECT * FROM ${quoted(tableNames.tinNhan)} WHERE \`tinNhanId\` = 1`,
      );
      expect(sourceMessage).toBeDefined();
      expect(sourceMessage.tinNhanId).toBe(1);
    } finally {
      await teardownTestSchema(db, tableNames);
    }
  });

  it('16. Test F3 — Preflight guard compatibility: preflight accepts previously normalized createdAt without false conflict (manual recovery required for partial migration)', async () => {
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

      // ĐẶC TẢ KIỂM CHỨNG CỦA TEST NÀY (FINDING P2):
      // Test này CHỨNG MINH: Câu lệnh preflight conflict guard (bước 1.1) nhận diện đúng trạng thái
      // createdAt đã được chuẩn hóa theo thoiGian ở bước 4 của lần chạy trước, và KHÔNG phát sinh xung đột giả (no false conflict).
      //
      // GIỚI HẠN VÀ KHUYẾN CÁO VẬN HÀNH:
      // Test này KHÔNG chứng minh toàn bộ migration script có thể tự động chạy lại từ đầu (not resumable),
      // bởi vì các câu lệnh DDL MySQL ở bước 3 (ADD COLUMN cuocTroChuyenId) sẽ lỗi duplicate column nếu chạy lại từ đầu.
      // Khi migration bị dừng dở dang, DBA bắt buộc phải thực hiện Quy trình Phục hồi Thủ công (Manual Recovery)
      // được hướng dẫn chi tiết tại Mục 8 của Runbook (docs/runbooks/legacy-chat-archive-runbook.md).
      await db.$executeRawUnsafe(`ALTER TABLE ${quoted(tableNames.tinNhan)} ADD COLUMN \`cuocTroChuyenId\` INT NULL;`);
      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.tinNhan)} (\`tinNhanId\`, \`noiDung\`, \`thoiGian\`, \`trangThai\`, \`khachHangId\`, \`createdAt\`, \`updatedAt\`) VALUES
          (1, 'Tin nhắn chạy dở', '2026-10-10 10:00:00', 'DA_GUI', 1, '2026-10-10 10:00:00', '2026-10-10 10:00:00')`,
      );

      // Archive lưu trữ snapshot ban đầu với createdAtCu = 09:00:00 (< thoiGianCu)
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
          (1, 'Tin nhắn chạy dở', '2026-10-10 10:00:00', 'DA_GUI', 1, '2026-10-10 09:00:00', '2026-10-10 10:00:00')`,
      );

      // Chạy câu lệnh kiểm tra preflight guard (bước 1.1)
      let guardError: Error | undefined;
      try {
        await db.$executeRawUnsafe(`
          SET @archive_conflict_guard = (
            SELECT 1
            FROM (
              SELECT 1 UNION ALL SELECT 2
            ) \`_archive_conflict_guard_fail_closed\`
            WHERE EXISTS (
              SELECT 1
              FROM ${quoted(tableNames.tinNhan)} src
              JOIN ${quoted(tableNames.luuTru)} arc ON arc.\`tinNhanId\` = src.\`tinNhanId\`
              WHERE BINARY(src.\`noiDung\`) <> BINARY(arc.\`noiDung\`)
                 OR src.\`thoiGian\` <> arc.\`thoiGianCu\`
                 OR BINARY(src.\`trangThai\`) <> BINARY(arc.\`trangThaiCu\`)
                 OR src.\`khachHangId\` <> arc.\`khachHangIdCu\`
                 OR src.\`updatedAt\` <> arc.\`updatedAtCu\`
                 OR (
                    src.\`createdAt\` <> arc.\`createdAtCu\`
                    AND NOT (
                      EXISTS (
                        SELECT 1 FROM information_schema.COLUMNS
                        WHERE TABLE_SCHEMA = DATABASE()
                          AND TABLE_NAME = '${tableNames.tinNhan}'
                          AND COLUMN_NAME = 'cuocTroChuyenId'
                      )
                      AND src.\`createdAt\` = src.\`thoiGian\`
                      AND arc.\`thoiGianCu\` = src.\`thoiGian\`
                    )
                 )
            )
          );
        `);
      } catch (err) {
        guardError = err instanceof Error ? err : new Error(String(err));
      }

      // Không được sinh lỗi xung đột giả (no false conflict)
      expect(guardError).toBeUndefined();

      // Dữ liệu nguồn và archive nguyên vẹn
      const [src] = await db.$queryRawUnsafe<Array<any>>(
        `SELECT * FROM ${quoted(tableNames.tinNhan)} WHERE \`tinNhanId\` = 1`,
      );
      expect(src.tinNhanId).toBe(1);
    } finally {
      await teardownTestSchema(db, tableNames);
    }
  });
});
