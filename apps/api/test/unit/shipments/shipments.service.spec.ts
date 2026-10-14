import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShipmentsService } from '../../../src/shipments/shipments.service.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import type { ConfigService } from '@nestjs/config';
import { CargoPricingService } from '../../../src/cargo-pricing/cargo-pricing.service.js';

describe('ShipmentsService', () => {
  let service: ShipmentsService;
  let prismaMock: any;
  let configMock: any;
  let cargoCapacityServiceMock: any;

  beforeEach(() => {
    configMock = {
      get: vi.fn().mockReturnValue('Asia/Ho_Chi_Minh'),
    };
    cargoCapacityServiceMock = {
      lockTrip: vi.fn().mockResolvedValue(undefined),
      getSnapshot: vi.fn().mockResolvedValue({
        trip: { chuyenXeId: 1, trangThai: 'CHUA_KHOI_HANH', nhanGuiHang: true },
        capacities: {
          XE_MAY: { total: 100, used: 0, remaining: 100 },
          HANG_CONG_KENH: { total: 100, used: 0, remaining: 100 },
          HANG_NHE: { total: 100, used: 0, remaining: 100 },
        },
      }),
      assertAvailable: vi.fn(),
    };

    prismaMock = {
      chuyenXe: {
        findUnique: vi.fn(),
      },
      diemGiaoNhanTuyenXe: {
        findMany: vi.fn(),
      },
      diemGiaoNhanHang: {
        findFirst: vi.fn(),
      },
      khachHang: {
        findUnique: vi.fn(),
      },
      bangCuocGuiHang: {
        findMany: vi.fn(),
      },
      loaiHangHoa: {
        findMany: vi.fn(),
      },
      phieuGuiHang: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
        findMany: vi.fn(),
      },
      $transaction: vi.fn(async (callback) => callback(prismaMock)),
    };

    service = new ShipmentsService(
      prismaMock as unknown as PrismaService,
      configMock as unknown as ConfigService,
      new CargoPricingService(),
      cargoCapacityServiceMock,
    );
  });

  describe('createShipment', () => {
    it('throws BadRequestException when items array is empty', async () => {
      await expect(
        service.createShipment({
          tripId: 1,
          sender: { fullName: 'Nguyễn Văn A', phoneNumber: '0901234567' },
          receiver: { fullName: 'Trần Thị B', phoneNumber: '0912345678' },
          items: [],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when trip is not found', async () => {
      prismaMock.chuyenXe.findUnique.mockResolvedValue(null);

      await expect(
        service.createShipment({
          tripId: 999,
          sender: { fullName: 'Nguyễn Văn A', phoneNumber: '0901234567' },
          receiver: { fullName: 'Trần Thị B', phoneNumber: '0912345678' },
          items: [{ name: 'Thùng hoa quả', quantity: 1, weight: 5 }],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when trip does not accept cargo', async () => {
      prismaMock.chuyenXe.findUnique.mockResolvedValue({
        chuyenXeId: 1,
        trangThai: 'CHUA_KHOI_HANH',
        nhanGuiHang: false,
        ngayKhoiHanh: new Date('2026-10-20T00:00:00.000Z'),
        gioKhoiHanh: new Date('1970-01-01T07:00:00.000Z'),
        tuyenXe: {
          tuyenXeId: 1,
          diemDi: 'TP.HCM',
          diemDen: 'Đà Lạt',
          nhaXe: { nhaXeId: 1, maNhaXe: 'FUTA', tenNhaXe: 'Phương Trang' },
        },
        xe: { bienSoXe: '51B-12345' },
      });

      await expect(
        service.createShipment({
          tripId: 1,
          sender: { fullName: 'Nguyễn Văn A', phoneNumber: '0901234567' },
          receiver: { fullName: 'Trần Thị B', phoneNumber: '0912345678' },
          items: [{ name: 'Hộp bánh', quantity: 1, weight: 2 }],
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects sender or receiver points that are not active route points for the trip', async () => {
      prismaMock.chuyenXe.findUnique.mockResolvedValue({
        chuyenXeId: 1,
        trangThai: 'CHUA_KHOI_HANH',
        nhanGuiHang: true,
        ngayKhoiHanh: new Date('2026-10-20T00:00:00.000Z'),
        gioKhoiHanh: new Date('1970-01-01T07:00:00.000Z'),
        nhaXeId: 1,
        tuyenXeId: 1,
        tuyenXe: { nhaXe: { maNhaXe: 'FUTA' } },
      });
      prismaMock.diemGiaoNhanTuyenXe.findMany.mockResolvedValue([
        {
          vaiTro: 'GUI_HANG',
          diemGiaoNhanHangId: 1,
          diemGiaoNhanHang: {
            diemGiaoNhanHangId: 1,
            nhaXeId: 1,
            trangThai: 'HOAT_DONG',
          },
        },
        {
          vaiTro: 'NHAN_HANG',
          diemGiaoNhanHangId: 2,
          diemGiaoNhanHang: {
            diemGiaoNhanHangId: 2,
            nhaXeId: 1,
            trangThai: 'HOAT_DONG',
          },
        },
      ]);

      await expect(
        service.createShipment({
          tripId: 1,
          sender: { fullName: 'Nguyễn Văn A', phoneNumber: '0901234567' },
          receiver: { fullName: 'Trần Thị B', phoneNumber: '0912345678' },
          items: [{ name: 'Hộp bánh', quantity: 1, weight: 2 }],
          senderPointId: 99,
          receiverPointId: 2,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('successfully creates shipment with correct pricing calculation in transaction', async () => {
      const trip = {
        chuyenXeId: 1,
        maChuyenXe: 'FUTA-CX-20102026-01',
        trangThai: 'CHUA_KHOI_HANH',
        nhanGuiHang: true,
        ngayKhoiHanh: new Date('2026-10-20T00:00:00.000Z'),
        gioKhoiHanh: new Date('1970-01-01T07:00:00.000Z'),
        nhaXeId: 1,
        tuyenXeId: 1,
        tuyenXe: {
          tuyenXeId: 1,
          diemDi: 'TP.HCM',
          diemDen: 'Đà Lạt',
          nhaXe: { nhaXeId: 1, maNhaXe: 'FUTA', tenNhaXe: 'Phương Trang' },
        },
        xe: { bienSoXe: '51B-12345' },
      };

      prismaMock.chuyenXe.findUnique.mockResolvedValue(trip);
      prismaMock.diemGiaoNhanTuyenXe.findMany.mockResolvedValue([
        {
          vaiTro: 'GUI_HANG',
          diemGiaoNhanHangId: 1,
          diemGiaoNhanHang: {
            diemGiaoNhanHangId: 1,
            nhaXeId: 1,
            tenDiem: 'Bến xe Miền Đông',
            diaChi: 'TP.HCM',
            trangThai: 'HOAT_DONG',
          },
        },
        {
          vaiTro: 'NHAN_HANG',
          diemGiaoNhanHangId: 2,
          diemGiaoNhanHang: {
            diemGiaoNhanHangId: 2,
            nhaXeId: 1,
            tenDiem: 'Bến xe Đà Lạt',
            diaChi: 'Đà Lạt',
            trangThai: 'HOAT_DONG',
          },
        },
      ]);

      prismaMock.loaiHangHoa.findMany.mockResolvedValue([
        {
          loaiHangHoaId: 1,
          tenLoai: 'BƯU PHẨM',
          nhomSucChua: 'HANG_NHE',
          trangThai: 'HOAT_DONG',
        },
      ]);
      prismaMock.bangCuocGuiHang.findMany.mockResolvedValue([
        {
          bangCuocGuiHangId: 55,
          loaiHangHoaId: 1,
          khoiLuongTu: 5,
          khoiLuongDen: 10,
          mucCuoc: 75000,
        },
      ]);

      // Mock transaction
      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        const txMock = {
          diemGiaoNhanTuyenXe: {
            findMany: prismaMock.diemGiaoNhanTuyenXe.findMany,
          },
          loaiHangHoa: { findMany: prismaMock.loaiHangHoa.findMany },
          bangCuocGuiHang: { findMany: prismaMock.bangCuocGuiHang.findMany },
          khachHang: {
            findUnique: vi.fn().mockResolvedValue({ khachHangId: 10 }),
            count: vi.fn().mockResolvedValue(10),
            create: vi.fn().mockResolvedValue({ khachHangId: 10 }),
          },
          taiKhoan: {
            findUnique: vi.fn().mockResolvedValue(null),
            count: vi.fn().mockResolvedValue(5),
            create: vi.fn().mockResolvedValue({ taiKhoanId: 100 }),
          },
          donGiaoDich: {
            count: vi.fn().mockResolvedValue(12),
            create: vi.fn().mockResolvedValue({
              donGiaoDichId: 200,
              maDonGiaoDich: 'FUTA-GD-20102026-0013',
              trangThai: 'CHO_THANH_TOAN',
            }),
          },
          phieuGuiHang: {
            create: vi.fn().mockResolvedValue({
              phieuGuiHangId: 300,
              maVanDon: 'FUTA-VD-20102026-0013',
              ngayGui: new Date('2026-10-09T08:00:00.000Z'),
              cuocChinh: 70000,
              phiDichVu: 20000,
              tongPhi: 90000,
              trangThai: 'MOI_TAO',
              ghiChu: 'Hàng dễ vỡ xin nhẹ tay',
              diemGui: {
                diemGiaoNhanHangId: 1,
                tenDiem: 'Bến xe Miền Đông',
                diaChi: 'TP.HCM',
              },
              diemNhan: {
                diemGiaoNhanHangId: 2,
                tenDiem: 'Bến xe Đà Lạt',
                diaChi: 'Đà Lạt',
              },
              chuyenXe: trip,
            }),
          },
          hangHoa: {
            create: vi.fn().mockResolvedValue({
              hangHoaId: 400,
              tenHang: 'Bình gốm sứ',
              soLuong: 1,
              khoiLuong: 7,
              loaiHangHoa: { tenLoai: 'BƯU PHẨM' },
            }),
          },
          lichSuTrangThaiPhieuGuiHang: {
            create: vi.fn().mockResolvedValue({}),
          },
          chiTietCuocGuiHang: {
            create: vi.fn().mockResolvedValue({}),
          },
        };
        return callback(txMock);
      });

      const result = await service.createShipment({
        tripId: 1,
        sender: { fullName: 'Nguyễn Văn A', phoneNumber: '0901234567' },
        receiver: { fullName: 'Trần Thị B', phoneNumber: '0912345678' },
        items: [{ name: 'Bình gốm sứ', quantity: 1, weight: 7 }],
        isFragile: true,
        note: 'Hàng dễ vỡ xin nhẹ tay',
      });

      expect(result).toBeDefined();
      expect(result.waybillCode).toBe('FUTA-VD-20102026-0013');
      expect(result.pricing.totalFee).toBe(95000);
      expect(result.sender.phoneNumber).toBe('0901234567');
      expect(result.receiver.fullName).toBe('Trần Thị B');
      expect(prismaMock.bangCuocGuiHang.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            diemGuiId: 1,
            diemNhanId: 2,
            trangThai: 'HOAT_DONG',
          }),
        }),
      );
    });

    it('fails instead of selecting a rate from another weight bracket', async () => {
      prismaMock.chuyenXe.findUnique.mockResolvedValue({
        chuyenXeId: 1,
        trangThai: 'CHUA_KHOI_HANH',
        nhanGuiHang: true,
        ngayKhoiHanh: new Date('2026-10-20T00:00:00.000Z'),
        gioKhoiHanh: new Date('1970-01-01T07:00:00.000Z'),
        nhaXeId: 1,
        tuyenXeId: 1,
        tuyenXe: { nhaXe: { maNhaXe: 'FUTA' } },
      });
      prismaMock.diemGiaoNhanTuyenXe.findMany.mockResolvedValue([
        { vaiTro: 'GUI_HANG', diemGiaoNhanHangId: 1, diemGiaoNhanHang: { diemGiaoNhanHangId: 1, nhaXeId: 1, trangThai: 'HOAT_DONG' } },
        { vaiTro: 'NHAN_HANG', diemGiaoNhanHangId: 2, diemGiaoNhanHang: { diemGiaoNhanHangId: 2, nhaXeId: 1, trangThai: 'HOAT_DONG' } },
      ]);
      prismaMock.loaiHangHoa.findMany.mockResolvedValue([
        { loaiHangHoaId: 1, tenLoai: 'BƯU PHẨM', nhomSucChua: 'HANG_NHE', trangThai: 'HOAT_DONG' },
      ]);
      prismaMock.bangCuocGuiHang.findMany.mockResolvedValue([
        { bangCuocGuiHangId: 55, loaiHangHoaId: 1, khoiLuongTu: 1, khoiLuongDen: 5, mucCuoc: 50000 },
      ]);

      await expect(
        service.createShipment({
          tripId: 1,
          sender: { fullName: 'Nguyễn Văn A', phoneNumber: '0901234567' },
          receiver: { fullName: 'Trần Thị B', phoneNumber: '0912345678' },
          items: [{ name: 'Hộp bánh', quantity: 1, weight: 7 }],
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('shipment access', () => {
    it('rejects anonymous detail reads before querying shipment data', async () => {
      await expect(service.getShipmentDetail(12)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prismaMock.phieuGuiHang.findUnique).not.toHaveBeenCalled();
    });

    it('rejects anonymous list reads before querying shipment data', async () => {
      await expect(service.listShipments({} as any)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prismaMock.phieuGuiHang.findMany).not.toHaveBeenCalled();
      expect(prismaMock.phieuGuiHang.count).not.toHaveBeenCalled();
    });

    it('does not let one customer read another customer shipment detail', async () => {
      prismaMock.phieuGuiHang.findUnique.mockResolvedValue({
        phieuGuiHangId: 12,
        chuyenXe: { nhaXeId: 1 },
        donGiaoDich: { khachHangId: 88 },
      });
      prismaMock.khachHang.findUnique.mockResolvedValue({ khachHangId: 10 });

      await expect(
        service.getShipmentDetail(12, {
          taiKhoanId: 7,
          roles: ['KHACH_HANG'],
        } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('does not let a tenant read another operator shipment detail', async () => {
      prismaMock.phieuGuiHang.findUnique.mockResolvedValue({
        phieuGuiHangId: 12,
        chuyenXe: { nhaXeId: 1 },
        donGiaoDich: { khachHangId: 88 },
      });

      await expect(
        service.getShipmentDetail(12, {
          taiKhoanId: 7,
          nhaXeId: 2,
          roles: ['NHA_XE_ADMIN'],
        } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('scopes customer shipment lists to the linked customer profile', async () => {
      prismaMock.khachHang.findUnique.mockResolvedValue({ khachHangId: 10 });
      prismaMock.phieuGuiHang.count.mockResolvedValue(0);
      prismaMock.phieuGuiHang.findMany.mockResolvedValue([]);

      await service.listShipments({} as any, {
        taiKhoanId: 7,
        roles: ['KHACH_HANG'],
      } as any);

      expect(prismaMock.phieuGuiHang.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [{ donGiaoDich: { khachHangId: 10 } }],
          },
        }),
      );
    });

    it('scopes tenant shipment lists to the operator company', async () => {
      prismaMock.phieuGuiHang.count.mockResolvedValue(0);
      prismaMock.phieuGuiHang.findMany.mockResolvedValue([]);

      await service.listShipments({} as any, {
        taiKhoanId: 7,
        nhaXeId: 2,
        roles: ['NHA_XE_ADMIN'],
      } as any);

      expect(prismaMock.phieuGuiHang.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [{ chuyenXe: { nhaXeId: 2 } }],
          },
        }),
      );
    });

    it('does not let a customer list shipments when no customer profile is linked', async () => {
      prismaMock.khachHang.findUnique.mockResolvedValue(null);

      await expect(
        service.listShipments(
          {} as any,
          { taiKhoanId: 7, roles: ['KHACH_HANG'] } as any,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(prismaMock.phieuGuiHang.findMany).not.toHaveBeenCalled();
    });
  });

  describe('lookupShipment', () => {
    it('throws NotFoundException when waybill code not found', async () => {
      prismaMock.phieuGuiHang.findFirst.mockResolvedValue(null);

      await expect(
        service.lookupShipment({
          waybillCode: 'NON_EXISTENT_CODE',
          phoneNumber: '0901234567',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when phone number does not match sender or receiver', async () => {
      prismaMock.phieuGuiHang.findFirst.mockResolvedValue({
        phieuGuiHangId: 1,
        maVanDon: 'FUTA-VD-001',
        soDienThoaiNguoiNhan: '0988888888',
        donGiaoDich: {
          soDienThoaiKhachHang: '0977777777',
        },
      });

      await expect(
        service.lookupShipment({
          waybillCode: 'FUTA-VD-001',
          phoneNumber: '0900000000',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getRoutePoints', () => {
    it('returns only active route points owned by the trip company and matching each role', async () => {
      prismaMock.chuyenXe.findUnique.mockResolvedValue({
        chuyenXeId: 12,
        tuyenXeId: 22,
        nhaXeId: 33,
        nhanGuiHang: true,
      });
      prismaMock.diemGiaoNhanTuyenXe.findMany.mockResolvedValue([
        {
          vaiTro: 'GUI_HANG',
          diemGiaoNhanHangId: 101,
          diemGiaoNhanHang: {
            tenDiem: 'Điểm gửi A',
            diaChi: 'Địa chỉ A',
            nhaXeId: 33,
            trangThai: 'HOAT_DONG',
          },
        },
        {
          vaiTro: 'NHAN_HANG',
          diemGiaoNhanHangId: 102,
          diemGiaoNhanHang: {
            tenDiem: 'Điểm nhận B',
            diaChi: 'Địa chỉ B',
            nhaXeId: 33,
            trangThai: 'HOAT_DONG',
          },
        },
        {
          vaiTro: 'CA_HAI',
          diemGiaoNhanHangId: 103,
          diemGiaoNhanHang: {
            tenDiem: 'Điểm chung',
            diaChi: 'Địa chỉ chung',
            nhaXeId: 33,
            trangThai: 'HOAT_DONG',
          },
        },
        {
          vaiTro: 'GUI_HANG',
          diemGiaoNhanHangId: 104,
          diemGiaoNhanHang: {
            tenDiem: 'Điểm đã ngừng',
            diaChi: 'Địa chỉ cũ',
            nhaXeId: 33,
            trangThai: 'NGUNG_HOAT_DONG',
          },
        },
      ]);

      const result = await service.getRoutePoints(12);

      expect(prismaMock.chuyenXe.findUnique).toHaveBeenCalledWith({
        where: { chuyenXeId: 12 },
        select: {
          chuyenXeId: true,
          tuyenXeId: true,
          nhaXeId: true,
          nhanGuiHang: true,
        },
      });
      expect(prismaMock.diemGiaoNhanTuyenXe.findMany).toHaveBeenCalledWith({
        where: {
          tuyenXeId: 22,
          diemGiaoNhanHang: { nhaXeId: 33, trangThai: 'HOAT_DONG' },
        },
        include: { diemGiaoNhanHang: true },
        orderBy: { diemGiaoNhanHangId: 'asc' },
      });
      expect(result.senderPoints.map((point) => point.id)).toEqual([101, 103]);
      expect(result.receiverPoints.map((point) => point.id)).toEqual([102, 103]);
      expect(result.senderPoints[0]).toEqual({
        id: 101,
        name: 'Điểm gửi A',
        address: 'Địa chỉ A',
      });
    });

    it('rejects a nonexistent trip instead of exposing unrelated route points', async () => {
      prismaMock.chuyenXe.findUnique.mockResolvedValue(null);

      await expect(service.getRoutePoints(999)).rejects.toMatchObject({
        response: { error: 'TRIP_NOT_FOUND' },
      });
      expect(prismaMock.diemGiaoNhanTuyenXe.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getCargoCategories', () => {
    it('returns list of active cargo categories with mapped fields', async () => {
      prismaMock.loaiHangHoa.findMany.mockResolvedValue([
        {
          loaiHangHoaId: 1,
          tenLoai: 'BƯU PHẨM',
          moTa: 'Bưu phẩm đóng gói thông thường',
          nhomSucChua: 'HANG_NHE',
          trangThai: 'HOAT_DONG',
        },
        {
          loaiHangHoaId: 2,
          tenLoai: 'THỰC PHẨM',
          moTa: null,
          nhomSucChua: 'HANG_NHE',
          trangThai: 'HOAT_DONG',
        },
      ]);

      const result = await service.getCargoCategories();

      expect(prismaMock.loaiHangHoa.findMany).toHaveBeenCalledWith({
        where: { trangThai: 'HOAT_DONG' },
        orderBy: { loaiHangHoaId: 'asc' },
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        categoryId: 1,
        name: 'BƯU PHẨM',
        description: 'Bưu phẩm đóng gói thông thường',
        capacityGroup: 'HANG_NHE',
      });
      expect(result[1].description).toBe('');
    });
  });
});

