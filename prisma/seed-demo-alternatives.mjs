import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../apps/api/dist/generated/prisma/client.js';

function databaseConfig() {
  const raw = process.env.DATABASE_URL ?? process.env.MIGRATION_URL;
  if (!raw) throw new Error('DATABASE_URL is required');
  const url = new URL(raw);
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\/+/, '')),
    allowPublicKeyRetrieval: true,
  };
}

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(databaseConfig()) });

function dateOnly(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day));
}

function timeOnly(hour, minute = 0) {
  return new Date(Date.UTC(1970, 0, 1, hour, minute, 0));
}

async function main() {
  console.log('--- Đang tạo dữ liệu demo chuyến xe ngày 23/10/2026 ---');

  // Lấy các tuyến xe TP.HCM -> Đà Lạt
  const futaRoute = await prisma.tuyenXe.findFirst({
    where: { maTuyenXe: 'FUTA-TX-0001' },
    include: { nhaXe: true },
  });
  const tbRoute = await prisma.tuyenXe.findFirst({
    where: { maTuyenXe: 'TB-TX-0002' },
    include: { nhaXe: true },
  });
  const hmRoute = await prisma.tuyenXe.findFirst({
    where: { maTuyenXe: 'HM-TX-0004' },
    include: { nhaXe: true },
  });

  if (!futaRoute || !tbRoute || !hmRoute) {
    throw new Error('Không tìm thấy tuyến xe mẫu của Phương Trang, Thành Bưởi hoặc Hoa Mai');
  }

  // Lấy các xe theo biển số
  // FUTA: 30F-125.47 (Limousine), 30F-124.46 (Giường nằm), 30F-127.49 (Giường nằm)
  // TB: 51B-125.47 (Limousine), 51B-124.46 (Giường nằm)
  // HM: 29A-125.47 (Limousine), 29A-124.46 (Giường nằm)
  const futaLimo = await prisma.xe.findFirst({ where: { bienSoXe: '30F-125.47' }, include: { ghes: true, loaiXe: true } });
  const futaSleeper = await prisma.xe.findFirst({ where: { bienSoXe: '30F-124.46' }, include: { ghes: true, loaiXe: true } });
  const futaSleeper2 = await prisma.xe.findFirst({ where: { bienSoXe: '30F-127.49' }, include: { ghes: true, loaiXe: true } });

  const tbLimo = await prisma.xe.findFirst({ where: { bienSoXe: '51B-125.47' }, include: { ghes: true, loaiXe: true } });
  const tbSleeper = await prisma.xe.findFirst({ where: { bienSoXe: '51B-124.46' }, include: { ghes: true, loaiXe: true } });

  const hmLimo = await prisma.xe.findFirst({ where: { bienSoXe: '29A-125.47' }, include: { ghes: true, loaiXe: true } });
  const hmSleeper = await prisma.xe.findFirst({ where: { bienSoXe: '29A-124.46' }, include: { ghes: true, loaiXe: true } });

  const demoTrips = [
    // --- KHUNG GIỜ 08:00 SÁNG ---
    {
      maChuyenXe: 'TB-CX-23102026-0800',
      route: tbRoute,
      vehicle: tbLimo,
      hour: 8,
      arrHour: 15,
      note: 'Thành Bưởi - Limousine VIP (340.000đ) - Chuyến gốc giá cao',
    },
    {
      maChuyenXe: 'HM-CX-23102026-0800',
      route: hmRoute,
      vehicle: hmLimo,
      hour: 8,
      arrHour: 15,
      note: 'Hoa Mai - Limousine VIP (330.000đ) - Cùng giờ 08:00, tiết kiệm 10k',
    },
    {
      maChuyenXe: 'FUTA-CX-23102026-0800',
      route: futaRoute,
      vehicle: futaLimo,
      hour: 8,
      arrHour: 15,
      note: 'Phương Trang - Limousine VIP (320.000đ) - Cùng giờ 08:00, tiết kiệm 20k (4.8★)',
    },
    {
      maChuyenXe: 'FUTA-CX-23102026-0801',
      route: futaRoute,
      vehicle: futaSleeper,
      hour: 8,
      arrHour: 15,
      note: 'Phương Trang - Giường nằm (250.000đ) - Cùng giờ 08:00, tiết kiệm 90k (4.8★)',
    },

    // --- KHUNG GIỜ 22:00 ĐÊM ---
    {
      maChuyenXe: 'TB-CX-23102026-2200',
      route: tbRoute,
      vehicle: tbSleeper,
      hour: 22,
      arrHour: 5,
      note: 'Thành Bưởi - Giường nằm (270.000đ) - Chuyến đêm gốc',
    },
    {
      maChuyenXe: 'HM-CX-23102026-2200',
      route: hmRoute,
      vehicle: hmSleeper,
      hour: 22,
      arrHour: 5,
      note: 'Hoa Mai - Giường nằm (260.000đ) - Cùng giờ 22:00, tiết kiệm 10k',
    },
    {
      maChuyenXe: 'FUTA-CX-23102026-2200',
      route: futaRoute,
      vehicle: futaSleeper2,
      hour: 22,
      arrHour: 5,
      note: 'Phương Trang - Giường nằm (250.000đ) - Cùng giờ 22:00, tiết kiệm 20k (4.8★)',
    },
  ];

  for (const item of demoTrips) {
    const trip = await prisma.chuyenXe.upsert({
      where: { maChuyenXe: item.maChuyenXe },
      create: {
        maChuyenXe: item.maChuyenXe,
        ngayKhoiHanh: dateOnly(2026, 10, 23),
        gioKhoiHanh: timeOnly(item.hour, 0),
        gioDen: timeOnly(item.arrHour, 0),
        nhanGuiHang: true,
        sucChuaXeMay: item.vehicle.loaiXe.sucChuaXeMayMacDinh,
        sucChuaHangCongKenh: item.vehicle.loaiXe.sucChuaHangCongKenhMacDinh,
        sucChuaHangNhe: item.vehicle.loaiXe.sucChuaHangNheMacDinh,
        trangThai: 'CHUA_KHOI_HANH',
        nhaXeId: item.route.nhaXeId,
        tuyenXeId: item.route.tuyenXeId,
        xeId: item.vehicle.xeId,
      },
      update: {
        ngayKhoiHanh: dateOnly(2026, 10, 23),
        gioKhoiHanh: timeOnly(item.hour, 0),
        gioDen: timeOnly(item.arrHour, 0),
        trangThai: 'CHUA_KHOI_HANH',
        nhaXeId: item.route.nhaXeId,
        tuyenXeId: item.route.tuyenXeId,
        xeId: item.vehicle.xeId,
      },
    });

    // Tạo toàn bộ ghế trống cho chuyến xe
    let addedSeats = 0;
    for (const seat of item.vehicle.ghes) {
      await prisma.gheChuyenXe.upsert({
        where: {
          chuyenXeId_gheId: {
            chuyenXeId: trip.chuyenXeId,
            gheId: seat.gheId,
          },
        },
        create: {
          chuyenXeId: trip.chuyenXeId,
          gheId: seat.gheId,
          trangThai: 'TRONG',
        },
        update: {
          trangThai: 'TRONG',
        },
      });
      addedSeats++;
    }

    console.log(`✓ Đã tạo/cập nhật: ${item.maChuyenXe} | ${item.note} | ${addedSeats} ghế`);
  }

  console.log('\n--- Hoàn tất chèn dữ liệu demo 23/10/2026! ---');
}

main()
  .catch((e) => {
    console.error('Lỗi seed demo:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
