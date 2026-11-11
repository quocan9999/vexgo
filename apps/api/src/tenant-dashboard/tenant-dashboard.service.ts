import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { requireTenantPrincipal } from '../auth/tenant-scope.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import {
  businessDateStartUtc,
  getBusinessDate,
  resolveBusinessTimeZone,
} from '../common/time/business-date.js';
import type {
  OperationalMetricsDto,
  TenantDashboardOverviewDto,
  UpcomingTripItemDto,
  UrgentAlertsDto,
} from './dto/tenant-dashboard-overview.dto.js';

@Injectable()
export class TenantDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getOverview(principal: AuthPrincipal): Promise<TenantDashboardOverviewDto> {
    const nhaXeId = requireTenantPrincipal(principal);

    const timeZone = resolveBusinessTimeZone(
      this.config.get<string>('BUSINESS_TIME_ZONE'),
    );
    const now = new Date();
    const dateStr = getBusinessDate(timeZone, now); // 'YYYY-MM-DD'
    const [yearStr, monthStr, dayStr] = dateStr.split('-');
    const formattedBusinessDate = `${dayStr}-${monthStr}-${yearStr}`; // 'DD-MM-YYYY'
    const todayMidnightUtc = new Date(`${dateStr}T00:00:00.000Z`);

    const nextDay = new Date(todayMidnightUtc.getTime() + 24 * 60 * 60 * 1000);
    const nextDayDateStr = nextDay.toISOString().slice(0, 10);
    const startOfTodayUtc = businessDateStartUtc(dateStr, timeZone);
    const startOfTomorrowUtc = businessDateStartUtc(nextDayDateStr, timeZone);

