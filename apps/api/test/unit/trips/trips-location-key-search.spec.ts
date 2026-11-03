import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import { TripsService } from '../../../src/trips/trips.service.js';
import { CargoCapacityService } from '../../../src/cargo-capacity/cargo-capacity.service.js';
import { BadRequestException } from '@nestjs/common';

// Địa danh mẫu
const LOCATIONS = [
  { diaDiemId: 79, maDiaDiem: 'VN-P1-79', code: 79, tenDiaDiem: 'Thành phố Hồ Chí Minh', capDiaDiem: 'TINH_THANH', laDiaDanhCu: true, diaDiemChaId: null },
  { diaDiemId: 74, maDiaDiem: 'VN-P1-74', code: 74, tenDiaDiem: 'Tỉnh Bình Dương', capDiaDiem: 'TINH_THANH', laDiaDanhCu: true, diaDiemChaId: null },
  { diaDiemId: 77, maDiaDiem: 'VN-P1-77', code: 77, tenDiaDiem: 'Tỉnh Bà Rịa - Vũng Tàu', capDiaDiem: 'TINH_THANH', laDiaDanhCu: true, diaDiemChaId: null },
  { diaDiemId: 28, maDiaDiem: 'VN-P2-28', code: 28, tenDiaDiem: 'Thành phố Hồ Chí Minh', capDiaDiem: 'TINH_THANH', laDiaDanhCu: false, diaDiemChaId: null },
  { diaDiemId: 101, maDiaDiem: 'VN-P1-15', code: 15, tenDiaDiem: 'Tỉnh Yên Bái', capDiaDiem: 'TINH_THANH', laDiaDanhCu: true, diaDiemChaId: null },
  { diaDiemId: 202, maDiaDiem: 'VN-P2-15', code: 15, tenDiaDiem: 'Tỉnh Lào Cai', capDiaDiem: 'TINH_THANH', laDiaDanhCu: false, diaDiemChaId: null },
  { diaDiemId: 300, maDiaDiem: 'VN-D-THUDUC', code: 769, tenDiaDiem: 'Thành phố Thủ Đức', capDiaDiem: 'QUAN_HUYEN', laDiaDanhCu: true, diaDiemChaId: 79 },
  { diaDiemId: 68, maDiaDiem: 'VN-P1-68', code: 68, tenDiaDiem: 'Tỉnh Lâm Đồng', capDiaDiem: 'TINH_THANH', laDiaDanhCu: true, diaDiemChaId: null },
  { diaDiemId: 49, maDiaDiem: 'VN-P2-49', code: 49, tenDiaDiem: 'Tỉnh Lâm Đồng', capDiaDiem: 'TINH_THANH', laDiaDanhCu: false, diaDiemChaId: null },
];

// Mapping sáp nhập: TP.HCM mới (28) gồm TP.HCM cũ (79), Bình Dương (74), Vũng Tàu (77)
const MERGER_MAPPINGS = [
  { bangSapNhapDiaDiemId: 1, diaDiemMoiId: 28, diaDiemCuId: 79, diaDiemCu: LOCATIONS[0], diaDiemMoi: LOCATIONS[3] },
  { bangSapNhapDiaDiemId: 2, diaDiemMoiId: 28, diaDiemCuId: 74, diaDiemCu: LOCATIONS[1], diaDiemMoi: LOCATIONS[3] },
  { bangSapNhapDiaDiemId: 3, diaDiemMoiId: 28, diaDiemCuId: 77, diaDiemCu: LOCATIONS[2], diaDiemMoi: LOCATIONS[3] },
  { bangSapNhapDiaDiemId: 4, diaDiemMoiId: 49, diaDiemCuId: 68, diaDiemCu: LOCATIONS[7], diaDiemMoi: LOCATIONS[8] },
];

const STATIONS = [
  { diemDonTraId: 10, maDiem: 'BX-MD', tenDiem: 'Bến xe Miền Đông', diaDiemCuId: 79, diaDiemMoiId: 28, trangThai: 'HOAT_DONG' },
  { diemDonTraId: 20, maDiem: 'BX-BD', tenDiem: 'Bến xe Bình Dương', diaDiemCuId: 74, diaDiemMoiId: 28, trangThai: 'HOAT_DONG' },
  { diemDonTraId: 30, maDiem: 'BX-DL', tenDiem: 'Bến xe Đà Lạt', diaDiemCuId: 68, diaDiemMoiId: 49, trangThai: 'HOAT_DONG' },
];

