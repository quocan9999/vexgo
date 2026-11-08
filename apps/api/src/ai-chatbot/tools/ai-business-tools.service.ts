import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TripsService } from '../../trips/trips.service.js';
import { TicketsService } from '../../tickets/tickets.service.js';
import { ShipmentsService } from '../../shipments/shipments.service.js';
import { PromotionsService } from '../../promotions/promotions.service.js';
import { LocationsService } from '../../locations/locations.service.js';
import { locationSearchTerms } from '../../locations/location-search.js';
import { Prisma } from '../../generated/prisma/client.js';

export interface TripSearchResultItem {
  tripId: number;
  code: string;
  operator: string;
  origin: string;
  destination: string;
  departureDate: string;
  departureTime: string;
  arrivalTime: string | null;
  vehicleType: string;
  price: number | null;
  availableSeats: number;
  bookingUrl: string;
}

export interface TicketLookupResult {
  ticketCode: string;
  bookingCode: string;
  customerName: string;
  customerPhone: string;
  status: string;
  tripCode: string;
  route: string;
  departureTime: string;
  seatName: string;
  price: number;
  paymentStatus: string;
  cancellationEligible: boolean;
  cancellationFeeRate: number;
}

export interface ShipmentLookupResult {
  waybillCode: string;
  orderCode: string;
  senderName: string;
  receiverName: string;
  receiverPhone: string;
  status: string;
  statusText: string;
  route: string;
  originPoint: string;
  destinationPoint: string;
  packageCount: number;
  totalFee: number;
  paymentStatus: string;
}

export interface PromotionResultItem {
  code: string;
  name: string;
  discountType: string;
  discountValue: number;
  maxDiscount: number | null;
  minOrderValue: number | null;
  remainingUses: number;
  validUntil: string;
}

@Injectable()
export class AiBusinessToolsService {
  private readonly logger = new Logger(AiBusinessToolsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly tripsService?: TripsService,
    @Optional() private readonly ticketsService?: TicketsService,
    @Optional() private readonly shipmentsService?: ShipmentsService,
    @Optional() private readonly promotionsService?: PromotionsService,
    @Optional() private readonly locationsService?: LocationsService,
  ) {}

