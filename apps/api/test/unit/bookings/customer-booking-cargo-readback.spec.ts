import { ForbiddenException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { BookingsService } from '../../../src/bookings/bookings.service.js';
import type { Prisma } from '../../../src/generated/prisma/client.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';

function harness({ fee = 50000, hasCargo = true, paid = false } = {}) {
  const stored = {
    phieuDatVeId: 842,
    maPhieuDatVe: 'QA-PDV-842',
    tongTienBanDau: 200000,
    soTienGiamKhuyenMai: 10000,
    soLuongVeBanDau: 1,
    trangThai: paid ? 'DA_THANH_TOAN' : 'CHO_THANH_TOAN',
    createdAt: new Date('2099-10-29T10:00:00Z'),
    updatedAt: new Date('2099-10-29T10:00:00Z'),
    khuyenMai: { maKhuyenMai: 'SAVE10' },
    donGiaoDich: {
      tongTien: 190000 + (hasCargo ? fee : 0),
      ngayTao: new Date('2099-10-29T10:00:00Z'),
      trangThai: paid ? 'DA_THANH_TOAN' : 'CHO_THANH_TOAN',
      khachHangId: 10,
      khachHang: { taiKhoanId: 1 },
      phieuGuiHang: hasCargo
        ? {
            tongPhi: fee,
            hangHoas: [
              {
                tenHang: 'QA parcel',
                soLuong: 2,
                khoiLuong: 2.5,
                loaiHangHoa: { nhomSucChua: 'HANG_NHE', tenLoai: 'BƯU PHẨM' },
              },
            ],
          }
        : null,
    },
    ves: [
      { veId: 355, giaThucTe: 190000, giaNiemYet: 200000, trangThai: 'DA_DAT' },
    ],
  };
  // A relational fake, rather than an unconditional fully hydrated return value:
  // missing Prisma includes must produce missing relation data as in production.
  function project(args: Prisma.PhieuDatVeFindManyArgs) {
    const { phieuGuiHang, ...order } = stored.donGiaoDich;
    const orderInclude = args.include?.donGiaoDich;
    const shipmentInclude =
      typeof orderInclude === 'object'
        ? orderInclude.include?.phieuGuiHang
        : null;
    const itemsInclude =
      shipmentInclude && typeof shipmentInclude === 'object'
        ? shipmentInclude.include?.hangHoas
        : null;
    return {
      ...stored,
      donGiaoDich: {
        ...order,
        ...(shipmentInclude
          ? {
              phieuGuiHang: phieuGuiHang
                ? {
                    tongPhi: phieuGuiHang.tongPhi,
                    ...(itemsInclude
                      ? {
                          hangHoas: phieuGuiHang.hangHoas.map((item) => ({
                            tenHang: item.tenHang,
                            soLuong: item.soLuong,
                            khoiLuong: item.khoiLuong,
                            ...(typeof itemsInclude === 'object' &&
                            itemsInclude.include?.loaiHangHoa
                              ? { loaiHangHoa: item.loaiHangHoa }
                              : {}),
                          })),
                        }
                      : {}),
                  }
                : null,
            }
          : {}),
      },
    };
  }
  const prisma = {
    khachHang: { findUnique: vi.fn().mockResolvedValue({ khachHangId: 10 }) },
    phieuDatVe: {
      count: vi.fn().mockResolvedValue(1),
      findMany: vi.fn(async (args: Prisma.PhieuDatVeFindManyArgs) => [
        project(args),
      ]),
      findUnique: vi.fn(async (args: Prisma.PhieuDatVeFindUniqueArgs) =>
        project(args),
      ),
    },
  };
  const service = new BookingsService(
    prisma as unknown as PrismaService,
    { get: () => 'Asia/Ho_Chi_Minh' } as unknown as ConfigService,
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never,
  );
  return { service, prisma };
}

describe('customer booking cargo readback', () => {
  for (const reader of ['detail', 'list'] as const) {
    const read = async (service: BookingsService) =>
      reader === 'detail'
        ? (await service.findCustomerBookingById(1, 842)).data
        : (await service.findCustomerBookings(1, { page: 1, pageSize: 10 }))
            .data[0];

    it.each([
      { fee: 50000, paid: false },
      { fee: 50000, paid: true },
      { fee: 0, paid: false },
    ])(
      `${reader} preserves shipment fee/items and ticket-only discount: %j`,
      async (options) => {
        const { service } = harness(options);
        const booking = await read(service);
        expect(booking).toMatchObject({
          bookingId: 842,
          originalTicketSubtotal: 200000,
          discountAmount: 10000,
          ticketSubtotal: 190000,
          cargoFee: options.fee,
          totalAmount: 190000 + options.fee,
          cargoItems: [
            {
              name: 'QA parcel',
              quantity: 2,
              weight: 2.5,
              category: 'HANG_NHE',
              categoryName: 'BƯU PHẨM',
            },
          ],
        });
        expect(booking.ticketSubtotal + booking.cargoFee).toBe(
          booking.totalAmount,
        );
      },
    );

    it(`${reader} keeps a ticket-only order free of invented cargo`, async () => {
      const booking = await read(harness({ hasCargo: false }).service);
      expect(booking).toMatchObject({
        totalAmount: 190000,
        ticketSubtotal: 190000,
        cargoFee: 0,
        cargoItems: [],
      });
    });
  }

  it('still rejects another account reading cargo detail', async () => {
    const { service } = harness();
    await expect(service.findCustomerBookingById(2, 842)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('keeps the list constrained to the authenticated customer', async () => {
    const { service, prisma } = harness();
    await service.findCustomerBookings(1, { page: 1, pageSize: 10 });
    expect(prisma.khachHang.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { taiKhoanId: 1 } }),
    );
    expect(prisma.phieuDatVe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          donGiaoDich: expect.objectContaining({ khachHangId: 10 }),
        }),
      }),
    );
  });
});
