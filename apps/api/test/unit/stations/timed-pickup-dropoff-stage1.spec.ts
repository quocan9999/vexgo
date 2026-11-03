import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { StationsService } from '../../../src/stations/stations.service.js';
import { RoutesService } from '../../../src/routes/routes.service.js';
import { TripsService } from '../../../src/trips/trips.service.js';
import {
  validateStopList,
  type StationValidationInfo,
  type StopListItemInput,
} from '../../../src/stations/stop-list-validator.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';

describe('Stage 1: Timed Pickup/Dropoff & Route Templates', () => {
  const nhaXeId = 5;
  const adminPrincipal: AuthPrincipal = {
    taiKhoanId: 10,
    sessionId: 'session-stage1',
    roles: ['NHA_XE_ADMIN'],
    permissions: ['route:read', 'route:update', 'trip:read', 'trip:update', 'trip:create'],
    nhanVienId: 1,
    nhaXeId,
  };

  describe('1. validateStopList pure logic', () => {
    const stationsMap = new Map<number, StationValidationInfo>([
      [
        1,
        {
          diemDonTraId: 1,
          tenDiem: 'Bến xe Miền Tây',
          loaiDiem: 'BEN_XE',
          trangThai: 'HOAT_DONG',
          nhaXeId,
          benTrungChuyenId: null,
        },
      ],
      [
        2,
        {
          diemDonTraId: 2,
          tenDiem: 'Bến xe Cần Thơ',
          loaiDiem: 'BEN_XE',
          trangThai: 'HOAT_DONG',
          nhaXeId,
          benTrungChuyenId: null,
        },
      ],
      [
        3,
        {
          diemDonTraId: 3,
          tenDiem: 'Điểm hẹn trung chuyển Q.5',
          loaiDiem: 'TRUNG_CHUYEN',
          trangThai: 'HOAT_DONG',
          nhaXeId,
          benTrungChuyenId: 1, // Trỏ về Bến xe Miền Tây
        },
      ],
      [
        4,
        {
          diemDonTraId: 4,
          tenDiem: 'Trạm dừng chân Tiền Giang',
          loaiDiem: 'TRAM_NGHI',
          trangThai: 'HOAT_DONG',
          nhaXeId,
          benTrungChuyenId: null,
        },
      ],
    ]);

    it('allows pickup with positive phutLech and dropoff with negative phutLech', () => {
      const stops: StopListItemInput[] = [
        { diemDonTraId: 1, loaiDiem: 'DON', phutLech: 20 },
        { diemDonTraId: 2, loaiDiem: 'TRA', phutLech: -10 },
      ];
      const errors = validateStopList(stops, stationsMap, nhaXeId);
      expect(errors).toEqual([]);
    });

    it('validates two-way transfer points (pickup transfer < target; dropoff transfer > target)', () => {
      // DON: Q.5 (-30) < Miền Tây (0) -> VALID
      // TRA: Q.5 (180) > Miền Tây (150) -> VALID
      const validTwoWay: StopListItemInput[] = [
        { diemDonTraId: 3, loaiDiem: 'DON', phutLech: -30 },
        { diemDonTraId: 1, loaiDiem: 'DON', phutLech: 0 },
        { diemDonTraId: 1, loaiDiem: 'TRA', phutLech: 150 },
        { diemDonTraId: 3, loaiDiem: 'TRA', phutLech: 180 },
      ];
      expect(validateStopList(validTwoWay, stationsMap, nhaXeId)).toEqual([]);

      // Invalid DON: Q.5 (10) >= Miền Tây (0)
      const invalidPickup: StopListItemInput[] = [
        { diemDonTraId: 3, loaiDiem: 'DON', phutLech: 10 },
        { diemDonTraId: 1, loaiDiem: 'DON', phutLech: 0 },
      ];
      expect(validateStopList(invalidPickup, stationsMap, nhaXeId)[0].code).toBe(
        'TRANSFER_PICKUP_TIME_INVALID',
      );

      // Invalid TRA: Q.5 (140) <= Miền Tây (150)
      const invalidDropoff: StopListItemInput[] = [
        { diemDonTraId: 1, loaiDiem: 'TRA', phutLech: 150 },
        { diemDonTraId: 3, loaiDiem: 'TRA', phutLech: 140 },
      ];
      expect(validateStopList(invalidDropoff, stationsMap, nhaXeId)[0].code).toBe(
        'TRANSFER_DROPOFF_TIME_INVALID',
      );
    });

    it('rejects duplicate (diemDonTraId, loaiDiem)', () => {
      const stops: StopListItemInput[] = [
        { diemDonTraId: 1, loaiDiem: 'DON', phutLech: 0 },
        { diemDonTraId: 1, loaiDiem: 'DON', phutLech: 15 },
      ];
      const errors = validateStopList(stops, stationsMap, nhaXeId);
      expect(errors[0].code).toBe('DUPLICATE_STOP');
    });
  });

  describe('2. StationsService transfer points and stop protection', () => {
    it('requires benTrungChuyenId when creating TRUNG_CHUYEN and verifies target station', async () => {
      const mockPrisma = {
        danhMucDiaDiem: {
          findUnique: vi.fn().mockResolvedValue({
            diaDiemId: 79,
            laDiaDanhCu: true,
            capDiaDiem: 'TINH_THANH',
          }),
        },
        bangSapNhapDiaDiem: {
          findFirst: vi.fn().mockResolvedValue({ diaDiemMoiId: 79 }),
        },
        diemDonTra: {
          findUnique: vi.fn().mockImplementation(({ where }) => {
            if (where.diemDonTraId === 10) {
              return Promise.resolve({
                diemDonTraId: 10,
                tenDiem: 'Bến xe Miền Tây',
                loaiDiem: 'BEN_XE',
                trangThai: 'HOAT_DONG',
                nhaXeId: 5,
              });
            }
            return Promise.resolve(null);
          }),
          create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ diemDonTraId: 99, ...data })),
        },
      } as unknown as PrismaService;

      const service = new StationsService(mockPrisma);

      // Missing benTrungChuyenId -> throws BadRequestException
      await expect(
        service.create(
          {
            maDiem: 'TC-HX',
            tenDiem: 'Hàng Xanh',
            loaiDiem: 'TRUNG_CHUYEN',
            diaChi: 'Hàng Xanh',
            diaDiemCuId: 79,
          },
          adminPrincipal,
        ),
      ).rejects.toThrowError(BadRequestException);

      // Valid target station 10
      const created = await service.create(
        {
          maDiem: 'TC-HX',
          tenDiem: 'Hàng Xanh',
          loaiDiem: 'TRUNG_CHUYEN',
          diaChi: 'Hàng Xanh',
          diaDiemCuId: 79,
          benTrungChuyenId: 10,
        },
        adminPrincipal,
      );
      expect(created.data.benTrungChuyenId).toBe(10);
    });

    it('blocks stopping or deleting a station that is destination of active transfer points', async () => {
      const mockPrisma = {
        diemDonTra: {
          findUnique: vi.fn().mockResolvedValue({
            diemDonTraId: 10,
            tenDiem: 'Bến xe Miền Tây',
            loaiDiem: 'BEN_XE',
            trangThai: 'HOAT_DONG',
            nhaXeId: 5,
          }),
          findMany: vi.fn().mockResolvedValue([
            { diemDonTraId: 30, tenDiem: 'Hàng Xanh', maDiem: 'TC-HX' },
          ]),
        },
      } as unknown as PrismaService;

      const service = new StationsService(mockPrisma);

      // Attempting to delete bến xe Miền Tây -> throws 409 ConflictException
      await expect(service.delete(10, adminPrincipal)).rejects.toThrowError(ConflictException);

      // Attempting to set NGUNG_HOAT_DONG -> throws 409 ConflictException
      await expect(
        service.update(10, { trangThai: 'NGUNG_HOAT_DONG' }, adminPrincipal),
      ).rejects.toThrowError(ConflictException);
    });

    it('blocks deleting or changing time for trip points that have active tickets (409 Conflict)', async () => {
      const mockPrisma = {
        chuyenXe: {
          findUnique: vi.fn().mockResolvedValue({
            chuyenXeId: 100,
            nhaXeId: 5,
            gioKhoiHanh: new Date('1970-01-01T08:00:00.000Z'),
          }),
        },
        diemDonTra: {
          findMany: vi.fn().mockResolvedValue([
            {
              diemDonTraId: 1,
              tenDiem: 'Bến xe Miền Tây',
              loaiDiem: 'BEN_XE',
              trangThai: 'HOAT_DONG',
              nhaXeId: 5,
              benTrungChuyenId: null,
            },
          ]),
        },
        diemDonTraChuyenXe: {
          findMany: vi.fn().mockResolvedValue([
            {
              diemDonTraChuyenXeId: 501,
              chuyenXeId: 100,
              diemDonTraId: 1,
              loaiDiem: 'DON',
              phutLech: 0,
              diemDonTra: { diemDonTraId: 1, tenDiem: 'Bến xe Miền Tây' },
              vesDon: [{ veId: 1 }, { veId: 2 }], // 2 vé đã chọn điểm này!
              vesTra: [],
            },
          ]),
        },
      } as unknown as PrismaService;

      const service = new StationsService(mockPrisma);

      // Attempting to remove point #1 -> throws 409 POINT_HAS_TICKETS
      await expect(
        service.updateTripPassengerPoints(100, { points: [] }, adminPrincipal),
      ).rejects.toThrowError(ConflictException);

      // Attempting to change phutLech from 0 to 15 -> throws 409 POINT_HAS_TICKETS
      await expect(
        service.updateTripPassengerPoints(
          100,
          {
            points: [
              {
                diemDonTraId: 1,
                loaiDiem: 'DON',
                phutLech: 15,
                thuTu: 1,
              },
            ],
          },
          adminPrincipal,
        ),
      ).rejects.toThrowError(ConflictException);
    });
  });

  describe('3. TripsService & RoutesService template copying & details', () => {
    it('returns donCount, traCount, nghiCount and thieuDiem in trip details', async () => {
      const mockPrisma = {
        chuyenXe: {
          findFirst: vi.fn().mockResolvedValue({
            chuyenXeId: 100,
            maChuyenXe: 'CX-SG-CT-01',
            ngayKhoiHanh: new Date('2026-11-20'),
            gioKhoiHanh: new Date('1970-01-01T08:00:00.000Z'),
            trangThai: 'CHUA_KHOI_HANH',
            nhanGuiHang: false,
            sucChuaXeMay: 2,
            sucChuaHangCongKenh: 1,
            sucChuaHangNhe: 10,
            createdAt: new Date(),
            updatedAt: new Date(),
            tuyenXe: {
              tuyenXeId: 1,
              maTuyenXe: 'TX-SG-CT',
              diemDi: 'TP.HCM',
              diemDen: 'Cần Thơ',
              thoiGianChayPhut: 180,
            },
            xe: {
              xeId: 1,
              bienSoXe: '51B-12345',
              trangThai: 'HOAT_DONG',
              loaiXe: { loaiXeId: 1, tenLoai: 'Giường nằm 40' },
            },
            gheChuyenXes: [{ trangThai: 'TRONG' }],
            diemDonTraChuyenXes: [
              { loaiDiem: 'DON' },
              { loaiDiem: 'NGHI' },
              // Không có điểm TRA -> thieuDiem phải là true!
            ],
          }),
        },
      } as unknown as PrismaService;

      const tripsService = new TripsService(
        mockPrisma,
        { get: vi.fn().mockReturnValue('Asia/Ho_Chi_Minh') } as any,
        {} as any,
      );
      const detail = await tripsService.findOne(100, adminPrincipal);

      expect(detail.data.donCount).toBe(1);
      expect(detail.data.traCount).toBe(0);
      expect(detail.data.nghiCount).toBe(1);
      expect(detail.data.thieuDiem).toBe(true);
    });

    it('copies route template stops into trip points atomically during createTrip', async () => {
      const templateStops = [
        {
          tuyenXeDiemDungId: 1,
          tuyenXeId: 1,
          diemDonTraId: 10,
          loaiDiem: 'DON',
          phutLech: -30,
          thuTu: 1,
          phuPhi: 0,
          phutCoMatTruoc: 15,
          nhanKhach: true,
          ghiChu: null,
        },
        {
          tuyenXeDiemDungId: 2,
          tuyenXeId: 1,
          diemDonTraId: 20,
          loaiDiem: 'TRA',
          phutLech: 120,
          thuTu: 2,
          phuPhi: 0,
          phutCoMatTruoc: 15,
          nhanKhach: true,
          ghiChu: null,
        },
      ];

      const createdTripPoints: any[] = [];
      const mockTx = {
        $queryRaw: vi.fn(async (parts: TemplateStringsArray) => {
          const sql = parts.join('?');
          if (sql.includes('FROM NhaXe')) return [{ maNhaXe: 'FUTA' }];
          if (sql.includes('FROM ChuyenXe')) return [{ code: 'FUTA-CX-20112026-0098' }];
          if (sql.includes('FROM BoDemMaNghiepVu')) return [];
          return [{ xeId: 1 }];
        }),
        $executeRaw: vi.fn().mockResolvedValue(1),
        boDemMaNghiepVu: {
          findUnique: vi.fn().mockResolvedValue(null),
          upsert: vi.fn().mockResolvedValue({ tienTo: 'CX-20261120-5-', soCuoi: 1 }),
        },
        ghe: { findMany: vi.fn().mockResolvedValue([{ gheId: 1, tang: 1, toaDoX: 1, toaDoY: 1 }]) },
        chuyenXe: {
          findFirst: vi.fn().mockResolvedValue(null), // no conflict
          findMany: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockResolvedValue({
            chuyenXeId: 200,
            maChuyenXe: 'CX-SG-VT-01',
            ngayKhoiHanh: new Date('2026-11-20'),
            gioKhoiHanh: new Date('1970-01-01T08:00:00.000Z'),
            trangThai: 'CHUA_KHOI_HANH',
            nhanGuiHang: false,
            sucChuaXeMay: 2,
            sucChuaHangCongKenh: 1,
            sucChuaHangNhe: 10,
            createdAt: new Date(),
            updatedAt: new Date(),
            tuyenXe: { tuyenXeId: 1, maTuyenXe: 'TX-01', diemDi: 'SG', diemDen: 'VT' },
            xe: { xeId: 1, bienSoXe: '51B-12345', trangThai: 'HOAT_DONG', loaiXe: { loaiXeId: 1, tenLoai: 'Giường nằm' } },
            gheChuyenXes: [{ trangThai: 'TRONG' }],
          }),
        },
        tuyenXeDiemDung: {
          findMany: vi.fn().mockResolvedValue(templateStops),
        },
        diemDonTraChuyenXe: {
          create: vi.fn().mockImplementation(({ data }) => {
            createdTripPoints.push(data);
            return Promise.resolve({ diemDonTraChuyenXeId: createdTripPoints.length, ...data });
          }),
        },
      };

      const mockPrisma = {
        tuyenXe: {
          findFirst: vi.fn().mockResolvedValue({ tuyenXeId: 1, trangThai: 'HOAT_DONG', thoiGianChayPhut: 120 }),
        },
        xe: {
          findFirst: vi.fn().mockResolvedValue({
            xeId: 1,
            trangThai: 'HOAT_DONG',
            loaiXe: {
              sucChuaXeMayMacDinh: 2,
              sucChuaHangCongKenhMacDinh: 1,
              sucChuaHangNheMacDinh: 10,
            },
          }),
        },
        $transaction: vi.fn().mockImplementation(async (callback) => callback(mockTx)),
        diemDonTraChuyenXe: {
          findMany: vi.fn().mockResolvedValue([
            { loaiDiem: 'DON' },
            { loaiDiem: 'TRA' },
          ]),
        },
      } as unknown as PrismaService;

      const tripsService = new TripsService(
        mockPrisma,
        { get: vi.fn().mockReturnValue('Asia/Ho_Chi_Minh') } as any,
        {} as any,
      );
      const res = await tripsService.create(
        {
          routeId: 1,
          vehicleId: 1,
          departureDate: '2026-11-20',
          departureTime: '08:00:00',
          copyRouteStops: true,
        },
        adminPrincipal,
      );

      // Verify that template stops were copied with calculated thoiGianDuKien
      expect(mockTx.tuyenXeDiemDung.findMany).toHaveBeenCalledWith({
        where: { tuyenXeId: 1 },
        orderBy: [{ phutLech: 'asc' }, { thuTu: 'asc' }],
      });
      expect(createdTripPoints.length).toBe(2);
      expect(createdTripPoints[0].diemDonTraId).toBe(10);
      expect(createdTripPoints[0].phutLech).toBe(-30);
      // 08:00 - 30 minutes = 07:30
      expect(createdTripPoints[0].thoiGianDuKien.toISOString()).toContain('07:30:00');
      expect(res.data.donCount).toBe(1);
      expect(res.data.traCount).toBe(1);
      expect(res.data.thieuDiem).toBe(false);
    });
  });
});
