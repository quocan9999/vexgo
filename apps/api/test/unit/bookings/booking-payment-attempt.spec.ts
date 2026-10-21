import type { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BookingsService } from '../../../src/bookings/bookings.service.js';
import { PromotionsService } from '../../../src/promotions/promotions.service.js';
import { Prisma } from '../../../src/generated/prisma/client.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import type { CreateBookingDto } from '../../../src/bookings/dto/create-booking.dto.js';

type Write = { data: Record<string, unknown> };

// Mock only infrastructure boundaries. Booking, promotion quote/locking/usage and
// createSepayPaymentAttempt run their real implementations. This is not a DB simulator:
// rejection assertions verify propagation through $transaction, not MySQL rollback.
function setup({
  discount = 300000,
  cargo = false,
  promoted = true,
  seatCount = 1,
} = {}) {
  const orderTime = new Date('2026-10-10T10:00:00.000Z');
  const bookingTime = new Date('2026-10-10T10:07:00.000Z');
  const promotion = {
    khuyenMaiId: 7,
    maKhuyenMai: 'SAVE',
    nhaXeId: 5,
    phamViApDung: 'DAT_VE',
    hinhThucApDung: 'NHAP_MA',
    loaiGiamGia: 'SO_TIEN',
    giaTriGiam: new Prisma.Decimal(discount),
    giamToiDa: null,
    giaTriDonToiThieu: null,
    tuNgay: new Date('2026-01-01T00:00:00Z'),
    denNgay: new Date('2099-12-31T00:00:00Z'),
    trangThai: 'HOAT_DONG',
    soLuotToiDa: 1,
    soLuotDaSuDung: 0,
  };
  const seats = Array.from({ length: seatCount }, (_, i) => ({
    gheChuyenXeId: i + 1,
    chuyenXeId: 50,
    trangThai: 'DANG_GIU',
    giuChoId: 9,
    ghe: { soGhe: `A${i + 1}` },
  })).reverse();
  const customer = {
    khachHangId: 10,
    taiKhoanId: 1,
    taiKhoan: { soDienThoai: '+84912345678', daXacThucSoDienThoai: true },
  };
  let ticketId = 0;
  const tx = {
    donGiaoDich: {
      create: vi.fn(async ({ data }: Write) => ({
        ...data,
        donGiaoDichId: 201,
        ngayTao: orderTime,
      })),
      update: vi.fn(async () => ({})),
    },
    thanhToan: {
      create: vi.fn(async () => ({
        thanhToanId: 401,
        trangThai: 'DANG_XU_LY',
      })),
    },
    phieuDatVe: {
      create: vi.fn(async ({ data }: Write) => ({
        ...data,
        phieuDatVeId: 301,
        createdAt: bookingTime,
      })),
      update: vi.fn(async () => ({})),
    },
    ve: {
      create: vi.fn(async ({ data }: Write) => ({ ...data, veId: ++ticketId })),
      update: vi.fn(async () => ({})),
    },
    gheChuyenXe: { updateMany: vi.fn(async () => ({ count: seatCount })) },
    lichSuTrangThaiPhieuDatVe: { create: vi.fn(async (_input: Write) => ({})) },
    lichSuTrangThaiVe: { create: vi.fn(async (_input: Write) => ({})) },
    khachHang: { findUnique: vi.fn(async () => customer) },
    khuyenMai: { updateMany: vi.fn(async () => ({ count: 1 })) },
    suDungKhuyenMai: { create: vi.fn(async () => ({})) },
    $queryRaw: vi.fn(async (query: TemplateStringsArray | Prisma.Sql) => {
      const sql = Array.isArray(query)
        ? query.join('')
        : (query as Prisma.Sql).sql;
      return sql.includes('FROM KhuyenMai') ? [promotion] : [];
    }),
  };
  const prisma = {
    chuyenXe: {
      findUnique: vi.fn(async () => ({
        chuyenXeId: 50,
        trangThai: 'CHUA_KHOI_HANH',
        nhaXeId: 5,
        tuyenXeId: 2,
        ngayKhoiHanh: new Date('2099-12-01T00:00:00Z'),
        gioKhoiHanh: new Date('1970-01-01T08:00:00Z'),
        nhanGuiHang: true,
        xe: { loaiXeId: 3 },
        tuyenXe: { diemDi: 'A', diemDen: 'B', nhaXe: { maNhaXe: 'FUTA' } },
      })),
    },
    khachHang: { findUnique: vi.fn(async () => customer) },
    gheChuyenXe: { findMany: vi.fn(async () => seats) },
    bangGia: {
      findFirst: vi.fn(async () => ({
        bangGiaId: 1,
        giaNiemYet: new Prisma.Decimal(300000),
      })),
    },
    khuyenMai: { findFirst: vi.fn(async () => promotion) },
    suDungKhuyenMai: { findFirst: vi.fn(async () => null) },
    $transaction: vi.fn(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    ),
  };
  const holds = {
    verifyHold: vi.fn(),
    consumeHoldInTx: vi.fn(
      async (
        _tx: unknown,
        _token: string,
        _tripId: number,
        _seats: number[],
        _customerId: number | null,
      ) => ({ giuChoId: 9 }),
    ),
  };
  const capacity = {
    lockTrip: vi.fn(),
    getSnapshot: vi.fn(async () => ({})),
    assertAvailable: vi.fn(),
  };
  const pricing = {
    calculate: vi.fn(async () => ({
      totalFee: new Prisma.Decimal(60000),
      baseFee: new Prisma.Decimal(60000),
      serviceFee: new Prisma.Decimal(0),
      senderPointId: 11,
      receiverPointId: 12,
      items: [
        {
          loaiHangHoa: { loaiHangHoaId: 21, nhomSucChua: 'HANG_NHE' },
          effectiveUnitWeight: new Prisma.Decimal(2),
          totalWeight: new Prisma.Decimal(2),
        },
      ],
      rates: [],
    })),
  };
  const persistence = {
    persistInTransaction: vi.fn(async (_tx: unknown, _input: unknown) => ({
      shipment: { phieuGuiHangId: 501 },
      items: [],
    })),
  };
  const service = new BookingsService(
    prisma as unknown as PrismaService,
    { get: () => 'Asia/Ho_Chi_Minh' } as unknown as ConfigService,
    holds as never,
    new PromotionsService(prisma as unknown as PrismaService),
    pricing as never,
    capacity as never,
    persistence as never,
  );
  const dto = {
    tripId: 50,
    seatIds: seats.map((seat) => seat.gheChuyenXeId),
    holdToken: 'signed-hold',
    pickupPoint: 'A',
    dropoffPoint: 'B',
    contact: { fullName: 'Khách thử', phone: '0901234567' },
    ...(promoted
      ? {
          promotionCode: ' save ',
          expectedPromotionQuote: {
            originalTotal: String(300000 * seatCount),
            discountAmount: String(Math.min(discount, 300000 * seatCount)),
            finalTotal: String(Math.max(300000 * seatCount - discount, 0)),
          },
        }
      : {}),
    ...(cargo
      ? {
          cargoItems: [
            {
              name: 'Hàng',
              type: 'Hàng nhẹ',
              loaiHangHoaId: 21,
              quantity: 1,
              weight: 2,
            },
          ],
        }
      : {}),
  } as CreateBookingDto;
  return {
    service,
    dto,
    tx,
    prisma,
    holds,
    capacity,
    pricing,
    persistence,
    promotion,
    orderTime,
    bookingTime,
  };
}

