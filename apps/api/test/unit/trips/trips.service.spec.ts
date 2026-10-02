import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import { TripsService } from '../../../src/trips/trips.service.js';

const firstTrip = {
  chuyenXeId: 21,
  maChuyenXe: 'CX-21',
  ngayKhoiHanh: new Date('2026-10-15T00:00:00.000Z'),
  gioKhoiHanh: new Date('1970-01-01T22:00:00.000Z'),
  trangThai: 'CHUA_KHOI_HANH',
  nhaXeId: 3,
  tuyenXeId: 8,
  xeId: 4,
  tuyenXe: {
    tuyenXeId: 8,
    maTuyenXe: 'SG-DL',
    diemDi: 'TP.HCM',
    diemDen: 'Đà Lạt',
    nhaXe: { nhaXeId: 3, tenNhaXe: 'Nhà xe A' },
  },
  xe: {
    xeId: 4,
    bienSoXe: '51B-12345',
    trangThai: 'HOAT_DONG',
    loaiXeId: 2,
    loaiXe: { loaiXeId: 2, tenLoai: 'Giường nằm' },
  },
  createdAt: new Date('2026-10-01T10:00:00.000Z'),
  updatedAt: new Date('2026-10-01T10:00:00.000Z'),
  gheChuyenXes: [{ trangThai: 'TRONG' }, { trangThai: 'DA_DAT' }],
};

const secondTrip = {
  ...firstTrip,
  chuyenXeId: 22,
  maChuyenXe: 'CX-22',
  gioKhoiHanh: new Date('1970-01-01T20:00:00.000Z'),
  gheChuyenXes: [{ trangThai: 'TRONG' }],
};

