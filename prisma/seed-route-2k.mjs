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
  console.log('=== THÊM TUYẾN XE VÀ CHUYẾN XE NGÀY 20/10/2026 VỚI GIÁ 2.000Đ ===');

  const targetDate = dateOnly(2026, 10, 20);
  const FARE_PRICE_2K = 2000;

  // Lấy các nhà xe
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

  // Cấu hình các tuyến xe giá 2.000đ cần tạo
  const routeConfigs = [
    {
      operatorCode: 'FUTA',
      routeCode: 'FUTA-TX-2010-2K',
      from: 'TP.HCM',
      to: 'Đà Lạt',
      durationMinutes: 420,
    },
    {
      operatorCode: 'TB',
      routeCode: 'TB-TX-2010-2K',
      from: 'TP.HCM',
      to: 'Đà Lạt',
      durationMinutes: 420,
    },
    {
      operatorCode: 'HM',
      routeCode: 'HM-TX-2010-2K',
      from: 'TP.HCM',
      to: 'Đà Lạt',
      durationMinutes: 420,
    },
    {
      operatorCode: 'HM',
      routeCode: 'HM-TX-2010-2K-VT',
      from: 'TP.HCM',
      to: 'Vũng Tàu',
      durationMinutes: 150,
    },
  ];

  // Các khung giờ khởi hành trong ngày 20/10/2026
  const departureSlots = [
    { hour: 7, minute: 0 },
    { hour: 10, minute: 30 },
    { hour: 13, minute: 0 },
    { hour: 17, minute: 30 },
    { hour: 20, minute: 0 },
    { hour: 22, minute: 0 },
  ];

  let createdRoutesCount = 0;
  let createdFaresCount = 0;
  let createdTripsCount = 0;
  let createdSeatsCount = 0;

  for (const rc of routeConfigs) {
    const nhaXe = nhaXes.find((n) => n.maNhaXe === rc.operatorCode);
    if (!nhaXe) {
      console.warn(`Không tìm thấy nhà xe ${rc.operatorCode}`);
      continue;
    }

    console.log(`\n--------------------------------------------------`);
    console.log(`Tạo tuyến xe [${rc.routeCode}] cho nhà xe ${nhaXe.tenNhaXe} (${rc.from} -> ${rc.to}):`);

    // 1. Tạo/Cập nhật Tuyến xe
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
      console.log(`  + Đã tạo tuyến xe ID: ${route.tuyenXeId}`);
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
      console.log(`  + Tuyến xe đã tồn tại, ID: ${route.tuyenXeId}`);
    }
    createdRoutesCount++;

    // 2. Gắn điểm giao nhận hàng hóa cho tuyến xe nếu có
    if (nhaXe.diemGiaoNhanHangs.length >= 2) {
      const pGui = nhaXe.diemGiaoNhanHangs[0];
      const pNhan = nhaXe.diemGiaoNhanHangs[1];

      await prisma.diemGiaoNhanTuyenXe.upsert({
        where: {
          tuyenXeId_diemGiaoNhanHangId: {
            tuyenXeId: route.tuyenXeId,
            diemGiaoNhanHangId: pGui.diemGiaoNhanHangId,
          },
        },
        create: {
          vaiTro: 'GUI_HANG',
          tuyenXeId: route.tuyenXeId,
          diemGiaoNhanHangId: pGui.diemGiaoNhanHangId,
        },
        update: {},
      });

      await prisma.diemGiaoNhanTuyenXe.upsert({
        where: {
          tuyenXeId_diemGiaoNhanHangId: {
            tuyenXeId: route.tuyenXeId,
            diemGiaoNhanHangId: pNhan.diemGiaoNhanHangId,
          },
        },
        create: {
          vaiTro: 'NHAN_HANG',
          tuyenXeId: route.tuyenXeId,
          diemGiaoNhanHangId: pNhan.diemGiaoNhanHangId,
        },
        update: {},
      });
    }

    // 3. Tạo Bảng giá 2.000đ cho tất cả loại xe của nhà xe trên tuyến này
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
      createdFaresCount++;
    }
    console.log(`  + Đã cấu hình giá niêm yết 2.000đ cho các loại xe của tuyến`);

    // 4. Tạo các Chuyến xe trong ngày 20/10/2026
    for (let sIdx = 0; sIdx < departureSlots.length; sIdx++) {
      const slot = departureSlots[sIdx];
      const vehicle = nhaXe.xes[sIdx % nhaXe.xes.length];
      if (!vehicle) continue;

      const duration = rc.durationMinutes;
      const totalDepMinutes = slot.hour * 60 + slot.minute;
      const totalArrMinutes = (totalDepMinutes + duration) % (24 * 60);
      const arrHour = Math.floor(totalArrMinutes / 60);
      const arrMinute = totalArrMinutes % 60;

      const tripCode = `${nhaXe.maNhaXe}-CX-201026-2K-${pad(slot.hour, 2)}${pad(slot.minute, 2)}`;

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
          tuyenXeId: route.tuyenXeId,
          xeId: vehicle.xeId,
        },
      });
      createdTripsCount++;

      // Tạo ghế trống cho chuyến xe
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
        createdSeatsCount++;
      }
    }
    console.log(`  + Đã tạo ${departureSlots.length} chuyến xe ngày 20/10/2026 (giá 2.000đ)`);
  }

  console.log(`\n======================================================`);
  console.log(`HOÀN TẤT THÊM TUYẾN VÀ CHUYẾN XE 2.000Đ NGÀY 20/10/2026:`);
  console.log(`- Tuyến xe: ${createdRoutesCount} tuyến`);
  console.log(`- Bảng giá: ${createdFaresCount} bản ghi bảng giá (mức cước: 2.000đ)`);
  console.log(`- Chuyến xe: ${createdTripsCount} chuyến xe ngày 20/10/2026`);
  console.log(`- Ghế chuyến xe: ${createdSeatsCount} ghế trạng thái TRỐNG`);
  console.log(`======================================================`);
}

main()
  .catch((e) => {
    console.error('Lỗi khi seed tuyến xe 2.000đ:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
