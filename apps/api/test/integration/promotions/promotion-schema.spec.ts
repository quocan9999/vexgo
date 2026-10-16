import { promotionTestDatabaseUrl } from '../../support/promotion-test-database.js';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { config as loadDotenv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Prisma, PrismaClient } from '../../../src/generated/prisma/client.js';

loadDotenv({
  path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../.env'),
});

let prisma: PrismaClient;

function promotionDatabaseConfig() {
  const url = promotionTestDatabaseUrl(process.env.DATABASE_URL);
  const database = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
  const username = decodeURIComponent(url.username);

  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: username,
    password: decodeURIComponent(url.password),
    database,
    allowPublicKeyRetrieval: true,
  };
}

type DbClient = Prisma.TransactionClient;

async function withRollback(
  work: (client: DbClient) => Promise<void>,
): Promise<void> {
  const rollbackMarker = new Error('intentional test transaction rollback');
  try {
    await prisma.$transaction(
      async (client) => {
        await work(client);
        throw rollbackMarker;
      },
      { timeout: 30_000 },
    );
  } catch (error) {
    if (error !== rollbackMarker) throw error;
  }
}

function mysqlErrorDetails(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const prismaError = error as Error & {
    code?: string;
    meta?: {
      code?: string | number;
      message?: string;
      database_error?: string;
    };
  };
  return [
    prismaError.code,
    prismaError.meta?.code,
    prismaError.meta?.message,
    prismaError.meta?.database_error,
    prismaError.message,
  ]
    .filter(Boolean)
    .join(' ');
}

async function expectMysqlError(
  operation: () => Promise<unknown>,
  mysqlCode: string,
): Promise<void> {
  let failure: unknown;
  try {
    await operation();
  } catch (error) {
    failure = error;
  }
  expect(failure, `expected MySQL error ${mysqlCode}`).toBeDefined();
  expect(mysqlErrorDetails(failure)).toContain(mysqlCode);
}

async function insertTenant(client: DbClient, suffix: string): Promise<number> {
  await client.$executeRaw`
    INSERT INTO NhaXe (maNhaXe, tenNhaXe, trangThai)
    VALUES (${`PROMO-TEST-${suffix}`}, 'Promotion schema test', 'HOAT_DONG')
  `;
  const [row] = await client.$queryRaw<
    Array<{ id: number }>
  >`SELECT LAST_INSERT_ID() AS id`;
  return Number(row.id);
}

async function insertPromotion(
  client: DbClient,
  nhaXeId: number,
  code: string,
  quota = 1,
): Promise<number> {
  await client.$executeRaw`
    INSERT INTO KhuyenMai (
      tenChuongTrinh,
      maKhuyenMai,
      phamViApDung,
      hinhThucApDung,
      loaiGiamGia,
      giaTriGiam,
      giamToiDa,
      giaTriDonToiThieu,
      dieuKienApDung,
      tuNgay,
      denNgay,
      trangThai,
      nhaXeId,
      soLuotToiDa
    ) VALUES (
      ${`Test ${code}`},
      ${code},
      'DAT_VE',
      'NHAP_MA',
      'PHAN_TRAM',
      10,
      50000,
      NULL,
      NULL,
      '2030-01-01',
      '2030-12-31',
      'HOAT_DONG',
      ${nhaXeId},
      ${quota}
    )
  `;
  const [row] = await client.$queryRaw<
    Array<{ id: number }>
  >`SELECT LAST_INSERT_ID() AS id`;
  return Number(row.id);
}

async function insertBooking(
  client: DbClient,
  nhaXeId: number,
  khuyenMaiId: number | null,
  suffix: string,
): Promise<{ phieuDatVeId: number; discount: number }> {
  await client.$executeRaw`
    INSERT INTO DonGiaoDich (
      maDonGiaoDich,
      ngayTao,
      tongTien,
      trangThai,
      tenKhachHang,
      soDienThoaiKhachHang,
      nhaXeId
    ) VALUES (
      ${`PROMO-TX-${suffix}`},
      '2030-02-01 09:00:00',
      100000,
      'CHO_THANH_TOAN',
      'Promotion schema test',
      '0900000000',
      ${nhaXeId}
    )
  `;
  const [transaction] = await client.$queryRaw<
    Array<{ id: number }>
  >`SELECT LAST_INSERT_ID() AS id`;

  await client.$executeRaw`
    INSERT INTO PhieuDatVe (
      maPhieuDatVe,
      ngayDat,
      soLuongVeBanDau,
      tongTienBanDau,
      trangThai,
      khuyenMaiId,
      donGiaoDichId
    ) VALUES (
      ${`PROMO-BOOKING-${suffix}`},
      '2030-02-01 09:00:00',
      1,
      100000,
      'CHO_THANH_TOAN',
      ${khuyenMaiId},
      ${Number(transaction.id)}
    )
  `;
  const [booking] = await client.$queryRaw<
    Array<{ id: number; discount: string | number }>
  >`
    SELECT phieuDatVeId AS id, soTienGiamKhuyenMai AS discount
    FROM PhieuDatVe
    WHERE donGiaoDichId = ${Number(transaction.id)}
  `;
  return {
    phieuDatVeId: Number(booking.id),
    discount: Number(booking.discount),
  };
}

