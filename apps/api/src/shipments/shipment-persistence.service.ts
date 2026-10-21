import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { assertValidCargoDimensions } from '../cargo-pricing/cargo-dimensions.validation.js';

type DecimalInput = number | Prisma.Decimal;

export interface ShipmentPersistenceItemInput {
  name: string;
  quantity: number;
  unitWeight: DecimalInput;
  length?: DecimalInput | null;
  width?: DecimalInput | null;
  height?: DecimalInput | null;
  description?: string | null;
  cargoTypeId: number;
}

export interface ShipmentPersistenceRateInput {
  cargoTypeId: number;
  rateId: number;
  billableWeight: DecimalInput;
  fee: DecimalInput;
}

export interface ShipmentPersistenceInput {
  waybillCode: string;
  recipientName: string;
  recipientPhone: string;
  sentAt: Date;
  baseFee: DecimalInput;
  serviceFee: DecimalInput;
  discount: DecimalInput;
  totalFee: DecimalInput;
  note?: string | null;
  tripId: number;
  senderPointId: number;
  receiverPointId: number;
  orderId: number;
  actorAccountId: number | null;
  historyNote: string;
  items: ShipmentPersistenceItemInput[];
  rates: ShipmentPersistenceRateInput[];
}

@Injectable()
export class ShipmentPersistenceService {
  /**
   * Persists the common shipment records using the transaction owned by the
   * booking or standalone shipment caller. This method deliberately never
   * starts a nested transaction.
   */
  async persistInTransaction(
    tx: Prisma.TransactionClient,
    input: ShipmentPersistenceInput,
  ) {
    for (const item of input.items) {
      assertValidCargoDimensions(item.name, {
        length: item.length ?? undefined,
        width: item.width ?? undefined,
        height: item.height ?? undefined,
      });
    }

    const shipment = await tx.phieuGuiHang.create({
      data: {
        maVanDon: input.waybillCode,
        tenNguoiNhan: input.recipientName,
        soDienThoaiNguoiNhan: input.recipientPhone,
        ngayGui: input.sentAt,
        cuocChinh: new Prisma.Decimal(input.baseFee),
        phiDichVu: new Prisma.Decimal(input.serviceFee),
        soTienGiam: new Prisma.Decimal(input.discount),
        tongPhi: new Prisma.Decimal(input.totalFee),
        nguoiTraCuoc: 'NGUOI_GUI',
        ghiChu: input.note ?? null,
        trangThai: 'MOI_TAO',
        chuyenXeId: input.tripId,
        diemGuiId: input.senderPointId,
        diemNhanId: input.receiverPointId,
        donGiaoDichId: input.orderId,
      },
      include: {
        diemGui: true,
        diemNhan: true,
        chuyenXe: {
          include: {
            tuyenXe: { include: { nhaXe: true } },
            xe: true,
          },
        },
      },
    });

    const items = [];
    for (const item of input.items) {
      const createdItem = await tx.hangHoa.create({
        data: {
          tenHang: item.name,
          soLuong: item.quantity,
          khoiLuong: new Prisma.Decimal(item.unitWeight),
          chieuDai:
            item.length == null ? null : new Prisma.Decimal(item.length),
          chieuRong: item.width == null ? null : new Prisma.Decimal(item.width),
          chieuCao:
            item.height == null ? null : new Prisma.Decimal(item.height),
          moTa: item.description ?? null,
          phieuGuiHangId: shipment.phieuGuiHangId,
          loaiHangHoaId: item.cargoTypeId,
        },
        include: { loaiHangHoa: true },
      });
      items.push(createdItem);
    }

    for (const rate of input.rates) {
      await tx.chiTietCuocGuiHang.create({
        data: {
          phieuGuiHangId: shipment.phieuGuiHangId,
          loaiHangHoaId: rate.cargoTypeId,
          bangCuocGuiHangId: rate.rateId,
          khoiLuongTinhCuoc: new Prisma.Decimal(rate.billableWeight),
          soTienCuoc: new Prisma.Decimal(rate.fee),
        },
      });
    }

    await tx.lichSuTrangThaiPhieuGuiHang.create({
      data: {
        trangThai: 'MOI_TAO',
        thoiGian: input.sentAt,
        ghiChu: input.historyNote,
        phieuGuiHangId: shipment.phieuGuiHangId,
        taiKhoanId: input.actorAccountId,
      },
    });

    return { shipment, items };
  }
}
