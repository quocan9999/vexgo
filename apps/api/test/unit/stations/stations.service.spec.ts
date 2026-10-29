import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { Reflector } from '@nestjs/core';
import { StationsService } from '../../../src/stations/stations.service.js';
import { StationsController } from '../../../src/stations/stations.controller.js';
import { AuthorizationGuard } from '../../../src/auth/guards/authorization.guard.js';
import { CreateStationDto } from '../../../src/stations/dto/create-station.dto.js';
import { UpdateStationDto } from '../../../src/stations/dto/update-station.dto.js';
import { StationQueryDto } from '../../../src/stations/dto/station-query.dto.js';
import { TripPassengerPointItemDto } from '../../../src/stations/dto/trip-passenger-points.dto.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';

describe('StationsService', () => {
  it('automatically resolves diaDiemMoiId from BangSapNhapDiaDiem when creating a station', async () => {
    const mockPrisma = {
      danhMucDiaDiem: {
        findUnique: vi.fn().mockResolvedValue({
          diaDiemId: 77,
          tenDiaDiem: 'Bà Rịa - Vũng Tàu',
          laDiaDanhCu: true,
          capDiaDiem: 'TINH_THANH',
        }),
      },
      bangSapNhapDiaDiem: {
        findFirst: vi.fn().mockResolvedValue({
          diaDiemMoiId: 28, // TP.HCM mới
          diaDiemCuId: 77, // Bà Rịa - Vũng Tàu cũ
        }),
      },
      diemDonTra: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({
          diemDonTraId: 1,
          ...data,
        })),
      },
    } as unknown as PrismaService;

    const service = new StationsService(mockPrisma);
    const principal: AuthPrincipal = {
      taiKhoanId: 1,
      sessionId: 'test-session',
      roles: ['NHA_XE_ADMIN'],
      permissions: [],
      nhanVienId: 1,
      nhaXeId: 5,
    };

    const result = await service.create(
      {
        maDiem: 'BX-VT',
        tenDiem: 'Bến xe Vũng Tàu',
        loaiDiem: 'BEN_XE',
        diaChi: '192 Nam Kỳ Khởi Nghĩa, Vũng Tàu',
        diaDiemCuId: 77, // Admin only chooses old location!
      },
      principal,
    );

    // Verify diaDiemMoiId was automatically filled
    expect(result.data.diaDiemCuId).toBe(77);
    expect(result.data.diaDiemMoiId).toBe(28);
    expect(result.data.nhaXeId).toBe(5);
    expect(mockPrisma.bangSapNhapDiaDiem.findFirst).toHaveBeenCalledWith({
      where: { diaDiemCuId: 77 },
    });
  });

  it('automatically updates diaDiemMoiId when diaDiemCuId is updated', async () => {
    const mockPrisma = {
      danhMucDiaDiem: {
        findUnique: vi.fn().mockResolvedValue({
          diaDiemId: 68,
          tenDiaDiem: 'Lâm Đồng',
          laDiaDanhCu: true,
          capDiaDiem: 'TINH_THANH',
        }),
      },
      diemDonTra: {
        findUnique: vi.fn().mockResolvedValue({
          diemDonTraId: 1,
          nhaXeId: 5,
          diaDiemCuId: 77,
          diaDiemMoiId: 28,
        }),
        update: vi.fn().mockImplementation(({ data }) => Promise.resolve({
          diemDonTraId: 1,
          ...data,
        })),
      },
      bangSapNhapDiaDiem: {
        findFirst: vi.fn().mockResolvedValue({
          diaDiemMoiId: 30, // Lâm Đồng mới
          diaDiemCuId: 68, // Lâm Đồng cũ
        }),
      },
    } as unknown as PrismaService;

    const service = new StationsService(mockPrisma);
    const principal: AuthPrincipal = {
      taiKhoanId: 1,
      sessionId: 'test-session',
      roles: ['NHA_XE_ADMIN'],
      permissions: [],
      nhanVienId: 1,
      nhaXeId: 5,
    };

    const result = await service.update(
      1,
      {
        diaDiemCuId: 68, // Change to Lâm Đồng cũ
      },
      principal,
    );

    expect(result.data.diaDiemCuId).toBe(68);
    expect(result.data.diaDiemMoiId).toBe(30);
  });

  it('throws BadRequestException if chosen diaDiemCuId is a new province', async () => {
    const mockPrisma = {
      danhMucDiaDiem: {
        findUnique: vi.fn().mockResolvedValue({
          diaDiemId: 28,
          tenDiaDiem: 'TP. Hồ Chí Minh (mới)',
          laDiaDanhCu: false, // NOT a legacy location!
          capDiaDiem: 'TINH_THANH',
        }),
      },
    } as unknown as PrismaService;

    const service = new StationsService(mockPrisma);
    const principal: AuthPrincipal = {
      taiKhoanId: 1,
      sessionId: 'test-session',
      roles: ['NHA_XE_ADMIN'],
      permissions: [],
      nhanVienId: 1,
      nhaXeId: 5,
    };

    await expect(
      service.create(
        {
          maDiem: 'BX-TEST',
          tenDiem: 'Bến xe Test',
          loaiDiem: 'BEN_XE',
          diaChi: 'Test',
          diaDiemCuId: 28,
        },
        principal,
      ),
    ).rejects.toThrowError(/laDiaDanhCu = true/i);
  });

  it('throws BadRequestException if chosen diaDiemCuId is a district', async () => {
    const mockPrisma = {
      danhMucDiaDiem: {
        findUnique: vi.fn().mockResolvedValue({
          diaDiemId: 7701,
          tenDiaDiem: 'Vũng Tàu',
          laDiaDanhCu: true,
          capDiaDiem: 'QUAN_HUYEN', // District, not province!
        }),
      },
    } as unknown as PrismaService;

    const service = new StationsService(mockPrisma);
    const principal: AuthPrincipal = {
      taiKhoanId: 1,
      sessionId: 'test-session',
      roles: ['NHA_XE_ADMIN'],
      permissions: [],
      nhanVienId: 1,
      nhaXeId: 5,
    };

    await expect(
      service.create(
        {
          maDiem: 'BX-TEST',
          tenDiem: 'Bến xe Test',
          loaiDiem: 'BEN_XE',
          diaChi: 'Test',
          diaDiemCuId: 7701,
        },
        principal,
      ),
    ).rejects.toThrowError(/capDiaDiem = TINH_THANH/i);
  });

  it('throws BadRequestException if chosen legacy province has no mapping in BangSapNhapDiaDiem', async () => {
    const mockPrisma = {
      danhMucDiaDiem: {
        findUnique: vi.fn().mockResolvedValue({
          diaDiemId: 99,
          tenDiaDiem: 'Tỉnh Chưa Biết',
          laDiaDanhCu: true,
          capDiaDiem: 'TINH_THANH',
        }),
      },
      bangSapNhapDiaDiem: {
        findFirst: vi.fn().mockResolvedValue(null), // No mapping!
      },
    } as unknown as PrismaService;

    const service = new StationsService(mockPrisma);
    const principal: AuthPrincipal = {
      taiKhoanId: 1,
      sessionId: 'test-session',
      roles: ['NHA_XE_ADMIN'],
      permissions: [],
      nhanVienId: 1,
      nhaXeId: 5,
    };

    await expect(
      service.create(
        {
          maDiem: 'BX-TEST',
          tenDiem: 'Bến xe Test',
          loaiDiem: 'BEN_XE',
          diaChi: 'Test',
          diaDiemCuId: 99,
        },
        principal,
      ),
    ).rejects.toThrowError(/chưa có thông tin tỉnh sáp nhập tương ứng/i);
  });

  it('ignores client-sent diaDiemMoiId in create and always uses resolved mapping', async () => {
    const mockPrisma = {
      danhMucDiaDiem: {
        findUnique: vi.fn().mockResolvedValue({
          diaDiemId: 77,
          tenDiaDiem: 'Bà Rịa - Vũng Tàu',
          laDiaDanhCu: true,
          capDiaDiem: 'TINH_THANH',
        }),
      },
      bangSapNhapDiaDiem: {
        findFirst: vi.fn().mockResolvedValue({
          diaDiemMoiId: 28, // Actual mapping
          diaDiemCuId: 77,
        }),
      },
      diemDonTra: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({
          diemDonTraId: 1,
          ...data,
        })),
      },
    } as unknown as PrismaService;

    const service = new StationsService(mockPrisma);
    const principal: AuthPrincipal = {
      taiKhoanId: 1,
      sessionId: 'test-session',
      roles: ['NHA_XE_ADMIN'],
      permissions: [],
      nhanVienId: 1,
      nhaXeId: 5,
    };

    const result = await service.create(
      {
        maDiem: 'BX-VT',
        tenDiem: 'Bến xe Vũng Tàu',
        loaiDiem: 'BEN_XE',
        diaChi: '192 Nam Kỳ Khởi Nghĩa',
        diaDiemCuId: 77,
        ...( { diaDiemMoiId: 9999 } as any ), // Spoofed value by client
      },
      principal,
    );

    expect(result.data.diaDiemMoiId).toBe(28);
  });

  it('ignores client-sent diaDiemMoiId in update and uses resolved mapping', async () => {
    const mockPrisma = {
      danhMucDiaDiem: {
        findUnique: vi.fn().mockResolvedValue({
          diaDiemId: 68,
          tenDiaDiem: 'Lâm Đồng',
          laDiaDanhCu: true,
          capDiaDiem: 'TINH_THANH',
        }),
      },
      diemDonTra: {
        findUnique: vi.fn().mockResolvedValue({
          diemDonTraId: 1,
          nhaXeId: 5,
          diaDiemCuId: 77,
          diaDiemMoiId: 28,
        }),
        update: vi.fn().mockImplementation(({ data }) => Promise.resolve({
          diemDonTraId: 1,
          ...data,
        })),
      },
      bangSapNhapDiaDiem: {
        findFirst: vi.fn().mockResolvedValue({
          diaDiemMoiId: 30, // Correct mapping
          diaDiemCuId: 68,
        }),
      },
    } as unknown as PrismaService;

    const service = new StationsService(mockPrisma);
    const principal: AuthPrincipal = {
      taiKhoanId: 1,
      sessionId: 'test-session',
      roles: ['NHA_XE_ADMIN'],
      permissions: [],
      nhanVienId: 1,
      nhaXeId: 5,
    };

    const result = await service.update(
      1,
      {
        diaDiemCuId: 68,
        ...( { diaDiemMoiId: 9999 } as any ), // Spoofed value by client
      },
      principal,
    );

    expect(result.data.diaDiemMoiId).toBe(30);
  });

  it('does not allow updating nhaXeId in update()', async () => {
    let updateDataPassed: any = null;
    const mockPrisma = {
      diemDonTra: {
        findUnique: vi.fn().mockResolvedValue({
          diemDonTraId: 1,
          nhaXeId: 5,
          diaDiemCuId: 77,
          diaDiemMoiId: 28,
        }),
        update: vi.fn().mockImplementation(({ data }) => {
          updateDataPassed = data;
          return Promise.resolve({ diemDonTraId: 1, nhaXeId: 5, ...data });
        }),
      },
    } as unknown as PrismaService;

    const service = new StationsService(mockPrisma);
    const principal: AuthPrincipal = {
      taiKhoanId: 1,
      sessionId: 'test-session',
      roles: ['NHA_XE_ADMIN'],
      permissions: [],
      nhanVienId: 1,
      nhaXeId: 5,
    };

    await service.update(
      1,
      {
        tenDiem: 'Tên Mới',
        ...( { nhaXeId: 999 } as any ), // Attempt to change company
      },
      principal,
    );

    expect(updateDataPassed.nhaXeId).toBeUndefined();
  });

  it('throws ConflictException on P2002 when creating station with duplicate maDiem', async () => {
    const mockPrisma = {
      danhMucDiaDiem: {
        findUnique: vi.fn().mockResolvedValue({
          diaDiemId: 77,
          tenDiaDiem: 'Bà Rịa - Vũng Tàu',
          laDiaDanhCu: true,
          capDiaDiem: 'TINH_THANH',
        }),
      },
      bangSapNhapDiaDiem: {
        findFirst: vi.fn().mockResolvedValue({ diaDiemMoiId: 28, diaDiemCuId: 77 }),
      },
      diemDonTra: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockRejectedValue({ code: 'P2002' }),
      },
    } as unknown as PrismaService;

    const service = new StationsService(mockPrisma);
    const principal: AuthPrincipal = {
      taiKhoanId: 1,
      sessionId: 'test-session',
      roles: ['NHA_XE_ADMIN'],
      permissions: [],
      nhanVienId: 1,
      nhaXeId: 5,
    };

    await expect(
      service.create(
        {
          maDiem: 'BX-VT',
          tenDiem: 'Bến xe Vũng Tàu',
          loaiDiem: 'BEN_XE',
          diaChi: '192 Nam Kỳ Khởi Nghĩa',
          diaDiemCuId: 77,
        },
        principal,
      ),
    ).rejects.toThrowError(/đã tồn tại trong nhà xe này/i);
  });

  it('throws ConflictException on P2002 when updating station with duplicate maDiem', async () => {
    const mockPrisma = {
      diemDonTra: {
        findUnique: vi.fn().mockResolvedValue({
          diemDonTraId: 1,
          nhaXeId: 5,
        }),
        update: vi.fn().mockRejectedValue({ code: 'P2002' }),
      },
    } as unknown as PrismaService;

    const service = new StationsService(mockPrisma);
    const principal: AuthPrincipal = {
      taiKhoanId: 1,
      sessionId: 'test-session',
      roles: ['NHA_XE_ADMIN'],
      permissions: [],
      nhanVienId: 1,
      nhaXeId: 5,
    };

    await expect(
      service.update(1, { maDiem: 'BX-DUPLICATE' }, principal),
    ).rejects.toThrowError(/đã tồn tại trong nhà xe này/i);
  });

  it('blocks passenger point if station does not exist (STATION_NOT_FOUND)', async () => {
    const mockPrisma = {
      chuyenXe: {
        findUnique: vi.fn().mockResolvedValue({
          chuyenXeId: 1,
          nhaXeId: 5,
        }),
      },
      diemDonTra: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as unknown as PrismaService;

    const service = new StationsService(mockPrisma);
    const principal: AuthPrincipal = {
      taiKhoanId: 1,
      sessionId: 'test-session',
      roles: ['NHA_XE_ADMIN'],
      permissions: [],
      nhanVienId: 1,
      nhaXeId: 5,
    };

    await expect(
      service.updateTripPassengerPoints(
        1,
        {
          points: [{ diemDonTraId: 999, loaiDiem: 'DON', thuTu: 1 }],
        },
        principal,
      ),
    ).rejects.toThrowError(/Không tìm thấy điểm đón\/trả #999/i);
  });

  it('blocks passenger point if station is NGUNG_HOAT_DONG (STATION_INACTIVE)', async () => {
    const mockPrisma = {
      chuyenXe: {
        findUnique: vi.fn().mockResolvedValue({
          chuyenXeId: 1,
          nhaXeId: 5,
        }),
      },
      diemDonTra: {
        findMany: vi.fn().mockResolvedValue([
          { diemDonTraId: 10, trangThai: 'NGUNG_HOAT_DONG', nhaXeId: 5 },
        ]),
      },
    } as unknown as PrismaService;

    const service = new StationsService(mockPrisma);
    const principal: AuthPrincipal = {
      taiKhoanId: 1,
      sessionId: 'test-session',
      roles: ['NHA_XE_ADMIN'],
      permissions: [],
      nhanVienId: 1,
      nhaXeId: 5,
    };

    await expect(
      service.updateTripPassengerPoints(
        1,
        {
          points: [{ diemDonTraId: 10, loaiDiem: 'DON', thuTu: 1 }],
        },
        principal,
      ),
    ).rejects.toThrowError(/đang ngưng hoạt động hoặc không khả dụng/i);
  });

  it('blocks passenger point if station belongs to another company (STATION_TENANT_MISMATCH)', async () => {
    const mockPrisma = {
      chuyenXe: {
        findUnique: vi.fn().mockResolvedValue({
          chuyenXeId: 1,
          nhaXeId: 5,
        }),
      },
      diemDonTra: {
        findMany: vi.fn().mockResolvedValue([
          { diemDonTraId: 10, trangThai: 'HOAT_DONG', nhaXeId: 99 },
        ]),
      },
    } as unknown as PrismaService;

    const service = new StationsService(mockPrisma);
    const principal: AuthPrincipal = {
      taiKhoanId: 1,
      sessionId: 'test-session',
      roles: ['NHA_XE_ADMIN'],
      permissions: [],
      nhanVienId: 1,
      nhaXeId: 5,
    };

    await expect(
      service.updateTripPassengerPoints(
        1,
        {
          points: [{ diemDonTraId: 10, loaiDiem: 'DON', thuTu: 1 }],
        },
        principal,
      ),
    ).rejects.toThrowError(/không thuộc nhà xe của chuyến xe này/i);
  });

  it('throws BadRequestException when SUPER_ADMIN creates station without providing nhaXeId', async () => {
    const mockPrisma = {} as PrismaService;
    const service = new StationsService(mockPrisma);
    const principal: AuthPrincipal = {
      taiKhoanId: 1,
      sessionId: 'test-session',
      roles: ['SUPER_ADMIN'],
      permissions: [],
      nhanVienId: null,
      nhaXeId: null,
    };

    await expect(
      service.create(
        {
          maDiem: 'BX-TEST',
          tenDiem: 'Bến xe Test',
          loaiDiem: 'BEN_XE',
          diaChi: 'Test',
          diaDiemCuId: 77,
        },
        principal,
      ),
    ).rejects.toThrowError(/Yêu cầu chọn nhà xe \(nhaXeId\)/i);
  });

  describe('list() and findById() status filtering', () => {
    it('filters by trangThai for admin when provided, and returns all when not provided', async () => {
      let whereCaptured: any = null;
      const mockPrisma = {
        diemDonTra: {
          count: vi.fn().mockResolvedValue(2),
          findMany: vi.fn().mockImplementation(({ where }) => {
            whereCaptured = where;
            return Promise.resolve([]);
          }),
        },
      } as unknown as PrismaService;

      const service = new StationsService(mockPrisma);
      const adminPrincipal: AuthPrincipal = {
        taiKhoanId: 1,
        sessionId: 'session-1',
        roles: ['NHA_XE_ADMIN'],
        permissions: ['route:read'],
        nhanVienId: 1,
        nhaXeId: 5,
      };

      // 1. Admin without filter -> no trangThai in where
      await service.list({}, adminPrincipal);
      expect(whereCaptured.nhaXeId).toBe(5);
      expect(whereCaptured.trangThai).toBeUndefined();

      // 2. Admin with HOAT_DONG filter
      await service.list({ trangThai: 'HOAT_DONG' }, adminPrincipal);
      expect(whereCaptured.trangThai).toBe('HOAT_DONG');

      // 3. Admin with NGUNG_HOAT_DONG filter
      await service.list({ trangThai: 'NGUNG_HOAT_DONG' }, adminPrincipal);
      expect(whereCaptured.trangThai).toBe('NGUNG_HOAT_DONG');
    });

    it('forces trangThai = HOAT_DONG for guest callers even if they send NGUNG_HOAT_DONG', async () => {
      let whereCaptured: any = null;
      const mockPrisma = {
        diemDonTra: {
          count: vi.fn().mockResolvedValue(0),
          findMany: vi.fn().mockImplementation(({ where }) => {
            whereCaptured = where;
            return Promise.resolve([]);
          }),
        },
      } as unknown as PrismaService;

      const service = new StationsService(mockPrisma);

      // 1. Unauthenticated guest
      await service.list({ trangThai: 'NGUNG_HOAT_DONG' }, undefined);
      expect(whereCaptured.trangThai).toBe('HOAT_DONG');

      // 2. Customer role
      const customerPrincipal: AuthPrincipal = {
        taiKhoanId: 2,
        sessionId: 'session-2',
        roles: ['KHACH_HANG'],
        permissions: [],
        nhanVienId: null,
        nhaXeId: null,
      };
      await service.list({ trangThai: 'NGUNG_HOAT_DONG' }, customerPrincipal);
      expect(whereCaptured.trangThai).toBe('HOAT_DONG');
    });

    it('findById throws 404 for NGUNG_HOAT_DONG station when caller is guest, but allows admin', async () => {
      const mockPrisma = {
        diemDonTra: {
          findUnique: vi.fn().mockResolvedValue({
            diemDonTraId: 1,
            nhaXeId: 5,
            trangThai: 'NGUNG_HOAT_DONG',
          }),
        },
      } as unknown as PrismaService;

      const service = new StationsService(mockPrisma);

      // Guest -> 404
      await expect(service.findById(1, undefined)).rejects.toThrowError(/Không tìm thấy điểm đón\/trả/i);

      // Admin of same company -> succeeds
      const adminPrincipal: AuthPrincipal = {
        taiKhoanId: 1,
        sessionId: 'session-1',
        roles: ['NHA_XE_ADMIN'],
        permissions: ['route:read'],
        nhanVienId: 1,
        nhaXeId: 5,
      };
      const result = await service.findById(1, adminPrincipal);
      expect(result.data.diemDonTraId).toBe(1);
    });
  });

  describe('getTripPassengerPointsForAdmin and getTripPassengerPointsPublic', () => {
    it('getTripPassengerPointsForAdmin denies admin of NhaXe A viewing trip of NhaXe B (403), allows SUPER_ADMIN', async () => {
      const mockPrisma = {
        chuyenXe: {
          findUnique: vi.fn().mockResolvedValue({
            chuyenXeId: 100,
            nhaXeId: 10, // Trip belongs to tenant 10
          }),
        },
        diemDonTraChuyenXe: {
          findMany: vi.fn().mockResolvedValue([
            { diemDonTraChuyenXeId: 1, chuyenXeId: 100, diemDonTraId: 1 },
          ]),
        },
      } as unknown as PrismaService;

      const service = new StationsService(mockPrisma);

      const adminNhaXeA: AuthPrincipal = {
        taiKhoanId: 1,
        sessionId: 'session-1',
        roles: ['NHA_XE_ADMIN'],
        permissions: ['trip:read'],
        nhanVienId: 1,
        nhaXeId: 5, // NhaXe 5
      };

      // NhaXe A -> 403 Forbidden
      await expect(
        service.getTripPassengerPointsForAdmin(100, adminNhaXeA),
      ).rejects.toThrowError(/Không có quyền xem điểm đón\/trả chuyến xe của nhà xe khác/i);

      // SUPER_ADMIN -> Allowed
      const superAdmin: AuthPrincipal = {
        taiKhoanId: 99,
        sessionId: 'session-99',
        roles: ['SUPER_ADMIN'],
        permissions: [],
        nhanVienId: null,
        nhaXeId: null,
      };
      const result = await service.getTripPassengerPointsForAdmin(100, superAdmin);
      expect(result.data).toHaveLength(1);
    });

    it('getTripPassengerPointsPublic only returns HOAT_DONG stations and strips internal tenant fields', async () => {
      let queryCaptured: any = null;
      const mockPrisma = {
        chuyenXe: {
          findUnique: vi.fn().mockResolvedValue({
            chuyenXeId: 100,
            nhaXeId: 10,
          }),
        },
        diemDonTraChuyenXe: {
          findMany: vi.fn().mockImplementation(({ where }) => {
            queryCaptured = where;
            return Promise.resolve([
              {
                diemDonTraChuyenXeId: 1,
                chuyenXeId: 100,
                diemDonTraId: 50,
                loaiDiem: 'DON',
                thoiGianDuKien: new Date('1970-01-01T08:00:00.000Z'),
                thuTu: 1,
                phuPhi: 0,
                diemDonTra: {
                  diemDonTraId: 50,
                  maDiem: 'BX-ACTIVE',
                  tenDiem: 'Bến xe Hoạt Động',
                  loaiDiem: 'BEN_XE',
                  diaChi: '123 Đường A',
                  viDo: 10.5,
                  kinhDo: 106.5,
                  nhaXeId: 10,
                  soDienThoai: '0901234567',
                  trangThai: 'HOAT_DONG',
                  diaDiemCu: { tenDiaDiem: 'Hồ Chí Minh' },
                  diaDiemMoi: { tenDiaDiem: 'TP. Hồ Chí Minh' },
                },
              },
            ]);
          }),
        },
      } as unknown as PrismaService;

      const service = new StationsService(mockPrisma);
      const res = await service.getTripPassengerPointsPublic(100);

      expect(queryCaptured.diemDonTra.trangThai).toBe('HOAT_DONG');
      expect(res.data).toHaveLength(1);
      const item = res.data[0];
      expect(item.diemDonTra.tenDiem).toBe('Bến xe Hoạt Động');
      // Verify internal fields are omitted
      expect((item.diemDonTra as any).nhaXeId).toBeUndefined();
      expect((item.diemDonTra as any).soDienThoai).toBeUndefined();
      expect((item.diemDonTra as any).trangThai).toBeUndefined();
    });
  });
});

