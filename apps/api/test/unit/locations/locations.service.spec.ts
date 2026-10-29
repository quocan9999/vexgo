import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocationsService } from '../../../src/locations/locations.service.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('LocationsService', () => {
  it('serves authoritative master catalogue including provinces, key districts and major stations', async () => {
    const service = new LocationsService();
    const result = await service.list();

    expect(result.data.length).toBeGreaterThan(60);
    expect(result.meta.stale).toBe(false);

    // Verify TP.HCM is clean, with no fictional merger legacy names
    const hcm = result.data.find((item) => item.id === 'province:79');
    expect(hcm).toBeDefined();
    expect(hcm?.name).toBe('TP. Hồ Chí Minh');
    expect(hcm?.value).toBe('TP.HCM');
    expect(hcm?.legacyNames).toBeUndefined();

    // Verify key districts (Thủ Đức, Đà Lạt)
    const thuDuc = result.data.find((item) => item.name.includes('Thủ Đức'));
    expect(thuDuc).toBeDefined();
    expect(thuDuc?.kind).toBe('district');
    expect(thuDuc?.province).toBe('TP. Hồ Chí Minh');

    const daLat = result.data.find((item) => item.name.includes('Đà Lạt'));
    expect(daLat).toBeDefined();
    expect(daLat?.kind).toBe('district');
    expect(daLat?.province).toBe('Lâm Đồng');

    // Verify major bus stations
    const bxMienDong = result.data.find((item) => item.id === 'station:bx-mien-dong');
    expect(bxMienDong).toBeDefined();
    expect(bxMienDong?.kind).toBe('station');
    expect(bxMienDong?.province).toBe('TP. Hồ Chí Minh');

    // Verify popular locations
    const popular = result.data.filter((item) => item.popular);
    expect(popular.length).toBeGreaterThan(0);
    expect(popular.some((item) => item.value === 'TP.HCM')).toBe(true);
  });

  it('coalesces concurrent requests and uses in-memory cache', async () => {
    const service = new LocationsService();
    const [first, concurrent] = await Promise.all([
      service.list(),
      service.list(),
    ]);
    const cached = await service.list();
    expect(first).toEqual(concurrent);
    expect(cached).toEqual(first);
    expect(first.meta.stale).toBe(false);
  });

  it('reads from DanhMucDiaDiem and DiemDonTra when Prisma is available', async () => {
    const mockPrisma = {
      danhMucDiaDiem: {
        findMany: vi.fn().mockResolvedValue([
          {
            diaDiemId: 101,
            code: 79,
            tenDiaDiem: 'Thành phố Hồ Chí Minh',
            tenKhongDau: 'thanh pho ho chi minh',
            capDiaDiem: 'TINH_THANH',
            laDiaDanhCu: false,
            chuThichSapNhap: 'Sáp nhập từ Bà Rịa - Vũng Tàu, Bình Dương, TP. Hồ Chí Minh',
            noiBat: true,
            thuTuHienThi: 10,
          },
          {
            diaDiemId: 102,
            code: 77,
            tenDiaDiem: 'Tỉnh Bà Rịa - Vũng Tàu',
            tenKhongDau: 'tinh ba ria vung tau',
            capDiaDiem: 'TINH_THANH',
            laDiaDanhCu: true,
            chuThichSapNhap: null,
            noiBat: true,
            thuTuHienThi: 10,
          },
        ]),
      },
      diemDonTra: {
        findMany: vi.fn().mockResolvedValue([
          {
            diemDonTraId: 201,
            maDiem: 'BX-VT',
            tenDiem: 'Bến xe Vũng Tàu',
            loaiDiem: 'BEN_XE',
            diaChi: '192 Nam Kỳ Khởi Nghĩa, Vũng Tàu',
            diaDiemCu: { tenDiaDiem: 'Bà Rịa - Vũng Tàu' },
            diaDiemMoi: { tenDiaDiem: 'Hồ Chí Minh' },
          },
        ]),
      },
    } as unknown as PrismaService;

    const service = new LocationsService(mockPrisma);
    const result = await service.list();

    expect(result.data.length).toBe(3);
    const newHcm = result.data.find((item) => item.id === 'current:province:79');
    expect(newHcm).toBeDefined();
    expect(newHcm?.isLegacy).toBe(false);
    expect(newHcm?.mergedFromText).toBe('Sáp nhập từ Bà Rịa - Vũng Tàu, Bình Dương, TP. Hồ Chí Minh');
    expect(newHcm?.diaDiemId).toBe(101);

    const oldVt = result.data.find((item) => item.id === 'legacy:province:77');
    expect(oldVt).toBeDefined();
    expect(oldVt?.isLegacy).toBe(true);
    expect(oldVt?.diaDiemId).toBe(102);

    const station = result.data.find((item) => item.id === 'station:bx-vt');
    expect(station).toBeDefined();
    expect(station?.kind).toBe('station');
    expect(station?.parentName).toBe('Bà Rịa - Vũng Tàu');
    expect(station?.diaDiemId).toBe(201);
  });
});
