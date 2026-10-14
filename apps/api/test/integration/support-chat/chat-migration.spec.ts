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

describe('Support chat schema migration with preflight archive and RBAC bootstrap', () => {
  let prisma: PrismaClient | undefined;

  afterEach(async () => {
    await prisma?.$disconnect();
    prisma = undefined;
  });

  it('runs safely on empty legacy table and initializes canonical permissions', async () => {
    const db = createMigrationTestClient();
    prisma = db;
    await db.$connect();

    const suffix = randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
    const tableNames = {
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
    const createdTables: string[] = [];

    try {
      // 1. Tạo các bảng cơ sở tiền đề theo schema cũ
      await db.$executeRawUnsafe(
        `CREATE TABLE ${quoted(tableNames.taiKhoan)} (\`taiKhoanId\` INT NOT NULL AUTO_INCREMENT, \`email\` VARCHAR(100) NOT NULL, PRIMARY KEY (\`taiKhoanId\`)) ENGINE=InnoDB`,
      );
      createdTables.push(tableNames.taiKhoan);

      await db.$executeRawUnsafe(
        `CREATE TABLE ${quoted(tableNames.nhaXe)} (\`nhaXeId\` INT NOT NULL AUTO_INCREMENT, \`tenNhaXe\` VARCHAR(100) NOT NULL, PRIMARY KEY (\`nhaXeId\`)) ENGINE=InnoDB`,
      );
      createdTables.push(tableNames.nhaXe);

      await db.$executeRawUnsafe(
        `CREATE TABLE ${quoted(tableNames.khachHang)} (\`khachHangId\` INT NOT NULL AUTO_INCREMENT, \`maKhachHang\` VARCHAR(50) NOT NULL, \`taiKhoanId\` INT NOT NULL, PRIMARY KEY (\`khachHangId\`)) ENGINE=InnoDB`,
      );
      createdTables.push(tableNames.khachHang);

      await db.$executeRawUnsafe(
        `CREATE TABLE ${quoted(tableNames.nhanVien)} (\`nhanVienId\` INT NOT NULL AUTO_INCREMENT, \`maNhanVien\` VARCHAR(50) NOT NULL, \`nhaXeId\` INT NOT NULL, \`taiKhoanId\` INT NOT NULL, PRIMARY KEY (\`nhanVienId\`)) ENGINE=InnoDB`,
      );
      createdTables.push(tableNames.nhanVien);

      await db.$executeRawUnsafe(
        `CREATE TABLE ${quoted(tableNames.role)} (\`vaiTroId\` INT NOT NULL AUTO_INCREMENT, \`tenVaiTro\` VARCHAR(50) NOT NULL, \`moTa\` VARCHAR(255) NULL, PRIMARY KEY (\`vaiTroId\`), UNIQUE KEY (\`tenVaiTro\`)) ENGINE=InnoDB`,
      );
      createdTables.push(tableNames.role);

      await db.$executeRawUnsafe(
        `CREATE TABLE ${quoted(tableNames.permission)} (\`quyenId\` INT NOT NULL AUTO_INCREMENT, \`tenQuyen\` VARCHAR(100) NOT NULL, \`moTa\` VARCHAR(255) NULL, PRIMARY KEY (\`quyenId\`), UNIQUE KEY (\`tenQuyen\`)) ENGINE=InnoDB`,
      );
      createdTables.push(tableNames.permission);

      await db.$executeRawUnsafe(
        `CREATE TABLE ${quoted(tableNames.assignments)} (\`vaiTroId\` INT NOT NULL, \`quyenId\` INT NOT NULL, PRIMARY KEY (\`vaiTroId\`, \`quyenId\`)) ENGINE=InnoDB`,
      );
      createdTables.push(tableNames.assignments);

      // Tạo bảng TinNhanHoTro theo schema cũ (rỗng)
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
          INDEX \`${suffix}_TK_fk\` (\`khachHangId\`),
          CONSTRAINT \`${suffix}_TK_fk\` FOREIGN KEY (\`khachHangId\`) REFERENCES ${quoted(tableNames.khachHang)} (\`khachHangId\`) ON DELETE RESTRICT ON UPDATE RESTRICT
        ) ENGINE=InnoDB`,
      );
      createdTables.push(tableNames.tinNhan);

      // Thêm roles mặc định
      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.role)} (\`tenVaiTro\`, \`moTa\`) VALUES
          ('NHA_XE_ADMIN', 'Quản trị nhà xe'),
          ('NHAN_VIEN_CSKH', 'Nhân viên chăm sóc khách hàng')`,
      );

      // Đọc và chạy migration SQL với mapping bảng
      const migrationSql = await readFile(migrationSqlUrl, 'utf8');
      const statements = migrationSql
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
        .split(';')
        .map((statement) => statement.trim())
        .filter(Boolean);

      // Đưa các bảng mới sẽ được tạo vào createdTables để dọn dẹp ở finally
      createdTables.push(tableNames.cuocTroChuyen, tableNames.luuTru);

      for (const statement of statements) {
        await db.$executeRawUnsafe(statement);
      }

      // Xác minh kết quả
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
  });

  it('safely archives legacy messages, creates conversation, and backfills relational fields', async () => {
    const db = createMigrationTestClient();
    prisma = db;
    await db.$connect();

    const suffix = randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
    const tableNames = {
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
    const createdTables: string[] = [];

    try {
      // 1. Tạo các bảng cơ sở theo schema cũ
      await db.$executeRawUnsafe(
        `CREATE TABLE ${quoted(tableNames.taiKhoan)} (\`taiKhoanId\` INT NOT NULL AUTO_INCREMENT, \`email\` VARCHAR(100) NOT NULL, PRIMARY KEY (\`taiKhoanId\`)) ENGINE=InnoDB`,
      );
      createdTables.push(tableNames.taiKhoan);

      await db.$executeRawUnsafe(
        `CREATE TABLE ${quoted(tableNames.nhaXe)} (\`nhaXeId\` INT NOT NULL AUTO_INCREMENT, \`tenNhaXe\` VARCHAR(100) NOT NULL, PRIMARY KEY (\`nhaXeId\`)) ENGINE=InnoDB`,
      );
      createdTables.push(tableNames.nhaXe);

      await db.$executeRawUnsafe(
        `CREATE TABLE ${quoted(tableNames.khachHang)} (\`khachHangId\` INT NOT NULL AUTO_INCREMENT, \`maKhachHang\` VARCHAR(50) NOT NULL, \`taiKhoanId\` INT NOT NULL, PRIMARY KEY (\`khachHangId\`)) ENGINE=InnoDB`,
      );
      createdTables.push(tableNames.khachHang);

      await db.$executeRawUnsafe(
        `CREATE TABLE ${quoted(tableNames.nhanVien)} (\`nhanVienId\` INT NOT NULL AUTO_INCREMENT, \`maNhanVien\` VARCHAR(50) NOT NULL, \`nhaXeId\` INT NOT NULL, \`taiKhoanId\` INT NOT NULL, PRIMARY KEY (\`nhanVienId\`)) ENGINE=InnoDB`,
      );
      createdTables.push(tableNames.nhanVien);

      await db.$executeRawUnsafe(
        `CREATE TABLE ${quoted(tableNames.role)} (\`vaiTroId\` INT NOT NULL AUTO_INCREMENT, \`tenVaiTro\` VARCHAR(50) NOT NULL, \`moTa\` VARCHAR(255) NULL, PRIMARY KEY (\`vaiTroId\`), UNIQUE KEY (\`tenVaiTro\`)) ENGINE=InnoDB`,
      );
      createdTables.push(tableNames.role);

      await db.$executeRawUnsafe(
        `CREATE TABLE ${quoted(tableNames.permission)} (\`quyenId\` INT NOT NULL AUTO_INCREMENT, \`tenQuyen\` VARCHAR(100) NOT NULL, \`moTa\` VARCHAR(255) NULL, PRIMARY KEY (\`quyenId\`), UNIQUE KEY (\`tenQuyen\`)) ENGINE=InnoDB`,
      );
      createdTables.push(tableNames.permission);

      await db.$executeRawUnsafe(
        `CREATE TABLE ${quoted(tableNames.assignments)} (\`vaiTroId\` INT NOT NULL, \`quyenId\` INT NOT NULL, PRIMARY KEY (\`vaiTroId\`, \`quyenId\`)) ENGINE=InnoDB`,
      );
      createdTables.push(tableNames.assignments);

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
          INDEX \`${suffix}_TK_fk\` (\`khachHangId\`),
          CONSTRAINT \`${suffix}_TK_fk\` FOREIGN KEY (\`khachHangId\`) REFERENCES ${quoted(tableNames.khachHang)} (\`khachHangId\`) ON DELETE RESTRICT ON UPDATE RESTRICT
        ) ENGINE=InnoDB`,
      );
      createdTables.push(tableNames.tinNhan);

      // Thêm roles
      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.role)} (\`tenVaiTro\`, \`moTa\`) VALUES
          ('NHA_XE_ADMIN', 'Quản trị nhà xe'),
          ('NHAN_VIEN_CSKH', 'Nhân viên chăm sóc khách hàng')`,
      );

      // 2. Chèn dữ liệu mẫu (Legacy Data)
      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.nhaXe)} (\`nhaXeId\`, \`tenNhaXe\`) VALUES (1, 'Nhà xe Phương Trang')`,
      );
      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.taiKhoan)} (\`taiKhoanId\`, \`email\`) VALUES (10, 'customer10@vexgo.vn')`,
      );
      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.khachHang)} (\`khachHangId\`, \`maKhachHang\`, \`taiKhoanId\`) VALUES (5, 'KH005', 10)`,
      );
      await db.$executeRawUnsafe(
        `INSERT INTO ${quoted(tableNames.tinNhan)} (\`tinNhanId\`, \`noiDung\`, \`thoiGian\`, \`trangThai\`, \`khachHangId\`, \`createdAt\`, \`updatedAt\`) VALUES
          (1, 'Xin chào, tôi cần hỗ trợ đổi vé', '2026-10-10 08:30:00', 'DA_GUI', 5, '2026-10-10 08:30:00', '2026-10-10 08:30:00'),
          (2, 'Nhà xe có chuyến đi Đà Lạt lúc 14h không?', '2026-10-10 08:32:00', 'DA_GUI', 5, '2026-10-10 08:32:00', '2026-10-10 08:32:00')`,
      );

      // 3. Đọc và thực thi migration SQL
      const migrationSql = await readFile(migrationSqlUrl, 'utf8');
      const statements = migrationSql
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
        .split(';')
        .map((statement) => statement.trim())
        .filter(Boolean);

      createdTables.push(tableNames.cuocTroChuyen, tableNames.luuTru);

      for (const statement of statements) {
        await db.$executeRawUnsafe(statement);
      }

      // 4. Xác minh Preflight Archive bảo toàn toàn vẹn dữ liệu
      const archivedRows = await db.$queryRawUnsafe<
        Array<{
          tinNhanId: number;
          noiDung: string;
          khachHangIdCu: number;
          trangThaiCu: string;
        }>
      >(
        `SELECT \`tinNhanId\`, \`noiDung\`, \`khachHangIdCu\`, \`trangThaiCu\` FROM ${quoted(tableNames.luuTru)} ORDER BY \`tinNhanId\` ASC`,
      );
      expect(archivedRows).toHaveLength(2);
      expect(archivedRows[0]).toMatchObject({
        tinNhanId: 1,
        noiDung: 'Xin chào, tôi cần hỗ trợ đổi vé',
        khachHangIdCu: 5,
        trangThaiCu: 'DA_GUI',
      });
      expect(archivedRows[1]).toMatchObject({
        tinNhanId: 2,
        noiDung: 'Nhà xe có chuyến đi Đà Lạt lúc 14h không?',
        khachHangIdCu: 5,
        trangThaiCu: 'DA_GUI',
      });

      // 5. Xác minh CuocTroChuyen được tự động tạo kế thừa từ khách hàng cũ
      const conversations = await db.$queryRawUnsafe<
        Array<{
          cuocTroChuyenId: number;
          maCuocTroChuyen: string;
          khachHangId: number;
          nhaXeId: number;
          trangThai: string;
        }>
      >(
        `SELECT \`cuocTroChuyenId\`, \`maCuocTroChuyen\`, \`khachHangId\`, \`nhaXeId\`, \`trangThai\` FROM ${quoted(tableNames.cuocTroChuyen)}`,
      );
      expect(conversations).toHaveLength(1);
      expect(conversations[0]).toMatchObject({
        maCuocTroChuyen: 'LEGACY-KH-5',
        khachHangId: 5,
        nhaXeId: 1,
        trangThai: 'DONG',
      });

      // 6. Xác minh dữ liệu TinNhanHoTro đã được backfill chuẩn xác sang schema mới
      const upgradedMessages = await db.$queryRawUnsafe<
        Array<{
          tinNhanId: number;
          cuocTroChuyenId: number;
          taiKhoanGuiId: number;
          loaiNguoiGui: string;
          loaiTinNhan: string;
          trangThai: string;
          noiDung: string;
        }>
      >(
        `SELECT \`tinNhanId\`, \`cuocTroChuyenId\`, \`taiKhoanGuiId\`, \`loaiNguoiGui\`, \`loaiTinNhan\`, \`trangThai\`, \`noiDung\`
         FROM ${quoted(tableNames.tinNhan)} ORDER BY \`tinNhanId\` ASC`,
      );
      expect(upgradedMessages).toHaveLength(2);
      expect(upgradedMessages[0]).toMatchObject({
        tinNhanId: 1,
        cuocTroChuyenId: conversations[0].cuocTroChuyenId,
        taiKhoanGuiId: 10,
        loaiNguoiGui: 'KHACH_HANG',
        loaiTinNhan: 'VAN_BAN',
        trangThai: 'DA_GUI',
        noiDung: 'Xin chào, tôi cần hỗ trợ đổi vé',
      });
      expect(upgradedMessages[1]).toMatchObject({
        tinNhanId: 2,
        cuocTroChuyenId: conversations[0].cuocTroChuyenId,
        taiKhoanGuiId: 10,
        loaiNguoiGui: 'KHACH_HANG',
        loaiTinNhan: 'VAN_BAN',
        trangThai: 'DA_GUI',
        noiDung: 'Nhà xe có chuyến đi Đà Lạt lúc 14h không?',
      });

      // 7. Xác minh cột cũ đã bị contract khỏi TinNhanHoTro
      const columns = await db.$queryRawUnsafe<Array<{ COLUMN_NAME: string }>>(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${tableNames.tinNhan}'`,
      );
      const columnNames = columns.map((c) => c.COLUMN_NAME);
      expect(columnNames).not.toContain('thoiGian');
      expect(columnNames).not.toContain('khachHangId');
      expect(columnNames).toContain('cuocTroChuyenId');
      expect(columnNames).toContain('taiKhoanGuiId');
      expect(columnNames).toContain('loaiNguoiGui');
    } finally {
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
  });
});