function createService() {
  const prisma = {
    chuyenXe: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findFirstOrThrow: vi.fn(),
    },
    bangGia: { findMany: vi.fn(), findFirst: vi.fn() },
    gheChuyenXe: { findMany: vi.fn(), findFirst: vi.fn() },
    tuyenXe: { findFirst: vi.fn() },
    xe: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma));
  return {
    prisma,
    service: new TripsService(
      prisma as unknown as PrismaService,
      {
        get: vi.fn().mockReturnValue('Asia/Ho_Chi_Minh'),
      } as never,
    ),
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('TripsService search', () => {
  it('applies keyword and vehicle filters before pagination', async () => {
    const { prisma, service } = createService();
    prisma.chuyenXe.findMany.mockResolvedValue([]);

    await service.search({
      search: 'Nhà xe A',
      vehicleType: 'Giường',
      page: 1,
      pageSize: 10,
      sortBy: 'departureTime',
      sortDirection: 'asc',
    } as never);

    expect(prisma.chuyenXe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            {
              OR: expect.arrayContaining([
                { tuyenXe: { nhaXe: { tenNhaXe: { contains: 'Nhà xe A' } } } },
                { xe: { loaiXe: { tenLoai: { contains: 'Nhà xe A' } } } },
              ]),
            },
            { xe: { loaiXe: { tenLoai: { contains: 'Giường' } } } },
          ]),
        }),
      }),
    );
  });

  it('returns real database fields, applicable fares and pagination without fabricated display data', async () => {
    const { prisma, service } = createService();
    prisma.chuyenXe.findMany.mockResolvedValue([firstTrip, secondTrip]);
    prisma.bangGia.findMany.mockResolvedValue([
      {
        bangGiaId: 10,
        nhaXeId: 3,
        tuyenXeId: 8,
        loaiXeId: 2,
        giaNiemYet: 300000,
        tuNgay: new Date('2026-10-01T00:00:00.000Z'),
        denNgay: null,
      },
    ]);

    const result = await service.search({
      from: 'TP.HCM',
      to: 'Đà Lạt',
      departureDate: '2026-10-15',
      page: 1,
      pageSize: 1,
      sortBy: 'departureTime',
      sortDirection: 'asc',
    });

    expect(result).toEqual({
      data: [
        {
          id: 22,
          code: 'CX-22',
          status: 'CHUA_KHOI_HANH',
          busCompany: {
            id: 3,
            name: 'Nhà xe A',
            logo: null,
            rating: null,
            reviewsCount: null,
          },
          route: {
            id: 8,
            code: 'SG-DL',
            origin: 'TP.HCM',
            destination: 'Đà Lạt',
            distance: null,
            durationMinutes: null,
          },
          departureTime: '2026-10-15T13:00:00.000Z',
          arrivalTime: null,
          vehicle: {
            id: 4,
            typeId: 2,
            type: 'Giường nằm',
            licensePlate: '51B-12345',
            capacity: 1,
            amenities: [],
          },
          price: 300000,
          availableSeats: 1,
        },
      ],
      meta: { page: 1, pageSize: 1, totalItems: 2, totalPages: 2 },
    });
  });

  it('filters by the backend fare and does not invent a fallback price', async () => {
    const { prisma, service } = createService();
    prisma.chuyenXe.findMany.mockResolvedValue([firstTrip]);
    prisma.bangGia.findMany.mockResolvedValue([]);

    const result = await service.search({
      minPrice: 1,
      page: 1,
      pageSize: 10,
      sortBy: 'departureTime',
      sortDirection: 'asc',
    });

    expect(result).toEqual({
      data: [],
      meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
    });
  });

  it('excludes an already departed trip even when its status is still CHUA_KHOI_HANH', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-15T14:00:00.000Z'));
    const { prisma, service } = createService();
    prisma.chuyenXe.findMany.mockResolvedValue([
      secondTrip,
      {
        ...firstTrip,
        chuyenXeId: 23,
        maChuyenXe: 'CX-23',
        gioKhoiHanh: new Date('1970-01-01T22:30:00.000Z'),
      },
    ]);
    prisma.bangGia.findMany.mockResolvedValue([]);

    const result = await service.search({
      page: 1,
      pageSize: 10,
      sortBy: 'departureTime',
      sortDirection: 'asc',
    });

    expect(result.data.map((trip) => trip.id)).toEqual([23]);
    expect(result.meta.totalItems).toBe(1);
  });

  it('resolves each trip fare from the price period covering that trip date', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T00:00:00.000Z'));
    const { prisma, service } = createService();
    const novemberTrip = {
      ...secondTrip,
      chuyenXeId: 24,
      maChuyenXe: 'CX-24',
      ngayKhoiHanh: new Date('2026-11-15T00:00:00.000Z'),
    };
    prisma.chuyenXe.findMany.mockResolvedValue([firstTrip, novemberTrip]);
    prisma.bangGia.findMany.mockResolvedValue([
      {
        bangGiaId: 10,
        nhaXeId: 3,
        tuyenXeId: 8,
        loaiXeId: 2,
        giaNiemYet: 300000,
        tuNgay: new Date('2026-10-01T00:00:00.000Z'),
        denNgay: new Date('2026-10-31T00:00:00.000Z'),
      },
      {
        bangGiaId: 11,
        nhaXeId: 3,
        tuyenXeId: 8,
        loaiXeId: 2,
        giaNiemYet: 350000,
        tuNgay: new Date('2026-11-01T00:00:00.000Z'),
        denNgay: null,
      },
    ]);

    const result = await service.search({
      page: 1,
      pageSize: 10,
      sortBy: 'departureTime',
      sortDirection: 'asc',
    });

    expect(result.data.map(({ id, price }) => ({ id, price }))).toEqual([
      { id: 21, price: 300000 },
      { id: 24, price: 350000 },
    ]);
  });
});

describe('TripsService detail', () => {
  it('maps one trip without random ratings, guessed duration or fallback fare', async () => {
    const { prisma, service } = createService();
    prisma.chuyenXe.findUnique.mockResolvedValue(firstTrip);
    prisma.bangGia.findFirst.mockResolvedValue(null);

    await expect(service.getDetails(21)).resolves.toMatchObject({
      id: 21,
      busCompany: { logo: null, rating: null, reviewsCount: null },
      route: { distance: null, durationMinutes: null },
      arrivalTime: null,
      vehicle: { capacity: 2, amenities: [] },
      price: null,
      availableSeats: 1,
    });
  });
});

const tenantPrincipal = {
  accountId: 2,
  nhanVienId: 10,
  nhaXeId: 3,
  khachHangId: null,
  roles: ['NHA_XE_ADMIN'],
  permissions: ['trip:read'],
  hoTen: 'Admin FUTA',
  soDienThoai: '0901234567',
  email: 'admin@futa.vn',
  trangThai: 'HOAT_DONG',
};

