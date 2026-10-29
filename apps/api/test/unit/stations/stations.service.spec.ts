import { describe, expect, it, vi } from 'vitest';
import { StationsService } from '../../../src/stations/stations.service.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';

describe('StationsService', () => {
  it('automatically resolves diaDiemMoiId from BangSapNhapDiaDiem when creating a station', async () => {
    const mockPrisma = {
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

  it('throws BadRequestException if no mapping exists for diaDiemCuId', async () => {
    const mockPrisma = {
      bangSapNhapDiaDiem: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      danhMucDiaDiem: {
        findUnique: vi.fn().mockResolvedValue({
          diaDiemId: 999,
          tenDiaDiem: 'Địa danh chưa mapping',
        }),
      },
    } as unknown as PrismaService;

    const service = new StationsService(mockPrisma);
    await expect(service.resolveDiaDiemMoiId(999)).rejects.toThrow();
  });
});