  /**
   * Tool 1: Tìm kiếm chuyến xe công khai cho khách hàng
   */
  async searchAvailableTrips(params: {
    originQuery: string;
    destinationQuery: string;
    departureDate?: string;
    timeOfDay?: 'SANG' | 'CHIEU' | 'TOI';
    maxPrice?: number;
    nhaXeId?: number;
  }): Promise<{ trips: TripSearchResultItem[]; totalFound: number }> {
    const { originQuery, destinationQuery, departureDate, timeOfDay, maxPrice, nhaXeId } = params;

    // Chuẩn hóa ngày tìm kiếm
    let dateFilter: Prisma.DateTimeFilter | Date;
    if (departureDate && /^\d{4}-\d{2}-\d{2}$/.test(departureDate)) {
      dateFilter = new Date(`${departureDate}T00:00:00.000Z`);
    } else {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      dateFilter = { gte: today };
    }

    const where: Prisma.ChuyenXeWhereInput = {
      trangThai: 'CHUA_KHOI_HANH',
      ngayKhoiHanh: dateFilter,
    };

    if (nhaXeId) {
      where.nhaXeId = nhaXeId;
    }

    // Lọc theo tuyến đường (điểm đi, điểm đến)
    const andFilters: Prisma.ChuyenXeWhereInput[] = [];
    if (originQuery && originQuery.trim()) {
      andFilters.push({
        tuyenXe: { diemDi: { contains: originQuery.trim() } },
      });
    }
    if (destinationQuery && destinationQuery.trim()) {
      andFilters.push({
        tuyenXe: { diemDen: { contains: destinationQuery.trim() } },
      });
    }

    if (andFilters.length > 0) {
      where.AND = andFilters;
    }

    const trips = await this.prisma.chuyenXe.findMany({
      where,
      include: {
        tuyenXe: { include: { nhaXe: true } },
        xe: { include: { loaiXe: true } },
        gheChuyenXes: { select: { trangThai: true } },
      },
      take: 20,
      orderBy: [{ ngayKhoiHanh: 'asc' }, { gioKhoiHanh: 'asc' }],
    });

    if (!trips || trips.length === 0) {
      return { trips: [], totalFound: 0 };
    }

    // Lấy bảng giá niêm yết cho các chuyến
    const latestDate = new Date(Math.max(...trips.map((t) => t.ngayKhoiHanh.getTime())));
    const earliestDate = new Date(Math.min(...trips.map((t) => t.ngayKhoiHanh.getTime())));

    const fares = await this.prisma.bangGia.findMany({
      where: {
        trangThai: 'HOAT_DONG',
        tuNgay: { lte: latestDate },
        OR: [{ denNgay: null }, { denNgay: { gte: earliestDate } }],
      },
    });

    const mappedTrips: TripSearchResultItem[] = [];

    for (const trip of trips) {
      const availableSeats = trip.gheChuyenXes.filter((g) => g.trangThai === 'TRONG').length;
      if (availableSeats === 0) continue;

      // Tìm giá vé
      const matchingFare = fares.find(
        (f) =>
          f.nhaXeId === trip.nhaXeId &&
          f.tuyenXeId === trip.tuyenXeId &&
          f.loaiXeId === trip.xe.loaiXeId &&
          trip.ngayKhoiHanh >= f.tuNgay &&
          (!f.denNgay || trip.ngayKhoiHanh <= f.denNgay),
      );
      const price = matchingFare ? Number(matchingFare.giaNiemYet) : null;

      if (maxPrice !== undefined && price !== null && price > maxPrice) {
        continue;
      }

      // Lọc theo khung giờ khởi hành trong ngày nếu có
      if (timeOfDay) {
        const hours = trip.gioKhoiHanh.getUTCHours();
        if (timeOfDay === 'SANG' && (hours < 4 || hours >= 12)) continue;
        if (timeOfDay === 'CHIEU' && (hours < 12 || hours >= 18)) continue;
        if (timeOfDay === 'TOI' && (hours < 18 || hours > 23)) continue;
      }

      const depTimeStr = trip.gioKhoiHanh.toISOString().slice(11, 16);
      const arrTimeStr = trip.gioDen ? trip.gioDen.toISOString().slice(11, 16) : null;

      mappedTrips.push({
        tripId: trip.chuyenXeId,
        code: trip.maChuyenXe,
        operator: trip.tuyenXe.nhaXe.tenNhaXe,
        origin: trip.tuyenXe.diemDi,
        destination: trip.tuyenXe.diemDen,
        departureDate: trip.ngayKhoiHanh.toISOString().slice(0, 10),
        departureTime: depTimeStr,
        arrivalTime: arrTimeStr,
        vehicleType: trip.xe.loaiXe.tenLoai,
        price,
        availableSeats,
        bookingUrl: `/trips/${trip.chuyenXeId}`,
      });

      if (mappedTrips.length >= 5) break;
    }

    return { trips: mappedTrips, totalFound: mappedTrips.length };
  }