describe('TripsService findAll (Feature 05)', () => {
  it('scopes trips to authenticated tenant and maps them to canonical format', async () => {
    const { prisma, service } = createService();
    prisma.chuyenXe.findMany.mockResolvedValue([firstTrip]);
    prisma.chuyenXe.count = vi.fn().mockResolvedValue(1);

    const result = await service.findAll(
      { page: 1, pageSize: 10, sortBy: 'departureDate', sortDirection: 'asc' },
      tenantPrincipal as never,
    );

    expect(prisma.chuyenXe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ nhaXeId: 3 }),
        skip: 0,
        take: 10,
      }),
    );
    expect(result).toEqual({
      data: [
        {
          tripId: 21,
          code: 'CX-21',
          departureDate: '2026-10-15',
          departureTime: '22:00:00',
          status: 'CHUA_KHOI_HANH',
          route: {
            routeId: 8,
            code: 'SG-DL',
            origin: 'TP.HCM',
            destination: 'Đà Lạt',
          },
          vehicle: {
            vehicleId: 4,
            licensePlate: '51B-12345',
            status: 'HOAT_DONG',
            vehicleType: {
              vehicleTypeId: 2,
              name: 'Giường nằm',
            },
          },
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      ],
      meta: {
        page: 1,
        pageSize: 10,
        totalItems: 1,
        totalPages: 1,
      },
    });
  });

  it('filters by status, route, vehicle and departure date', async () => {
    const { prisma, service } = createService();
    prisma.chuyenXe.findMany.mockResolvedValue([]);
    prisma.chuyenXe.count = vi.fn().mockResolvedValue(0);

    await service.findAll(
      {
        page: 1,
        pageSize: 10,
        sortBy: 'departureDate',
        sortDirection: 'asc',
        status: 'CHUA_KHOI_HANH',
        routeId: 8,
        vehicleId: 4,
        departureDate: '2026-10-15',
        search: 'CX-21',
      },
      tenantPrincipal as never,
    );

    expect(prisma.chuyenXe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          nhaXeId: 3,
          trangThai: 'CHUA_KHOI_HANH',
          tuyenXeId: 8,
          xeId: 4,
          ngayKhoiHanh: new Date('2026-10-15T00:00:00.000Z'),
          OR: expect.arrayContaining([
            { maChuyenXe: { contains: 'CX-21' } },
            { tuyenXe: { is: { maTuyenXe: { contains: 'CX-21' } } } },
            { tuyenXe: { is: { diemDi: { contains: 'CX-21' } } } },
            { tuyenXe: { is: { diemDen: { contains: 'CX-21' } } } },
            { xe: { is: { bienSoXe: { contains: 'CX-21' } } } },
          ]),
        }),
      }),
    );
  });
});

describe('TripsService findOne (Feature 05)', () => {
  it('returns trip details and aggregates seat summary', async () => {
    const { prisma, service } = createService();
    prisma.chuyenXe.findFirst = vi.fn().mockResolvedValue({
      ...firstTrip,
      gheChuyenXes: [
        { trangThai: 'TRONG' },
        { trangThai: 'TRONG' },
        { trangThai: 'DANG_GIU' },
        { trangThai: 'DA_DAT' },
      ],
    });

    const result = await service.findOne(21, tenantPrincipal as never);

    expect(prisma.chuyenXe.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { chuyenXeId: 21, nhaXeId: 3 },
      }),
    );
    expect(result.data.seatSummary).toEqual({
      total: 4,
      available: 2,
      held: 1,
      booked: 1,
    });
  });

  it('throws 404 when trip is not found or belongs to another tenant', async () => {
    const { prisma, service } = createService();
    prisma.chuyenXe.findFirst = vi.fn().mockResolvedValue(null);

    await expect(
      service.findOne(999, tenantPrincipal as never),
    ).rejects.toMatchObject({
      status: 404,
      response: {
        error: 'TRIP_NOT_FOUND',
        message: 'Không tìm thấy chuyến xe.',
      },
    });
  });
});

