import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '../../../src/generated/prisma/client.js';
import { ShipmentPersistenceService } from '../../../src/shipments/shipment-persistence.service.js';

describe('ShipmentPersistenceService', () => {
  it('rejects invalid dimensions before writing any shipment records', async () => {
    const transaction = {
      phieuGuiHang: { create: vi.fn() },
      hangHoa: { create: vi.fn() },
      chiTietCuocGuiHang: { create: vi.fn() },
      lichSuTrangThaiPhieuGuiHang: { create: vi.fn() },
    } as unknown as Prisma.TransactionClient;

    await expect(
      new ShipmentPersistenceService().persistInTransaction(transaction, {
        waybillCode: 'FUTA-VD-INVALID-DIMENSIONS',
        recipientName: 'Người nhận',
        recipientPhone: '0900000001',
        sentAt: new Date('2026-10-15T00:00:00.000Z'),
        baseFee: 60_000,
        serviceFee: 0,
        discount: 0,
        totalFee: 60_000,
        tripId: 10,
        senderPointId: 11,
        receiverPointId: 12,
        orderId: 13,
        actorAccountId: null,
        historyNote: 'Tạo phiếu gửi hàng độc lập',
        items: [
          {
            name: 'Hộp hàng',
            quantity: 1,
            unitWeight: 1,
            length: -150,
            width: 50,
            height: 50,
            cargoTypeId: 14,
          },
        ],
        rates: [],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ error: 'CARGO_DIMENSIONS_INVALID' }),
    });

    expect(transaction.phieuGuiHang.create).not.toHaveBeenCalled();
    expect(transaction.hangHoa.create).not.toHaveBeenCalled();
    expect(transaction.chiTietCuocGuiHang.create).not.toHaveBeenCalled();
    expect(transaction.lichSuTrangThaiPhieuGuiHang.create).not.toHaveBeenCalled();
  });

  it('writes shipment, items, fee breakdown, and first history through the supplied transaction', async () => {
    const transaction = {
      $transaction: vi.fn(),
      phieuGuiHang: {
        create: vi.fn().mockResolvedValue({
          phieuGuiHangId: 42,
          maVanDon: 'FUTA-VD-TEST',
          trangThai: 'MOI_TAO',
        }),
      },
      hangHoa: {
        create: vi
          .fn()
          .mockResolvedValue({ hangHoaId: 72, tenHang: 'Máy ảnh' }),
      },
      chiTietCuocGuiHang: { create: vi.fn().mockResolvedValue({}) },
      lichSuTrangThaiPhieuGuiHang: { create: vi.fn().mockResolvedValue({}) },
    } as unknown as Prisma.TransactionClient;
    const service = new ShipmentPersistenceService();

    const result = await service.persistInTransaction(transaction, {
      waybillCode: 'FUTA-VD-TEST',
      recipientName: 'Người nhận',
      recipientPhone: '0900000001',
      sentAt: new Date('2026-10-15T00:00:00.000Z'),
      baseFee: 60000,
      serviceFee: 20000,
      discount: 0,
      totalFee: 80000,
      note: 'Ghi chú',
      tripId: 10,
      senderPointId: 11,
      receiverPointId: 12,
      orderId: 13,
      actorAccountId: null,
      historyNote: 'Tạo phiếu gửi hàng độc lập',
      items: [
        {
          name: 'Máy ảnh',
          quantity: 2,
          unitWeight: 1.5,
          length: 20,
          width: 10,
          height: 8,
          description: 'Dễ vỡ',
          cargoTypeId: 14,
        },
      ],
      rates: [
        {
          cargoTypeId: 14,
          rateId: 15,
          billableWeight: 3,
          fee: 60000,
        },
      ],
    });

    expect(transaction.phieuGuiHang.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          maVanDon: 'FUTA-VD-TEST',
          tongPhi: expect.anything(),
          chuyenXeId: 10,
          diemGuiId: 11,
          diemNhanId: 12,
          donGiaoDichId: 13,
          trangThai: 'MOI_TAO',
        }),
      }),
    );
    expect(transaction.hangHoa.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenHang: 'Máy ảnh',
          soLuong: 2,
          khoiLuong: expect.anything(),
          chieuDai: expect.anything(),
          chieuRong: expect.anything(),
          chieuCao: expect.anything(),
          moTa: 'Dễ vỡ',
          phieuGuiHangId: 42,
          loaiHangHoaId: 14,
        }),
      }),
    );
    expect(transaction.chiTietCuocGuiHang.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          phieuGuiHangId: 42,
          loaiHangHoaId: 14,
          bangCuocGuiHangId: 15,
          khoiLuongTinhCuoc: expect.anything(),
          soTienCuoc: expect.anything(),
        }),
      }),
    );
    expect(transaction.lichSuTrangThaiPhieuGuiHang.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          trangThai: 'MOI_TAO',
          ghiChu: 'Tạo phiếu gửi hàng độc lập',
          phieuGuiHangId: 42,
          taiKhoanId: null,
        }),
      }),
    );
    expect(transaction.$transaction).not.toHaveBeenCalled();
    expect(result.shipment.phieuGuiHangId).toBe(42);
    expect(result.items).toHaveLength(1);
  });

  it('propagates a persistence failure so the caller transaction can roll back', async () => {
    const transaction = {
      phieuGuiHang: {
        create: vi.fn().mockResolvedValue({
          phieuGuiHangId: 42,
          maVanDon: 'FUTA-VD-TEST',
        }),
      },
      hangHoa: { create: vi.fn().mockResolvedValue({ hangHoaId: 72 }) },
      chiTietCuocGuiHang: {
        create: vi.fn().mockRejectedValue(new Error('write failed')),
      },
      lichSuTrangThaiPhieuGuiHang: { create: vi.fn() },
    } as unknown as Prisma.TransactionClient;

    await expect(
      new ShipmentPersistenceService().persistInTransaction(transaction, {
        waybillCode: 'FUTA-VD-TEST',
        recipientName: 'Người nhận',
        recipientPhone: '0900000001',
        sentAt: new Date('2026-10-15T00:00:00.000Z'),
        baseFee: 60000,
        serviceFee: 20000,
        discount: 0,
        totalFee: 80000,
        tripId: 10,
        senderPointId: 11,
        receiverPointId: 12,
        orderId: 13,
        actorAccountId: null,
        historyNote: 'Tạo phiếu gửi hàng độc lập',
        items: [],
        rates: [{ cargoTypeId: 14, rateId: 15, billableWeight: 3, fee: 60000 }],
      }),
    ).rejects.toThrow('write failed');
    expect(
      transaction.lichSuTrangThaiPhieuGuiHang.create,
    ).not.toHaveBeenCalled();
  });
});