describe('Stations DTO Validation', () => {
  it('validates thoiGianDuKien in TripPassengerPointItemDto for valid and invalid formats', async () => {
    const valid1 = plainToInstance(TripPassengerPointItemDto, {
      diemDonTraId: 1,
      loaiDiem: 'DON',
      thuTu: 1,
      thoiGianDuKien: '08:30',
    });
    expect(await validate(valid1)).toHaveLength(0);

    const valid2 = plainToInstance(TripPassengerPointItemDto, {
      diemDonTraId: 1,
      loaiDiem: 'TRA',
      thuTu: 2,
      thoiGianDuKien: '17:45:00',
    });
    expect(await validate(valid2)).toHaveLength(0);

    const invalid1 = plainToInstance(TripPassengerPointItemDto, {
      diemDonTraId: 1,
      loaiDiem: 'DON',
      thuTu: 1,
      thoiGianDuKien: 'invalid-time',
    });
    const errors1 = await validate(invalid1);
    expect(errors1.length).toBeGreaterThan(0);
    expect(errors1[0].property).toBe('thoiGianDuKien');

    const invalid2 = plainToInstance(TripPassengerPointItemDto, {
      diemDonTraId: 1,
      loaiDiem: 'DON',
      thuTu: 1,
      thoiGianDuKien: '25:00',
    });
    const errors2 = await validate(invalid2);
    expect(errors2.length).toBeGreaterThan(0);
    expect(errors2[0].property).toBe('thoiGianDuKien');
  });

  it('validates sortBy whitelist in StationQueryDto', async () => {
    const validQuery = plainToInstance(StationQueryDto, {
      sortBy: 'tenDiem',
    });
    expect(await validate(validQuery)).toHaveLength(0);

    const invalidQuery = plainToInstance(StationQueryDto, {
      sortBy: 'unsupportedColumn',
    });
    const errors = await validate(invalidQuery);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('sortBy');
  });

  it('validates trangThai enum in CreateStationDto, UpdateStationDto, and StationQueryDto', async () => {
    // Valid values
    expect(await validate(plainToInstance(CreateStationDto, {
      maDiem: 'BX1',
      tenDiem: 'Bến 1',
      loaiDiem: 'BEN_XE',
      diaChi: 'Đường A',
      diaDiemCuId: 77,
      trangThai: 'HOAT_DONG',
    }))).toHaveLength(0);

    expect(await validate(plainToInstance(UpdateStationDto, {
      trangThai: 'NGUNG_HOAT_DONG',
    }))).toHaveLength(0);

    expect(await validate(plainToInstance(StationQueryDto, {
      trangThai: 'HOAT_DONG',
    }))).toHaveLength(0);

    // Invalid values
    const invalidCreate = plainToInstance(CreateStationDto, {
      maDiem: 'BX1',
      tenDiem: 'Bến 1',
      loaiDiem: 'BEN_XE',
      diaChi: 'Đường A',
      diaDiemCuId: 77,
      trangThai: 'ABC',
    });
    const createErrors = await validate(invalidCreate);
    expect(createErrors.some(e => e.property === 'trangThai')).toBe(true);

    const invalidUpdate = plainToInstance(UpdateStationDto, {
      trangThai: 'INVALID_STATUS',
    });
    const updateErrors = await validate(invalidUpdate);
    expect(updateErrors.some(e => e.property === 'trangThai')).toBe(true);

    const invalidQuery = plainToInstance(StationQueryDto, {
      trangThai: 'XYZ',
    });
    const queryErrors = await validate(invalidQuery);
    expect(queryErrors.some(e => e.property === 'trangThai')).toBe(true);
  });

  it('validates loaiDiem enum in StationQueryDto', async () => {
    expect(await validate(plainToInstance(StationQueryDto, {
      loaiDiem: 'BEN_XE',
    }))).toHaveLength(0);

    expect(await validate(plainToInstance(StationQueryDto, {
      loaiDiem: 'VAN_PHONG',
    }))).toHaveLength(0);

    expect(await validate(plainToInstance(StationQueryDto, {
      loaiDiem: 'DIEM_DON_TRA',
    }))).toHaveLength(0);

    const invalidQuery = plainToInstance(StationQueryDto, {
      loaiDiem: 'UNKNOWN_TYPE',
    });
    const errors = await validate(invalidQuery);
    expect(errors.some(e => e.property === 'loaiDiem')).toBe(true);
  });
});

