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
  return new Date(Date.UTC(1970, 0, 1, hour, minute));
}

async function main() {
  console.log('Seeding trips for 29/10, 30/10, 31/10/2026...');

  const routes = await prisma.tuyenXe.findMany({
    where: { trangThai: 'HOAT_DONG' },
  });
  const routeByCode = new Map(routes.map(r => [r.maTuyenXe, r]));

  // Vehicles
  const futaCars = await prisma.xe.findMany({ where: { nhaXeId: 1 }, include: { ghes: true, loaiXe: true } });
  const tbCars = await prisma.xe.findMany({ where: { nhaXeId: 2 }, include: { ghes: true, loaiXe: true } });
  const hmCars = await prisma.xe.findMany({ where: { nhaXeId: 3 }, include: { ghes: true, loaiXe: true } });

  const futaSleeper = futaCars.find(c => c.loaiXeId === 2) || futaCars[0];
  const futaLimo = futaCars.find(c => c.loaiXeId === 3) || futaCars[0];
  const tbSleeper = tbCars.find(c => c.loaiXeId === 5) || tbCars[0];
  const hmSleeper = hmCars.find(c => c.loaiXeId === 8) || hmCars[0];
  const hmLimo = hmCars.find(c => c.loaiXeId === 9) || hmCars[0];

  const targetRoutes = [
    { code: 'FUTA-TX-0001', vehicle: futaSleeper, h: 20, m: 30, arrH: 3, arrM: 30 }, // TP.HCM -> Đà Lạt
    { code: 'TB-TX-0002', vehicle: tbSleeper, h: 21, m: 30, arrH: 4, arrM: 30 }, // TP.HCM -> Đà Lạt
    { code: 'HM-TX-0002', vehicle: hmLimo, h: 20, m: 0, arrH: 22, arrM: 30 }, // TP.HCM -> Vũng Tàu
    { code: 'HM-TX-0002', vehicle: hmLimo, h: 22, m: 0, arrH: 0, arrM: 30 }, // TP.HCM -> Vũng Tàu
    { code: 'FUTA-TX-0003', vehicle: futaSleeper, h: 21, m: 0, arrH: 5, arrM: 30 }, // TP.HCM -> Nha Trang
    { code: 'FUTA-TX-0002', vehicle: futaSleeper, h: 20, m: 30, arrH: 3, arrM: 30 }, // Đà Lạt -> TP.HCM
    { code: 'TB-TX-0001', vehicle: tbSleeper, h: 22, m: 0, arrH: 5, arrM: 0 }, // Đà Lạt -> TP.HCM
    { code: 'TB-TX-0003', vehicle: tbSleeper, h: 20, m: 0, arrH: 0, arrM: 0 }, // Đà Lạt -> Nha Trang
    { code: 'FUTA-TX-DL-DN', vehicle: futaSleeper, h: 20, m: 0, arrH: 10, arrM: 0 }, // Đà Lạt -> Đà Nẵng
    { code: 'FUTA-TX-DN-DL', vehicle: futaSleeper, h: 20, m: 30, arrH: 10, arrM: 30 }, // Đà Nẵng -> Đà Lạt
    { code: 'FUTA-TX-DN-SG', vehicle: futaSleeper, h: 20, m: 0, arrH: 14, arrM: 0 }, // Đà Nẵng -> TP.HCM
    { code: 'FUTA-TX-DN-NT', vehicle: futaLimo, h: 20, m: 30, arrH: 6, arrM: 30 }, // Đà Nẵng -> Nha Trang
  ];

  const dates = [
    { y: 2026, m: 10, d: 29, suffix: '29102026' },
    { y: 2026, m: 10, d: 30, suffix: '30102026' },
    { y: 2026, m: 10, d: 31, suffix: '31102026' },
  ];

  let tripCount = 0;
  for (const date of dates) {
    for (const [idx, tr] of targetRoutes.entries()) {
      const route = routeByCode.get(tr.code);
      if (!route) continue;
      const tripCode = `${tr.code.split('-')[0]}-CX-${date.suffix}-${idx}-${tr.h}${tr.m}`;

      const trip = await prisma.chuyenXe.upsert({
        where: { maChuyenXe: tripCode },
        create: {
          maChuyenXe: tripCode,
          ngayKhoiHanh: dateOnly(date.y, date.m, date.d),
          gioKhoiHanh: timeOnly(tr.h, tr.m),
          gioDen: timeOnly(tr.arrH, tr.arrM),
          nhanGuiHang: true,
          sucChuaXeMay: tr.vehicle.loaiXe.sucChuaXeMayMacDinh,
          sucChuaHangCongKenh: tr.vehicle.loaiXe.sucChuaHangCongKenhMacDinh,
          sucChuaHangNhe: tr.vehicle.loaiXe.sucChuaHangNheMacDinh,
          trangThai: 'CHUA_KHOI_HANH',
          nhaXeId: route.nhaXeId,
          tuyenXeId: route.tuyenXeId,
          xeId: tr.vehicle.xeId,
        },
        update: {
          ngayKhoiHanh: dateOnly(date.y, date.m, date.d),
          gioKhoiHanh: timeOnly(tr.h, tr.m),
          gioDen: timeOnly(tr.arrH, tr.arrM),
          trangThai: 'CHUA_KHOI_HANH',
        },
      });

      for (const seat of tr.vehicle.ghes) {
        await prisma.gheChuyenXe.upsert({
          where: {
            chuyenXeId_gheId: { chuyenXeId: trip.chuyenXeId, gheId: seat.gheId },
          },
          create: {
            chuyenXeId: trip.chuyenXeId,
            gheId: seat.gheId,
            trangThai: 'TRONG',
            tang: seat.tang ?? 1,
          },
          update: {
            trangThai: 'TRONG',
          },
        });
      }
      tripCount++;
    }
  }

  console.log(`Seeded ${tripCount} trips for today (29/10), tomorrow (30/10), and 31/10!`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