afterEach(() => vi.useRealTimers());

describe('G2 booking payment and promotion transaction boundary', () => {
  it.each([
    {
      promoted: false,
      cargo: false,
      total: 300000,
      paymentCount: 1,
      status: 'CHO_THANH_TOAN',
    },
    {
      promoted: true,
      cargo: false,
      total: 0,
      paymentCount: 0,
      status: 'DA_THANH_TOAN',
    },
    {
      promoted: true,
      cargo: true,
      total: 60000,
      paymentCount: 1,
      status: 'CHO_THANH_TOAN',
    },
  ])(
    'creates $paymentCount attempt(s) for total $total',
    async ({ promoted, cargo, total, paymentCount, status }) => {
      const f = setup({ promoted, cargo });
      const result = await f.service.createBooking(f.dto);
      expect(result).toMatchObject({
        totalAmount: total,
        status,
        shippingFee: cargo ? 60000 : 0,
        ticketSubtotal: promoted ? 0 : 300000,
        discountAmount: promoted ? 300000 : 0,
      });
      expect(f.tx.donGiaoDich.create).toHaveBeenCalledOnce();
      expect(f.tx.donGiaoDich.create.mock.calls[0][0].data).not.toHaveProperty(
        'thanhToans',
      );
      expect(f.tx.thanhToan.create).toHaveBeenCalledTimes(paymentCount);
      if (paymentCount) {
        expect(f.tx.thanhToan.create).toHaveBeenCalledWith({
          data: {
            donGiaoDichId: 201,
            soTien: new Prisma.Decimal(total),
            phuongThuc: 'SEPAY',
            loaiGiaoDich: 'THANH_TOAN',
            trangThai: 'DANG_XU_LY',
            thoiGian: f.orderTime,
          },
          select: { thanhToanId: true, trangThai: true },
        });
        expect(f.tx.donGiaoDich.update).not.toHaveBeenCalled();
      } else {
        expect(f.tx.donGiaoDich.update).toHaveBeenCalledWith({
          where: { donGiaoDichId: 201 },
          data: { trangThai: 'DA_THANH_TOAN' },
        });
        expect(f.tx.phieuDatVe.update).toHaveBeenCalledWith({
          where: { phieuDatVeId: 301 },
          data: { trangThai: 'DA_THANH_TOAN' },
        });
        expect(f.tx.ve.update).toHaveBeenCalledWith({
          where: { veId: 1 },
          data: { trangThai: 'DA_THANH_TOAN' },
        });
        expect(result.tickets[0].status).toBe('DA_THANH_TOAN');
        expect(
          f.tx.lichSuTrangThaiPhieuDatVe.create.mock.calls.map(
            ([arg]) => arg.data,
          ),
        ).toMatchObject([
          { trangThaiCu: null, trangThaiMoi: 'CHO_THANH_TOAN' },
          {
            trangThaiCu: 'CHO_THANH_TOAN',
            trangThaiMoi: 'DA_THANH_TOAN',
            nguonThayDoi: 'SYSTEM',
            lyDo: 'Đơn 0đ – miễn thanh toán',
          },
        ]);
        expect(
          f.tx.lichSuTrangThaiVe.create.mock.calls.map(([arg]) => arg.data),
        ).toMatchObject([
          { trangThaiCu: null, trangThaiMoi: 'DA_DAT' },
          { trangThaiCu: 'DA_DAT', trangThaiMoi: 'DA_THANH_TOAN' },
        ]);
      }
      expect(f.tx.khuyenMai.updateMany).toHaveBeenCalledTimes(promoted ? 1 : 0);
      expect(f.tx.suDungKhuyenMai.create).toHaveBeenCalledTimes(
        promoted ? 1 : 0,
      );
      if (promoted) {
        expect(f.tx.suDungKhuyenMai.create).toHaveBeenCalledWith({
          data: {
            khuyenMaiId: 7,
            phieuDatVeId: 301,
            khachHangId: null,
            soDienThoaiChuanHoa: '0901234567',
            soTienGiam: new Prisma.Decimal(300000),
          },
        });
        expect(f.tx.$queryRaw).toHaveBeenCalledTimes(4); // promotion + current usage, twice
        for (const [query] of f.tx.$queryRaw.mock.calls) {
          const sql = Array.isArray(query)
            ? query.join('')
            : (query as Prisma.Sql).sql;
          expect(sql).toContain('FOR UPDATE');
        }
      }
      expect(f.holds.consumeHoldInTx).toHaveBeenCalledWith(
        f.tx,
        'signed-hold',
        50,
        [1],
        null,
      );
      expect(f.tx.gheChuyenXe.updateMany).toHaveBeenCalledWith({
        where: {
          chuyenXeId: 50,
          gheChuyenXeId: { in: [1] },
          trangThai: 'DANG_GIU',
          giuChoId: 9,
        },
        data: { trangThai: 'DA_DAT', giuChoId: null },
      });
      if (cargo) {
        expect(f.capacity.lockTrip).toHaveBeenCalledWith(f.tx, 50);
        expect(f.persistence.persistInTransaction).toHaveBeenCalledWith(
          f.tx,
          expect.objectContaining({
            orderId: 201,
            discount: 0,
            totalFee: new Prisma.Decimal(60000),
          }),
        );
      }
      expect(result.createdAt).toBe(f.bookingTime.toISOString());
      expect(result.paymentExpiresAt).toBe('2026-10-10T10:10:00.000Z');
    },
  );

  it('preserves real quote calculation, deterministic discounted allocation and one usage per booking', async () => {
    const f = setup({ discount: 100001, seatCount: 3 });
    const quote = await f.service.getBookingQuote(
      50,
      [3, 2, 1],
      ' save ',
      '0901234567',
    );
    expect(quote).toMatchObject({
      originalTotal: '900000.00',
      discountAmount: '100001.00',
      finalTotal: '799999.00',
      identityChecked: true,
    });
    expect(f.tx.khuyenMai.updateMany).not.toHaveBeenCalled();
    const result = await f.service.createBooking(f.dto);
    const tickets = f.tx.ve.create.mock.calls.map(([arg]) => arg.data);
    expect(tickets.map((ticket) => ticket.gheChuyenXeId)).toEqual([1, 2, 3]);
    expect(tickets.map((ticket) => String(ticket.giaThucTe))).toEqual([
      '266666',
      '266666',
      '266667',
    ]);
    expect(result.ticketSubtotal).toBe(799999);
    expect(f.tx.phieuDatVe.create.mock.calls[0][0].data).toMatchObject({
      khuyenMaiId: 7,
      soTienGiamKhuyenMai: new Prisma.Decimal(100001),
    });
    expect(f.tx.suDungKhuyenMai.create).toHaveBeenCalledOnce();
  });

  it('uses verified account identity instead of the contact override at quote and locked usage', async () => {
    const f = setup();
    await f.service.createBooking(f.dto, { taiKhoanId: 1 } as never);
    expect(f.prisma.suDungKhuyenMai.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          khuyenMaiId: 7,
          OR: [{ soDienThoaiChuanHoa: '0912345678' }, { khachHangId: 10 }],
        },
      }),
    );
    expect(f.tx.suDungKhuyenMai.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        khachHangId: 10,
        soDienThoaiChuanHoa: '0912345678',
      }),
    });
  });

  it('propagates a failed shared payment write through the transaction before creating booking/usage', async () => {
    const f = setup({ discount: 100000 });
    const failure = new Error('payment insert failed');
    f.tx.thanhToan.create.mockRejectedValueOnce(failure);
    await expect(f.service.createBooking(f.dto)).rejects.toBe(failure);
    await expect(f.prisma.$transaction.mock.results[0].value).rejects.toBe(
      failure,
    );
    expect(f.tx.donGiaoDich.create).toHaveBeenCalledOnce();
    expect(f.holds.consumeHoldInTx.mock.calls[0][0]).toBe(f.tx);
    expect(f.tx.phieuDatVe.create).not.toHaveBeenCalled();
    expect(f.tx.suDungKhuyenMai.create).not.toHaveBeenCalled();
  });

  it('rejects an invalid consumed hold before writing an order or usage', async () => {
    const f = setup();
    f.holds.consumeHoldInTx.mockResolvedValueOnce({ giuChoId: 0 });
    await expect(f.service.createBooking(f.dto)).rejects.toMatchObject({
      response: { error: 'HOLD_INVALID' },
    });
    expect(f.tx.donGiaoDich.create).not.toHaveBeenCalled();
    expect(f.tx.suDungKhuyenMai.create).not.toHaveBeenCalled();
  });

  it('propagates cargo persistence failure after payment/seat writes in the same transaction', async () => {
    const f = setup({ cargo: true });
    const failure = new Error('shipment persistence failed');
    f.persistence.persistInTransaction.mockRejectedValueOnce(failure);
    await expect(f.service.createBooking(f.dto)).rejects.toBe(failure);
    await expect(f.prisma.$transaction.mock.results[0].value).rejects.toBe(
      failure,
    );
    expect(f.tx.thanhToan.create).toHaveBeenCalledOnce();
    expect(f.tx.gheChuyenXe.updateMany).toHaveBeenCalledOnce();
    expect(f.persistence.persistInTransaction.mock.calls[0][0]).toBe(f.tx);
    expect(f.tx.suDungKhuyenMai.create).not.toHaveBeenCalled();
  });

  it.each(['seat-CAS', 'capacity', 'ledger', 'completion-history'] as const)(
    'propagates %s failure to the transaction boundary',
    async (stage) => {
      const f = setup({ cargo: stage === 'capacity' });
      const failure = new Error(stage);
      if (stage === 'seat-CAS')
        f.tx.gheChuyenXe.updateMany.mockResolvedValueOnce({ count: 0 });
      if (stage === 'capacity')
        f.capacity.assertAvailable.mockImplementationOnce(() => {
          throw failure;
        });
      if (stage === 'ledger')
        f.tx.suDungKhuyenMai.create.mockRejectedValueOnce(failure);
      if (stage === 'completion-history')
        f.tx.lichSuTrangThaiPhieuDatVe.create
          .mockResolvedValueOnce({})
          .mockRejectedValueOnce(failure);
      const attempt = f.service.createBooking(f.dto);
      if (stage === 'seat-CAS')
        await expect(attempt).rejects.toMatchObject({
          response: { error: 'SEAT_UNAVAILABLE' },
        });
      else await expect(attempt).rejects.toBe(failure);
      await expect(
        f.prisma.$transaction.mock.results[0].value,
      ).rejects.toBeInstanceOf(Error);
      if (stage === 'capacity')
        expect(f.tx.donGiaoDich.create).not.toHaveBeenCalled();
      if (stage === 'seat-CAS' || stage === 'capacity')
        expect(f.tx.suDungKhuyenMai.create).not.toHaveBeenCalled();
      if (stage === 'ledger')
        expect(f.tx.donGiaoDich.update).not.toHaveBeenCalled();
    },
  );

  it('fails closed when the quota is exhausted after the preview quote', async () => {
    const f = setup();
    f.tx.$queryRaw.mockResolvedValueOnce([
      { ...f.promotion, soLuotDaSuDung: 1 },
    ]);
    await expect(f.service.createBooking(f.dto)).rejects.toMatchObject({
      response: { error: 'PROMOTION_QUOTA_EXHAUSTED' },
    });
    expect(f.tx.donGiaoDich.create).not.toHaveBeenCalled();
  });

  it('rejects a promotion changed before commit and never records its stale discount', async () => {
    const f = setup();
    f.tx.$queryRaw
      .mockResolvedValueOnce([f.promotion])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { ...f.promotion, giaTriGiam: new Prisma.Decimal(100000) },
      ]);
    await expect(f.service.createBooking(f.dto)).rejects.toMatchObject({
      response: { error: 'PROMOTION_UNAVAILABLE' },
    });
    expect(f.tx.suDungKhuyenMai.create).not.toHaveBeenCalled();
    expect(f.tx.donGiaoDich.update).not.toHaveBeenCalled();
  });

  it.each(['quota-CAS', 'unique-ledger'] as const)(
    'rejects the %s loser rather than completing a free booking',
    async (cause) => {
      const f = setup();
      if (cause === 'quota-CAS')
        f.tx.khuyenMai.updateMany.mockResolvedValueOnce({ count: 0 });
      else
        f.tx.suDungKhuyenMai.create.mockRejectedValueOnce(
          new Prisma.PrismaClientKnownRequestError('duplicate usage', {
            code: 'P2002',
            clientVersion: 'test',
          }),
        );
      await expect(f.service.createBooking(f.dto)).rejects.toMatchObject({
        response: {
          error:
            cause === 'quota-CAS'
              ? 'PROMOTION_UNAVAILABLE'
              : 'PROMOTION_ALREADY_USED',
        },
      });
      expect(f.tx.donGiaoDich.update).not.toHaveBeenCalled();
      expect(f.tx.khuyenMai.updateMany).toHaveBeenCalledWith({
        where: {
          khuyenMaiId: 7,
          trangThai: 'HOAT_DONG',
          soLuotDaSuDung: { lt: 1 },
        },
        data: { soLuotDaSuDung: { increment: 1 } },
      });
    },
  );
});
