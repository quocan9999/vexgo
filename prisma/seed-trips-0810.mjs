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

function pad(val, len) {
  return String(val).padStart(len, '0');
}

async function main() {
  console.log('--- ĐANG THÊM CHUYẾN XE CHO NGÀY 08/10/2026 ---');

  // Lấy các nhà xe
  const nhaXes = await prisma.nhaXe.findMany({
    include: {
      tuyenXes: true,
      xes: {
        include: {
          ghes: true,
          loaiXe: true,
        },
      },
    },
  });

  const targetDate = dateOnly(2026, 10, 8);
  console.log(`Target Date: ${targetDate.toISOString()}`);

  // Cấu hình các khung giờ chạy để so sánh cùng giờ (7:00, 10:30, 13:00, 17:30, 22:00)
  const departureSlots = [
    { hour: 7, minute: 0 },
    { hour: 10, minute: 30 },
    { hour: 13, minute: 0 },
    { hour: 17, minute: 30 },
    { hour: 22, minute: 0 },
  ];

  let totalTripsCreated = 0;
  let totalSeatsCreated = 0;

  for (const nhaXe of nhaXes) {
    console.log(`\nNhà xe: ${nhaXe.tenNhaXe} (${nhaXe.maNhaXe})`);

    // Tuyến xe đang hoạt động của nhà xe
    const activeRoutes = nhaXe.tuyenXes.filter((r) => r.trangThai === 'HOAT_DONG');

    for (const route of activeRoutes) {
      console.log(`  > Tuyến: ${route.diemDi} -> ${route.diemDen}`);

      for (let sIdx = 0; sIdx < departureSlots.length; sIdx++) {
        const slot = departureSlots[sIdx];
        const vehicle = nhaXe.xes[sIdx % nhaXe.xes.length];

        if (!vehicle) {
          console.log(`    Không có xe cho slot ${slot.hour}:${slot.minute}`);
          continue;
        }

        const duration = route.thoiGianChayPhut || 420;
        const totalDepMinutes = slot.hour * 60 + slot.minute;
        const totalArrMinutes = (totalDepMinutes + duration) % (24 * 60);
        const arrHour = Math.floor(totalArrMinutes / 60);
        const arrMinute = totalArrMinutes % 60;

        const tripCode = `${nhaXe.maNhaXe}-CX-08102026-${pad(route.tuyenXeId, 2)}${pad(slot.hour, 2)}${pad(slot.minute, 2)}`;

        // Tạo chuyến xe
        const trip = await prisma.chuyenXe.upsert({
          where: { maChuyenXe: tripCode },
          create: {
            maChuyenXe: tripCode,
            ngayKhoiHanh: targetDate,
            gioKhoiHanh: timeOnly(slot.hour, slot.minute),
            gioDen: timeOnly(arrHour, arrMinute),
            nhanGuiHang: true,
            sucChuaXeMay: 3,
            sucChuaHangCongKenh: 8,
            sucChuaHangNhe: 60,
            trangThai: 'CHUA_KHOI_HANH',
            nhaXeId: nhaXe.nhaXeId,
            tuyenXeId: route.tuyenXeId,
            xeId: vehicle.xeId,
          },
          update: {
            ngayKhoiHanh: targetDate,
            gioKhoiHanh: timeOnly(slot.hour, slot.minute),
            gioDen: timeOnly(arrHour, arrMinute),
            nhanGuiHang: true,
            trangThai: 'CHUA_KHOI_HANH',
            xeId: vehicle.xeId,
          },
        });
        totalTripsCreated++;

        // Tạo ghế chuyến xe (GheChuyenXe)
        for (const seat of vehicle.ghes) {
          await prisma.gheChuyenXe.upsert({
            where: {
              chuyenXeId_gheId: {
                chuyenXeId: trip.chuyenXeId,
                gheId: seat.gheId,
              },
            },
            create: {
              trangThai: 'TRONG',
              chuyenXeId: trip.chuyenXeId,
              gheId: seat.gheId,
            },
            update: {
              trangThai: 'TRONG',
            },
          });
          totalSeatsCreated++;
        }
      }
    }
  }

  console.log(`\n HOÀN TẤT: Đã tạo/cập nhật ${totalTripsCreated} chuyến xe và ${totalSeatsCreated} ghế chuyến xe cho ngày 08/10/2026!`);
}

main()
  .catch((e) => {
    console.error('Lỗi khi seed chuyến xe:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