    return this.prisma.$transaction(async (tx) => {
      // 1. Chuyến xe hôm nay của nhà xe
      const tripsToday = await tx.chuyenXe.findMany({
        where: {
          nhaXeId,
          ngayKhoiHanh: todayMidnightUtc,
        },
        select: {
          chuyenXeId: true,
          maChuyenXe: true,
          ngayKhoiHanh: true,
          gioKhoiHanh: true,
          trangThai: true,
          tuyenXe: {
            select: {
              maTuyenXe: true,
              diemDi: true,
              diemDen: true,
            },
          },
          xe: {
            select: {
              bienSoXe: true,
              loaiXe: {
                select: {
                  tenLoai: true,
                },
              },
            },
          },
          gheChuyenXes: {
            select: {
              gheChuyenXeId: true,
              trangThai: true,
            },
          },
        },
        orderBy: [{ gioKhoiHanh: 'asc' }, { chuyenXeId: 'asc' }],
      });

      const totalTripsToday = tripsToday.length;
      const preparingTrips = tripsToday.filter(
        (t) => t.trangThai === 'CHUA_KHOI_HANH',
      ).length;
      const runningTrips = tripsToday.filter(
        (t) => t.trangThai === 'DANG_CHAY',
      ).length;
      const completedTrips = tripsToday.filter(
        (t) => t.trangThai === 'HOAN_THANH',
      ).length;
      const cancelledTrips = tripsToday.filter(
        (t) => t.trangThai === 'DA_HUY',
      ).length;

      let totalSeatsToday = 0;
      let bookedTicketsToday = 0;
      for (const trip of tripsToday) {
        if (trip.trangThai !== 'DA_HUY') {
          totalSeatsToday += trip.gheChuyenXes.length;
          bookedTicketsToday += trip.gheChuyenXes.filter(
            (g) => g.trangThai === 'DA_DAT',
          ).length;
        }
      }

      const loadFactorPercent =
        totalSeatsToday > 0
          ? Math.round((bookedTicketsToday / totalSeatsToday) * 100)
          : 0;

      // 2. Doanh thu vé ước tính của các chuyến hôm nay
      const nonCancelledTripIds = tripsToday
        .filter((t) => t.trangThai !== 'DA_HUY')
        .map((t) => t.chuyenXeId);

      let ticketRevenueToday = 0;
      if (nonCancelledTripIds.length > 0) {
        const ticketSum = await tx.ve.aggregate({
          where: {
            gheChuyenXe: {
              chuyenXeId: { in: nonCancelledTripIds },
            },
            trangThai: { not: 'DA_HUY' },
          },
          _sum: {
            giaThucTe: true,
          },
        });
        ticketRevenueToday = Number(ticketSum._sum.giaThucTe ?? 0);
      }

      // 3. Kiện hàng tiếp nhận hôm nay
      const shipmentsToday = await tx.phieuGuiHang.findMany({
        where: {
          donGiaoDich: { nhaXeId },
          ngayGui: {
            gte: startOfTodayUtc,
            lt: startOfTomorrowUtc,
          },
        },
        select: {
          phieuGuiHangId: true,
          chuyenXeId: true,
          tongPhi: true,
          trangThai: true,
        },
      });

      const totalShipmentsToday = shipmentsToday.length;
      const unassignedShipmentsToday = shipmentsToday.filter(
        (s) =>
          s.chuyenXeId === null &&
          s.trangThai !== 'DA_HUY' &&
          s.trangThai !== 'DA_GIAO',
      ).length;

      const shipmentRevenueToday = shipmentsToday
        .filter((s) => s.trangThai !== 'DA_HUY')
        .reduce((sum, s) => sum + Number(s.tongPhi ?? 0), 0);

      const estimatedRevenueToday = ticketRevenueToday + shipmentRevenueToday;

      const metrics: OperationalMetricsDto = {
        totalTripsToday,
        preparingTrips,
        runningTrips,
        completedTrips,
        cancelledTrips,
        bookedTicketsToday,
        totalSeatsToday,
        loadFactorPercent,
        totalShipmentsToday,
        unassignedShipmentsToday,
        estimatedRevenueToday,
      };

      // 4. Danh sách chuyến sắp xuất bến gần nhất
      const upcomingTrips: UpcomingTripItemDto[] = tripsToday
        .filter(
          (t) =>
            t.trangThai === 'CHUA_KHOI_HANH' || t.trangThai === 'DANG_CHAY',
        )
        .slice(0, 8)
        .map((trip) => {
          const tripTotalSeats = trip.gheChuyenXes.length;
          const tripBookedSeats = trip.gheChuyenXes.filter(
            (g) => g.trangThai === 'DA_DAT',
          ).length;
          const tripLoadFactor =
            tripTotalSeats > 0
              ? Math.round((tripBookedSeats / tripTotalSeats) * 100)
              : 0;

          const timeIso = trip.gioKhoiHanh.toISOString();
          const depTime = timeIso.slice(11, 16);

          return {
            tripId: trip.chuyenXeId,
            tripCode: trip.maChuyenXe,
            departureDate: formattedBusinessDate,
            departureTime: depTime,
            routeName: `${trip.tuyenXe.diemDi} - ${trip.tuyenXe.diemDen}`,
            departureLocation: trip.tuyenXe.diemDi,
            arrivalLocation: trip.tuyenXe.diemDen,
            licensePlate: trip.xe.bienSoXe,
            vehicleTypeName: trip.xe.loaiXe.tenLoai,
            bookedSeats: tripBookedSeats,
            totalSeats: tripTotalSeats,
            loadFactorPercent: tripLoadFactor,
            status: trip.trangThai,
          };
        });

      // 5. Cảnh báo khẩn cần xử lý ngay
      const pendingBookingsCount = await tx.phieuDatVe.count({
        where: {
          donGiaoDich: { nhaXeId },
          trangThai: 'CHO_THANH_TOAN',
        },
      });

      const unassignedShipmentsCount = await tx.phieuGuiHang.count({
        where: {
          donGiaoDich: { nhaXeId },
          chuyenXeId: null,
          trangThai: { in: ['MOI_TAO', 'DA_TIEP_NHAN'] },
        },
      });

      let departingSoonLowOccupancyCount = 0;
      for (const trip of tripsToday) {
        if (trip.trangThai === 'CHUA_KHOI_HANH') {
          const tripTotal = trip.gheChuyenXes.length;
          const tripBooked = trip.gheChuyenXes.filter(
            (g) => g.trangThai === 'DA_DAT',
          ).length;
          const occupancy =
            tripTotal > 0 ? (tripBooked / tripTotal) * 100 : 0;
          if (occupancy < 30) {
            departingSoonLowOccupancyCount += 1;
          }
        }
      }

      const urgentAlerts: UrgentAlertsDto = {
        pendingBookingsCount,
        unassignedShipmentsCount,
        departingSoonLowOccupancyCount,
      };

      return {
        businessDate: formattedBusinessDate,
        timeZone,
        metrics,
        upcomingTrips,
        urgentAlerts,
      };
    });
  }
}