describe('TripsService create (05.2)', () => {
  const createDto = {
    code: 'FUTA-CX-99',
    routeId: 8,
    vehicleId: 4,
    departureDate: '2026-10-20',
    departureTime: '08:00:00',
  };

  it('throws 404 ROUTE_NOT_FOUND when route does not belong to tenant', async () => {
    const { prisma, service } = createService();
    prisma.tuyenXe.findFirst.mockResolvedValue(null);

    await expect(
      service.create(createDto, tenantPrincipal as never),
    ).rejects.toMatchObject({
      status: 404,
      response: {
        error: 'ROUTE_NOT_FOUND',
        message: 'Không tìm thấy tuyến xe trong nhà xe.',
      },
    });
  });

  it('throws 409 ROUTE_NOT_ACTIVE when route is not HOAT_DONG', async () => {
    const { prisma, service } = createService();
    prisma.tuyenXe.findFirst.mockResolvedValue({
      tuyenXeId: 8,
      nhaXeId: 3,
      trangThai: 'TAM_NGUNG',
    });

    await expect(
      service.create(createDto, tenantPrincipal as never),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        error: 'ROUTE_NOT_ACTIVE',
        message: 'Tuyến xe đang tạm ngưng hoạt động, không thể lập chuyến.',
      },
    });
  });

  it('throws 404 VEHICLE_NOT_FOUND when vehicle does not belong to tenant', async () => {
    const { prisma, service } = createService();
    prisma.tuyenXe.findFirst.mockResolvedValue({
      tuyenXeId: 8,
      nhaXeId: 3,
      trangThai: 'HOAT_DONG',
    });
    prisma.xe.findFirst.mockResolvedValue(null);

    await expect(
      service.create(createDto, tenantPrincipal as never),
    ).rejects.toMatchObject({
      status: 404,
      response: {
        error: 'VEHICLE_NOT_FOUND',
        message: 'Không tìm thấy xe trong nhà xe.',
      },
    });
  });

  it('throws 409 VEHICLE_NOT_ACTIVE when vehicle is not HOAT_DONG', async () => {
    const { prisma, service } = createService();
    prisma.tuyenXe.findFirst.mockResolvedValue({
      tuyenXeId: 8,
      nhaXeId: 3,
      trangThai: 'HOAT_DONG',
    });
    prisma.xe.findFirst.mockResolvedValue({
      xeId: 4,
      nhaXeId: 3,
      trangThai: 'TAM_NGUNG',
      ghes: [{ gheId: 1 }],
    });

    await expect(
      service.create(createDto, tenantPrincipal as never),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        error: 'VEHICLE_NOT_ACTIVE',
        message: 'Xe đang không hoạt động, không thể phân công vào chuyến.',
      },
    });
  });

  it('throws 409 VEHICLE_HAS_NO_SEATS when vehicle has no configured seats', async () => {
    const { prisma, service } = createService();
    prisma.tuyenXe.findFirst.mockResolvedValue({
      tuyenXeId: 8,
      nhaXeId: 3,
      trangThai: 'HOAT_DONG',
    });
    prisma.xe.findFirst.mockResolvedValue({
      xeId: 4,
      nhaXeId: 3,
      trangThai: 'HOAT_DONG',
      ghes: [],
    });

    await expect(
      service.create(createDto, tenantPrincipal as never),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        error: 'VEHICLE_HAS_NO_SEATS',
        message: 'Xe chưa được cấu hình ghế nên chưa thể lập chuyến.',
      },
    });
  });

  it('throws 409 TRIP_CODE_EXISTS when trip code already exists', async () => {
    const { prisma, service } = createService();
    prisma.tuyenXe.findFirst.mockResolvedValue({
      tuyenXeId: 8,
      nhaXeId: 3,
      trangThai: 'HOAT_DONG',
    });
    prisma.xe.findFirst.mockResolvedValue({
      xeId: 4,
      nhaXeId: 3,
      trangThai: 'HOAT_DONG',
      ghes: [{ gheId: 1 }, { gheId: 2 }],
    });
    prisma.chuyenXe.findFirst.mockResolvedValue({ chuyenXeId: 10 });

    await expect(
      service.create(createDto, tenantPrincipal as never),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        error: 'TRIP_CODE_EXISTS',
        message: 'Mã chuyến xe đã tồn tại.',
      },
    });
  });

  it('creates trip and GheChuyenXe snapshot initialized to TRONG atomically', async () => {
    const { prisma, service } = createService();
    prisma.tuyenXe.findFirst.mockResolvedValue({
      tuyenXeId: 8,
      nhaXeId: 3,
      trangThai: 'HOAT_DONG',
    });
    prisma.xe.findFirst.mockResolvedValue({
      xeId: 4,
      nhaXeId: 3,
      trangThai: 'HOAT_DONG',
      ghes: [{ gheId: 1 }, { gheId: 2 }],
    });
    prisma.chuyenXe.findFirst.mockResolvedValue(null);

    const createdTrip = {
      ...firstTrip,
      chuyenXeId: 99,
      maChuyenXe: 'FUTA-CX-99',
      gheChuyenXes: [{ trangThai: 'TRONG' }, { trangThai: 'TRONG' }],
    };
    prisma.chuyenXe.create.mockResolvedValue(createdTrip);

    const result = await service.create(createDto, tenantPrincipal as never);

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.chuyenXe.create).toHaveBeenCalledWith({
      data: {
        maChuyenXe: 'FUTA-CX-99',
        ngayKhoiHanh: new Date('2026-10-20T00:00:00.000Z'),
        gioKhoiHanh: new Date('1970-01-01T08:00:00.000Z'),
        trangThai: 'CHUA_KHOI_HANH',
        nhaXeId: 3,
        tuyenXeId: 8,
        xeId: 4,
        gheChuyenXes: {
          create: [{ gheId: 1, trangThai: 'TRONG' }, { gheId: 2, trangThai: 'TRONG' }],
        },
      },
      include: {
        tuyenXe: true,
        xe: { include: { loaiXe: true } },
        gheChuyenXes: { select: { trangThai: true } },
      },
    });
    expect(result.data.seatSummary).toEqual({
      total: 2,
      available: 2,
      held: 0,
      booked: 0,
    });
  });
});

