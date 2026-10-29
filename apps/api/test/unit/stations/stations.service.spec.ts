import { describe, expect, it, vi } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { StationsService } from '../../../src/stations/stations.service.js';
import { TripPassengerPointItemDto } from '../../../src/stations/dto/trip-passenger-points.dto.js';
import { StationQueryDto } from '../../../src/stations/dto/station-query.dto.js';
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
      roles: ['ADMIN_NHA_XE'],
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
      roles: ['ADMIN_NHA_XE'],
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

  it('throws BadRequestException if sending new location id into diaDiemCuId', async () => {
    const mockPrisma = {
      danhMucDiaDiem: {
        findUnique: vi.fn().mockResolvedValue({
          diaDiemId: 28,
          tenDiaDiem: 'Hồ Chí Minh (mới)',
          laDiaDanhCu: false, // NEW location
          capDiaDiem: 'TINH_THANH',
        }),
      },
      bangSapNhapDiaDiem: {
        findFirst: vi.fn(),
      },
    } as unknown as PrismaService;

    const service = new StationsService(mockPrisma);
    await expect(service.resolveDiaDiemMoiId(28)).rejects.toThrowError(
      /tỉnh\/thành phố trước sáp nhập/i,
    );
  });

  it('throws BadRequestException if diaDiemCuId is not TINH_THANH (e.g. district)', async () => {
    const mockPrisma = {
      danhMucDiaDiem: {
        findUnique: vi.fn().mockResolvedValue({
          diaDiemId: 769,
          tenDiaDiem: 'Thành phố Thủ Đức',
          laDiaDanhCu: true,
          capDiaDiem: 'QUAN_HUYEN',
        }),
      },
      bangSapNhapDiaDiem: {
        findFirst: vi.fn(),
      },
    } as unknown as PrismaService;

    const service = new StationsService(mockPrisma);
    await expect(service.resolveDiaDiemMoiId(769)).rejects.toThrowError(
      /tỉnh\/thành phố trước sáp nhập/i,
    );
  });

  it('throws BadRequestException if no mapping exists for diaDiemCuId', async () => {
    const mockPrisma = {
      danhMucDiaDiem: {
        findUnique: vi.fn().mockResolvedValue({
          diaDiemId: 999,
          tenDiaDiem: 'Địa danh chưa mapping',
          laDiaDanhCu: true,
          capDiaDiem: 'TINH_THANH',
        }),
      },
      bangSapNhapDiaDiem: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    } as unknown as PrismaService;

    const service = new StationsService(mockPrisma);
    await expect(service.resolveDiaDiemMoiId(999)).rejects.toThrowError(
      /chưa có thông tin tỉnh sáp nhập tương ứng/i,
    );
  });

  it('throws ConflictException when updating trip passenger points with duplicate station and type', async () => {
    const mockPrisma = {
      chuyenXe: {
        findUnique: vi.fn().mockResolvedValue({
          chuyenXeId: 1,
          nhaXeId: 5,
        }),
      },
    } as unknown as PrismaService;

    const service = new StationsService(mockPrisma);
    const principal: AuthPrincipal = {
      taiKhoanId: 1,
      sessionId: 'test-session',
      roles: ['ADMIN_NHA_XE'],
      permissions: [],
      nhanVienId: 1,
      nhaXeId: 5,
    };

    await expect(
      service.updateTripPassengerPoints(
        1,
        {
          points: [
            { diemDonTraId: 10, loaiDiem: 'DON', thuTu: 1 },
            { diemDonTraId: 10, loaiDiem: 'DON', thuTu: 2 }, // Duplicate!
          ],
        },
        principal,
      ),
    ).rejects.toThrowError(/đã tồn tại trong danh sách/i);
  });

  it('ignores diaDiemMoiId sent by client in create and always resolves from mapping', async () => {
    let capturedData: any;
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
          diaDiemCuId: 77,
        }),
      },
      diemDonTra: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(({ data }) => {
          capturedData = data;
          return Promise.resolve({ diemDonTraId: 1, ...data });
        }),
      },
    } as unknown as PrismaService;

    const service = new StationsService(mockPrisma);
    const principal: AuthPrincipal = {
      taiKhoanId: 1,
      sessionId: 'test-session',
      roles: ['ADMIN_NHA_XE'],
      permissions: [],
      nhanVienId: 1,
      nhaXeId: 5,
    };

    await service.create(
      {
        maDiem: 'BX-VT',
        tenDiem: 'Bến xe Vũng Tàu',
        loaiDiem: 'BEN_XE',
        diaChi: '192 Nam Kỳ Khởi Nghĩa',
        diaDiemCuId: 77,
        ...({ diaDiemMoiId: 9999 } as any), // Client attempts to spoof diaDiemMoiId
      },
      principal,
    );

    expect(capturedData.diaDiemMoiId).toBe(28);
    expect(capturedData.diaDiemMoiId).not.toBe(9999);
  });

  it('ignores diaDiemMoiId and does not allow updating nhaXeId in update', async () => {
    let capturedData: any;
    const mockPrisma = {
      danhMucDiaDiem: {
        findUnique: vi.fn().mockResolvedValue({
          diaDiemId: 68,
          tenDiaDiem: 'Lâm Đồng',
          laDiaDanhCu: true,
          capDiaDiem: 'TINH_THANH',
        }),
      },
      bangSapNhapDiaDiem: {
        findFirst: vi.fn().mockResolvedValue({
          diaDiemMoiId: 30, // Lâm Đồng mới
          diaDiemCuId: 68,
        }),
      },
      diemDonTra: {
        findUnique: vi.fn().mockResolvedValue({
          diemDonTraId: 1,
          nhaXeId: 5,
          diaDiemCuId: 77,
          diaDiemMoiId: 28,
        }),
        update: vi.fn().mockImplementation(({ data }) => {
          capturedData = data;
          return Promise.resolve({ diemDonTraId: 1, ...data });
        }),
      },
    } as unknown as PrismaService;

    const service = new StationsService(mockPrisma);
    const principal: AuthPrincipal = {
      taiKhoanId: 1,
      sessionId: 'test-session',
      roles: ['ADMIN_NHA_XE'],
      permissions: [],
      nhanVienId: 1,
      nhaXeId: 5,
    };

    await service.update(
      1,
      {
        diaDiemCuId: 68,
        ...({ diaDiemMoiId: 8888, nhaXeId: 999 } as any), // Spoof attempts
      },
      principal,
    );

    expect(capturedData.diaDiemMoiId).toBe(30);
    expect(capturedData.diaDiemMoiId).not.toBe(8888);
    expect(capturedData.nhaXeId).toBeUndefined();
  });

  it('throws 400 when create or update receives new location or district as diaDiemCuId', async () => {
    const mockPrisma = {
      danhMucDiaDiem: {
        findUnique: vi.fn().mockResolvedValue({
          diaDiemId: 28,
          tenDiaDiem: 'TP.HCM mới',
          laDiaDanhCu: false,
          capDiaDiem: 'TINH_THANH',
        }),
      },
      diemDonTra: {
        findUnique: vi.fn().mockResolvedValue({
          diemDonTraId: 1,
          nhaXeId: 5,
          diaDiemCuId: 77,
        }),
      },
    } as unknown as PrismaService;

    const service = new StationsService(mockPrisma);
    const principal: AuthPrincipal = {
      taiKhoanId: 1,
      sessionId: 'test-session',
      roles: ['ADMIN_NHA_XE'],
      permissions: [],
      nhanVienId: 1,
      nhaXeId: 5,
    };

    // Test create
    await expect(
      service.create(
        {
          maDiem: 'BX-TEST',
          tenDiem: 'Bến xe Test',
          loaiDiem: 'BEN_XE',
          diaChi: 'Test',
          diaDiemCuId: 28, // New location
        },
        principal,
      ),
    ).rejects.toThrowError(/tỉnh\/thành phố trước sáp nhập/i);

    // Test update
    await expect(
      service.update(1, { diaDiemCuId: 28 }, principal),
    ).rejects.toThrowError(/tỉnh\/thành phố trước sáp nhập/i);
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
      roles: ['ADMIN_NHA_XE'],
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
      roles: ['ADMIN_NHA_XE'],
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
        findMany: vi.fn().mockResolvedValue([]), // No station found!
      },
    } as unknown as PrismaService;

    const service = new StationsService(mockPrisma);
    const principal: AuthPrincipal = {
      taiKhoanId: 1,
      sessionId: 'test-session',
      roles: ['ADMIN_NHA_XE'],
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
      roles: ['ADMIN_NHA_XE'],
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
          nhaXeId: 5, // Trip belongs to tenant 5
        }),
      },
      diemDonTra: {
        findMany: vi.fn().mockResolvedValue([
          { diemDonTraId: 10, trangThai: 'HOAT_DONG', nhaXeId: 99 }, // Station belongs to tenant 99
        ]),
      },
    } as unknown as PrismaService;

    const service = new StationsService(mockPrisma);
    const principal: AuthPrincipal = {
      taiKhoanId: 1,
      sessionId: 'test-session',
      roles: ['ADMIN_NHA_XE'],
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
          // nhaXeId is undefined
        },
        principal,
      ),
    ).rejects.toThrowError(/Yêu cầu chọn nhà xe \(nhaXeId\)/i);
  });
});

describe('Stations DTO Validation', () => {
  it('validates thoiGianDuKien in TripPassengerPointItemDto for valid and invalid formats', async () => {
    // Valid HH:mm
    const valid1 = plainToInstance(TripPassengerPointItemDto, {
      diemDonTraId: 1,
      loaiDiem: 'DON',
      thuTu: 1,
      thoiGianDuKien: '08:30',
    });
    expect(await validate(valid1)).toHaveLength(0);

    // Valid HH:mm:ss
    const valid2 = plainToInstance(TripPassengerPointItemDto, {
      diemDonTraId: 1,
      loaiDiem: 'TRA',
      thuTu: 2,
      thoiGianDuKien: '17:45:00',
    });
    expect(await validate(valid2)).toHaveLength(0);

    // Invalid non-time format
    const invalid1 = plainToInstance(TripPassengerPointItemDto, {
      diemDonTraId: 1,
      loaiDiem: 'DON',
      thuTu: 1,
      thoiGianDuKien: 'invalid-time',
    });
    const errors1 = await validate(invalid1);
    expect(errors1.length).toBeGreaterThan(0);
    expect(errors1[0].property).toBe('thoiGianDuKien');

    // Invalid hour 25:00
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
});
