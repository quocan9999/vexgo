import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import { TripsService } from '../../../src/trips/trips.service.js';

const firstTrip = {
  chuyenXeId: 21,
  maChuyenXe: 'CX-21',
  ngayKhoiHanh: new Date('2026-10-15T00:00:00.000Z'),
  gioKhoiHanh: new Date('1970-01-01T22:00:00.000Z'),
  trangThai: 'MO_BAN',
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
    loaiXeId: 2,
    loaiXe: { loaiXeId: 2, tenLoai: 'Giường nằm' },
  },
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
    chuyenXe: { findMany: vi.fn(), findUnique: vi.fn() },
    bangGia: { findMany: vi.fn(), findFirst: vi.fn() },
    gheChuyenXe: { findMany: vi.fn() },
  };
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
          status: 'MO_BAN',
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

  it('excludes an already departed trip even when its status is still MO_BAN', async () => {
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