describe('TripsService update (05.2)', () => {
  const updateDto = {
    departureDate: '2026-10-21',
    departureTime: '09:30:00',
  };

  it('throws 404 TRIP_NOT_FOUND when trip does not belong to tenant', async () => {
    const { prisma, service } = createService();
    prisma.chuyenXe.findFirst.mockResolvedValue(null);

    await expect(
      service.update(999, updateDto, tenantPrincipal as never),
    ).rejects.toMatchObject({
      status: 404,
      response: {
        error: 'TRIP_NOT_FOUND',
        message: 'Không tìm thấy chuyến xe.',
      },
    });
  });

  it('updates departureDate and departureTime and returns updated trip with seatSummary', async () => {
    const { prisma, service } = createService();
    prisma.chuyenXe.findFirst.mockResolvedValue(firstTrip);

    const updatedTrip = {
      ...firstTrip,
      ngayKhoiHanh: new Date('2026-10-21T00:00:00.000Z'),
      gioKhoiHanh: new Date('1970-01-01T09:30:00.000Z'),
    };
    prisma.chuyenXe.updateMany.mockResolvedValue({ count: 1 });
    prisma.chuyenXe.findFirstOrThrow.mockResolvedValue(updatedTrip);

    const result = await service.update(21, updateDto, tenantPrincipal as never);

    expect(prisma.chuyenXe.updateMany).toHaveBeenCalledWith({
      where: { chuyenXeId: 21, nhaXeId: 3, trangThai: 'CHUA_KHOI_HANH' },
      data: {
        ngayKhoiHanh: new Date('2026-10-21T00:00:00.000Z'),
        gioKhoiHanh: new Date('1970-01-01T09:30:00.000Z'),
      },
    });
    expect(result.data.departureDate).toBe('2026-10-21');
    expect(result.data.departureTime).toBe('09:30:00');
  });

  it('throws 409 TRIP_STATUS_TRANSITION_NOT_ALLOWED when updating non-CHUA_KHOI_HANH trip (e.g. DANG_CHAY, HOAN_THANH, DA_HUY)', async () => {
    const { prisma, service } = createService();

    // DANG_CHAY
    prisma.chuyenXe.findFirst.mockResolvedValue({
      ...firstTrip,
      trangThai: 'DANG_CHAY',
    });
    await expect(
      service.update(21, updateDto, tenantPrincipal as never),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        error: 'TRIP_STATUS_TRANSITION_NOT_ALLOWED',
        message: 'Chỉ có thể cập nhật chuyến xe khi chưa khởi hành.',
      },
    });

    // HOAN_THANH
    prisma.chuyenXe.findFirst.mockResolvedValue({
      ...firstTrip,
      trangThai: 'HOAN_THANH',
    });
    await expect(
      service.update(21, updateDto, tenantPrincipal as never),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        error: 'TRIP_STATUS_TRANSITION_NOT_ALLOWED',
        message: 'Chỉ có thể cập nhật chuyến xe khi chưa khởi hành.',
      },
    });

    // DA_HUY
    prisma.chuyenXe.findFirst.mockResolvedValue({
      ...firstTrip,
      trangThai: 'DA_HUY',
    });
    await expect(
      service.update(21, updateDto, tenantPrincipal as never),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        error: 'TRIP_STATUS_TRANSITION_NOT_ALLOWED',
        message: 'Chỉ có thể cập nhật chuyến xe khi chưa khởi hành.',
      },
    });
  });

  it('handles race condition during update when state changes concurrently', async () => {
    const { prisma, service } = createService();
    prisma.chuyenXe.findFirst
      .mockResolvedValueOnce({
        ...firstTrip,
        trangThai: 'CHUA_KHOI_HANH',
      })
      .mockResolvedValueOnce({
        ...firstTrip,
        trangThai: 'DANG_CHAY',
      });
    prisma.chuyenXe.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.update(21, updateDto, tenantPrincipal as never),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        error: 'TRIP_STATUS_TRANSITION_NOT_ALLOWED',
        message: 'Chỉ có thể cập nhật chuyến xe khi chưa khởi hành.',
      },
    });
  });
});