  /**
   * Tool 2: Tra cứu trạng thái vé xe điện tử
   */
  async lookupTicketStatus(params: {
    ticketCode: string;
    phoneNumber?: string;
  }): Promise<TicketLookupResult> {
    const rawCode = params.ticketCode.trim();

    // Tìm vé theo mã vé, mã phiếu đặt hoặc mã đơn giao dịch
    const ticket = await this.prisma.ve.findFirst({
      where: {
        OR: [
          { maVe: rawCode },
          { phieuDatVe: { maPhieuDatVe: rawCode } },
          { phieuDatVe: { donGiaoDich: { maDonGiaoDich: rawCode } } },
        ],
      },
      include: {
        phieuDatVe: {
          include: {
            donGiaoDich: {
              include: {
                thanhToans: {
                  where: { loaiGiaoDich: 'THANH_TOAN', trangThai: 'THANH_CONG' },
                  take: 1,
                },
              },
            },
          },
        },
        gheChuyenXe: {
          include: {
            ghe: true,
            chuyenXe: {
              include: {
                tuyenXe: { include: { nhaXe: true } },
              },
            },
          },
        },
      },
    });

    if (!ticket) {
      throw new Error(`TICKET_NOT_FOUND: Không tìm thấy vé hoặc mã đơn "${rawCode}".`);
    }

    const customerPhone = ticket.phieuDatVe.donGiaoDich.soDienThoaiKhachHang;
    if (params.phoneNumber) {
      const cleanInput = params.phoneNumber.replace(/\D/g, '');
      const cleanDb = customerPhone.replace(/\D/g, '');
      if (cleanInput.slice(-9) !== cleanDb.slice(-9)) {
        throw new Error('PHONE_MISMATCH: Số điện thoại xác thực không khớp với thông tin đặt vé.');
      }
    }

    const trip = ticket.gheChuyenXe.chuyenXe;
    const depDateStr = trip.ngayKhoiHanh.toISOString().slice(0, 10);
    const depTimeStr = trip.gioKhoiHanh.toISOString().slice(11, 16);

    const price = Number(ticket.giaThucTe || ticket.giaNiemYet);
    const hasSuccessfulPayment = ticket.phieuDatVe.donGiaoDich.thanhToans.length > 0;

    return {
      ticketCode: ticket.maVe,
      bookingCode: ticket.phieuDatVe.maPhieuDatVe,
      customerName: ticket.phieuDatVe.donGiaoDich.tenKhachHang,
      customerPhone,
      status: ticket.trangThai,
      tripCode: trip.maChuyenXe,
      route: `${trip.tuyenXe.diemDi} → ${trip.tuyenXe.diemDen} (${trip.tuyenXe.nhaXe.tenNhaXe})`,
      departureTime: `${depTimeStr} ngày ${depDateStr}`,
      seatName: ticket.gheChuyenXe.ghe.tenGhe,
      price,
      paymentStatus: hasSuccessfulPayment ? 'ĐÃ_THANH_TOÁN' : 'CHỜ_THANH_TOÁN',
      cancellationEligible: ticket.trangThai !== 'HUY',
      cancellationFeeRate: 0.1,
    };
  }

