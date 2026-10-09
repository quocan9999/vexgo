import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { requireTenantPrincipal } from '../auth/tenant-scope.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { ShipmentQueryDto } from './dto/shipment-query.dto.js';
import type { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto.js';
import type {
  CargoFeeDetail,
  CargoItemDetail,
  ShipmentDetail,
  ShipmentHistoryItem,
  ShipmentSummary,
} from './dto/shipment-response.dto.js';
import { Prisma, TrangThaiPhieuGuiHang } from '../generated/prisma/client.js';

function formatTripDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatTripTime(d: Date): string {
  return d.toISOString().slice(11, 19);
}

function toVnd(val: Prisma.Decimal | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  return Math.round(Number(val));
}

@Injectable()
export class ShipmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: ShipmentQueryDto,
    principal: AuthPrincipal,
  ): Promise<{
    data: ShipmentSummary[];
    meta: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
    };
  }> {
    const tenantId = requireTenantPrincipal(principal);
    const { page, pageSize, search, status, sortDirection } = query;

    const where: Prisma.PhieuGuiHangWhereInput = {
      donGiaoDich: { nhaXeId: tenantId },
      chuyenXe: { nhaXeId: tenantId },
      diemGui: { nhaXeId: tenantId },
      diemNhan: { nhaXeId: tenantId },
    };

    if (status) {
      where.trangThai = status;
    }

    if (search && search.length > 0) {
      where.OR = [
        { maVanDon: { contains: search } },
        { tenNguoiNhan: { contains: search } },
        { soDienThoaiNguoiNhan: { contains: search } },
        { donGiaoDich: { tenKhachHang: { contains: search } } },
        { donGiaoDich: { soDienThoaiKhachHang: { contains: search } } },
      ];
    }

    const direction: Prisma.SortOrder = sortDirection === 'asc' ? 'asc' : 'desc';
    const orderBy: Prisma.PhieuGuiHangOrderByWithRelationInput[] = [
      { createdAt: direction },
      { phieuGuiHangId: direction },
    ];

    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const [totalItems, records] = await Promise.all([
      this.prisma.phieuGuiHang.count({ where }),
      this.prisma.phieuGuiHang.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          donGiaoDich: {
            select: {
              tenKhachHang: true,
              soDienThoaiKhachHang: true,
              nhaXeId: true,
            },
          },
          chuyenXe: {
            select: {
              chuyenXeId: true,
              maChuyenXe: true,
              ngayKhoiHanh: true,
              gioKhoiHanh: true,
              nhaXeId: true,
            },
          },
          diemGui: {
            select: {
              diemGiaoNhanHangId: true,
              tenDiem: true,
              maDiem: true,
              diaChi: true,
              tinhThanh: true,
              nhaXeId: true,
            },
          },
          diemNhan: {
            select: {
              diemGiaoNhanHangId: true,
              tenDiem: true,
              maDiem: true,
              diaChi: true,
              tinhThanh: true,
              nhaXeId: true,
            },
          },
        },
      }),
    ]);

    const data: ShipmentSummary[] = records
      .filter((record) => {
        return (
          record.donGiaoDich.nhaXeId === tenantId &&
          record.chuyenXe.nhaXeId === tenantId &&
          record.diemGui.nhaXeId === tenantId &&
          record.diemNhan.nhaXeId === tenantId
        );
      })
      .map((record) => ({
        shipmentId: record.phieuGuiHangId,
        waybillCode: record.maVanDon,
        sentAt: record.ngayGui.toISOString(),
        status: record.trangThai,
        sender: {
          fullName: record.donGiaoDich.tenKhachHang,
          phoneNumber: record.donGiaoDich.soDienThoaiKhachHang,
        },
        receiver: {
          fullName: record.tenNguoiNhan,
          phoneNumber: record.soDienThoaiNguoiNhan,
        },
        trip: {
          tripId: record.chuyenXe.chuyenXeId,
          code: record.chuyenXe.maChuyenXe,
          departureDate: formatTripDate(record.chuyenXe.ngayKhoiHanh),
          departureTime: formatTripTime(record.chuyenXe.gioKhoiHanh),
        },
        originPoint: {
          pointId: record.diemGui.diemGiaoNhanHangId,
          name: record.diemGui.tenDiem,
          code: record.diemGui.maDiem,
          address: record.diemGui.diaChi,
        },
        destinationPoint: {
          pointId: record.diemNhan.diemGiaoNhanHangId,
          name: record.diemNhan.tenDiem,
          code: record.diemNhan.maDiem,
          address: record.diemNhan.diaChi,
        },
        totalFee: toVnd(record.tongPhi),
      }));

    return {
      data,
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
  }

  async findOne(
    id: number,
    principal: AuthPrincipal,
  ): Promise<{ data: ShipmentDetail }> {
    const tenantId = requireTenantPrincipal(principal);

    const record = await this.prisma.phieuGuiHang.findUnique({
      where: { phieuGuiHangId: id },
      include: {
        donGiaoDich: {
          select: {
            tenKhachHang: true,
            soDienThoaiKhachHang: true,
            nhaXeId: true,
          },
        },
        chuyenXe: {
          select: {
            chuyenXeId: true,
            maChuyenXe: true,
            ngayKhoiHanh: true,
            gioKhoiHanh: true,
            nhaXeId: true,
          },
        },
        diemGui: {
          select: {
            diemGiaoNhanHangId: true,
            tenDiem: true,
            maDiem: true,
            diaChi: true,
            tinhThanh: true,
            nhaXeId: true,
          },
        },
        diemNhan: {
          select: {
            diemGiaoNhanHangId: true,
            tenDiem: true,
            maDiem: true,
            diaChi: true,
            tinhThanh: true,
            nhaXeId: true,
          },
        },
        hangHoas: {
          include: { loaiHangHoa: true },
          orderBy: { hangHoaId: 'asc' },
        },
        chiTietCuocGuiHangs: {
          include: { loaiHangHoa: true },
          orderBy: { chiTietCuocGuiHangId: 'asc' },
        },
        lichSuTrangThais: {
          include: {
            taiKhoan: { select: { taiKhoanId: true, hoTen: true } },
          },
          orderBy: [{ thoiGian: 'asc' }, { lichSuTrangThaiId: 'asc' }],
        },
      },
    });

    if (
      !record ||
      record.donGiaoDich.nhaXeId !== tenantId ||
      record.chuyenXe.nhaXeId !== tenantId ||
      record.diemGui.nhaXeId !== tenantId ||
      record.diemNhan.nhaXeId !== tenantId
    ) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'SHIPMENT_NOT_FOUND',
        message: 'Không tìm thấy phiếu gửi hàng.',
      });
    }

    const cargoItems: CargoItemDetail[] = record.hangHoas.map((item) => ({
      cargoId: item.hangHoaId,
      name: item.tenHang,
      typeName: item.loaiHangHoa.tenLoai,
      weightKg: Number(item.khoiLuong),
      quantity: item.soLuong,
      dimensions:
        item.chieuDai != null && item.chieuRong != null && item.chieuCao != null
          ? {
              length: Number(item.chieuDai),
              width: Number(item.chieuRong),
              height: Number(item.chieuCao),
            }
          : null,
      declaredValue:
        item.giaTriKhaiBao != null ? toVnd(item.giaTriKhaiBao) : null,
      description: item.moTa ?? null,
    }));

    const cargoFeeDetails: CargoFeeDetail[] = record.chiTietCuocGuiHangs.map(
      (detail) => ({
        feeDetailId: detail.chiTietCuocGuiHangId,
        cargoTypeName: detail.loaiHangHoa.tenLoai,
        chargeableWeightKg: Number(detail.khoiLuongTinhCuoc),
        fee: toVnd(detail.soTienCuoc),
      }),
    );

    const history: ShipmentHistoryItem[] = record.lichSuTrangThais.map((h) => ({
      historyId: h.lichSuTrangThaiId,
      status: h.trangThai,
      time: h.thoiGian.toISOString(),
      note: h.ghiChu ?? null,
      actor: h.taiKhoan
        ? {
            accountId: h.taiKhoan.taiKhoanId,
            fullName: h.taiKhoan.hoTen,
          }
        : null,
    }));

    const data: ShipmentDetail = {
      shipmentId: record.phieuGuiHangId,
      waybillCode: record.maVanDon,
      sentAt: record.ngayGui.toISOString(),
      status: record.trangThai,
      note: record.ghiChu ?? null,
      sender: {
        fullName: record.donGiaoDich.tenKhachHang,
        phoneNumber: record.donGiaoDich.soDienThoaiKhachHang,
      },
      receiver: {
        fullName: record.tenNguoiNhan,
        phoneNumber: record.soDienThoaiNguoiNhan,
      },
      trip: {
        tripId: record.chuyenXe.chuyenXeId,
        code: record.chuyenXe.maChuyenXe,
        departureDate: formatTripDate(record.chuyenXe.ngayKhoiHanh),
        departureTime: formatTripTime(record.chuyenXe.gioKhoiHanh),
      },
      originPoint: {
        pointId: record.diemGui.diemGiaoNhanHangId,
        name: record.diemGui.tenDiem,
        code: record.diemGui.maDiem,
        address: record.diemGui.diaChi,
      },
      destinationPoint: {
        pointId: record.diemNhan.diemGiaoNhanHangId,
        name: record.diemNhan.tenDiem,
        code: record.diemNhan.maDiem,
        address: record.diemNhan.diaChi,
      },
      cargoItems,
      cargoFeeDetails,
      feeSummary: {
        mainFee: toVnd(record.cuocChinh),
        serviceFee: toVnd(record.phiDichVu),
        discountAmount: toVnd(record.soTienGiam),
        totalFee: toVnd(record.tongPhi),
        freightPayer: record.nguoiTraCuoc,
      },
      history,
      totalFee: toVnd(record.tongPhi),
    };

    return { data };
  }

  async updateStatus(
    id: number,
    dto: UpdateShipmentStatusDto,
    principal: AuthPrincipal,
  ): Promise<{
    data: {
      shipmentId: number;
      status: TrangThaiPhieuGuiHang;
      updatedAt: string;
    };
  }> {
    const tenantId = requireTenantPrincipal(principal);

    const shipment = await this.prisma.phieuGuiHang.findUnique({
      where: { phieuGuiHangId: id },
      include: {
        donGiaoDich: {
          select: {
            nhaXeId: true,
            trangThai: true,
            thanhToans: {
              select: { trangThai: true },
            },
          },
        },
        chuyenXe: { select: { nhaXeId: true } },
        diemGui: { select: { nhaXeId: true } },
        diemNhan: { select: { nhaXeId: true } },
      },
    });

    if (
      !shipment ||
      shipment.donGiaoDich.nhaXeId !== tenantId ||
      shipment.chuyenXe.nhaXeId !== tenantId ||
      shipment.diemGui.nhaXeId !== tenantId ||
      shipment.diemNhan.nhaXeId !== tenantId
    ) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'SHIPMENT_NOT_FOUND',
        message: 'Không tìm thấy phiếu gửi hàng.',
      });
    }

    const currentStatus = shipment.trangThai;
    const targetStatus = dto.status;

    if (currentStatus === targetStatus) {
      throw new ConflictException({
        statusCode: 409,
        error: 'INVALID_STATUS_TRANSITION',
        message: `Phiếu gửi hàng đã ở trạng thái ${targetStatus}.`,
      });
    }

    if (currentStatus === 'DA_GIAO' || currentStatus === 'DA_HUY') {
      throw new ConflictException({
        statusCode: 409,
        error: 'INVALID_STATUS_TRANSITION',
        message: `Phiếu gửi hàng đã ở trạng thái kết thúc (${currentStatus}), không thể thay đổi trạng thái.`,
      });
    }

    const validTransitions: Record<
      TrangThaiPhieuGuiHang,
      TrangThaiPhieuGuiHang[]
    > = {
      MOI_TAO: ['DA_TIEP_NHAN', 'DA_HUY'],
      DA_TIEP_NHAN: ['DANG_VAN_CHUYEN'],
      DANG_VAN_CHUYEN: ['DA_GIAO'],
      DA_GIAO: [],
      DA_HUY: [],
    };

    const allowed = validTransitions[currentStatus] ?? [];
    if (!allowed.includes(targetStatus)) {
      throw new ConflictException({
        statusCode: 409,
        error: 'INVALID_STATUS_TRANSITION',
        message: `Không thể chuyển trạng thái từ ${currentStatus} sang ${targetStatus}.`,
      });
    }

    if (targetStatus === 'DA_HUY') {
      const hasPaid =
        shipment.donGiaoDich.trangThai === 'DA_THANH_TOAN' ||
        shipment.donGiaoDich.thanhToans.some(
          (t) =>
            t.trangThai === 'THANH_CONG' || t.trangThai === 'DA_THANH_TOAN',
        );
      if (hasPaid) {
        throw new ConflictException({
          statusCode: 409,
          error: 'SHIPMENT_REFUND_REQUIRED',
          message:
            'Phiếu gửi hàng đã thanh toán thành công, không thể hủy khi chưa có quy trình hoàn tiền trong MVP.',
        });
      }
    }

    const now = new Date();
    const noteText = dto.note?.trim() || null;

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.phieuGuiHang.updateMany({
        where: {
          phieuGuiHangId: id,
          trangThai: currentStatus,
          donGiaoDich: { nhaXeId: tenantId },
        },
        data: {
          trangThai: targetStatus,
          updatedAt: now,
        },
      });

      if (updated.count === 0) {
        throw new ConflictException({
          statusCode: 409,
          error: 'CONCURRENT_STATUS_UPDATE',
          message:
            'Trạng thái phiếu gửi hàng đã bị thay đổi bởi thao tác khác.',
        });
      }

      await tx.lichSuTrangThaiPhieuGuiHang.create({
        data: {
          phieuGuiHangId: id,
          trangThai: targetStatus,
          thoiGian: now,
          taiKhoanId: principal.taiKhoanId,
          ghiChu: noteText,
        },
      });

      return {
        shipmentId: id,
        status: targetStatus,
        updatedAt: now.toISOString(),
      };
    });

    return { data: result };
  }
}
