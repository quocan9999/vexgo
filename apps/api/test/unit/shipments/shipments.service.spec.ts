import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShipmentsService } from '../../../src/shipments/shipments.service.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import type { ConfigService } from '@nestjs/config';

describe('ShipmentsService', () => {
  let service: ShipmentsService;
  let prismaMock: any;
  let configMock: any;

  beforeEach(() => {
    configMock = {
      get: vi.fn().mockReturnValue('Asia/Ho_Chi_Minh'),
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
      loaiHangHoa: {
        findMany: vi.fn(),
      },
      phieuGuiHang: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
        findMany: vi.fn(),
      },
      $transaction: vi.fn(),
    };

    service = new ShipmentsService(
      prismaMock as unknown as PrismaService,
      configMock as unknown as ConfigService,
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
            tenDiem: 'Bến xe Đà Lạt',
            diaChi: 'Đà Lạt',
            trangThai: 'HOAT_DONG',
          },
        },
      ]);

      prismaMock.loaiHangHoa.findMany.mockResolvedValue([
        { loaiHangHoaId: 1, tenLoai: 'BƯU PHẨM', trangThai: 'HOAT_DONG' },
      ]);

      // Mock transaction
      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        const txMock = {
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
      expect(result.pricing.totalFee).toBe(90000);
      expect(result.sender.phoneNumber).toBe('0901234567');
      expect(result.receiver.fullName).toBe('Trần Thị B');
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

