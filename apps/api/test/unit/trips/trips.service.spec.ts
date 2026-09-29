import { describe, expect, it, vi } from 'vitest';
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
    service: new TripsService(prisma as unknown as PrismaService),
  };
}

describe('TripsService search', () => {
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
          departureTime: '2026-10-15T20:00:00.000Z',
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
