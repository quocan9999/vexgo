import 'dotenv/config';
import crypto from 'node:crypto';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../apps/api/dist/generated/prisma/client.js';
import {
  getFutaGiuongNam34Seats,
  getThanhBuoiGiuongNam34Seats,
  getFutaLimousine28Seats,
} from './lib/seat-layouts.mjs';

function deterministicUuid(...parts) {
  const hash = crypto.createHash('md5').update(parts.map(String).join(':')).digest('hex');
  return `${hash.slice(0, 12)}4${hash.slice(13, 16)}a${hash.slice(17, 32)}`;
}

function calculateClockTime(baseTime, durationMinutes) {
  if (durationMinutes == null || !Number.isFinite(durationMinutes)) return null;
  const totalSeconds =
    baseTime.getUTCHours() * 3600 +
    baseTime.getUTCMinutes() * 60 +
    baseTime.getUTCSeconds() +
    Math.round(durationMinutes * 60);
  const normalizedSeconds = ((totalSeconds % 86400) + 86400) % 86400;
  const hours = Math.floor(normalizedSeconds / 3600);
  const minutes = Math.floor((normalizedSeconds % 3600) / 60);
  const seconds = normalizedSeconds % 60;
  const d = new Date(0);
  d.setUTCHours(hours, minutes, seconds, 0);
  return d;
}