describe('Stations Controller Authorization Guards', () => {
  const reflector = new Reflector();
  const guard = new AuthorizationGuard(reflector);

  function executeGuard(handler: Function, roles: string[], permissions: string[]) {
    return guard.canActivate({
      getType: () => 'http',
      getHandler: () => handler,
      getClass: () => StationsController,
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            taiKhoanId: 1,
            nhanVienId: 1,
            sessionId: 'test-session',
            nhaXeId: 5,
            roles,
            permissions,
          },
        }),
      }),
    } as never);
  }

  it('denies tenant admin without route:create when calling POST /stations', () => {
    // Has role NHA_XE_ADMIN but lacks route:create
    expect(() =>
      executeGuard(StationsController.prototype.create, ['NHA_XE_ADMIN'], []),
    ).toThrowError(/Tài khoản không có quyền/i);

    // Has route:create -> allowed
    expect(
      executeGuard(StationsController.prototype.create, ['NHA_XE_ADMIN'], ['route:create']),
    ).toBe(true);
  });

  it('denies tenant admin without route:update when calling PATCH and DELETE /stations/:id', () => {
    expect(() =>
      executeGuard(StationsController.prototype.update, ['NHA_XE_ADMIN'], []),
    ).toThrowError(/Tài khoản không có quyền/i);

    expect(
      executeGuard(StationsController.prototype.update, ['NHA_XE_ADMIN'], ['route:update']),
    ).toBe(true);

    expect(() =>
      executeGuard(StationsController.prototype.delete, ['NHA_XE_ADMIN'], []),
    ).toThrowError(/Tài khoản không có quyền/i);

    expect(
      executeGuard(StationsController.prototype.delete, ['NHA_XE_ADMIN'], ['route:update']),
    ).toBe(true);
  });

  it('denies tenant admin without trip:read on GET /trips/:id/passenger-points', () => {
    expect(() =>
      executeGuard(StationsController.prototype.getTripPointsForAdmin, ['NHA_XE_ADMIN'], []),
    ).toThrowError(/Tài khoản không có quyền/i);

    expect(
      executeGuard(StationsController.prototype.getTripPointsForAdmin, ['NHA_XE_ADMIN'], ['trip:read']),
    ).toBe(true);
  });

  it('denies tenant admin without trip:update on PUT /trips/:id/passenger-points', () => {
    expect(() =>
      executeGuard(StationsController.prototype.updateTripPoints, ['NHA_XE_ADMIN'], []),
    ).toThrowError(/Tài khoản không có quyền/i);

    expect(
      executeGuard(StationsController.prototype.updateTripPoints, ['NHA_XE_ADMIN'], ['trip:update']),
    ).toBe(true);
  });

  it('denies authenticated tenant caller without route:read on GET /stations (tenantPermissionsIfAuthenticated)', () => {
    expect(() =>
      executeGuard(StationsController.prototype.list, ['NHA_XE_ADMIN'], []),
    ).toThrowError(/Tài khoản không có quyền/i);

    expect(
      executeGuard(StationsController.prototype.list, ['NHA_XE_ADMIN'], ['route:read']),
    ).toBe(true);
  });
});