async function insertCustomer(
  client: DbClient,
  suffix: string,
): Promise<number> {
  const phoneNumber = Number.parseInt(suffix.slice(0, 8), 16)
    .toString()
    .padStart(8, '0')
    .slice(-8);
  const phone = `09${phoneNumber}`;
  await client.$executeRaw`
    INSERT INTO TaiKhoan (hoTen, soDienThoai, matKhau, daXacThucSoDienThoai, trangThai)
    VALUES (${`Promotion test ${suffix}`}, ${phone}, 'test-password-hash', 1, 'HOAT_DONG')
  `;
  const [account] = await client.$queryRaw<
    Array<{ id: number }>
  >`SELECT LAST_INSERT_ID() AS id`;
  await client.$executeRaw`
    INSERT INTO KhachHang (maKhachHang, taiKhoanId)
    VALUES (${`PROMO-CUSTOMER-${suffix}`}, ${Number(account.id)})
  `;
  const [customer] = await client.$queryRaw<
    Array<{ id: number }>
  >`SELECT LAST_INSERT_ID() AS id`;
  return Number(customer.id);
}

async function insertUsage(
  client: DbClient,
  khuyenMaiId: number,
  phieuDatVeId: number,
  khachHangId: number | null,
  phone: string | null,
): Promise<void> {
  await client.$executeRaw`
    INSERT INTO SuDungKhuyenMai (
      khuyenMaiId,
      phieuDatVeId,
      khachHangId,
      soDienThoaiChuanHoa,
      soTienGiam
    ) VALUES (
      ${khuyenMaiId},
      ${phieuDatVeId},
      ${khachHangId},
      ${phone},
      1000
    )
  `;
}