describe('TripsService.updateStatus', () => {
  it('throws 404 TRIP_NOT_FOUND when trip is not in tenant scope', async () => {
    const { prisma, service } = createService();
    prisma.chuyenXe.findFirst.mockResolvedValue(null);

    await expect(
      service.updateStatus(999, { status: 'DANG_CHAY' }, tenantPrincipal as never),
    ).rejects.toMatchObject({
      status: 404,
      response: {
        error: 'TRIP_NOT_FOUND',
        message: 'Không tìm thấy chuyến xe.',
      },
    });
  });

  it('handles idempotent same-state update without querying updateMany', async () => {
    const { prisma, service } = createService();
    prisma.chuyenXe.findFirst.mockResolvedValue({
      ...firstTrip,
      trangThai: 'DANG_CHAY',
    });

    const result = await service.updateStatus(
      21,
      { status: 'DANG_CHAY' },
      tenantPrincipal as never,
    );

    expect(prisma.chuyenXe.updateMany).not.toHaveBeenCalled();
    expect(result.data.status).toBe('DANG_CHAY');
  });

  it('allows valid transition CHUA_KHOI_HANH -> DANG_CHAY', async () => {
    const { prisma, service } = createService();
    prisma.chuyenXe.findFirst.mockResolvedValue({
      ...firstTrip,
      trangThai: 'CHUA_KHOI_HANH',
    });
    prisma.chuyenXe.updateMany.mockResolvedValue({ count: 1 });
    prisma.chuyenXe.findFirstOrThrow.mockResolvedValue({
      ...firstTrip,
      trangThai: 'DANG_CHAY',
    });

    const result = await service.updateStatus(
      21,
      { status: 'DANG_CHAY' },
      tenantPrincipal as never,
    );

    expect(prisma.chuyenXe.updateMany).toHaveBeenCalledWith({
      where: { chuyenXeId: 21, nhaXeId: 3, trangThai: 'CHUA_KHOI_HANH' },
      data: { trangThai: 'DANG_CHAY' },
    });
    expect(result.data.status).toBe('DANG_CHAY');
  });

  it('allows valid transition DANG_CHAY -> HOAN_THANH', async () => {
    const { prisma, service } = createService();
    prisma.chuyenXe.findFirst.mockResolvedValue({
      ...firstTrip,
      trangThai: 'DANG_CHAY',
    });
    prisma.chuyenXe.updateMany.mockResolvedValue({ count: 1 });
    prisma.chuyenXe.findFirstOrThrow.mockResolvedValue({
      ...firstTrip,
      trangThai: 'HOAN_THANH',
    });

    const result = await service.updateStatus(
      21,
      { status: 'HOAN_THANH' },
      tenantPrincipal as never,
    );

    expect(prisma.chuyenXe.updateMany).toHaveBeenCalledWith({
      where: { chuyenXeId: 21, nhaXeId: 3, trangThai: 'DANG_CHAY' },
      data: { trangThai: 'HOAN_THANH' },
    });
    expect(result.data.status).toBe('HOAN_THANH');
  });

  it('rejects invalid backward or skipped transitions with 409', async () => {
    const { prisma, service } = createService();

    // CHUA_KHOI_HANH -> HOAN_THANH (skip)
    prisma.chuyenXe.findFirst.mockResolvedValue({
      ...firstTrip,
      trangThai: 'CHUA_KHOI_HANH',
    });
    await expect(
      service.updateStatus(21, { status: 'HOAN_THANH' }, tenantPrincipal as never),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        error: 'TRIP_STATUS_TRANSITION_NOT_ALLOWED',
        message: 'Không thể chuyển chuyến xe sang trạng thái yêu cầu.',
      },
    });

    // DANG_CHAY -> CHUA_KHOI_HANH (backward)
    prisma.chuyenXe.findFirst.mockResolvedValue({
      ...firstTrip,
      trangThai: 'DANG_CHAY',
    });
    await expect(
      service.updateStatus(21, { status: 'CHUA_KHOI_HANH' }, tenantPrincipal as never),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        error: 'TRIP_STATUS_TRANSITION_NOT_ALLOWED',
      },
    });

    // HOAN_THANH -> DANG_CHAY (terminal)
    prisma.chuyenXe.findFirst.mockResolvedValue({
      ...firstTrip,
      trangThai: 'HOAN_THANH',
    });
    await expect(
      service.updateStatus(21, { status: 'DANG_CHAY' }, tenantPrincipal as never),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        error: 'TRIP_STATUS_TRANSITION_NOT_ALLOWED',
      },
    });
  });

  it('handles race condition when updateMany count is 0', async () => {
    const { prisma, service } = createService();
    prisma.chuyenXe.findFirst
      .mockResolvedValueOnce({
        ...firstTrip,
        trangThai: 'CHUA_KHOI_HANH',
      })
      .mockResolvedValueOnce({
        ...firstTrip,
        trangThai: 'DA_HUY',
      });
    prisma.chuyenXe.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.updateStatus(21, { status: 'DANG_CHAY' }, tenantPrincipal as never),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        error: 'TRIP_STATUS_TRANSITION_NOT_ALLOWED',
      },
    });
  });
});

