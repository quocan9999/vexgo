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
  console.log('====================================================================');
  console.log('   TẠO DỮ LIỆU CHUYẾN XE MẪU NGÀY 26 - 27 - 28 THÁNG 10 NĂM 2026    ');
  console.log('   (Vé 0đ, vé thường, cùng tuyến, cùng giờ, khác giá, khác nhà xe)   ');
  console.log('====================================================================\n');

  // 1. Kiểm tra / Tạo cấu hình Xe 0đ cho Nhà xe Hoa Mai (nhaXeId: 3)
  let hmLoaiXe0d = await prisma.loaiXe.findFirst({
    where: { nhaXeId: 3, tenLoai: 'Xe Thử Nghiệm (0đ)' },
  });
  if (!hmLoaiXe0d) {
    hmLoaiXe0d = await prisma.loaiXe.create({
      data: {
        nhaXeId: 3,
        tenLoai: 'Xe Thử Nghiệm (0đ)',
        moTa: 'Xe chuyên dùng thử nghiệm đặt vé và gửi hàng 0đ',
        sucChuaXeMayMacDinh: 5,
        sucChuaHangCongKenhMacDinh: 10,
        sucChuaHangNheMacDinh: 50,
      },
    });
    console.log('✓ Đã tạo loại xe 0đ cho Hoa Mai');
  }

  let hmXe0d = await prisma.xe.findFirst({ where: { bienSoXe: '29A-000.77' } });
  if (!hmXe0d) {
    hmXe0d = await prisma.xe.create({
      data: {
        bienSoXe: '29A-000.77',
        trangThai: 'HOAT_DONG',
        nhaXeId: 3,
        loaiXeId: hmLoaiXe0d.loaiXeId,
      },
    });

    const seatCodes = [
      'A01', 'A02', 'A03', 'A04', 'A05', 'A06',
      'A07', 'A08', 'A09', 'A10', 'A11', 'A12',
      'B01', 'B02', 'B03', 'B04', 'B05', 'B06',
      'B07', 'B08', 'B09', 'B10', 'B11', 'B12',
    ];
    for (const code of seatCodes) {
      await prisma.ghe.create({
        data: {
          xeId: hmXe0d.xeId,
          soGhe: code,
          viTri: code.startsWith('A') ? 'Tầng dưới' : 'Tầng trên',
        },
      });
    }
    console.log('✓ Đã tạo xe 29A-000.77 và 24 ghế 0đ cho Hoa Mai');
  }

  // Bảng giá 0đ cho Hoa Mai tuyến 10 (TP.HCM -> Đà Lạt) và tuyến 11 (Đà Lạt -> TP.HCM)
  for (const tuyenXeId of [10, 11]) {
    const existing = await prisma.bangGia.findFirst({
      where: {
        nhaXeId: 3,
        tuyenXeId: tuyenXeId,
        loaiXeId: hmLoaiXe0d.loaiXeId,
      },
    });
    if (!existing) {
      await prisma.bangGia.create({
        data: {
          nhaXeId: 3,
          tuyenXeId: tuyenXeId,
          loaiXeId: hmLoaiXe0d.loaiXeId,
          giaNiemYet: 0,
          tuNgay: new Date('2026-01-01T00:00:00.000Z'),
          denNgay: null,
          trangThai: 'HOAT_DONG',
        },
      });
      console.log(`✓ Đã tạo bảng giá 0đ cho Hoa Mai tuyến ${tuyenXeId}`);
    }
  }

  // 2. Lấy thông tin các tuyến xe
  // Tuyến TP.HCM -> Đà Lạt
  const futaRouteOut = await prisma.tuyenXe.findUnique({ where: { tuyenXeId: 1 } });
  const tbRouteOut = await prisma.tuyenXe.findUnique({ where: { tuyenXeId: 5 } });
  const hmRouteOut = await prisma.tuyenXe.findUnique({ where: { tuyenXeId: 10 } });

  // Tuyến Đà Lạt -> TP.HCM
  const futaRouteRet = await prisma.tuyenXe.findUnique({ where: { tuyenXeId: 2 } });
  const tbRouteRet = await prisma.tuyenXe.findUnique({ where: { tuyenXeId: 4 } });
  const hmRouteRet = await prisma.tuyenXe.findUnique({ where: { tuyenXeId: 11 } });

  // 3. Lấy các xe theo chủng loại
  // FUTA: 71 (0đ), 1 (Ghế ngồi - 180k/200k), 2 (Giường nằm - 250k/270k), 3 (Limousine - 320k/340k)
  const futaCar0d = await prisma.xe.findUnique({ where: { xeId: 71 }, include: { ghes: true, loaiXe: true } });
  const futaCarSeat = await prisma.xe.findUnique({ where: { xeId: 1 }, include: { ghes: true, loaiXe: true } });
  const futaCarSleeper = await prisma.xe.findUnique({ where: { xeId: 2 }, include: { ghes: true, loaiXe: true } });
  const futaCarLimo = await prisma.xe.findUnique({ where: { xeId: 3 }, include: { ghes: true, loaiXe: true } });

  // TB: 110 (0đ), 7 (Ghế ngồi - 200k/180k), 8 (Giường nằm - 270k/250k), 9 (Limousine - 340k/320k)
  const tbCar0d = await prisma.xe.findUnique({ where: { xeId: 110 }, include: { ghes: true, loaiXe: true } });
  const tbCarSeat = await prisma.xe.findUnique({ where: { xeId: 7 }, include: { ghes: true, loaiXe: true } });
  const tbCarSleeper = await prisma.xe.findUnique({ where: { xeId: 8 }, include: { ghes: true, loaiXe: true } });
  const tbCarLimo = await prisma.xe.findUnique({ where: { xeId: 9 }, include: { ghes: true, loaiXe: true } });

  // HM: hmXe0d (0đ), 13 (Ghế ngồi - 190k), 14 (Giường nằm - 260k), 15 (Limousine - 330k)
  const hmCar0d = await prisma.xe.findUnique({ where: { xeId: hmXe0d.xeId }, include: { ghes: true, loaiXe: true } });
  const hmCarSeat = await prisma.xe.findUnique({ where: { xeId: 13 }, include: { ghes: true, loaiXe: true } });
  const hmCarSleeper = await prisma.xe.findUnique({ where: { xeId: 14 }, include: { ghes: true, loaiXe: true } });
  const hmCarLimo = await prisma.xe.findUnique({ where: { xeId: 15 }, include: { ghes: true, loaiXe: true } });

  const datesToSeed = [
    { year: 2026, month: 10, day: 26, label: '26/10/2026', codeSuffix: '26102026' },
    { year: 2026, month: 10, day: 27, label: '27/10/2026', codeSuffix: '27102026' },
    { year: 2026, month: 10, day: 28, label: '28/10/2026', codeSuffix: '28102026' },
  ];

  let totalTripsCreated = 0;
  let totalSeatsCreated = 0;

  for (const d of datesToSeed) {
    console.log(`\n>>> Đang khởi tạo chuyến xe ngày ${d.label} <<<`);

    const tripTemplates = [
      // =========================================================================
      // CHIỀU ĐI: TP.HCM -> ĐÀ LẠT
      // =========================================================================

      // --- Khung giờ 08:00 sáng: CÙNG GIỜ, KHÁC NHÀ XE, KHÁC GIÁ (Có vé 0đ) ---
      {
        code: `FUTA-CX-${d.codeSuffix}-0800-LIMO`,
        route: futaRouteOut,
        vehicle: futaCarLimo,
        hour: 8, minute: 0, arrHour: 14, arrMinute: 30,
        expectedPrice: '320.000đ',
        note: 'FUTA Limousine VIP 320k',
      },
      {
        code: `TB-CX-${d.codeSuffix}-0800-LIMO`,
        route: tbRouteOut,
        vehicle: tbCarLimo,
        hour: 8, minute: 0, arrHour: 14, arrMinute: 30,
        expectedPrice: '340.000đ',
        note: 'Thành Bưởi Limousine VIP 340k',
      },
      {
        code: `HM-CX-${d.codeSuffix}-0800-LIMO`,
        route: hmRouteOut,
        vehicle: hmCarLimo,
        hour: 8, minute: 0, arrHour: 14, arrMinute: 30,
        expectedPrice: '330.000đ',
        note: 'Hoa Mai Limousine VIP 330k',
      },
      {
        code: `FUTA-CX-${d.codeSuffix}-0800-SLEEP`,
        route: futaRouteOut,
        vehicle: futaCarSleeper,
        hour: 8, minute: 0, arrHour: 14, arrMinute: 30,
        expectedPrice: '250.000đ',
        note: 'FUTA Giường nằm 250k',
      },
      {
        code: `TB-CX-${d.codeSuffix}-0800-0D`,
        route: tbRouteOut,
        vehicle: tbCar0d,
        hour: 8, minute: 0, arrHour: 14, arrMinute: 30,
        expectedPrice: '0đ (Miễn phí)',
        note: 'Thành Bưởi Khuyến mãi 0đ (Cùng giờ 08:00)',
      },

      // --- Khung giờ 13:30 chiều: CÙNG GIỜ, KHÁC NHÀ XE, KHÁC GIÁ (Có vé 0đ) ---
      {
        code: `FUTA-CX-${d.codeSuffix}-1330-0D`,
        route: futaRouteOut,
        vehicle: futaCar0d,
        hour: 13, minute: 30, arrHour: 20, arrMinute: 0,
        expectedPrice: '0đ (Miễn phí)',
        note: 'FUTA Khuyến mãi 0đ',
      },
      {
        code: `FUTA-CX-${d.codeSuffix}-1330-SLEEP`,
        route: futaRouteOut,
        vehicle: futaCarSleeper,
        hour: 13, minute: 30, arrHour: 20, arrMinute: 0,
        expectedPrice: '250.000đ',
        note: 'FUTA Giường nằm 250k',
      },
      {
        code: `TB-CX-${d.codeSuffix}-1330-SLEEP`,
        route: tbRouteOut,
        vehicle: tbCarSleeper,
        hour: 13, minute: 30, arrHour: 20, arrMinute: 0,
        expectedPrice: '270.000đ',
        note: 'Thành Bưởi Giường nằm 270k',
      },
      {
        code: `HM-CX-${d.codeSuffix}-1330-SLEEP`,
        route: hmRouteOut,
        vehicle: hmCarSleeper,
        hour: 13, minute: 30, arrHour: 20, arrMinute: 0,
        expectedPrice: '260.000đ',
        note: 'Hoa Mai Giường nằm 260k',
      },
      {
        code: `HM-CX-${d.codeSuffix}-1330-SEAT`,
        route: hmRouteOut,
        vehicle: hmCarSeat,
        hour: 13, minute: 30, arrHour: 20, arrMinute: 0,
        expectedPrice: '190.000đ',
        note: 'Hoa Mai Ghế ngồi tiết kiệm 190k',
      },

      // --- Khung giờ 19:00 tối: CÙNG GIỜ, KHÁC NHÀ XE, KHÁC GIÁ (Có vé 0đ Hoa Mai) ---
      {
        code: `HM-CX-${d.codeSuffix}-1900-0D`,
        route: hmRouteOut,
        vehicle: hmCar0d,
        hour: 19, minute: 0, arrHour: 2, arrMinute: 0,
        expectedPrice: '0đ (Miễn phí)',
        note: 'Hoa Mai Khuyến mãi 0đ',
      },
      {
        code: `FUTA-CX-${d.codeSuffix}-1900-LIMO`,
        route: futaRouteOut,
        vehicle: futaCarLimo,
        hour: 19, minute: 0, arrHour: 2, arrMinute: 0,
        expectedPrice: '320.000đ',
        note: 'FUTA Limousine VIP 320k',
      },
      {
        code: `TB-CX-${d.codeSuffix}-1900-LIMO`,
        route: tbRouteOut,
        vehicle: tbCarLimo,
        hour: 19, minute: 0, arrHour: 2, arrMinute: 0,
        expectedPrice: '340.000đ',
        note: 'Thành Bưởi Limousine VIP 340k',
      },
      {
        code: `HM-CX-${d.codeSuffix}-1900-LIMO`,
        route: hmRouteOut,
        vehicle: hmCarLimo,
        hour: 19, minute: 0, arrHour: 2, arrMinute: 0,
        expectedPrice: '330.000đ',
        note: 'Hoa Mai Limousine VIP 330k',
      },

      // --- Khung giờ 22:00 đêm: CÙNG GIỜ, KHÁC NHÀ XE, KHÁC GIÁ (Có vé 0đ) ---
      {
        code: `TB-CX-${d.codeSuffix}-2200-0D`,
        route: tbRouteOut,
        vehicle: tbCar0d,
        hour: 22, minute: 0, arrHour: 5, arrMinute: 0,
        expectedPrice: '0đ (Miễn phí)',
        note: 'Thành Bưởi Đêm Khuyến mãi 0đ',
      },
      {
        code: `FUTA-CX-${d.codeSuffix}-2200-SLEEP`,
        route: futaRouteOut,
        vehicle: futaCarSleeper,
        hour: 22, minute: 0, arrHour: 5, arrMinute: 0,
        expectedPrice: '250.000đ',
        note: 'FUTA Giường nằm đêm 250k',
      },
      {
        code: `TB-CX-${d.codeSuffix}-2200-SLEEP`,
        route: tbRouteOut,
        vehicle: tbCarSleeper,
        hour: 22, minute: 0, arrHour: 5, arrMinute: 0,
        expectedPrice: '270.000đ',
        note: 'Thành Bưởi Giường nằm đêm 270k',
      },
      {
        code: `HM-CX-${d.codeSuffix}-2200-SLEEP`,
        route: hmRouteOut,
        vehicle: hmCarSleeper,
        hour: 22, minute: 0, arrHour: 5, arrMinute: 0,
        expectedPrice: '260.000đ',
        note: 'Hoa Mai Giường nằm đêm 260k',
      },

      // =========================================================================
      // CHIỀU VỀ: ĐÀ LẠT -> TP.HCM (Dành cho kiểm thử khứ hồi & so sánh giá)
      // =========================================================================

      // --- Khung giờ 08:00 sáng chiều về: CÙNG GIỜ, KHÁC NHÀ XE (Có vé 0đ) ---
      {
        code: `FUTA-CX-${d.codeSuffix}-RET-0800-0D`,
        route: futaRouteRet,
        vehicle: futaCar0d,
        hour: 8, minute: 0, arrHour: 14, arrMinute: 30,
        expectedPrice: '0đ (Miễn phí)',
        note: 'FUTA Chiều về Khuyến mãi 0đ',
      },
      {
        code: `FUTA-CX-${d.codeSuffix}-RET-0800-LIMO`,
        route: futaRouteRet,
        vehicle: futaCarLimo,
        hour: 8, minute: 0, arrHour: 14, arrMinute: 30,
        expectedPrice: '340.000đ',
        note: 'FUTA Chiều về Limousine 340k',
      },
      {
        code: `TB-CX-${d.codeSuffix}-RET-0800-LIMO`,
        route: tbRouteRet,
        vehicle: tbCarLimo,
        hour: 8, minute: 0, arrHour: 14, arrMinute: 30,
        expectedPrice: '320.000đ',
        note: 'Thành Bưởi Chiều về Limousine 320k',
      },
      {
        code: `HM-CX-${d.codeSuffix}-RET-0800-LIMO`,
        route: hmRouteRet,
        vehicle: hmCarLimo,
        hour: 8, minute: 0, arrHour: 14, arrMinute: 30,
        expectedPrice: '330.000đ',
        note: 'Hoa Mai Chiều về Limousine 330k',
      },

      // --- Khung giờ 13:30 chiều chiều về: CÙNG GIỜ, KHÁC NHÀ XE (Có vé 0đ) ---
      {
        code: `TB-CX-${d.codeSuffix}-RET-1330-0D`,
        route: tbRouteRet,
        vehicle: tbCar0d,
        hour: 13, minute: 30, arrHour: 20, arrMinute: 0,
        expectedPrice: '0đ (Miễn phí)',
        note: 'Thành Bưởi Chiều về Khuyến mãi 0đ',
      },
      {
        code: `TB-CX-${d.codeSuffix}-RET-1330-SLEEP`,
        route: tbRouteRet,
        vehicle: tbCarSleeper,
        hour: 13, minute: 30, arrHour: 20, arrMinute: 0,
        expectedPrice: '250.000đ',
        note: 'Thành Bưởi Chiều về Giường nằm 250k',
      },
      {
        code: `FUTA-CX-${d.codeSuffix}-RET-1330-SLEEP`,
        route: futaRouteRet,
        vehicle: futaCarSleeper,
        hour: 13, minute: 30, arrHour: 20, arrMinute: 0,
        expectedPrice: '270.000đ',
        note: 'FUTA Chiều về Giường nằm 270k',
      },
      {
        code: `HM-CX-${d.codeSuffix}-RET-1330-SLEEP`,
        route: hmRouteRet,
        vehicle: hmCarSleeper,
        hour: 13, minute: 30, arrHour: 20, arrMinute: 0,
        expectedPrice: '260.000đ',
        note: 'Hoa Mai Chiều về Giường nằm 260k',
      },

      // --- Khung giờ 22:00 đêm chiều về: CÙNG GIỜ, KHÁC NHÀ XE (Có vé 0đ) ---
      {
        code: `HM-CX-${d.codeSuffix}-RET-2200-0D`,
        route: hmRouteRet,
        vehicle: hmCar0d,
        hour: 22, minute: 0, arrHour: 5, arrMinute: 0,
        expectedPrice: '0đ (Miễn phí)',
        note: 'Hoa Mai Chiều về Khuyến mãi 0đ',
      },
      {
        code: `FUTA-CX-${d.codeSuffix}-RET-2200-SLEEP`,
        route: futaRouteRet,
        vehicle: futaCarSleeper,
        hour: 22, minute: 0, arrHour: 5, arrMinute: 0,
        expectedPrice: '270.000đ',
        note: 'FUTA Chiều về Giường nằm 270k',
      },
      {
        code: `TB-CX-${d.codeSuffix}-RET-2200-SLEEP`,
        route: tbRouteRet,
        vehicle: tbCarSleeper,
        hour: 22, minute: 0, arrHour: 5, arrMinute: 0,
        expectedPrice: '250.000đ',
        note: 'Thành Bưởi Chiều về Giường nằm 250k',
      },
      {
        code: `HM-CX-${d.codeSuffix}-RET-2200-SLEEP`,
        route: hmRouteRet,
        vehicle: hmCarSleeper,
        hour: 22, minute: 0, arrHour: 5, arrMinute: 0,
        expectedPrice: '260.000đ',
        note: 'Hoa Mai Chiều về Giường nằm 260k',
      },
    ];

    for (const t of tripTemplates) {
      const trip = await prisma.chuyenXe.upsert({
        where: { maChuyenXe: t.code },
        create: {
          maChuyenXe: t.code,
          ngayKhoiHanh: dateOnly(d.year, d.month, d.day),
          gioKhoiHanh: timeOnly(t.hour, t.minute),
          gioDen: timeOnly(t.arrHour, t.arrMinute),
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
          gioKhoiHanh: timeOnly(t.hour, t.minute),
          gioDen: timeOnly(t.arrHour, t.arrMinute),
          trangThai: 'CHUA_KHOI_HANH',
          nhaXeId: t.route.nhaXeId,
          tuyenXeId: t.route.tuyenXeId,
          xeId: t.vehicle.xeId,
        },
      });

      // Tạo ghế trống cho chuyến xe
      for (const seat of t.vehicle.ghes) {
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
        totalSeatsCreated++;
      }

      totalTripsCreated++;
      const timeStr = `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;
      console.log(`  [${d.label} ${timeStr}] ${t.route.diemDi} -> ${t.route.diemDen} | ${t.note} | Giá: ${t.expectedPrice} | Mã: ${t.code}`);
    }
  }

  console.log('\n====================================================================');
  console.log(`✅ HOÀN THÀNH: Đã tạo thành công ${totalTripsCreated} chuyến xe và ${totalSeatsCreated} lượt ghế!`);
  console.log('   - Tuyến: TP.HCM <-> Đà Lạt (Cả 2 chiều khứ hồi)');
  console.log('   - Ngày: 26/10/2026, 27/10/2026, 28/10/2026');
  console.log('   - Nhà xe: Phương Trang (FUTA), Thành Bưởi, Hoa Mai');
  console.log('   - Loại giá: Vé 0đ (miễn phí), 190k, 250k, 260k, 270k, 320k, 330k, 340k');
  console.log('   - Khung giờ so sánh: 08:00, 13:30, 19:00, 22:00 (cùng giờ, khác nhà xe, khác giá)');
  console.log('====================================================================\n');
}

main()
  .catch((e) => {
    console.error('Lỗi khi khởi tạo chuyến xe:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