function createTripFixture(overrides: Record<string, unknown> = {}) {
  return {
    chuyenXeId: 10,
    maChuyenXe: 'CX-TEST',
    ngayKhoiHanh: new Date('2026-11-01T00:00:00.000Z'),
    gioKhoiHanh: new Date('1970-01-01T08:00:00.000Z'),
    gioDen: null,
    trangThai: 'CHUA_KHOI_HANH',
    nhanGuiHang: false,
    sucChuaXeMay: 0,
    sucChuaHangCongKenh: 0,
    sucChuaHangNhe: 0,
    nhaXeId: 1,
    tuyenXeId: 1,
    xeId: 1,
    tuyenXe: {
      tuyenXeId: 1,
      maTuyenXe: 'ROUTE-01',
      diemDi: 'TP.HCM',
      diemDen: 'Đà Lạt',
      thoiGianChayPhut: 360,
      nhaXe: { nhaXeId: 1, tenNhaXe: 'Nhà xe Phương Trang' },
    },
    xe: {
      xeId: 1,
      bienSoXe: '51B-99999',
      trangThai: 'HOAT_DONG',
      loaiXeId: 1,
      loaiXe: { loaiXeId: 1, tenLoai: 'Giường nằm 34 chỗ' },
    },
    gheChuyenXes: [{ trangThai: 'TRONG' }],
    diemDonTraChuyenXes: [],
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    ...overrides,
  };
}

function setupTestEnvironment() {
  const prisma = {
    danhMucDiaDiem: {
      findUnique: vi.fn(async ({ where }: { where: { diaDiemId: number } }) => {
        return LOCATIONS.find((l) => l.diaDiemId === where.diaDiemId) ?? null;
      }),
      findMany: vi.fn(async () => LOCATIONS),
    },
    diemDonTra: {
      findUnique: vi.fn(async ({ where }: { where: { diemDonTraId: number } }) => {
        return STATIONS.find((s) => s.diemDonTraId === where.diemDonTraId) ?? null;
      }),
      findMany: vi.fn(async () => STATIONS),
    },
    bangSapNhapDiaDiem: {
      findUnique: vi.fn(async ({ where }: { where: { diaDiemCuId: number } }) => {
        return MERGER_MAPPINGS.find((m) => m.diaDiemCuId === where.diaDiemCuId) ?? null;
      }),
      findFirst: vi.fn(async ({ where }: { where: { diaDiemMoiId: number; diaDiemCuId: number } }) => {
        return (
          MERGER_MAPPINGS.find(
            (m) => m.diaDiemMoiId === where.diaDiemMoiId && m.diaDiemCuId === where.diaDiemCuId,
          ) ?? null
        );
      }),
      findMany: vi.fn(async ({ where }: { where?: { diaDiemMoiId?: number } }) => {
        if (where?.diaDiemMoiId) {
          return MERGER_MAPPINGS.filter((m) => m.diaDiemMoiId === where.diaDiemMoiId);
        }
        return MERGER_MAPPINGS;
      }),
    },
    chuyenXe: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    bangGia: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    phanHoi: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  };

  const service = new TripsService(
    prisma as unknown as PrismaService,
    { get: vi.fn().mockReturnValue('Asia/Ho_Chi_Minh') } as never,
    new CargoCapacityService(),
  );

  return { prisma, service };
}