describe('TripsService.cancel', () => {
  it('throws 404 TRIP_NOT_FOUND when trip is not in tenant scope', async () => {
    const { prisma, service } = createService();
    prisma.chuyenXe.findFirst.mockResolvedValue(null);

    await expect(
      service.cancel(999, tenantPrincipal as never),
    ).rejects.toMatchObject({
      status: 404,
      response: {
        error: 'TRIP_NOT_FOUND',
        message: 'Không tìm thấy chuyến xe.',
      },
    });
  });

  it('handles idempotent same-state cancellation when already DA_HUY', async () => {
    const { prisma, service } = createService();
    prisma.chuyenXe.findFirst.mockResolvedValue({
      ...firstTrip,
      trangThai: 'DA_HUY',
    });

    const result = await service.cancel(21, tenantPrincipal as never);

    expect(prisma.chuyenXe.updateMany).not.toHaveBeenCalled();
    expect(result.data.status).toBe('DA_HUY');
  });

  it('successfully cancels trip in CHUA_KHOI_HANH state', async () => {
    const { prisma, service } = createService();
    prisma.chuyenXe.findFirst.mockResolvedValue({
      ...firstTrip,
      trangThai: 'CHUA_KHOI_HANH',
    });
    prisma.gheChuyenXe.findFirst.mockResolvedValue(null);
    prisma.chuyenXe.updateMany.mockResolvedValue({ count: 1 });
    prisma.chuyenXe.findFirstOrThrow.mockResolvedValue({
      ...firstTrip,
      trangThai: 'DA_HUY',
    });

    const result = await service.cancel(21, tenantPrincipal as never);

    expect(prisma.chuyenXe.updateMany).toHaveBeenCalledWith({
      where: { chuyenXeId: 21, nhaXeId: 3, trangThai: 'CHUA_KHOI_HANH' },
      data: { trangThai: 'DA_HUY' },
    });
    expect(result.data.status).toBe('DA_HUY');
  });

  it('throws 409 TRIP_HAS_ACTIVE_BOOKINGS when trip has active booked/held seats or tickets', async () => {
    const { prisma, service } = createService();
    prisma.chuyenXe.findFirst.mockResolvedValue({
      ...firstTrip,
      trangThai: 'CHUA_KHOI_HANH',
    });
    prisma.gheChuyenXe.findFirst.mockResolvedValue({ gheChuyenXeId: 101 });

    await expect(
      service.cancel(21, tenantPrincipal as never),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        error: 'TRIP_HAS_ACTIVE_BOOKINGS',
        message: 'Không thể hủy chuyến xe đã có vé hoặc đang có khách giữ chỗ.',
      },
    });
    expect(prisma.chuyenXe.updateMany).not.toHaveBeenCalled();
  });

  it('rejects cancellation of running or completed trips with 409', async () => {
    const { prisma, service } = createService();

    // DANG_CHAY
    prisma.chuyenXe.findFirst.mockResolvedValue({
      ...firstTrip,
      trangThai: 'DANG_CHAY',
    });
    await expect(
      service.cancel(21, tenantPrincipal as never),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        error: 'TRIP_STATUS_TRANSITION_NOT_ALLOWED',
        message: 'Không thể hủy chuyến xe đang chạy hoặc đã hoàn thành.',
      },
    });

    // HOAN_THANH
    prisma.chuyenXe.findFirst.mockResolvedValue({
      ...firstTrip,
      trangThai: 'HOAN_THANH',
    });
    await expect(
      service.cancel(21, tenantPrincipal as never),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        error: 'TRIP_STATUS_TRANSITION_NOT_ALLOWED',
        message: 'Không thể hủy chuyến xe đang chạy hoặc đã hoàn thành.',
      },
    });
  });

  it('handles race condition during cancel when state changes concurrently', async () => {
    const { prisma, service } = createService();
    prisma.chuyenXe.findFirst
      .mockResolvedValueOnce({
        ...firstTrip,
        trangThai: 'CHUA_KHOI_HANH',
      })
      .mockResolvedValueOnce({
        ...firstTrip,
        trangThai: 'DANG_CHAY',
      });
    prisma.chuyenXe.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.cancel(21, tenantPrincipal as never),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        error: 'TRIP_STATUS_TRANSITION_NOT_ALLOWED',
      },
    });
  });
});

