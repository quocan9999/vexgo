import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import { TenantDashboardService } from '../../../src/tenant-dashboard/tenant-dashboard.service.js';

const mockTenantPrincipal: AuthPrincipal = {
  taiKhoanId: 10,
  sessionId: 'session-10',
  roles: ['NHA_XE_ADMIN'],
  permissions: ['trip:read', 'booking:read', 'shipment:read'],
  nhanVienId: 20,
  nhaXeId: 5,
};

const mockInvalidPrincipal: AuthPrincipal = {
  taiKhoanId: 1,
  sessionId: 'session-1',
  roles: ['SUPER_ADMIN'],
  permissions: [],
  nhanVienId: null,
  nhaXeId: null,
};

describe('TenantDashboardService', () => {
  let service: TenantDashboardService;
  let mockPrisma: any;
  let mockConfig: any;
  let txMock: any;

  beforeEach(() => {
    txMock = {
      chuyenXe: {
        findMany: vi.fn(),
      },
      ve: {
        aggregate: vi.fn(),
      },
      phieuGuiHang: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      phieuDatVe: {
        count: vi.fn(),
      },
    };

    mockPrisma = {
      $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => cb(txMock)),
    } as unknown as PrismaService;

    mockConfig = {
      get: vi.fn().mockImplementation((key: string) => {
        if (key === 'BUSINESS_TIME_ZONE') return 'Asia/Ho_Chi_Minh';
        return undefined;
      }),
    } as unknown as ConfigService;

    service = new TenantDashboardService(mockPrisma, mockConfig);
  });

  it('rejects principals without valid tenant identity', async () => {
    await expect(service.getOverview(mockInvalidPrincipal)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('calculates operational metrics, upcoming trips, and urgent alerts correctly for tenant', async () => {
    // Mock trips today
    txMock.chuyenXe.findMany.mockResolvedValue([
      {
        chuyenXeId: 1,
        maChuyenXe: 'CX01',
        ngayKhoiHanh: new Date('2026-11-08T00:00:00.000Z'),
        gioKhoiHanh: new Date('1970-01-01T08:00:00.000Z'),
        trangThai: 'CHUA_KHOI_HANH',
        tuyenXe: {
          maTuyenXe: 'SG-DL',
          diemDi: 'Sài Gòn',
          diemDen: 'Đà Lạt',
        },
        xe: {
          bienSoXe: '51B-111.11',
          loaiXe: { tenLoai: 'Giường nằm 40 chỗ' },
        },
        gheChuyenXes: [
          { gheChuyenXeId: 1, trangThai: 'DA_DAT' },
          { gheChuyenXeId: 2, trangThai: 'DA_DAT' },
          { gheChuyenXeId: 3, trangThai: 'TRONG' },
          { gheChuyenXeId: 4, trangThai: 'TRONG' },
        ],
      },
      {
        chuyenXeId: 2,
        maChuyenXe: 'CX02',
        ngayKhoiHanh: new Date('2026-11-08T00:00:00.000Z'),
        gioKhoiHanh: new Date('1970-01-01T10:30:00.000Z'),
        trangThai: 'DANG_CHAY',
        tuyenXe: {
          maTuyenXe: 'SG-VT',
          diemDi: 'Sài Gòn',
          diemDen: 'Vũng Tàu',
        },
        xe: {
          bienSoXe: '51B-222.22',
          loaiXe: { tenLoai: 'Limousine 9 chỗ' },
        },
        gheChuyenXes: [
          { gheChuyenXeId: 5, trangThai: 'DA_DAT' },
          { gheChuyenXeId: 6, trangThai: 'DA_DAT' },
        ],
      },
      {
        chuyenXeId: 3,
        maChuyenXe: 'CX03',
        ngayKhoiHanh: new Date('2026-11-08T00:00:00.000Z'),
        gioKhoiHanh: new Date('1970-01-01T06:00:00.000Z'),
        trangThai: 'HOAN_THANH',
        tuyenXe: {
          maTuyenXe: 'SG-PT',
          diemDi: 'Sài Gòn',
          diemDen: 'Phan Thiết',
        },
        xe: {
          bienSoXe: '51B-333.33',
          loaiXe: { tenLoai: 'Ghế ngồi 29 chỗ' },
        },
        gheChuyenXes: [
          { gheChuyenXeId: 7, trangThai: 'DA_DAT' },
        ],
      },
    ]);

    // Mock ticket revenue
    txMock.ve.aggregate.mockResolvedValue({
      _sum: {
        giaThucTe: 1500000,
      },
    });

    // Mock shipments today
    txMock.phieuGuiHang.findMany.mockResolvedValue([
      {
        phieuGuiHangId: 101,
        chuyenXeId: 1,
        tongPhi: 200000,
        trangThai: 'DA_TIEP_NHAN',
      },
      {
        phieuGuiHangId: 102,
        chuyenXeId: null, // Unassigned
        tongPhi: 150000,
        trangThai: 'MOI_TAO',
      },
    ]);

    // Mock urgent alerts count
    txMock.phieuDatVe.count.mockResolvedValue(3); // 3 pending bookings
    txMock.phieuGuiHang.count.mockResolvedValue(5); // 5 total unassigned shipments

    const result = await service.getOverview(mockTenantPrincipal);

    expect(result).toBeDefined();
    expect(result.timeZone).toBe('Asia/Ho_Chi_Minh');
    expect(result.businessDate).toMatch(/^\d{2}-\d{2}-\d{4}$/);

    // Verify operational metrics
    expect(result.metrics.totalTripsToday).toBe(3);
    expect(result.metrics.preparingTrips).toBe(1);
    expect(result.metrics.runningTrips).toBe(1);
    expect(result.metrics.completedTrips).toBe(1);
    expect(result.metrics.cancelledTrips).toBe(0);

    // Total seats: 4 + 2 + 1 = 7, Booked: 2 + 2 + 1 = 5
    expect(result.metrics.totalSeatsToday).toBe(7);
    expect(result.metrics.bookedTicketsToday).toBe(5);
    expect(result.metrics.loadFactorPercent).toBe(Math.round((5 / 7) * 100)); // 71%

    // Shipments: 2 today, 1 unassigned today
    expect(result.metrics.totalShipmentsToday).toBe(2);
    expect(result.metrics.unassignedShipmentsToday).toBe(1);

    // Revenue: 1,500,000 + 350,000 = 1,850,000
    expect(result.metrics.estimatedRevenueToday).toBe(1850000);

    // Verify upcoming trips
    expect(result.upcomingTrips).toHaveLength(2); // CX01 (CHUA_KHOI_HANH) and CX02 (DANG_CHAY)
    expect(result.upcomingTrips[0].tripCode).toBe('CX01');
    expect(result.upcomingTrips[0].routeName).toBe('Sài Gòn - Đà Lạt');
    expect(result.upcomingTrips[0].licensePlate).toBe('51B-111.11');
    expect(result.upcomingTrips[0].vehicleTypeName).toBe('Giường nằm 40 chỗ');
    expect(result.upcomingTrips[0].bookedSeats).toBe(2);
    expect(result.upcomingTrips[0].totalSeats).toBe(4);
    expect(result.upcomingTrips[0].loadFactorPercent).toBe(50);

    // Verify urgent alerts
    expect(result.urgentAlerts.pendingBookingsCount).toBe(3);
    expect(result.urgentAlerts.unassignedShipmentsCount).toBe(5);

    // Verify nhaXeId was filtered strictly
    expect(txMock.chuyenXe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ nhaXeId: 5 }),
      }),
    );
  });
});