async function main() {
  const rawUrl = process.env.DATABASE_URL ?? process.env.MIGRATION_URL;
  const url = new URL(rawUrl);
  const prisma = new PrismaClient({
    adapter: new PrismaMariaDb({
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: decodeURIComponent(url.pathname.replace(/^\/+/, '')),
      allowPublicKeyRetrieval: true,
    }),
  });

  console.log('=== ĐANG TẠO CÁC CHUYẾN XE 0Đ (MIỄN PHÍ) CHO HÔM NAY & 7 NGÀY TỚI ===\n');

  const operators = [
    {
      nhaXeId: 1,
      codePrefix: 'FUTA',
      plate: '51B-000.99',
      typeName: 'Xe Giường Nằm Thử Nghiệm (0đ)',
      getSeats: getFutaGiuongNam34Seats,
    },
    {
      nhaXeId: 2,
      codePrefix: 'TB',
      plate: '51B-000.88',
      typeName: 'Xe Phòng Nằm Thử Nghiệm (0đ)',
      getSeats: getThanhBuoiGiuongNam34Seats,
    },
    {
      nhaXeId: 3,
      codePrefix: 'HM',
      plate: '72B-000.77',
      typeName: 'Limousine VIP Thử Nghiệm (0đ)',
      getSeats: getFutaLimousine28Seats,
    },
  ];

  // Tạo lịch từ ngày 07/11/2026 đến 14/11/2026
  const dates = [
    '2026-11-07',
    '2026-11-08',
    '2026-11-09',
    '2026-11-10',
    '2026-11-11',
    '2026-11-12',
    '2026-11-13',
    '2026-11-14',
  ];

  const timesByDate = (dateStr) =>
    dateStr === '2026-11-07'
      ? ['23:30']
      : ['07:30', '11:00', '15:30', '20:00'];

  const createdTripsSummary = [];

  for (const op of operators) {
    const nhaXe = await prisma.nhaXe.findUnique({ where: { nhaXeId: op.nhaXeId } });
    if (!nhaXe) {
      console.log(`Bỏ qua nhà xe ID ${op.nhaXeId} vì không tồn tại.`);
      continue;
    }

    // 1. Tạo hoặc lấy loại xe 0đ
    let loaiXe = await prisma.loaiXe.findFirst({
      where: { nhaXeId: op.nhaXeId, tenLoai: op.typeName },
    });
    if (!loaiXe) {
      loaiXe = await prisma.loaiXe.create({
        data: {
          nhaXeId: op.nhaXeId,
          tenLoai: op.typeName,
          moTa: 'Xe chuyên dùng thử nghiệm đặt vé và gửi hàng 0đ (Miễn phí)',
          sucChuaXeMayMacDinh: 5,
          sucChuaHangCongKenhMacDinh: 10,
          sucChuaHangNheMacDinh: 50,
        },
      });
    }

    // 2. Tạo hoặc lấy xe
    let xe = await prisma.xe.findFirst({ where: { bienSoXe: op.plate } });
    if (!xe) {
      xe = await prisma.xe.create({
        data: {
          bienSoXe: op.plate,
          trangThai: 'HOAT_DONG',
          nhaXeId: op.nhaXeId,
          loaiXeId: loaiXe.loaiXeId,
        },
      });
    } else if (xe.loaiXeId !== loaiXe.loaiXeId || xe.trangThai !== 'HOAT_DONG') {
      xe = await prisma.xe.update({
        where: { xeId: xe.xeId },
        data: { loaiXeId: loaiXe.loaiXeId, trangThai: 'HOAT_DONG' },
      });
    }

    // 3. Tạo hoặc đồng bộ ghế xe theo sơ đồ chuẩn 2 tầng / Limousine
    const layoutSpecs = op.getSeats();
    for (const spec of layoutSpecs) {
      const maGhe = deterministicUuid('GHE-0D', xe.bienSoXe, spec.tenGhe);
      const existing = await prisma.ghe.findFirst({
        where: { xeId: xe.xeId, tenGhe: spec.tenGhe },
      });
      if (!existing) {
        await prisma.ghe.create({
          data: {
            maGhe,
            tenGhe: spec.tenGhe,
            viTri: spec.viTri,
            tang: spec.tang,
            toaDoX: spec.toaDoX,
            toaDoY: spec.toaDoY,
            xeId: xe.xeId,
          },
        });
      }
    }
    const allSeats = await prisma.ghe.findMany({
      where: { xeId: xe.xeId },
      orderBy: { gheId: 'asc' },
    });

    // 4. Lấy các tuyến xe đang hoạt động của nhà xe kèm điểm dừng
    const routes = await prisma.tuyenXe.findMany({
      where: { nhaXeId: op.nhaXeId, trangThai: 'HOAT_DONG' },
      include: {
        tuyenXeDiemDungs: {
          orderBy: [{ phutLech: 'asc' }, { thuTu: 'asc' }],
        },
      },
    });

    for (const route of routes) {
      // Đảm bảo có bảng giá 0đ cho tuyến này
      let bangGia = await prisma.bangGia.findFirst({
        where: {
          nhaXeId: op.nhaXeId,
          tuyenXeId: route.tuyenXeId,
          loaiXeId: loaiXe.loaiXeId,
        },
      });
      if (!bangGia) {
        bangGia = await prisma.bangGia.create({
          data: {
            nhaXeId: op.nhaXeId,
            tuyenXeId: route.tuyenXeId,
            loaiXeId: loaiXe.loaiXeId,
            giaNiemYet: 0,
            tuNgay: new Date('2026-01-01T00:00:00.000Z'),
            denNgay: null,
            trangThai: 'HOAT_DONG',
          },
        });
      } else {
        await prisma.bangGia.update({
          where: { bangGiaId: bangGia.bangGiaId },
          data: { giaNiemYet: 0, trangThai: 'HOAT_DONG', denNgay: null },
        });
      }

      const durationMinutes = route.thoiGianChayPhut || 300;

      for (const dateStr of dates) {
        const depTimes = timesByDate(dateStr);
        for (const depTimeStr of depTimes) {
          const dateClean = dateStr.replace(/-/g, '');
          const timeClean = depTimeStr.replace(':', '');
          const tripCode = `${op.codePrefix}-0D-R${route.tuyenXeId}-${dateClean}-${timeClean}`;

          const departureDate = new Date(`${dateStr}T00:00:00.000Z`);
          const gioKhoiHanh = new Date(`1970-01-01T${depTimeStr}:00.000Z`);
          const gioDen = calculateClockTime(gioKhoiHanh, durationMinutes);

          let chuyenXe = await prisma.chuyenXe.findFirst({
            where: { maChuyenXe: tripCode },
          });

          if (!chuyenXe) {
            chuyenXe = await prisma.chuyenXe.create({
              data: {
                maChuyenXe: tripCode,
                ngayKhoiHanh: departureDate,
                gioKhoiHanh,
                gioDen,
                nhanGuiHang: true,
                sucChuaXeMay: 5,
                sucChuaHangCongKenh: 10,
                sucChuaHangNhe: 50,
                trangThai: 'CHUA_KHOI_HANH',
                nhaXeId: op.nhaXeId,
                tuyenXeId: route.tuyenXeId,
                xeId: xe.xeId,
              },
            });

            if (allSeats.length > 0) {
              await prisma.gheChuyenXe.createMany({
                data: allSeats.map((seat) => ({
                  chuyenXeId: chuyenXe.chuyenXeId,
                  gheId: seat.gheId,
                  trangThai: 'TRONG',
                  tang: seat.tang,
                  toaDoX: seat.toaDoX,
                  toaDoY: seat.toaDoY,
                })),
                skipDuplicates: true,
              });
            }
          } else {
            await prisma.chuyenXe.update({
              where: { chuyenXeId: chuyenXe.chuyenXeId },
              data: {
                trangThai: 'CHUA_KHOI_HANH',
                gioKhoiHanh,
                gioDen,
                nhanGuiHang: true,
              },
            });
          }

          // Đồng bộ điểm đón trả cho chuyến xe (để khách chọn được điểm đón/trả trên UI)
          const existingStopsCount = await prisma.diemDonTraChuyenXe.count({
            where: { chuyenXeId: chuyenXe.chuyenXeId },
          });
          if (existingStopsCount === 0 && route.tuyenXeDiemDungs.length > 0) {
            await prisma.diemDonTraChuyenXe.createMany({
              data: route.tuyenXeDiemDungs.map((stop) => ({
                chuyenXeId: chuyenXe.chuyenXeId,
                diemDonTraId: stop.diemDonTraId,
                loaiDiem: stop.loaiDiem,
                thoiGianDuKien: calculateClockTime(gioKhoiHanh, stop.phutLech),
                phutLech: stop.phutLech,
                thuTu: stop.thuTu,
                phuPhi: 0,
                phutCoMatTruoc: stop.phutCoMatTruoc,
                nhanKhach: stop.nhanKhach,
                ghiChu: stop.ghiChu,
              })),
              skipDuplicates: true,
            });
          }

          createdTripsSummary.push({
            id: chuyenXe.chuyenXeId,
            code: tripCode,
            nhaXe: nhaXe.tenNhaXe,
            route: `${route.diemDi} → ${route.diemDen}`,
            date: dateStr,
            time: depTimeStr,
            price: '0đ',
          });
        }
      }
    }
  }

  console.log(`✓ Đã tạo/cập nhật thành công ${createdTripsSummary.length} chuyến xe giá 0đ!`);
  console.log('\n--- BẢNG DANH SÁCH CÁC CHUYẾN XE 0Đ TIÊU BIỂU ---');
  console.table(
    createdTripsSummary.slice(0, 24).map((t) => ({
      ID: t.id,
      'Nhà xe': t.nhaXe,
      Tuyến: t.route,
      Ngày: t.date,
      Giờ: t.time,
      Giá: t.price,
      Mã: t.code,
    })),
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Lỗi khi tạo các chuyến xe 0đ:', err);
  process.exit(1);
});