describe('TripsService - Task 4: Location Key-based Search', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-31T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // 1. Tìm theo địa danh cũ (TP.HCM cũ id 79)
  it('1. Searches by legacy province (TP.HCM cu id 79): matches point with diaDiemCuId=79; ignores points in Binh Duong (74) or Vung Tau (77)', async () => {
    const { prisma, service } = setupTestEnvironment();

    const tripHcm = createTripFixture({
      chuyenXeId: 1,
      diemDonTraChuyenXes: [
        {
          loaiDiem: 'DON',
          diemDonTra: {
            diemDonTraId: 10,
            tenDiem: 'Bến xe Miền Đông',
            diaDiemCuId: 79,
            diaDiemMoiId: 28,
            trangThai: 'HOAT_DONG',
          },
        },
      ],
    });

    prisma.chuyenXe.findMany.mockResolvedValueOnce([tripHcm]).mockResolvedValue([]);

    const result = await service.search({
      fromLocationId: 79,
      departureDate: '2026-11-01',
      page: 1,
      pageSize: 10,
      sortBy: 'departureTime',
      sortDirection: 'asc',
    });

    expect(prisma.chuyenXe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.arrayContaining([
                expect.objectContaining({
                  diemDonTraChuyenXes: {
                    some: {
                      loaiDiem: 'DON',
                      diemDonTra: {
                        diaDiemCuId: 79,
                        trangThai: 'HOAT_DONG',
                      },
                    },
                  },
                }),
              ]),
            }),
          ]),
        }),
      }),
    );

    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe(1);
  });

  // 2. Tìm theo địa danh mới (TP.HCM mới id 28)
  it('2. Searches by new province (TP.HCM moi id 28): matches points across all 3 constituent provinces and returns fromSubAreas with counts', async () => {
    const { prisma, service } = setupTestEnvironment();

    const trip1 = createTripFixture({
      chuyenXeId: 1,
      diemDonTraChuyenXes: [
        {
          loaiDiem: 'DON',
          diemDonTra: { diemDonTraId: 10, diaDiemCuId: 79, diaDiemMoiId: 28, trangThai: 'HOAT_DONG' },
        },
      ],
    });
    const trip2 = createTripFixture({
      chuyenXeId: 2,
      diemDonTraChuyenXes: [
        {
          loaiDiem: 'DON',
          diemDonTra: { diemDonTraId: 20, diaDiemCuId: 74, diaDiemMoiId: 28, trangThai: 'HOAT_DONG' },
        },
      ],
    });

    prisma.chuyenXe.findMany.mockResolvedValue([trip1, trip2]);

    const result = await service.search({
      fromLocationId: 28,
      departureDate: '2026-11-01',
      page: 1,
      pageSize: 10,
      sortBy: 'departureTime',
      sortDirection: 'asc',
    });

    expect(result.data).toHaveLength(2);
    expect(result.fromSubAreas).toBeDefined();
    expect(result.subAreas).toBeDefined();
    expect(result.fromSubAreas).toEqual(
      expect.arrayContaining([
        { diaDiemId: 79, tenDiaDiem: 'Thành phố Hồ Chí Minh', tripCount: 1 },
        { diaDiemId: 74, tenDiaDiem: 'Tỉnh Bình Dương', tripCount: 1 },
        { diaDiemId: 77, tenDiaDiem: 'Tỉnh Bà Rịa - Vũng Tàu', tripCount: 0 },
      ]),
    );
  });

  // 3. Tìm theo địa danh mới + fromAreaId = 74
  it('3. Searches by new province (id 28) + fromAreaId = 74: filters results down to only Binh Duong trips', async () => {
    const { prisma, service } = setupTestEnvironment();

    const tripHcm = createTripFixture({
      chuyenXeId: 1,
      diemDonTraChuyenXes: [
        {
          loaiDiem: 'DON',
          diemDonTra: { diemDonTraId: 10, diaDiemCuId: 79, diaDiemMoiId: 28, trangThai: 'HOAT_DONG' },
        },
      ],
    });
    const tripBinhDuong = createTripFixture({
      chuyenXeId: 2,
      diemDonTraChuyenXes: [
        {
          loaiDiem: 'DON',
          diemDonTra: { diemDonTraId: 20, diaDiemCuId: 74, diaDiemMoiId: 28, trangThai: 'HOAT_DONG' },
        },
      ],
    });

    prisma.chuyenXe.findMany.mockResolvedValue([tripHcm, tripBinhDuong]);

    const result = await service.search({
      fromLocationId: 28,
      fromAreaId: 74,
      departureDate: '2026-11-01',
      page: 1,
      pageSize: 10,
      sortBy: 'departureTime',
      sortDirection: 'asc',
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe(2);
    expect(result.fromSubAreas).toEqual(
      expect.arrayContaining([
        { diaDiemId: 79, tenDiaDiem: 'Thành phố Hồ Chí Minh', tripCount: 1 },
        { diaDiemId: 74, tenDiaDiem: 'Tỉnh Bình Dương', tripCount: 1 },
        { diaDiemId: 77, tenDiaDiem: 'Tỉnh Bà Rịa - Vũng Tàu', tripCount: 0 },
      ]),
    );
  });

  // 4. Trùng code nhưng khác id (Yên Bái cũ vs Lào Cai mới)
  it('4. Distinguishes locations with the same code (code 15) by diaDiemId (Yen Bai cu id 101 vs Lao Cai moi id 202)', async () => {
    const { prisma, service } = setupTestEnvironment();

    prisma.chuyenXe.findMany.mockResolvedValue([]);

    // Search Yen Bai cu (id 101)
    await service.search({
      fromLocationId: 101,
      departureDate: '2026-11-01',
      page: 1,
      pageSize: 10,
      sortBy: 'departureTime',
      sortDirection: 'asc',
    });

    expect(prisma.chuyenXe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.arrayContaining([
                expect.objectContaining({
                  diemDonTraChuyenXes: {
                    some: {
                      loaiDiem: 'DON',
                      diemDonTra: { diaDiemCuId: 101, trangThai: 'HOAT_DONG' },
                    },
                  },
                }),
              ]),
            }),
          ]),
        }),
      }),
    );

    // Search Lao Cai moi (id 202)
    await service.search({
      fromLocationId: 202,
      departureDate: '2026-11-01',
      page: 1,
      pageSize: 10,
      sortBy: 'departureTime',
      sortDirection: 'asc',
    });

    expect(prisma.chuyenXe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.arrayContaining([
                expect.objectContaining({
                  diemDonTraChuyenXes: {
                    some: {
                      loaiDiem: 'DON',
                      diemDonTra: { diaDiemMoiId: 202, trangThai: 'HOAT_DONG' },
                    },
                  },
                }),
              ]),
            }),
          ]),
        }),
      }),
    );
  });

  // 5. Tìm theo quận/huyện cũ (TP. Thủ Đức id 300)
  it('5. Searches by legacy district (TP. Thu Duc id 300): resolves to parent province (diaDiemChaId=79) and matches identically to TP.HCM cu', async () => {
    const { prisma, service } = setupTestEnvironment();

    prisma.chuyenXe.findMany.mockResolvedValue([]);

    await service.search({
      fromLocationId: 300,
      departureDate: '2026-11-01',
      page: 1,
      pageSize: 10,
      sortBy: 'departureTime',
      sortDirection: 'asc',
    });

    expect(prisma.chuyenXe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.arrayContaining([
                expect.objectContaining({
                  diemDonTraChuyenXes: {
                    some: {
                      loaiDiem: 'DON',
                      diemDonTra: { diaDiemCuId: 79, trangThai: 'HOAT_DONG' },
                    },
                  },
                }),
              ]),
            }),
          ]),
        }),
      }),
    );
  });

  // 6. Graceful fallback cho chuyến chưa gán điểm đón/trả
  it('6. Graceful fallback: unassigned trips fall back to string matching; trips with active points in other provinces do NOT match string fallback', async () => {
    const { prisma, service } = setupTestEnvironment();

    const unassignedTrip = createTripFixture({
      chuyenXeId: 101,
      tuyenXe: {
        tuyenXeId: 1,
        maTuyenXe: 'SG-DL',
        diemDi: 'Sài Gòn',
        diemDen: 'Đà Lạt',
        thoiGianChayPhut: 360,
        nhaXe: { nhaXeId: 1, tenNhaXe: 'Nhà xe A' },
      },
      diemDonTraChuyenXes: [],
    });

    prisma.chuyenXe.findMany.mockResolvedValueOnce([unassignedTrip]).mockResolvedValue([]);

    const result = await service.search({
      fromLocationId: 79,
      departureDate: '2026-11-01',
      page: 1,
      pageSize: 10,
      sortBy: 'departureTime',
      sortDirection: 'asc',
    });

    expect(prisma.chuyenXe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.arrayContaining([
                expect.objectContaining({
                  diemDonTraChuyenXes: {
                    some: {
                      loaiDiem: 'DON',
                      diemDonTra: { diaDiemCuId: 79, trangThai: 'HOAT_DONG' },
                    },
                  },
                }),
                expect.objectContaining({
                  diemDonTraChuyenXes: {
                    none: {
                      loaiDiem: 'DON',
                      diemDonTra: { trangThai: 'HOAT_DONG' },
                    },
                  },
                  tuyenXe: expect.objectContaining({
                    OR: expect.any(Array),
                  }),
                }),
              ]),
            }),
          ]),
        }),
      }),
    );

    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe(101);
  });

  // 7. Điểm đón/trả NGUNG_HOAT_DONG bị bỏ qua
  it('7. Inactive pickup/dropoff points (NGUNG_HOAT_DONG) are ignored in point matching', async () => {
    const { prisma, service } = setupTestEnvironment();

    prisma.chuyenXe.findMany.mockResolvedValue([]);

    await service.search({
      fromLocationId: 79,
      departureDate: '2026-11-01',
      page: 1,
      pageSize: 10,
      sortBy: 'departureTime',
      sortDirection: 'asc',
    });

    expect(prisma.chuyenXe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.arrayContaining([
                expect.objectContaining({
                  diemDonTraChuyenXes: {
                    some: {
                      loaiDiem: 'DON',
                      diemDonTra: {
                        diaDiemCuId: 79,
                        trangThai: 'HOAT_DONG',
                      },
                    },
                  },
                }),
              ]),
            }),
          ]),
        }),
      }),
    );
  });

  // 8. Gợi ý mở rộng (fromExpandSuggestion) khi chọn địa danh cũ
  it('8. Expand suggestion: searching Binh Duong cu (id 74) returns fromExpandSuggestion with sibling areas and trip counts', async () => {
    const { prisma, service } = setupTestEnvironment();

    const tripBinhDuong = createTripFixture({
      chuyenXeId: 2,
      diemDonTraChuyenXes: [
        {
          loaiDiem: 'DON',
          diemDonTra: { diemDonTraId: 20, diaDiemCuId: 74, diaDiemMoiId: 28, trangThai: 'HOAT_DONG' },
        },
      ],
    });

    const tripHcm = createTripFixture({
      chuyenXeId: 1,
      diemDonTraChuyenXes: [
        {
          loaiDiem: 'DON',
          diemDonTra: { diemDonTraId: 10, diaDiemCuId: 79, diaDiemMoiId: 28, trangThai: 'HOAT_DONG' },
        },
      ],
    });

    prisma.chuyenXe.findMany
      .mockResolvedValueOnce([tripBinhDuong])
      .mockResolvedValueOnce([tripHcm]);

    const result = await service.search({
      fromLocationId: 74,
      departureDate: '2026-11-01',
      page: 1,
      pageSize: 10,
      sortBy: 'departureTime',
      sortDirection: 'asc',
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe(2);

    expect(result.fromExpandSuggestion).toBeDefined();
    expect(result.expandSuggestion).toBeDefined();
    expect(result.fromExpandSuggestion).toEqual({
      currentLocation: {
        diaDiemId: 74,
        tenDiaDiem: 'Tỉnh Bình Dương',
      },
      parentLocation: {
        diaDiemId: 28,
        tenDiaDiem: 'Thành phố Hồ Chí Minh',
      },
      siblingAreas: expect.arrayContaining([
        { diaDiemId: 79, tenDiaDiem: 'Thành phố Hồ Chí Minh', additionalTripCount: 1 },
        { diaDiemId: 77, tenDiaDiem: 'Tỉnh Bà Rịa - Vũng Tàu', additionalTripCount: 0 },
      ]),
      totalAdditionalTrips: 1,
    });
  });

  // 9. Độc lập 2 đầu (from legacy, to new)
  it('9. Independent endpoints: legacy fromLocationId (79) + new toLocationId (49) works seamlessly', async () => {
    const { prisma, service } = setupTestEnvironment();

    const independentTrip = createTripFixture({
      chuyenXeId: 99,
      diemDonTraChuyenXes: [
        {
          loaiDiem: 'DON',
          diemDonTra: { diemDonTraId: 1, diaDiemCuId: 79, diaDiemMoiId: 28, trangThai: 'HOAT_DONG' },
        },
        {
          loaiDiem: 'TRA',
          diemDonTra: { diemDonTraId: 2, diaDiemCuId: 68, diaDiemMoiId: 49, trangThai: 'HOAT_DONG' },
        },
      ],
    });

    prisma.chuyenXe.findMany.mockResolvedValue([independentTrip]);

    const result = await service.search({
      fromLocationId: 79,
      toLocationId: 49,
      departureDate: '2026-11-01',
      page: 1,
      pageSize: 10,
      sortBy: 'departureTime',
      sortDirection: 'asc',
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe(99);
    // from is legacy -> fromExpandSuggestion
    expect(result.fromExpandSuggestion).toBeDefined();
    // to is new -> toSubAreas
    expect(result.toSubAreas).toBeDefined();
  });

  // 10. Tương thích ngược: request không truyền id mới vẫn chạy đúng 100% logic cũ
  it('10. Backward compatibility: request without location IDs uses 100% legacy string query', async () => {
    const { prisma, service } = setupTestEnvironment();

    prisma.chuyenXe.findMany.mockResolvedValue([]);

    await service.search({
      from: 'HCM',
      to: 'DL',
      page: 1,
      pageSize: 10,
      sortBy: 'departureTime',
      sortDirection: 'asc',
    });

    expect(prisma.chuyenXe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tuyenXe: expect.objectContaining({
            AND: [
              {
                OR: expect.arrayContaining([
                  { diemDi: { contains: 'TP.HCM' } },
                  { diemDi: { contains: 'Hồ Chí Minh' } },
                ]),
              },
              {
                OR: expect.arrayContaining([
                  { diemDen: { contains: 'Đà Lạt' } },
                ]),
              },
            ],
          }),
        }),
      }),
    );
  });

  // 11. Tìm kiếm theo fromStationId (bến xe cụ thể)
  it('11. Searches by specific station (fromStationId=10): filters directly by diemDonTraId', async () => {
    const { prisma, service } = setupTestEnvironment();

    const tripStation10 = createTripFixture({
      chuyenXeId: 55,
      diemDonTraChuyenXes: [
        {
          loaiDiem: 'DON',
          diemDonTraId: 10,
          diemDonTra: { diemDonTraId: 10, tenDiem: 'Bến xe Miền Đông', trangThai: 'HOAT_DONG' },
        },
      ],
    });

    prisma.chuyenXe.findMany.mockResolvedValueOnce([tripStation10]);

    const result = await service.search({
      fromStationId: 10,
      departureDate: '2026-11-01',
      page: 1,
      pageSize: 10,
      sortBy: 'departureTime',
      sortDirection: 'asc',
    });

    expect(prisma.chuyenXe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.arrayContaining([
                expect.objectContaining({
                  diemDonTraChuyenXes: {
                    some: {
                      loaiDiem: 'DON',
                      diemDonTraId: 10,
                      diemDonTra: { trangThai: 'HOAT_DONG' },
                    },
                  },
                }),
              ]),
            }),
          ]),
        }),
      }),
    );
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe(55);
  });

  // 12. Cả hai đầu đều chọn địa danh MỚI: trả cả fromSubAreas và toSubAreas
  it('12. Both ends choose NEW locations: returns both fromSubAreas and toSubAreas', async () => {
    const { prisma, service } = setupTestEnvironment();

    const tripBothNew = createTripFixture({
      chuyenXeId: 77,
      diemDonTraChuyenXes: [
        {
          loaiDiem: 'DON',
          diemDonTra: { diemDonTraId: 10, diaDiemCuId: 79, diaDiemMoiId: 28, trangThai: 'HOAT_DONG' },
        },
        {
          loaiDiem: 'TRA',
          diemDonTra: { diemDonTraId: 30, diaDiemCuId: 68, diaDiemMoiId: 49, trangThai: 'HOAT_DONG' },
        },
      ],
    });

    prisma.chuyenXe.findMany.mockResolvedValue([tripBothNew]);

    const result = await service.search({
      fromLocationId: 28, // TP.HCM mới
      toLocationId: 49,   // Lâm Đồng mới
      departureDate: '2026-11-01',
      page: 1,
      pageSize: 10,
      sortBy: 'departureTime',
      sortDirection: 'asc',
    });

    expect(result.data).toHaveLength(1);
    expect(result.fromSubAreas).toBeDefined();
    expect(result.toSubAreas).toBeDefined();
  });

  // Validation: non-existent location ID throws 400 LOCATION_NOT_FOUND
  it('throws 400 LOCATION_NOT_FOUND when fromLocationId does not exist', async () => {
    const { service } = setupTestEnvironment();

    await expect(
      service.search({
        fromLocationId: 999999,
        page: 1,
        pageSize: 10,
        sortBy: 'departureTime',
        sortDirection: 'asc',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // Validation: non-existent station ID throws 400 STATION_NOT_FOUND
  it('throws 400 STATION_NOT_FOUND when fromStationId does not exist', async () => {
    const { service } = setupTestEnvironment();

    await expect(
      service.search({
        fromStationId: 999999,
        page: 1,
        pageSize: 10,
        sortBy: 'departureTime',
        sortDirection: 'asc',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // Validation: invalid area filter throws 400 AREA_NOT_FOUND
  it('throws 400 AREA_NOT_FOUND when fromAreaId does not belong to fromLocationId', async () => {
    const { service } = setupTestEnvironment();

    await expect(
      service.search({
        fromLocationId: 28,
        fromAreaId: 101,
        page: 1,
        pageSize: 10,
        sortBy: 'departureTime',
        sortDirection: 'asc',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