describe('promotion quota schema on MySQL', () => {
  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaMariaDb(promotionDatabaseConfig()),
    });
    await prisma.$connect();
    const [row] = await prisma.$queryRaw<
      Array<{ databaseName: string }>
    >`SELECT DATABASE() AS databaseName`;
    expect(row.databaseName).toBe(decodeURIComponent(promotionTestDatabaseUrl(process.env.DATABASE_URL).pathname.slice(1)));
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('stores required quota, bounded counters, ledger snapshots, and unique indexes', async () => {
    const columns = await prisma.$queryRaw<
      Array<{
        tableName: string;
        columnName: string;
        isNullable: string;
        columnDefault: string | null;
        dataType: string;
        numericPrecision: number | bigint | null;
        numericScale: number | bigint | null;
      }>
    >`
      SELECT
        TABLE_NAME AS tableName,
        COLUMN_NAME AS columnName,
        IS_NULLABLE AS isNullable,
        COLUMN_DEFAULT AS columnDefault,
        DATA_TYPE AS dataType,
        NUMERIC_PRECISION AS numericPrecision,
        NUMERIC_SCALE AS numericScale
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND (
          (TABLE_NAME = 'KhuyenMai' AND COLUMN_NAME IN ('maKhuyenMai', 'denNgay', 'soLuotToiDa', 'soLuotDaSuDung'))
          OR (TABLE_NAME = 'PhieuDatVe' AND COLUMN_NAME = 'soTienGiamKhuyenMai')
          OR (TABLE_NAME = 'SuDungKhuyenMai' AND COLUMN_NAME IN ('khuyenMaiId', 'phieuDatVeId', 'khachHangId', 'soDienThoaiChuanHoa', 'soTienGiam', 'createdAt'))
        )
    `;
    const column = (tableName: string, columnName: string) =>
      columns.find(
        (item) =>
          item.tableName === tableName && item.columnName === columnName,
      );

    for (const [table, name] of [
      ['KhuyenMai', 'maKhuyenMai'],
      ['KhuyenMai', 'denNgay'],
      ['KhuyenMai', 'soLuotToiDa'],
      ['KhuyenMai', 'soLuotDaSuDung'],
      ['PhieuDatVe', 'soTienGiamKhuyenMai'],
      ['SuDungKhuyenMai', 'khuyenMaiId'],
      ['SuDungKhuyenMai', 'phieuDatVeId'],
      ['SuDungKhuyenMai', 'khachHangId'],
      ['SuDungKhuyenMai', 'soDienThoaiChuanHoa'],
      ['SuDungKhuyenMai', 'soTienGiam'],
      ['SuDungKhuyenMai', 'createdAt'],
    ]) {
      expect(column(table, name), `${table}.${name} must exist`).toBeDefined();
    }

    expect(column('KhuyenMai', 'maKhuyenMai')?.isNullable).toBe('NO');
    expect(column('KhuyenMai', 'denNgay')?.isNullable).toBe('NO');
    expect(column('KhuyenMai', 'soLuotToiDa')?.isNullable).toBe('NO');
    expect(column('KhuyenMai', 'soLuotDaSuDung')).toMatchObject({
      isNullable: 'NO',
      columnDefault: '0',
      dataType: 'int',
    });
    expect(column('PhieuDatVe', 'soTienGiamKhuyenMai')).toMatchObject({
      isNullable: 'NO',
      columnDefault: '0.00',
      dataType: 'decimal',
    });
    expect(
      Number(column('PhieuDatVe', 'soTienGiamKhuyenMai')?.numericPrecision),
    ).toBe(18);
    expect(
      Number(column('PhieuDatVe', 'soTienGiamKhuyenMai')?.numericScale),
    ).toBe(2);
    expect(column('SuDungKhuyenMai', 'soDienThoaiChuanHoa')?.isNullable).toBe(
      'YES',
    );
    expect(column('SuDungKhuyenMai', 'soTienGiam')).toMatchObject({
      isNullable: 'NO',
      dataType: 'decimal',
    });
    expect(
      Number(column('SuDungKhuyenMai', 'soTienGiam')?.numericPrecision),
    ).toBe(18);
    expect(Number(column('SuDungKhuyenMai', 'soTienGiam')?.numericScale)).toBe(
      2,
    );

    const indexes = await prisma.$queryRaw<
      Array<{ indexName: string; columns: string; nonUnique: number }>
    >`
      SELECT
        INDEX_NAME AS indexName,
        GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') AS columns,
        MIN(NON_UNIQUE) AS nonUnique
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SuDungKhuyenMai'
      GROUP BY INDEX_NAME
    `;
    const uniqueColumns = indexes
      .filter((index) => Number(index.nonUnique) === 0)
      .map((index) => index.columns);
    expect(uniqueColumns).toContain('phieuDatVeId');
    expect(uniqueColumns).toContain('khuyenMaiId,soDienThoaiChuanHoa');
    expect(uniqueColumns).toContain('khuyenMaiId,khachHangId');
    expect(
      indexes.some(
        (index) =>
          index.columns === 'khachHangId' && Number(index.nonUnique) === 1,
      ),
    ).toBe(true);

    const foreignKeys = await prisma.$queryRaw<
      Array<{
        tableName: string;
        columnName: string;
        referencedTable: string;
        deleteRule: string;
      }>
    >`
      SELECT
        kcu.TABLE_NAME AS tableName,
        kcu.COLUMN_NAME AS columnName,
        kcu.REFERENCED_TABLE_NAME AS referencedTable,
        rc.DELETE_RULE AS deleteRule
      FROM information_schema.KEY_COLUMN_USAGE kcu
      JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
        ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
        AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
      WHERE kcu.CONSTRAINT_SCHEMA = DATABASE()
        AND kcu.TABLE_NAME = 'SuDungKhuyenMai'
        AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
    `;
    expect(foreignKeys).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          columnName: 'khuyenMaiId',
          referencedTable: 'KhuyenMai',
          deleteRule: 'RESTRICT',
        }),
        expect.objectContaining({
          columnName: 'phieuDatVeId',
          referencedTable: 'PhieuDatVe',
          deleteRule: 'RESTRICT',
        }),
        expect.objectContaining({
          columnName: 'khachHangId',
          referencedTable: 'KhachHang',
          deleteRule: 'RESTRICT',
        }),
      ]),
    );
  });

  it('defaults booking discount to zero and rejects invalid quota counter states', async () => {
    await withRollback(async (client) => {
      const suffix = randomUUID()
        .replaceAll('-', '')
        .slice(0, 16)
        .toUpperCase();
      const nhaXeId = await insertTenant(client, suffix);
      const khuyenMaiId = await insertPromotion(
        client,
        nhaXeId,
        `PM-${suffix}-Q`,
        1,
      );
      const bookingWithoutPromotion = await insertBooking(
        client,
        nhaXeId,
        null,
        `${suffix}-A0`,
      );
      const bookingWithPromotion = await insertBooking(
        client,
        nhaXeId,
        khuyenMaiId,
        `${suffix}-A1`,
      );

      expect(bookingWithoutPromotion.discount).toBe(0);
      await client.$executeRaw`
        UPDATE KhuyenMai SET soLuotDaSuDung = 1 WHERE khuyenMaiId = ${khuyenMaiId}
      `;
      await expectMysqlError(
        () =>
          client.$executeRaw`UPDATE KhuyenMai SET soLuotDaSuDung = -1 WHERE khuyenMaiId = ${khuyenMaiId}`,
        '3819',
      );
      await expectMysqlError(
        () =>
          client.$executeRaw`UPDATE KhuyenMai SET soLuotDaSuDung = 2 WHERE khuyenMaiId = ${khuyenMaiId}`,
        '3819',
      );
      await expectMysqlError(
        () =>
          client.$executeRaw`UPDATE KhuyenMai SET soLuotToiDa = 0 WHERE khuyenMaiId = ${khuyenMaiId}`,
        '3819',
      );
      await expectMysqlError(
        () =>
          client.$executeRaw`UPDATE PhieuDatVe SET soTienGiamKhuyenMai = -1 WHERE phieuDatVeId = ${bookingWithoutPromotion.phieuDatVeId}`,
        '3819',
      );
      await insertUsage(
        client,
        khuyenMaiId,
        bookingWithPromotion.phieuDatVeId,
        null,
        '+84901234567',
      );
      await expectMysqlError(
        () =>
          client.$executeRaw`UPDATE SuDungKhuyenMai SET soTienGiam = -1 WHERE khuyenMaiId = ${khuyenMaiId} AND phieuDatVeId = ${bookingWithPromotion.phieuDatVeId}`,
        '3819',
      );
    });
  }, 30_000);

  it('enforces code and usage uniqueness without crossing tenant or promotion scope', async () => {
    await withRollback(async (client) => {
      const suffix = randomUUID()
        .replaceAll('-', '')
        .slice(0, 16)
        .toUpperCase();
      const tenantA = await insertTenant(client, `${suffix}A`);
      const tenantB = await insertTenant(client, `${suffix}B`);
      const sharedCode = `PM-${suffix}-SHARED`;
      const promoA = await insertPromotion(client, tenantA, sharedCode);
      const promoB = await insertPromotion(client, tenantA, `PM-${suffix}-B`);

      await insertPromotion(client, tenantB, sharedCode);
      await expectMysqlError(
        () => insertPromotion(client, tenantA, sharedCode),
        '1062',
      );

      const guestBookingA = await insertBooking(
        client,
        tenantA,
        promoA,
        `${suffix}-A1`,
      );
      const guestBookingA2 = await insertBooking(
        client,
        tenantA,
        promoA,
        `${suffix}-A2`,
      );
      await insertUsage(
        client,
        promoA,
        guestBookingA.phieuDatVeId,
        null,
        '+84901234567',
      );
      await expectMysqlError(
        () =>
          insertUsage(
            client,
            promoA,
            guestBookingA2.phieuDatVeId,
            null,
            '+84901234567',
          ),
        '1062',
      );

      const guestBookingB = await insertBooking(
        client,
        tenantA,
        promoB,
        `${suffix}-B1`,
      );
      await insertUsage(
        client,
        promoB,
        guestBookingB.phieuDatVeId,
        null,
        '+84901234567',
      );

      const khachHangId = await insertCustomer(client, suffix);
      const signedBookingA = await insertBooking(
        client,
        tenantA,
        promoA,
        `${suffix}-A3`,
      );
      const signedBookingA2 = await insertBooking(
        client,
        tenantA,
        promoA,
        `${suffix}-A4`,
      );
      await insertUsage(
        client,
        promoA,
        signedBookingA.phieuDatVeId,
        khachHangId,
        null,
      );
      await expectMysqlError(
        () =>
          insertUsage(
            client,
            promoA,
            signedBookingA2.phieuDatVeId,
            khachHangId,
            null,
          ),
        '1062',
      );

      const signedBookingB = await insertBooking(
        client,
        tenantA,
        promoB,
        `${suffix}-B2`,
      );
      await insertUsage(
        client,
        promoB,
        signedBookingB.phieuDatVeId,
        khachHangId,
        null,
      );

      await expectMysqlError(
        () =>
          insertUsage(
            client,
            promoB,
            guestBookingB.phieuDatVeId,
            null,
            '+84901999999',
          ),
        '1062',
      );
    });
  }, 30_000);
});
