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
  console.log('Seeding Da Nang and Da Lat - Vung Tau routes & trips...');

  // 1. Ensure routes exist
  const routesToUpsert = [
    { code: 'FUTA-TX-DN-DL', diemDi: 'Đà Nẵng', diemDen: 'Đà Lạt', thoiGianChayPhut: 840, nhaXeId: 1 },
    { code: 'FUTA-TX-DN-SG', diemDi: 'Đà Nẵng', diemDen: 'TP.HCM', thoiGianChayPhut: 1080, nhaXeId: 1 },
    { code: 'FUTA-TX-DN-NT', diemDi: 'Đà Nẵng', diemDen: 'Nha Trang', thoiGianChayPhut: 600, nhaXeId: 1 },
    { code: 'FUTA-TX-DL-DN', diemDi: 'Đà Lạt', diemDen: 'Đà Nẵng', thoiGianChayPhut: 840, nhaXeId: 1 },
    { code: 'HM-TX-DL-VT', diemDi: 'Đà Lạt', diemDen: 'Vũng Tàu', thoiGianChayPhut: 420, nhaXeId: 3 },
  ];

  const routeMap = new Map();
  for (const r of routesToUpsert) {
    const route = await prisma.tuyenXe.upsert({
      where: { nhaXeId_maTuyenXe: { nhaXeId: r.nhaXeId, maTuyenXe: r.code } },
      create: {
        maTuyenXe: r.code,
        diemDi: r.diemDi,
        diemDen: r.diemDen,
        thoiGianChayPhut: r.thoiGianChayPhut,
        trangThai: 'HOAT_DONG',
        nhaXeId: r.nhaXeId,
      },
      update: {
        diemDi: r.diemDi,
        diemDen: r.diemDen,
        thoiGianChayPhut: r.thoiGianChayPhut,
        trangThai: 'HOAT_DONG',
      },
    });
    routeMap.set(r.code, route);
    console.log(`Route ready: ${r.code} (${r.diemDi} -> ${r.diemDen})`);
  }

  // 2. Ensure price lists (BangGia)
  // loaiXe: 1 (Ghế ngồi), 2 (Giường nằm), 3 (Limousine)
  const fares = [
    { routeCode: 'FUTA-TX-DN-DL', nhaXeId: 1, loaiXeId: 2, price: 350000 },
    { routeCode: 'FUTA-TX-DN-DL', nhaXeId: 1, loaiXeId: 3, price: 420000 },
    { routeCode: 'FUTA-TX-DN-SG', nhaXeId: 1, loaiXeId: 2, price: 450000 },
    { routeCode: 'FUTA-TX-DN-SG', nhaXeId: 1, loaiXeId: 3, price: 550000 },
    { routeCode: 'FUTA-TX-DN-NT', nhaXeId: 1, loaiXeId: 2, price: 300000 },
    { routeCode: 'FUTA-TX-DN-NT', nhaXeId: 1, loaiXeId: 3, price: 380000 },
    { routeCode: 'FUTA-TX-DL-DN', nhaXeId: 1, loaiXeId: 2, price: 350000 },
    { routeCode: 'FUTA-TX-DL-DN', nhaXeId: 1, loaiXeId: 3, price: 420000 },
    { routeCode: 'HM-TX-DL-VT', nhaXeId: 3, loaiXeId: 8, price: 290000 },
    { routeCode: 'HM-TX-DL-VT', nhaXeId: 3, loaiXeId: 9, price: 360000 },
  ];

  for (const f of fares) {
    const route = routeMap.get(f.routeCode);
    const existing = await prisma.bangGia.findFirst({
      where: { tuyenXeId: route.tuyenXeId, loaiXeId: f.loaiXeId, trangThai: 'HOAT_DONG' },
    });
    if (!existing) {
      await prisma.bangGia.create({
        data: {
          tuyenXeId: route.tuyenXeId,
          loaiXeId: f.loaiXeId,
          nhaXeId: f.nhaXeId,
          giaNiemYet: f.price,
          tuNgay: dateOnly(2026, 1, 1),
          denNgay: dateOnly(2027, 12, 31),
          trangThai: 'HOAT_DONG',
        },
      });
    }
  }

  // Vehicles
  const futaSleeper = await prisma.xe.findUnique({ where: { xeId: 2 }, include: { ghes: true, loaiXe: true } });
  const futaLimo = await prisma.xe.findUnique({ where: { xeId: 3 }, include: { ghes: true, loaiXe: true } });
  const hmSleeper = await prisma.xe.findUnique({ where: { xeId: 14 }, include: { ghes: true, loaiXe: true } });

  const datesToSeed = [
    { year: 2026, month: 11, day: 1, suffix: '01112026' },
    { year: 2026, month: 11, day: 2, suffix: '02112026' },
    { year: 2026, month: 11, day: 3, suffix: '03112026' },
    { year: 2026, month: 11, day: 4, suffix: '04112026' },
    { year: 2026, month: 11, day: 5, suffix: '05112026' },
  ];

  for (const d of datesToSeed) {
    const trips = [
      // DN -> DL
      { code: `FUTA-CX-${d.suffix}-DNDL-0700`, route: routeMap.get('FUTA-TX-DN-DL'), vehicle: futaSleeper, h: 7, m: 0, arrH: 21, arrM: 0, price: 350000 },
      // DN -> SG
      { code: `FUTA-CX-${d.suffix}-DNSG-0800`, route: routeMap.get('FUTA-TX-DN-SG'), vehicle: futaSleeper, h: 8, m: 0, arrH: 2, arrM: 0, price: 450000 },
      // DN -> NT
      { code: `FUTA-CX-${d.suffix}-DNNT-0900`, route: routeMap.get('FUTA-TX-DN-NT'), vehicle: futaLimo, h: 9, m: 0, arrH: 19, arrM: 0, price: 380000 },
      // DL -> DN
      { code: `FUTA-CX-${d.suffix}-DLDN-0730`, route: routeMap.get('FUTA-TX-DL-DN'), vehicle: futaSleeper, h: 7, m: 30, arrH: 21, arrM: 30, price: 350000 },
      // DL -> VT
      { code: `HM-CX-${d.suffix}-DLVT-0800`, route: routeMap.get('HM-TX-DL-VT'), vehicle: hmSleeper, h: 8, m: 0, arrH: 15, arrM: 0, price: 290000 },
    ];

    for (const t of trips) {
      const trip = await prisma.chuyenXe.upsert({
        where: { maChuyenXe: t.code },
        create: {
          maChuyenXe: t.code,
          ngayKhoiHanh: dateOnly(d.year, d.month, d.day),
          gioKhoiHanh: timeOnly(t.h, t.m),
          gioDen: timeOnly(t.arrH, t.arrM),
          nhanGuiHang: true,
          sucChuaXeMay: t.vehicle.loaiXe.sucChuaXeMayMacDinh,
          sucChuaHangCongKenh: t.vehicle.loaiXe.sucChuaHangCongKenhMacDinh,
          sucChuaHangNhe: t.vehicle.loaiXe.sucChuaHangNheMacDinh,
          trangThai: 'CHUA_KHOI_HANH',
          nhaXeId: t.route.nhaXeId,
          tuyenXeId: t.route.tuyenXeId,
          xeId: t.vehicle.xeId,
        },
        update: {
          ngayKhoiHanh: dateOnly(d.year, d.month, d.day),
          gioKhoiHanh: timeOnly(t.h, t.m),
          gioDen: timeOnly(t.arrH, t.arrM),
          trangThai: 'CHUA_KHOI_HANH',
        },
      });

      for (const seat of t.vehicle.ghes) {
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
    }
  }

  console.log('Successfully seeded Da Nang and Da Lat routes and trips!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