describe('TripsService.getSeats', () => {
  const mockSeats = [
    {
      gheChuyenXeId: 102,
      chuyenXeId: 21,
      gheId: 52,
      trangThai: 'DANG_GIU',
      createdAt: new Date('2026-10-01T10:00:00.000Z'),
      updatedAt: new Date('2026-10-01T10:00:00.000Z'),
      ghe: {
        gheId: 52,
        soGhe: 'A02',
        viTri: 'Tầng dưới',
      },
    },
    {
      gheChuyenXeId: 101,
      chuyenXeId: 21,
      gheId: 51,
      trangThai: 'TRONG',
      createdAt: new Date('2026-10-01T10:00:00.000Z'),
      updatedAt: new Date('2026-10-01T10:00:00.000Z'),
      ghe: {
        gheId: 51,
        soGhe: 'A01',
        viTri: 'Tầng dưới',
      },
    },
    {
      gheChuyenXeId: 103,
      chuyenXeId: 21,
      gheId: 53,
      trangThai: 'DA_DAT',
      createdAt: new Date('2026-10-01T10:00:00.000Z'),
      updatedAt: new Date('2026-10-01T10:00:00.000Z'),
      ghe: {
        gheId: 53,
        soGhe: 'B01',
        viTri: 'Tầng trên',
      },
    },
  ];

  it('returns sorted seats with exact meta counts when query is empty', async () => {
    const { prisma, service } = createService();
    prisma.chuyenXe.findFirst.mockResolvedValue({ chuyenXeId: 21 });
    prisma.gheChuyenXe.findMany.mockResolvedValue([...mockSeats]);

    const result = await service.getSeats(21, {}, tenantPrincipal as never);

    expect(prisma.chuyenXe.findFirst).toHaveBeenCalledWith({
      where: { chuyenXeId: 21, nhaXeId: 3 },
      select: { chuyenXeId: true },
    });
    expect(result.meta).toEqual({
      tripId: 21,
      total: 3,
      available: 1,
      held: 1,
      booked: 1,
    });
    expect(result.data).toHaveLength(3);
    expect(result.data[0].seat.code).toBe('A01');
    expect(result.data[0].status).toBe('TRONG');
    expect(result.data[0].seat.position).toBe('Tầng dưới');
    expect(result.data[1].seat.code).toBe('A02');
    expect(result.data[2].seat.code).toBe('B01');
  });

  it('filters data by status while keeping accurate total meta counts', async () => {
    const { prisma, service } = createService();
    prisma.chuyenXe.findFirst.mockResolvedValue({ chuyenXeId: 21 });
    prisma.gheChuyenXe.findMany.mockResolvedValue([...mockSeats]);

    const result = await service.getSeats(21, { status: 'TRONG' }, tenantPrincipal as never);

    expect(result.data).toHaveLength(1);
    expect(result.data[0].seat.code).toBe('A01');
    expect(result.data[0].status).toBe('TRONG');
    expect(result.meta).toEqual({
      tripId: 21,
      total: 3,
      available: 1,
      held: 1,
      booked: 1,
    });
  });

  it('throws 404 TRIP_NOT_FOUND when trip is outside tenant scope', async () => {
    const { prisma, service } = createService();
    prisma.chuyenXe.findFirst.mockResolvedValue(null);

    await expect(
      service.getSeats(999, {}, tenantPrincipal as never),
    ).rejects.toMatchObject({
      status: 404,
      response: {
        error: 'TRIP_NOT_FOUND',
        message: 'Không tìm thấy chuyến xe.',
      },
    });
  });
});
