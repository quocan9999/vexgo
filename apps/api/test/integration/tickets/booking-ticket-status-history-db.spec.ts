import { resolve } from 'node:path';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { config as loadDotenv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  Prisma,
  PrismaClient,
  type LichSuTrangThaiPhieuDatVe,
  type LichSuTrangThaiVe,
} from '../../../src/generated/prisma/client.js';

loadDotenv({ path: resolve(process.cwd(), '../../.env') });
loadDotenv({ path: resolve(process.cwd(), '.env') });
loadDotenv({ path: resolve(process.cwd(), '.env.test') });

const TEST_DATABASE_ENV = 'BOOKING_TICKET_STATUS_HISTORY_TEST_DATABASE_URL';
const TEST_DATABASE_NAME = /^vexgo_booking_ticket_status_history_[a-z0-9_]*_test$/i;
const UUID_V1_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-1[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type HistoryEntity = 'booking' | 'ticket';

type HistoryEntry = {
  trangThaiCu: string | null;
  trangThaiMoi: string;
  nguonThayDoi: string;
  taiKhoanId: number | null;
  lyDo: string;
  thoiDiem: Date;
  laOverride?: boolean;
  maThaoTac: string;
};

type TestFixture = {
  nhaXeId: number;
  loaiXeId: number;
  xeId: number;
  gheIds: number[];
  tuyenXeId: number;
  chuyenXeId: number;
  gheChuyenXeIds: number[];
  bangGiaId: number;
  customerAccountId: number;
  staffAccountId: number;
  khachHangId: number;
  donGiaoDichId: number;
  phieuDatVeId: number;
  veIds: number[];
};

let prisma: PrismaClient;
let fixtureSequence = 0;

function targetFromDatabaseUrl(value: string): {
  host: string;
  port: number;
  database: string;
} {
  const url = new URL(value);
  return {
    host: url.hostname.toLowerCase(),
    port: Number(url.port || 3306),
    database: decodeURIComponent(url.pathname.replace(/^\/+/, '')).toLowerCase(),
  };
}

function assertDedicatedTestDatabase(): URL {
  const configuredUrl = process.env[TEST_DATABASE_ENV];
  if (!configuredUrl) {
    throw new Error(
      `${TEST_DATABASE_ENV} is required; integration tests never use DATABASE_URL.`,
    );
  }

  let url: URL;
  try {
    url = new URL(configuredUrl);
  } catch {
    throw new Error(`${TEST_DATABASE_ENV} must be a valid MySQL URL.`);
  }

  const target = targetFromDatabaseUrl(configuredUrl);
  if (url.protocol !== 'mysql:' || !TEST_DATABASE_NAME.test(target.database)) {
    throw new Error(
      `${TEST_DATABASE_ENV} must target a dedicated vexgo_booking_ticket_status_history_*_test schema.`,
    );
  }

  const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
  if (
    !localHosts.has(target.host) &&
    process.env.BOOKING_TICKET_STATUS_HISTORY_ALLOW_REMOTE_TEST_DATABASE !== 'true'
  ) {
    throw new Error(
      'Remote test database blocked. Set BOOKING_TICKET_STATUS_HISTORY_ALLOW_REMOTE_TEST_DATABASE=true only for a dedicated test server.',
    );
  }

  for (const name of ['DATABASE_URL', 'MIGRATION_URL', 'SHADOW_DATABASE_URL']) {
    const configured = process.env[name];
    if (!configured) continue;
    const configuredTarget = targetFromDatabaseUrl(configured);
    if (
      target.host === configuredTarget.host &&
      target.port === configuredTarget.port &&
      target.database === configuredTarget.database
    ) {
      throw new Error(`${TEST_DATABASE_ENV} must not point to ${name}.`);
    }
  }

  return url;
}

function createTestClient(): PrismaClient {
  const databaseUrl = assertDedicatedTestDatabase();
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

async function createUuidV1(client: Prisma.TransactionClient): Promise<string> {
  const [row] = await client.$queryRaw<Array<{ maThaoTac: string }>>`
    SELECT UUID() AS maThaoTac
  `;
  expect(row.maThaoTac).toMatch(UUID_V1_PATTERN);
  return row.maThaoTac;
}

async function createAccount(
  client: Prisma.TransactionClient,
  phone: string,
  name: string,
): Promise<number> {
  const account = await client.taiKhoan.create({
    data: {
      hoTen: name,
      soDienThoai: phone,
      matKhau: 'test-fixture-password-hash',
      daXacThucSoDienThoai: true,
      trangThai: 'HOAT_DONG',
    },
    select: { taiKhoanId: true },
  });
  return account.taiKhoanId;
}

async function createFixture(
  client: Prisma.TransactionClient,
  ticketCount = 2,
): Promise<TestFixture> {
  fixtureSequence += 1;
  const suffix = `${Date.now().toString(36)}${fixtureSequence.toString(36)}`;
  const phone = `9${`${Date.now()}${fixtureSequence.toString().padStart(5, '0')}`.slice(-15)}`;
  const nhaXe = await client.nhaXe.create({
    data: {
      maNhaXe: `TEST-NX-${suffix}`,
      tenNhaXe: `Test fixture ${suffix}`,
      trangThai: 'HOAT_DONG',
    },
    select: { nhaXeId: true },
  });
  const customerAccountId = await createAccount(client, phone, `Customer ${suffix}`);
  const staffAccountId = await createAccount(
    client,
    `8${phone.slice(1)}`,
    `Staff ${suffix}`,
  );
  const khachHang = await client.khachHang.create({
    data: {
      maKhachHang: `TEST-KH-${suffix}`,
      taiKhoanId: customerAccountId,
    },
    select: { khachHangId: true },
  });
  const loaiXe = await client.loaiXe.create({
    data: { nhaXeId: nhaXe.nhaXeId, tenLoai: `Test coach ${suffix}` },
    select: { loaiXeId: true },
  });
  const xe = await client.xe.create({
    data: {
      bienSoXe: `TST-${suffix}`,
      trangThai: 'HOAT_DONG',
      nhaXeId: nhaXe.nhaXeId,
      loaiXeId: loaiXe.loaiXeId,
    },
    select: { xeId: true },
  });
  const tuyenXe = await client.tuyenXe.create({
    data: {
      maTuyenXe: `TEST-TX-${suffix}`,
      diemDi: 'Test origin',
      diemDen: 'Test destination',
      trangThai: 'HOAT_DONG',
      nhaXeId: nhaXe.nhaXeId,
    },
    select: { tuyenXeId: true },
  });
  const gheIds: number[] = [];
  for (let index = 0; index < ticketCount; index += 1) {
    const ghe = await client.ghe.create({
      data: { soGhe: `T${index + 1}`, xeId: xe.xeId },
      select: { gheId: true },
    });
    gheIds.push(ghe.gheId);
  }
  const chuyenXe = await client.chuyenXe.create({
    data: {
      maChuyenXe: `TEST-CX-${suffix}`,
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
  const gheChuyenXeIds: number[] = [];
  for (const gheId of gheIds) {
    const gheChuyenXe = await client.gheChuyenXe.create({
      data: {
        trangThai: 'CON_TRONG',
        chuyenXeId: chuyenXe.chuyenXeId,
        gheId,
      },
      select: { gheChuyenXeId: true },
    });
    gheChuyenXeIds.push(gheChuyenXe.gheChuyenXeId);
  }
  const bangGia = await client.bangGia.create({
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
  const donGiaoDich = await client.donGiaoDich.create({
    data: {
      maDonGiaoDich: `TEST-DGD-${suffix}`,
      ngayTao: new Date('2034-12-01T00:00:00.000Z'),
      tongTien: 100000,
      trangThai: 'CHO_THANH_TOAN',
      tenKhachHang: `Customer ${suffix}`,
      soDienThoaiKhachHang: phone,
      khachHangId: khachHang.khachHangId,
      nhaXeId: nhaXe.nhaXeId,
    },
    select: { donGiaoDichId: true },
  });
  const phieuDatVe = await client.phieuDatVe.create({
    data: {
      maPhieuDatVe: `TEST-PDV-${suffix}`,
      ngayDat: new Date('2034-12-01T00:00:00.000Z'),
      soLuongVeBanDau: ticketCount,
      tongTienBanDau: 100000,
      trangThai: 'CHO_THANH_TOAN',
      donGiaoDichId: donGiaoDich.donGiaoDichId,
    },
    select: { phieuDatVeId: true },
  });
  const veIds: number[] = [];
  for (let index = 0; index < gheChuyenXeIds.length; index += 1) {
    const ve = await client.ve.create({
      data: {
        maVe: `TEST-VE-${suffix}-${index + 1}`,
        giaNiemYet: 100000,
        giaThucTe: 100000,
        trangThai: 'CHO_THANH_TOAN',
        phieuDatVeId: phieuDatVe.phieuDatVeId,
        gheChuyenXeId: gheChuyenXeIds[index],
        bangGiaApDungId: bangGia.bangGiaId,
      },
      select: { veId: true },
    });
    veIds.push(ve.veId);
  }

  return {
    nhaXeId: nhaXe.nhaXeId,
    loaiXeId: loaiXe.loaiXeId,
    xeId: xe.xeId,
    gheIds,
    tuyenXeId: tuyenXe.tuyenXeId,
    chuyenXeId: chuyenXe.chuyenXeId,
    gheChuyenXeIds,
    bangGiaId: bangGia.bangGiaId,
    customerAccountId,
    staffAccountId,
    khachHangId: khachHang.khachHangId,
    donGiaoDichId: donGiaoDich.donGiaoDichId,
    phieuDatVeId: phieuDatVe.phieuDatVeId,
    veIds,
  };
}

async function cleanupFixture(
  client: Prisma.TransactionClient,
  fixture: TestFixture,
): Promise<void> {
  await client.lichSuTrangThaiPhieuDatVe.deleteMany({
    where: { phieuDatVeId: fixture.phieuDatVeId },
  });
  if (fixture.veIds.length > 0) {
    await client.lichSuTrangThaiVe.deleteMany({
      where: { veId: { in: fixture.veIds } },
    });
    await client.ve.deleteMany({ where: { veId: { in: fixture.veIds } } });
  }
  await client.phieuDatVe.delete({
    where: { phieuDatVeId: fixture.phieuDatVeId },
  });
  await client.donGiaoDich.delete({
    where: { donGiaoDichId: fixture.donGiaoDichId },
  });
  if (fixture.gheChuyenXeIds.length > 0) {
    await client.gheChuyenXe.deleteMany({
      where: { gheChuyenXeId: { in: fixture.gheChuyenXeIds } },
    });
  }
  await client.bangGia.delete({ where: { bangGiaId: fixture.bangGiaId } });
  await client.chuyenXe.delete({
    where: { chuyenXeId: fixture.chuyenXeId },
  });
  if (fixture.gheIds.length > 0) {
    await client.ghe.deleteMany({ where: { gheId: { in: fixture.gheIds } } });
  }
  await client.xe.delete({ where: { xeId: fixture.xeId } });
  await client.tuyenXe.delete({ where: { tuyenXeId: fixture.tuyenXeId } });
  await client.loaiXe.delete({ where: { loaiXeId: fixture.loaiXeId } });
  await client.khachHang.delete({
    where: { khachHangId: fixture.khachHangId },
  });
  await client.taiKhoan.deleteMany({
    where: {
      taiKhoanId: {
        in: [fixture.customerAccountId, fixture.staffAccountId],
      },
    },
  });
  await client.nhaXe.delete({ where: { nhaXeId: fixture.nhaXeId } });
}

async function withFixture(
  action: (
    client: Prisma.TransactionClient,
    fixture: TestFixture,
  ) => Promise<void>,
  ticketCount = 2,
): Promise<void> {
  await prisma.$transaction(
    async (client) => {
      const fixture = await createFixture(client, ticketCount);
      try {
        await action(client, fixture);
      } finally {
        await cleanupFixture(client, fixture);
      }
    },
    { timeout: 30_000 },
  );
}

async function insertHistory(
  client: Prisma.TransactionClient,
  entity: HistoryEntity,
  fixture: TestFixture,
  entry: HistoryEntry,
  ticketIndex?: number,
): Promise<LichSuTrangThaiPhieuDatVe | LichSuTrangThaiVe> {
  if (entity === 'booking') {
    return await client.lichSuTrangThaiPhieuDatVe.create({
      data: { phieuDatVeId: fixture.phieuDatVeId, ...entry },
    });
  }
  return await client.lichSuTrangThaiVe.create({
    data: { veId: fixture.veIds[ticketIndex ?? 0], ...entry },
  });
}

async function validEntry(
  client: Prisma.TransactionClient,
  fixture: TestFixture,
  overrides: Partial<HistoryEntry> = {},
): Promise<HistoryEntry> {
  return {
    trangThaiCu: null,
    trangThaiMoi: 'CHO_THANH_TOAN',
    nguonThayDoi: 'SYSTEM',
    taiKhoanId: null,
    lyDo: 'Fixture test history',
    thoiDiem: new Date(),
    maThaoTac: await createUuidV1(client),
    ...overrides,
  };
}

async function expectCheckConstraintViolation(
  operation: Promise<unknown>,
  constraintName: string,
): Promise<void> {
  const error = await operation.then(
    () => undefined,
    (value: unknown) => value,
  );
  expect(error).toMatchObject({ code: 'P2039' });
  const details =
    error instanceof Error ? error.message : JSON.stringify(error ?? {});
  const metadata = JSON.stringify(
    (error as { meta?: unknown } | undefined)?.meta ?? {},
  );
  expect(`${details} ${metadata}`).toContain(constraintName);
}

async function expectPrismaError(
  operation: Promise<unknown>,
  code: string,
  details?: string,
): Promise<void> {
  const error = await operation.then(
    () => undefined,
    (value: unknown) => value,
  );
  expect(error).toMatchObject({ code });
  if (details) {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    const metadata = JSON.stringify(
      (error as { meta?: unknown } | undefined)?.meta ?? {},
    );
    expect(`${message} ${metadata}`).toContain(details);
  }
}

beforeAll(async () => {
  prisma = createTestClient();
  await prisma.$connect();
});

afterAll(async () => {
  if (prisma) await prisma.$disconnect();
});

describe('Lịch sử trạng thái Phiếu đặt vé & Vé DB Foundation', () => {
  for (const entity of ['booking', 'ticket'] as const) {
    const prefix = entity === 'booking' ? 'LSTTPDV' : 'LSTTV';

    describe(`${entity} CHECK constraints`, () => {
      it('chỉ chấp nhận source hợp lệ và actor phù hợp với source', async () => {
        await withFixture(async (client, fixture) => {
          await expectCheckConstraintViolation(
            insertHistory(
              client,
              entity,
              fixture,
              await validEntry(client, fixture, {
                nguonThayDoi: 'ADMIN',
                taiKhoanId: fixture.staffAccountId,
              }),
            ),
            `chk_${prefix}_nguonThayDoi`,
          );
          for (const nguonThayDoi of ['CUSTOMER', 'STAFF']) {
            await expectCheckConstraintViolation(
              insertHistory(
                client,
                entity,
                fixture,
                await validEntry(client, fixture, {
                  nguonThayDoi,
                  taiKhoanId: null,
                }),
              ),
              `chk_${prefix}_taiKhoan_theo_nguon`,
            );
          }
          await expectCheckConstraintViolation(
            insertHistory(
              client,
              entity,
              fixture,
              await validEntry(client, fixture, {
                nguonThayDoi: 'SYSTEM',
                taiKhoanId: fixture.staffAccountId,
              }),
            ),
            `chk_${prefix}_taiKhoan_theo_nguon`,
          );
        });
      });

      it('chỉ cho phép laOverride=true với STAFF', async () => {
        await withFixture(async (client, fixture) => {
          await expectCheckConstraintViolation(
            insertHistory(
              client,
              entity,
              fixture,
              await validEntry(client, fixture, {
                nguonThayDoi: 'CUSTOMER',
                taiKhoanId: fixture.customerAccountId,
                laOverride: true,
              }),
            ),
            `chk_${prefix}_laOverride_staff_only`,
          );
        });
      });

      it('từ chối history transition có trạng thái cũ bằng trạng thái mới', async () => {
        await withFixture(async (client, fixture) => {
          await expectCheckConstraintViolation(
            insertHistory(
              client,
              entity,
              fixture,
              await validEntry(client, fixture, {
                trangThaiCu: 'DA_THANH_TOAN',
                trangThaiMoi: 'DA_THANH_TOAN',
                nguonThayDoi: 'STAFF',
                taiKhoanId: fixture.staffAccountId,
              }),
            ),
            `chk_${prefix}_trangThai_hopLe`,
          );
        });
      });

      it('chấp nhận source hợp lệ, trạng thái khởi tạo và override hợp lệ', async () => {
        await withFixture(async (client, fixture) => {
          await insertHistory(
            client,
            entity,
            fixture,
            await validEntry(client, fixture, {
              nguonThayDoi: 'CUSTOMER',
              taiKhoanId: fixture.customerAccountId,
            }),
          );
          await insertHistory(
            client,
            entity,
            fixture,
            await validEntry(client, fixture, {
              trangThaiCu: 'CHO_THANH_TOAN',
              trangThaiMoi: 'DA_THANH_TOAN',
              nguonThayDoi: 'STAFF',
              taiKhoanId: fixture.staffAccountId,
              laOverride: true,
            }),
          );
          await insertHistory(
            client,
            entity,
            fixture,
            await validEntry(client, fixture),
          );
          const rows =
            entity === 'booking'
              ? await client.lichSuTrangThaiPhieuDatVe.findMany({
                  where: { phieuDatVeId: fixture.phieuDatVeId },
                  orderBy: { lichSuTrangThaiPhieuDatVeId: 'asc' },
                })
              : await client.lichSuTrangThaiVe.findMany({
                  where: { veId: fixture.veIds[0] },
                  orderBy: { lichSuTrangThaiVeId: 'asc' },
                });
          expect(rows).toHaveLength(3);
          expect(rows[0].maThaoTac).toMatch(UUID_V1_PATTERN);
          expect(rows[1].laOverride).toBe(true);
          expect(rows[2].laOverride).toBe(false);
          expect(rows[2].trangThaiCu).toBeNull();
        });
      });
    });

    it('cho phép nhiều transition và chia sẻ maThaoTac giữa các entity khác nhau', async () => {
      await withFixture(async (client, fixture) => {
        const baselineOperation = await createUuidV1(client);
        const transitionOperation = await createUuidV1(client);
        const timestamp = new Date('2034-12-01T12:00:00.000Z');

        await insertHistory(client, 'booking', fixture, {
          ...(await validEntry(client, fixture, { maThaoTac: baselineOperation })),
          thoiDiem: timestamp,
        } as HistoryEntry);
        await insertHistory(
          client,
          'ticket',
          fixture,
          {
            ...(await validEntry(client, fixture, { maThaoTac: baselineOperation })),
            thoiDiem: timestamp,
          } as HistoryEntry,
          0,
        );
        await insertHistory(client, 'ticket', fixture, {
          ...(await validEntry(client, fixture, { maThaoTac: baselineOperation })),
          thoiDiem: timestamp,
        } as HistoryEntry, 1);

        await client.phieuDatVe.update({
          where: { phieuDatVeId: fixture.phieuDatVeId },
          data: { trangThai: 'DA_THANH_TOAN' },
        });
        await client.ve.updateMany({
          where: { veId: { in: fixture.veIds } },
          data: { trangThai: 'DA_THANH_TOAN' },
        });

        const sharedTransition = {
          trangThaiCu: 'CHO_THANH_TOAN',
          trangThaiMoi: 'DA_THANH_TOAN',
          nguonThayDoi: 'STAFF',
          taiKhoanId: fixture.staffAccountId,
          lyDo: 'Fixture status transition',
          maThaoTac: transitionOperation,
          thoiDiem: timestamp,
        };
        await insertHistory(client, 'booking', fixture, sharedTransition);
        await insertHistory(client, 'ticket', fixture, sharedTransition, 0);
        await insertHistory(client, 'ticket', fixture, sharedTransition, 1);

        const [bookingHistoryCount, ticketHistoryCounts] = await Promise.all([
          client.lichSuTrangThaiPhieuDatVe.count({
            where: { phieuDatVeId: fixture.phieuDatVeId },
          }),
          client.lichSuTrangThaiVe.groupBy({
            by: ['veId'],
            where: { veId: { in: fixture.veIds } },
            _count: { _all: true },
          }),
        ]);
        expect(bookingHistoryCount).toBe(2);
        expect(ticketHistoryCounts).toHaveLength(2);
        expect(ticketHistoryCounts.every((group) => group._count._all === 2)).toBe(true);

        const [bookingTransition, ticketTransitions] = await Promise.all([
          client.lichSuTrangThaiPhieuDatVe.findFirstOrThrow({
            where: {
              phieuDatVeId: fixture.phieuDatVeId,
              maThaoTac: transitionOperation,
            },
          }),
          client.lichSuTrangThaiVe.findMany({
            where: {
              veId: { in: fixture.veIds },
              maThaoTac: transitionOperation,
            },
          }),
        ]);
        expect(ticketTransitions).toHaveLength(2);
        expect(bookingTransition.maThaoTac).toBe(transitionOperation);
        expect(ticketTransitions.every((row) => row.maThaoTac === transitionOperation)).toBe(
          true,
        );
        expect(bookingTransition.thoiDiem).toEqual(timestamp);
        expect(ticketTransitions.every((row) => row.thoiDiem.getTime() === timestamp.getTime())).toBe(
          true,
        );
        expect(bookingTransition.maThaoTac).toMatch(UUID_V1_PATTERN);
      });
    });

    it('UNIQUE(maThaoTac, entityId) chỉ chặn lặp lại cùng operation trên cùng entity', async () => {
      await withFixture(async (client, fixture) => {
        const maThaoTac = await createUuidV1(client);
        const initial = await validEntry(client, fixture, { maThaoTac });
        await insertHistory(client, entity, fixture, initial);

        await expectPrismaError(
          insertHistory(client, entity, fixture, {
            ...initial,
            trangThaiCu: 'CHO_THANH_TOAN',
            trangThaiMoi: 'DA_THANH_TOAN',
          }),
          'P2002',
        );

        if (fixture.veIds.length > 1) {
          await expect(
            insertHistory(client, 'ticket', fixture, initial, 1),
          ).resolves.toMatchObject({ maThaoTac });
        }
      });
    });
  }

  describe('Foreign Key Restrict trên fixture riêng', () => {
    it('chặn xóa PhieuDatVe chỉ được tham chiếu bởi history', async () => {
      await withFixture(async (client, fixture) => {
        await insertHistory(
          client,
          'booking',
          fixture,
          await validEntry(client, fixture),
        );
        await expectPrismaError(
          client.phieuDatVe.delete({
            where: { phieuDatVeId: fixture.phieuDatVeId },
          }),
          'P2003',
          'LichSuTrangThaiPhieuDatVe_phieuDatVeId_fkey',
        );
      }, 0);
    });

    it('chặn xóa Ve đang được history fixture tham chiếu', async () => {
      await withFixture(async (client, fixture) => {
        await insertHistory(
          client,
          'ticket',
          fixture,
          await validEntry(client, fixture),
        );
        await expectPrismaError(
          client.ve.delete({ where: { veId: fixture.veIds[0] } }),
          'P2003',
          'LichSuTrangThaiVe_veId_fkey',
        );
      }, 1);
    });

    it('chặn xóa actor account được history fixture tham chiếu', async () => {
      await withFixture(async (client, fixture) => {
        await insertHistory(
          client,
          'booking',
          fixture,
          await validEntry(client, fixture, {
            nguonThayDoi: 'STAFF',
            taiKhoanId: fixture.staffAccountId,
          }),
        );
        await expectPrismaError(
          client.taiKhoan.delete({
            where: { taiKhoanId: fixture.staffAccountId },
          }),
          'P2003',
          'LichSuTrangThaiPhieuDatVe_taiKhoanId_fkey',
        );
      }, 0);
    });

    it('từ chối history có booking, ticket hoặc account id không tồn tại', async () => {
      await withFixture(async (client, fixture) => {
        const danglingId = 2_147_483_647;
        await expectPrismaError(
          client.lichSuTrangThaiPhieuDatVe.create({
            data: {
              phieuDatVeId: danglingId,
              ...(await validEntry(client, fixture)),
            },
          }),
          'P2003',
        );
        await expectPrismaError(
          client.lichSuTrangThaiVe.create({
            data: {
              veId: danglingId,
              ...(await validEntry(client, fixture)),
            },
          }),
          'P2003',
        );
        await expectPrismaError(
          client.lichSuTrangThaiPhieuDatVe.create({
            data: {
              phieuDatVeId: fixture.phieuDatVeId,
              ...(await validEntry(client, fixture, {
                nguonThayDoi: 'STAFF',
                taiKhoanId: danglingId,
              })),
            },
          }),
          'P2003',
        );
      });
    });
  });
});
