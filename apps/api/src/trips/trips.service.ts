import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SearchTripsDto } from './dto/search-trips.dto.js';
import { Prisma } from '../generated/prisma/client.js';

@Injectable()
export class TripsService {
  constructor(private readonly prisma: PrismaService) {}

  async search(dto: SearchTripsDto) {
    const where: Prisma.ChuyenXeWhereInput = {
      trangThai: 'MO_BAN',
    };

    if (dto.origin || dto.destination) {
      where.tuyenXe = {};
      if (dto.origin) {
        where.tuyenXe.diemDi = { contains: dto.origin };
      }
      if (dto.destination) {
        where.tuyenXe.diemDen = { contains: dto.destination };
      }
    }

    if (dto.date) {
      where.ngayKhoiHanh = new Date(`${dto.date}T00:00:00.000Z`);
    }

    const chuyenXes = await this.prisma.chuyenXe.findMany({
      where,
      include: {
        tuyenXe: { include: { nhaXe: true } },
        xe: { include: { loaiXe: true } },
        gheChuyenXes: { where: { trangThai: 'TRONG' } },
      },
    });

    const prices = await this.prisma.bangGia.findMany({
      where: {
        trangThai: 'HOAT_DONG',
        tuNgay: { lte: dto.date ? new Date(`${dto.date}T00:00:00.000Z`) : new Date() },
        OR: [
          { denNgay: null },
          { denNgay: { gte: dto.date ? new Date(`${dto.date}T00:00:00.000Z`) : new Date() } },
        ],
      },
    });

    return chuyenXes.map((cx) => {
      // Find fare price
      const bangGia = prices.find(
        (bg) => bg.tuyenXeId === cx.tuyenXeId && bg.loaiXeId === cx.xe.loaiXeId && bg.nhaXeId === cx.nhaXeId
      );
      
      const departureDate = new Date(cx.ngayKhoiHanh);
      const departureTime = new Date(cx.gioKhoiHanh);
      departureDate.setUTCHours(departureTime.getUTCHours(), departureTime.getUTCMinutes(), 0, 0);

      // Mock arrival time (add 8 hours)
      const arrivalDate = new Date(departureDate);
      arrivalDate.setUTCHours(arrivalDate.getUTCHours() + 8);

      return {
        id: cx.chuyenXeId,
        busCompany: {
          id: cx.tuyenXe.nhaXe.nhaXeId,
          name: cx.tuyenXe.nhaXe.tenNhaXe,
          logo: '/images/futa.png', // Mocked
          rating: 4.8, // Mocked
          reviewsCount: Math.floor(Math.random() * 500) + 100, // Mocked
        },
        route: {
          origin: cx.tuyenXe.diemDi,
          destination: cx.tuyenXe.diemDen,
          distance: 300, // Mocked
          durationMinutes: 480, // Mocked 8 hours
        },
        departureTime: departureDate.toISOString(),
        arrivalTime: arrivalDate.toISOString(),
        vehicle: {
          type: cx.xe.loaiXe.tenLoai,
          capacity: cx.gheChuyenXes.length + (cx.xe.loaiXe.tenLoai.includes('34') ? 34 : 40), // Approximate
          amenities: ['Wifi', 'Nước suối', 'Chăn đắp', 'WC'], // Mocked
        },
        price: bangGia ? Number(bangGia.giaNiemYet) : 300000,
        availableSeats: cx.gheChuyenXes.length,
      };
    });
  }

  async getDetails(id: number) {
    const cx = await this.prisma.chuyenXe.findUnique({
      where: { chuyenXeId: id },
      include: {
        tuyenXe: { include: { nhaXe: true } },
        xe: { include: { loaiXe: true } },
        gheChuyenXes: { where: { trangThai: 'TRONG' } },
      },
    });

    if (!cx) {
      throw new NotFoundException({
        error: 'TRIP_NOT_FOUND',
        message: 'Không tìm thấy chuyến xe.',
      });
    }

    const bangGia = await this.prisma.bangGia.findFirst({
      where: {
        trangThai: 'HOAT_DONG',
        nhaXeId: cx.nhaXeId,
        tuyenXeId: cx.tuyenXeId,
        loaiXeId: cx.xe.loaiXeId,
        tuNgay: { lte: cx.ngayKhoiHanh },
        OR: [{ denNgay: null }, { denNgay: { gte: cx.ngayKhoiHanh } }],
      },
    });

    const departureDate = new Date(cx.ngayKhoiHanh);
    const departureTime = new Date(cx.gioKhoiHanh);
    departureDate.setUTCHours(departureTime.getUTCHours(), departureTime.getUTCMinutes(), 0, 0);

    const arrivalDate = new Date(departureDate);
    arrivalDate.setUTCHours(arrivalDate.getUTCHours() + 8);

    return {
      id: cx.chuyenXeId,
      busCompany: {
        id: cx.tuyenXe.nhaXe.nhaXeId,
        name: cx.tuyenXe.nhaXe.tenNhaXe,
        logo: '/images/futa.png', // Mocked
        rating: 4.8, // Mocked
        reviewsCount: 1500, // Mocked
      },
      route: {
        origin: cx.tuyenXe.diemDi,
        destination: cx.tuyenXe.diemDen,
        distance: 300, // Mocked
        durationMinutes: 480, // Mocked 8 hours
      },
      departureTime: departureDate.toISOString(),
      arrivalTime: arrivalDate.toISOString(),
      vehicle: {
        type: cx.xe.loaiXe.tenLoai,
        capacity: cx.gheChuyenXes.length + 30, // Approximate
        amenities: ['Wifi', 'Nước suối', 'Chăn đắp', 'WC'], // Mocked
      },
      price: bangGia ? Number(bangGia.giaNiemYet) : 300000,
      availableSeats: cx.gheChuyenXes.length,
    };
  }

  async getSeats(id: number) {
    const gheChuyenXes = await this.prisma.gheChuyenXe.findMany({
      where: { chuyenXeId: id },
      include: { ghe: true },
      orderBy: { ghe: { soGhe: 'asc' } },
    });
    
    if (gheChuyenXes.length === 0) {
      throw new NotFoundException({
        error: 'TRIP_SEATS_NOT_FOUND',
        message: 'Không tìm thấy sơ đồ ghế cho chuyến xe này.',
      });
    }

    return gheChuyenXes.map((gx) => ({
      gheChuyenXeId: gx.gheChuyenXeId,
      soGhe: gx.ghe.soGhe,
      viTri: gx.ghe.viTri,
      trangThai: gx.trangThai,
    }));
  }
}
