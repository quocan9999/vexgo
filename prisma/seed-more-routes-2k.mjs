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
  console.log('=== BỔ SUNG 3-4 TUYẾN XE MỚI VỚI GIÁ 2.000Đ ===');

  const FARE_PRICE_2K = 2000;
  const targetDates = [
    dateOnly(2026, 10, 20), // Ngày 20/10/2026
    dateOnly(2026, 10, 9),  // Hôm nay 09/10/2026
    dateOnly(2026, 10, 10), // Ngày mai 10/10/2026
  ];

  // Lấy các nhà xe kèm loại xe, xe và điểm giao nhận
  const nhaXes = await prisma.nhaXe.findMany({
    include: {
      loaiXes: true,
      xes: {
        include: {
          ghes: true,
          loaiXe: true,
        },
      },
      diemGiaoNhanHangs: true,
    },
  });

  // Cấu hình các tuyến mới
  const newRoutes = [
    {
      operatorCode: 'FUTA',
      routeCode: 'FUTA-TX-2K-DL-SG',
      from: 'Đà Lạt',
      to: 'TP.HCM',
      durationMinutes: 420,
      name: 'Đà Lạt ➔ TP.HCM (FUTA 2K)',
    },
    {
      operatorCode: 'TB',
      routeCode: 'TB-TX-2K-DL-SG',
      from: 'Đà Lạt',
      to: 'TP.HCM',
      durationMinutes: 420,
      name: 'Đà Lạt ➔ TP.HCM (Thành Bưởi 2K)',
    },
    {
      operatorCode: 'FUTA',
      routeCode: 'FUTA-TX-2K-SG-NT',
      from: 'TP.HCM',
      to: 'Nha Trang',
      durationMinutes: 480,
      name: 'TP.HCM ➔ Nha Trang (FUTA 2K)',
    },
    {
      operatorCode: 'HM',
      routeCode: 'HM-TX-2K-VT-SG',
      from: 'Vũng Tàu',
      to: 'TP.HCM',
      durationMinutes: 150,
      name: 'Vũng Tàu ➔ TP.HCM (Hoa Mai 2K)',
    },
    {
      operatorCode: 'TB',
      routeCode: 'TB-TX-2K-DL-NT',
      from: 'Đà Lạt',
      to: 'Nha Trang',
      durationMinutes: 240,
      name: 'Đà Lạt ➔ Nha Trang (Thành Bưởi 2K)',
    },
  ];

  const departureSlots = [
    { hour: 7, minute: 0 },
    { hour: 10, minute: 30 },
    { hour: 13, minute: 0 },
    { hour: 17, minute: 30 },
    { hour: 20, minute: 0 },
    { hour: 22, minute: 0 },
  ];

  let totalRoutesCreated = 0;
  let totalTripsCreated = 0;
  let totalSeatsCreated = 0;

  for (const rc of newRoutes) {
    const nhaXe = nhaXes.find((n) => n.maNhaXe === rc.operatorCode);
    if (!nhaXe) continue;

    console.log(`\n------------------------------------------------------`);
    console.log(`Đang cấu hình tuyến: ${rc.name}`);

    // 1. Tạo/cập nhật Tuyến xe
    let route = await prisma.tuyenXe.findFirst({
      where: {
        nhaXeId: nhaXe.nhaXeId,
        maTuyenXe: rc.routeCode,
      },
    });

    if (!route) {
      route = await prisma.tuyenXe.create({
        data: {
          maTuyenXe: rc.routeCode,
          diemDi: rc.from,
          diemDen: rc.to,
          thoiGianChayPhut: rc.durationMinutes,
          trangThai: 'HOAT_DONG',
          nhaXeId: nhaXe.nhaXeId,
        },
      });
      console.log(`  + Tạo tuyến xe ID: ${route.tuyenXeId}`);
    } else {
      route = await prisma.tuyenXe.update({
        where: { tuyenXeId: route.tuyenXeId },
        data: {
          diemDi: rc.from,
          diemDen: rc.to,
          thoiGianChayPhut: rc.durationMinutes,
          trangThai: 'HOAT_DONG',
        },
      });
      console.log(`  + Đã cập nhật tuyến xe ID: ${route.tuyenXeId}`);
    }
    totalRoutesCreated++;

    // 2. Gán điểm giao nhận hàng hóa
    if (nhaXe.diemGiaoNhanHangs.length >= 2) {
      await prisma.diemGiaoNhanTuyenXe.upsert({
        where: {
          tuyenXeId_diemGiaoNhanHangId: {
            tuyenXeId: route.tuyenXeId,
            diemGiaoNhanHangId: nhaXe.diemGiaoNhanHangs[0].diemGiaoNhanHangId,
          },
        },
        create: {
          vaiTro: 'GUI_HANG',
          tuyenXeId: route.tuyenXeId,
          diemGiaoNhanHangId: nhaXe.diemGiaoNhanHangs[0].diemGiaoNhanHangId,
        },
        update: {},
      });

      await prisma.diemGiaoNhanTuyenXe.upsert({
        where: {
          tuyenXeId_diemGiaoNhanHangId: {
            tuyenXeId: route.tuyenXeId,
            diemGiaoNhanHangId: nhaXe.diemGiaoNhanHangs[1].diemGiaoNhanHangId,
          },
        },
        create: {
          vaiTro: 'NHAN_HANG',
          tuyenXeId: route.tuyenXeId,
          diemGiaoNhanHangId: nhaXe.diemGiaoNhanHangs[1].diemGiaoNhanHangId,
        },
        update: {},
      });
    }

    // 3. Tạo bảng giá 2.000đ cho mọi loại xe của tuyến
    for (const loaiXe of nhaXe.loaiXes) {
      const existingFare = await prisma.bangGia.findFirst({
        where: {
          nhaXeId: nhaXe.nhaXeId,
          tuyenXeId: route.tuyenXeId,
          loaiXeId: loaiXe.loaiXeId,
        },
      });

      if (existingFare) {
        await prisma.bangGia.update({
          where: { bangGiaId: existingFare.bangGiaId },
          data: {
            giaNiemYet: FARE_PRICE_2K,
            trangThai: 'HOAT_DONG',
            tuNgay: dateOnly(2026, 1, 1),
            denNgay: null,
          },
        });
      } else {
        await prisma.bangGia.create({
          data: {
            giaNiemYet: FARE_PRICE_2K,
            tuNgay: dateOnly(2026, 1, 1),
            denNgay: null,
            trangThai: 'HOAT_DONG',
            nhaXeId: nhaXe.nhaXeId,
            tuyenXeId: route.tuyenXeId,
            loaiXeId: loaiXe.loaiXeId,
          },
        });
      }
    }
    console.log(`  + Đã cấu hình giá 2.000đ cho mọi loại xe của tuyến`);

    // 4. Tạo chuyến xe cho các ngày
    for (const tDate of targetDates) {
      const dateStr = `${pad(tDate.getUTCDate(), 2)}${pad(tDate.getUTCMonth() + 1, 2)}`;

      for (let sIdx = 0; sIdx < departureSlots.length; sIdx++) {
        const slot = departureSlots[sIdx];
        const vehicle = nhaXe.xes[sIdx % nhaXe.xes.length];
        if (!vehicle) continue;

        const duration = rc.durationMinutes;
        const totalDepMinutes = slot.hour * 60 + slot.minute;
        const totalArrMinutes = (totalDepMinutes + duration) % (24 * 60);
        const arrHour = Math.floor(totalArrMinutes / 60);
        const arrMinute = totalArrMinutes % 60;

        const tripCode = `${nhaXe.maNhaXe}-CX-${dateStr}-2K-${pad(route.tuyenXeId, 2)}${pad(slot.hour, 2)}${pad(slot.minute, 2)}`;

        const trip = await prisma.chuyenXe.upsert({
          where: { maChuyenXe: tripCode },
          create: {
            maChuyenXe: tripCode,
            ngayKhoiHanh: tDate,
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
            ngayKhoiHanh: tDate,
            gioKhoiHanh: timeOnly(slot.hour, slot.minute),
            gioDen: timeOnly(arrHour, arrMinute),
            nhanGuiHang: true,
            trangThai: 'CHUA_KHOI_HANH',
            tuyenXeId: route.tuyenXeId,
            xeId: vehicle.xeId,
          },
        });
        totalTripsCreated++;

        // Ghế trống
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
    console.log(`  + Đã tạo các chuyến xe cho 3 ngày (hôm nay, ngày mai, 20/10)`);
  }

  console.log(`\n======================================================`);
  console.log(`HOÀN TẤT THÊM TUYẾN XE 2.000Đ:`);
  console.log(`- Đã thêm/cập nhật: ${totalRoutesCreated} tuyến xe mới`);
  console.log(`- Đã tạo: ${totalTripsCreated} chuyến xe với giá 2.000đ`);
  console.log(`- Đã tạo: ${totalSeatsCreated} ghế trống sẵn sàng đặt vé`);
  console.log(`======================================================`);
}

main()
  .catch((e) => {
    console.error('Lỗi khi seed thêm tuyến xe 2.000đ:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
