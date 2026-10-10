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
  console.log('--- ĐANG TẠO DỮ LIỆU CHUYẾN XE CHO NGÀY 20/10/2026 ---');

  // Lấy danh sách nhà xe kèm tuyến xe và danh sách xe, ghế
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

  const targetDate = dateOnly(2026, 10, 20);
  console.log(`Ngày khởi hành: 20/10/2026 (${targetDate.toISOString()})`);

  // Danh sách các khung giờ khởi hành trong ngày
  // Bao gồm các khung giờ chung nhau (07:00, 10:30, 13:00, 17:30, 22:00) để khách hàng thấy nhiều nhà xe cùng chạy một giờ!
  // Và thêm các khung giờ xen kẽ khác (05:30, 08:30, 15:00, 19:30, 23:15,...)
  const departureSlots = [
    { hour: 5, minute: 30, desc: 'Sáng sớm' },
    { hour: 7, minute: 0, desc: 'Giờ vàng sáng (CHUNG GIỜ)' },
    { hour: 8, minute: 30, desc: 'Giữa buổi sáng' },
    { hour: 10, minute: 30, desc: 'Trưa (CHUNG GIỜ)' },
    { hour: 13, minute: 0, desc: 'Đầu giờ chiều (CHUNG GIỜ)' },
    { hour: 15, minute: 30, desc: 'Chiều' },
    { hour: 17, minute: 30, desc: 'Cuối chiều (CHUNG GIỜ)' },
    { hour: 19, minute: 30, desc: 'Tối' },
    { hour: 21, minute: 0, desc: 'Đêm' },
    { hour: 22, minute: 0, desc: 'Đêm muộn (CHUNG GIỜ)' },
    { hour: 23, minute: 30, desc: 'Đêm khuya' },
  ];

  let totalTripsCreated = 0;
  let totalSeatsCreated = 0;

  for (const nhaXe of nhaXes) {
    console.log(`\n======================================================`);
    console.log(`Nhà xe: ${nhaXe.tenNhaXe} [${nhaXe.maNhaXe}]`);

    // Tuyến xe đang hoạt động của nhà xe
    const activeRoutes = nhaXe.tuyenXes.filter((r) => r.trangThai === 'HOAT_DONG');

    for (const route of activeRoutes) {
      console.log(`  -> Tuyến ID ${route.tuyenXeId}: ${route.diemDi} -> ${route.diemDen}`);

      // Duyệt qua các khung giờ
      for (let sIdx = 0; sIdx < departureSlots.length; sIdx++) {
        const slot = departureSlots[sIdx];
        
        // Luân phiên chọn loại xe trong đội xe của nhà xe (Ghế ngồi, Giường nằm, Limousine)
        const vehicle = nhaXe.xes[sIdx % nhaXe.xes.length];

        if (!vehicle) {
          continue;
        }

        const duration = route.thoiGianChayPhut || 420;
        const totalDepMinutes = slot.hour * 60 + slot.minute;
        const totalArrMinutes = (totalDepMinutes + duration) % (24 * 60);
        const arrHour = Math.floor(totalArrMinutes / 60);
        const arrMinute = totalArrMinutes % 60;

        // Mã chuyến xe duy nhất cho ngày 20/10/2026
        const tripCode = `${nhaXe.maNhaXe}-CX-20102026-${pad(route.tuyenXeId, 2)}${pad(slot.hour, 2)}${pad(slot.minute, 2)}`;

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

        // Tạo/Cập nhật toàn bộ ghế cho chuyến xe
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

  console.log(`\n======================================================`);
  console.log(`HOÀN TẤT THÊM DỮ LIỆU:`);
  console.log(`- Đã tạo/cập nhật: ${totalTripsCreated} chuyến xe cho ngày 20/10/2026`);
  console.log(`- Đã tạo/cập nhật: ${totalSeatsCreated} ghế chuyến xe`);
  console.log(`- Tuyến TP.HCM <-> Đà Lạt có 3 nhà xe cùng chạy: Phương Trang, Thành Bưởi, Hoa Mai`);
  console.log(`- Các khung giờ chung chạy cùng giờ gồm: 07:00, 10:30, 13:00, 17:30, 22:00`);
  console.log(`- Đầy đủ các loại xe: Ghế ngồi, Giường nằm, Limousine`);
  console.log(`======================================================`);
}

main()
  .catch((e) => {
    console.error('Lỗi khi seed chuyến xe 20/10/2026:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