  /**
   * Tool 3: Tra cứu tiến trình vận chuyển bưu kiện
   */
  async lookupShipmentStatus(params: {
    shipmentCode: string;
    phoneNumber?: string;
  }): Promise<ShipmentLookupResult> {
    const rawCode = params.shipmentCode.trim().toUpperCase();

    const shipment = await this.prisma.phieuGuiHang.findFirst({
      where: {
        OR: [
          { maVanDon: rawCode },
          { donGiaoDich: { maDonGiaoDich: rawCode } },
        ],
      },
      include: {
        donGiaoDich: {
          include: {
            thanhToans: {
              where: { loaiGiaoDich: 'THANH_TOAN', trangThai: 'THANH_CONG' },
              take: 1,
            },
          },
        },
        diemGui: true,
        diemNhan: true,
        tuyenXe: { include: { nhaXe: true } },
        hangHoas: true,
      },
    });

    if (!shipment) {
      throw new Error(`SHIPMENT_NOT_FOUND: Không tìm thấy vận đơn "${rawCode}".`);
    }

    if (params.phoneNumber) {
      const cleanInput = params.phoneNumber.replace(/\D/g, '');
      const senderPhone = shipment.donGiaoDich.soDienThoaiKhachHang.replace(/\D/g, '');
      const receiverPhone = shipment.soDienThoaiNguoiNhan.replace(/\D/g, '');

      if (
        cleanInput.slice(-9) !== senderPhone.slice(-9) &&
        cleanInput.slice(-9) !== receiverPhone.slice(-9)
      ) {
        throw new Error('PHONE_MISMATCH: Số điện thoại không khớp với người gửi hoặc người nhận.');
      }
    }

    const statusTexts: Record<string, string> = {
      MOI_TAO: 'Mới tạo (Chờ gửi hàng ra bến)',
      DA_TIEP_NHAN: 'Đã tiếp nhận hàng tại bến/văn phòng',
      DANG_VAN_CHUYEN: 'Đang vận chuyển trên đường',
      DA_GIAO: 'Đã phát hàng thành công',
      DA_HUY: 'Đã hủy đơn gửi hàng',
    };

    const hasPayment = shipment.donGiaoDich.thanhToans.length > 0;

    return {
      waybillCode: shipment.maVanDon,
      orderCode: shipment.donGiaoDich.maDonGiaoDich,
      senderName: shipment.donGiaoDich.tenKhachHang,
      receiverName: shipment.tenNguoiNhan,
      receiverPhone: shipment.soDienThoaiNguoiNhan,
      status: shipment.trangThai,
      statusText: statusTexts[shipment.trangThai] || shipment.trangThai,
      route: shipment.tuyenXe
        ? `${shipment.tuyenXe.diemDi} → ${shipment.tuyenXe.diemDen} (${shipment.tuyenXe.nhaXe.tenNhaXe})`
        : 'Chưa phân tuyến',
      originPoint: `${shipment.diemGui.tenDiem} (${shipment.diemGui.diaChi})`,
      destinationPoint: `${shipment.diemNhan.tenDiem} (${shipment.diemNhan.diaChi})`,
      packageCount: shipment.hangHoas.length,
      totalFee: Number(shipment.tongPhi),
      paymentStatus: hasPayment ? 'ĐÃ_THANH_TOÁN' : 'CHƯA_THANH_TOÁN',
    };
  }

  /**
   * Tool 4: Lấy danh sách chương trình khuyến mãi đang hoạt động
   */
  async getActivePromotions(params: {
    orderValue?: number;
    nhaXeId?: number;
  }): Promise<{ promotions: PromotionResultItem[]; total: number }> {
    const now = new Date();
    const where: Prisma.KhuyenMaiWhereInput = {
      trangThai: 'HOAT_DONG',
      tuNgay: { lte: now },
      denNgay: { gte: now },
    };

    if (params.nhaXeId) {
      where.nhaXeId = params.nhaXeId;
    }

    const promotions = await this.prisma.khuyenMai.findMany({
      where,
      orderBy: [{ giaTriGiam: 'desc' }, { createdAt: 'desc' }],
      take: 10,
    });

    const activeList = promotions
      .filter((p) => p.soLuotDaSuDung < p.soLuotToiDa)
      .filter((p) => {
        if (params.orderValue && p.giaTriDonToiThieu) {
          return params.orderValue >= Number(p.giaTriDonToiThieu);
        }
        return true;
      })
      .map((p) => ({
        code: p.maKhuyenMai,
        name: p.tenChuongTrinh,
        discountType: p.loaiGiamGia === 'PHAN_TRAM' ? 'Giảm theo phần trăm' : 'Giảm tiền mặt',
        discountValue: Number(p.giaTriGiam),
        maxDiscount: p.giamToiDa ? Number(p.giamToiDa) : null,
        minOrderValue: p.giaTriDonToiThieu ? Number(p.giaTriDonToiThieu) : null,
        remainingUses: Math.max(0, p.soLuotToiDa - p.soLuotDaSuDung),
        validUntil: p.denNgay.toISOString().slice(0, 10),
      }));

    return { promotions: activeList, total: activeList.length };
  }
}
