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
  console.log('    TẠO DỮ LIỆU CHUYẾN XE MẪU TỪ NGÀY 01/11 ĐẾN 05/11 NĂM 2026      ');
  console.log('    (TP.HCM - Đà Lạt, Vũng Tàu, Nha Trang | FUTA, Thành Bưởi, Hoa Mai)');
  console.log('====================================================================\n');

  // Lấy thông tin các tuyến xe
  const futaRouteOut = await prisma.tuyenXe.findUnique({ where: { tuyenXeId: 1 } }); // TP.HCM -> Đà Lạt
  const futaRouteRet = await prisma.tuyenXe.findUnique({ where: { tuyenXeId: 2 } }); // Đà Lạt -> TP.HCM
  const futaRouteNhaTrang = await prisma.tuyenXe.findUnique({ where: { tuyenXeId: 3 } }); // TP.HCM -> Nha Trang

  const tbRouteOut = await prisma.tuyenXe.findUnique({ where: { tuyenXeId: 5 } }); // TP.HCM -> Đà Lạt
  const tbRouteRet = await prisma.tuyenXe.findUnique({ where: { tuyenXeId: 4 } }); // Đà Lạt -> TP.HCM
  const tbRouteNhaTrang = await prisma.tuyenXe.findUnique({ where: { tuyenXeId: 6 } }); // Đà Lạt -> Nha Trang

  const hmRouteOut = await prisma.tuyenXe.findUnique({ where: { tuyenXeId: 10 } }); // TP.HCM -> Đà Lạt
  const hmRouteRet = await prisma.tuyenXe.findUnique({ where: { tuyenXeId: 11 } }); // Đà Lạt -> TP.HCM
  const hmRouteVungTauOut = await prisma.tuyenXe.findUnique({ where: { tuyenXeId: 8 } }); // TP.HCM -> Vũng Tàu
  const hmRouteVungTauRet = await prisma.tuyenXe.findUnique({ where: { tuyenXeId: 7 } }); // Vũng Tàu -> TP.HCM
  const hmRouteVungTauDaLat = await prisma.tuyenXe.findUnique({ where: { tuyenXeId: 9 } }); // Vũng Tàu -> Đà Lạt

  // Lấy các xe theo nhà xe & loại xe
  // FUTA (nhaXeId: 1)
  const futaCar0d = await prisma.xe.findUnique({ where: { xeId: 71 }, include: { ghes: true, loaiXe: true } });
  const futaCarSeat = await prisma.xe.findUnique({ where: { xeId: 1 }, include: { ghes: true, loaiXe: true } });
  const futaCarSleeper = await prisma.xe.findUnique({ where: { xeId: 2 }, include: { ghes: true, loaiXe: true } });
  const futaCarLimo = await prisma.xe.findUnique({ where: { xeId: 3 }, include: { ghes: true, loaiXe: true } });

  // Thành Bưởi (nhaXeId: 2)
  const tbCar0d = await prisma.xe.findUnique({ where: { xeId: 110 }, include: { ghes: true, loaiXe: true } });
  const tbCarSeat = await prisma.xe.findUnique({ where: { xeId: 7 }, include: { ghes: true, loaiXe: true } });
  const tbCarSleeper = await prisma.xe.findUnique({ where: { xeId: 8 }, include: { ghes: true, loaiXe: true } });
  const tbCarLimo = await prisma.xe.findUnique({ where: { xeId: 9 }, include: { ghes: true, loaiXe: true } });

  // Hoa Mai (nhaXeId: 3)
  const hmCar0d = await prisma.xe.findUnique({ where: { xeId: 161 }, include: { ghes: true, loaiXe: true } });
  const hmCarSeat = await prisma.xe.findUnique({ where: { xeId: 13 }, include: { ghes: true, loaiXe: true } });
  const hmCarSleeper = await prisma.xe.findUnique({ where: { xeId: 14 }, include: { ghes: true, loaiXe: true } });
  const hmCarLimo = await prisma.xe.findUnique({ where: { xeId: 15 }, include: { ghes: true, loaiXe: true } });

  const datesToSeed = [
    { year: 2026, month: 11, day: 1, label: '01/11/2026', codeSuffix: '01112026' },
    { year: 2026, month: 11, day: 2, label: '02/11/2026', codeSuffix: '02112026' },
    { year: 2026, month: 11, day: 3, label: '03/11/2026', codeSuffix: '03112026' },
    { year: 2026, month: 11, day: 4, label: '04/11/2026', codeSuffix: '04112026' },
    { year: 2026, month: 11, day: 5, label: '05/11/2026', codeSuffix: '05112026' },
  ];

  let totalTripsCreated = 0;
  let totalSeatsCreated = 0;

  for (const d of datesToSeed) {
    console.log(`\n>>> Đang khởi tạo chuyến xe ngày ${d.label} <<<`);

    const tripTemplates = [
      // =========================================================================
      // 1. CHIỀU ĐI: TP.HCM -> ĐÀ LẠT
      // =========================================================================
      {
        code: `FUTA-CX-${d.codeSuffix}-0700-SLEEP`,
        route: futaRouteOut,
        vehicle: futaCarSleeper,
        hour: 7, minute: 0, arrHour: 13, arrMinute: 30,
        expectedPrice: '250.000đ',
        note: 'FUTA Giường nằm 250k',
      },
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
        code: `TB-CX-${d.codeSuffix}-0830-0D`,
        route: tbRouteOut,
        vehicle: tbCar0d,
        hour: 8, minute: 30, arrHour: 15, arrMinute: 0,
        expectedPrice: '0đ (Miễn phí)',
        note: 'Thành Bưởi Khuyến mãi 0đ',
      },
      {
        code: `HM-CX-${d.codeSuffix}-1100-SLEEP`,
        route: hmRouteOut,
        vehicle: hmCarSleeper,
        hour: 11, minute: 0, arrHour: 17, arrMinute: 30,
        expectedPrice: '260.000đ',
        note: 'Hoa Mai Giường nằm 260k',
      },
      {
        code: `FUTA-CX-${d.codeSuffix}-1330-0D`,
        route: futaRouteOut,
        vehicle: futaCar0d,
        hour: 13, minute: 30, arrHour: 20, arrMinute: 0,
        expectedPrice: '0đ (Miễn phí)',
        note: 'FUTA Khuyến mãi 0đ',
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
        code: `FUTA-CX-${d.codeSuffix}-1700-SEAT`,
        route: futaRouteOut,
        vehicle: futaCarSeat,
        hour: 17, minute: 0, arrHour: 23, arrMinute: 30,
        expectedPrice: '180.000đ',
        note: 'FUTA Ghế ngồi tiêu chuẩn 180k',
      },
      {
        code: `TB-CX-${d.codeSuffix}-1930-LIMO`,
        route: tbRouteOut,
        vehicle: tbCarLimo,
        hour: 19, minute: 30, arrHour: 2, arrMinute: 0,
        expectedPrice: '340.000đ',
        note: 'Thành Bưởi Limousine 340k',
      },
      {
        code: `HM-CX-${d.codeSuffix}-2200-0D`,
        route: hmRouteOut,
        vehicle: hmCar0d,
        hour: 22, minute: 0, arrHour: 4, arrMinute: 30,
        expectedPrice: '0đ (Miễn phí)',
        note: 'Hoa Mai Khuyến mãi 0đ',
      },
      {
        code: `FUTA-CX-${d.codeSuffix}-2230-SLEEP`,
        route: futaRouteOut,
        vehicle: futaCarSleeper,
        hour: 22, minute: 30, arrHour: 5, arrMinute: 0,
        expectedPrice: '250.000đ',
        note: 'FUTA Giường nằm 250k',
      },
      {
        code: `TB-CX-${d.codeSuffix}-2300-SLEEP`,
        route: tbRouteOut,
        vehicle: tbCarSleeper,
        hour: 23, minute: 0, arrHour: 5, arrMinute: 30,
        expectedPrice: '270.000đ',
        note: 'Thành Bưởi Giường nằm 270k',
      },

      // =========================================================================
      // 2. CHIỀU VỀ: ĐÀ LẠT -> TP.HCM
      // =========================================================================
      {
        code: `TB-CX-${d.codeSuffix}-RET-0730-SLEEP`,
        route: tbRouteRet,
        vehicle: tbCarSleeper,
        hour: 7, minute: 30, arrHour: 14, arrMinute: 0,
        expectedPrice: '250.000đ',
        note: 'Thành Bưởi Chiều về Giường nằm 250k',
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
        code: `HM-CX-${d.codeSuffix}-RET-0830-0D`,
        route: hmRouteRet,
        vehicle: hmCar0d,
        hour: 8, minute: 30, arrHour: 15, arrMinute: 0,
        expectedPrice: '0đ (Miễn phí)',
        note: 'Hoa Mai Chiều về Khuyến mãi 0đ',
      },
      {
        code: `FUTA-CX-${d.codeSuffix}-RET-1300-0D`,
        route: futaRouteRet,
        vehicle: futaCar0d,
        hour: 13, minute: 0, arrHour: 19, arrMinute: 30,
        expectedPrice: '0đ (Miễn phí)',
        note: 'FUTA Chiều về Khuyến mãi 0đ',
      },
      {
        code: `TB-CX-${d.codeSuffix}-RET-1330-0D`,
        route: tbRouteRet,
        vehicle: tbCar0d,
        hour: 13, minute: 30, arrHour: 20, arrMinute: 0,
        expectedPrice: '0đ (Miễn phí)',
        note: 'Thành Bưởi Chiều về Khuyến mãi 0đ',
      },
      {
        code: `HM-CX-${d.codeSuffix}-RET-1400-SLEEP`,
        route: hmRouteRet,
        vehicle: hmCarSleeper,
        hour: 14, minute: 0, arrHour: 20, arrMinute: 30,
        expectedPrice: '260.000đ',
        note: 'Hoa Mai Chiều về Giường nằm 260k',
      },
      {
        code: `FUTA-CX-${d.codeSuffix}-RET-1800-SEAT`,
        route: futaRouteRet,
        vehicle: futaCarSeat,
        hour: 18, minute: 0, arrHour: 0, arrMinute: 30,
        expectedPrice: '200.000đ',
        note: 'FUTA Chiều về Ghế ngồi 200k',
      },
      {
        code: `TB-CX-${d.codeSuffix}-RET-2130-LIMO`,
        route: tbRouteRet,
        vehicle: tbCarLimo,
        hour: 21, minute: 30, arrHour: 4, arrMinute: 0,
        expectedPrice: '320.000đ',
        note: 'Thành Bưởi Chiều về Limousine 320k',
      },
      {
        code: `FUTA-CX-${d.codeSuffix}-RET-2200-SLEEP`,
        route: futaRouteRet,
        vehicle: futaCarSleeper,
        hour: 22, minute: 0, arrHour: 4, arrMinute: 30,
        expectedPrice: '270.000đ',
        note: 'FUTA Chiều về Giường nằm 270k',
      },
      {
        code: `HM-CX-${d.codeSuffix}-RET-2230-LIMO`,
        route: hmRouteRet,
        vehicle: hmCarLimo,
        hour: 22, minute: 30, arrHour: 5, arrMinute: 0,
        expectedPrice: '330.000đ',
        note: 'Hoa Mai Chiều về Limousine 330k',
      },

      // =========================================================================
      // 3. TUYẾN TP.HCM <-> VŨNG TÀU (Hoa Mai)
      // =========================================================================
      {
        code: `HM-CX-${d.codeSuffix}-SG-VT-0630-LIMO`,
        route: hmRouteVungTauOut,
        vehicle: hmCarLimo,
        hour: 6, minute: 30, arrHour: 8, arrMinute: 45,
        expectedPrice: '340.000đ',
        note: 'Hoa Mai TP.HCM -> Vũng Tàu Limousine 340k',
      },
      {
        code: `HM-CX-${d.codeSuffix}-SG-VT-0900-SEAT`,
        route: hmRouteVungTauOut,
        vehicle: hmCarSeat,
        hour: 9, minute: 0, arrHour: 11, arrMinute: 30,
        expectedPrice: '200.000đ',
        note: 'Hoa Mai TP.HCM -> Vũng Tàu Ghế ngồi 200k',
      },
      {
        code: `HM-CX-${d.codeSuffix}-SG-VT-1430-SLEEP`,
        route: hmRouteVungTauOut,
        vehicle: hmCarSleeper,
        hour: 14, minute: 30, arrHour: 17, arrMinute: 0,
        expectedPrice: '270.000đ',
        note: 'Hoa Mai TP.HCM -> Vũng Tàu Giường nằm 270k',
      },
      {
        code: `HM-CX-${d.codeSuffix}-VT-SG-0800-LIMO`,
        route: hmRouteVungTauRet,
        vehicle: hmCarLimo,
        hour: 8, minute: 0, arrHour: 10, arrMinute: 15,
        expectedPrice: '320.000đ',
        note: 'Hoa Mai Vũng Tàu -> TP.HCM Limousine 320k',
      },
      {
        code: `HM-CX-${d.codeSuffix}-VT-SG-1300-SEAT`,
        route: hmRouteVungTauRet,
        vehicle: hmCarSeat,
        hour: 13, minute: 0, arrHour: 15, arrMinute: 30,
        expectedPrice: '180.000đ',
        note: 'Hoa Mai Vũng Tàu -> TP.HCM Ghế ngồi 180k',
      },
      {
        code: `HM-CX-${d.codeSuffix}-VT-SG-1730-SLEEP`,
        route: hmRouteVungTauRet,
        vehicle: hmCarSleeper,
        hour: 17, minute: 30, arrHour: 20, arrMinute: 0,
        expectedPrice: '250.000đ',
        note: 'Hoa Mai Vũng Tàu -> TP.HCM Giường nằm 250k',
      },

      // =========================================================================
      // 4. TUYẾN TP.HCM -> NHA TRANG (Phương Trang)
      // =========================================================================
      {
        code: `FUTA-CX-${d.codeSuffix}-SG-NT-0800-LIMO`,
        route: futaRouteNhaTrang,
        vehicle: futaCarLimo,
        hour: 8, minute: 0, arrHour: 16, arrMinute: 30,
        expectedPrice: '360.000đ',
        note: 'FUTA TP.HCM -> Nha Trang Limousine 360k',
      },
      {
        code: `FUTA-CX-${d.codeSuffix}-SG-NT-2100-SLEEP`,
        route: futaRouteNhaTrang,
        vehicle: futaCarSleeper,
        hour: 21, minute: 0, arrHour: 5, arrMinute: 30,
        expectedPrice: '290.000đ',
        note: 'FUTA TP.HCM -> Nha Trang Giường nằm 290k',
      },

      // =========================================================================
      // 5. TUYẾN ĐÀ LẠT -> NHA TRANG (Thành Bưởi)
      // =========================================================================
      {
        code: `TB-CX-${d.codeSuffix}-DL-NT-0800-LIMO`,
        route: tbRouteNhaTrang,
        vehicle: tbCarLimo,
        hour: 8, minute: 0, arrHour: 11, arrMinute: 30,
        expectedPrice: '360.000đ',
        note: 'Thành Bưởi Đà Lạt -> Nha Trang Limousine 360k',
      },
      {
        code: `TB-CX-${d.codeSuffix}-DL-NT-1330-SLEEP`,
        route: tbRouteNhaTrang,
        vehicle: tbCarSleeper,
        hour: 13, minute: 30, arrHour: 17, arrMinute: 0,
        expectedPrice: '290.000đ',
        note: 'Thành Bưởi Đà Lạt -> Nha Trang Giường nằm 290k',
      },

      // =========================================================================
      // 6. TUYẾN VŨNG TÀU -> ĐÀ LẠT (Hoa Mai)
      // =========================================================================
      {
        code: `HM-CX-${d.codeSuffix}-VT-DL-0700-LIMO`,
        route: hmRouteVungTauDaLat,
        vehicle: hmCarLimo,
        hour: 7, minute: 0, arrHour: 14, arrMinute: 30,
        expectedPrice: '360.000đ',
        note: 'Hoa Mai Vũng Tàu -> Đà Lạt Limousine 360k',
      },
      {
        code: `HM-CX-${d.codeSuffix}-VT-DL-1830-SLEEP`,
        route: hmRouteVungTauDaLat,
        vehicle: hmCarSleeper,
        hour: 18, minute: 30, arrHour: 2, arrMinute: 0,
        expectedPrice: '290.000đ',
        note: 'Hoa Mai Vũng Tàu -> Đà Lạt Giường nằm 290k',
      },
    ];

    for (const t of tripTemplates) {
      if (!t.route || !t.vehicle) {
        console.warn(`  ⚠️ Bỏ qua ${t.code} do thiếu route hoặc vehicle`);
        continue;
      }

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
  console.log('   - Tuyến: TP.HCM <-> Đà Lạt, TP.HCM <-> Vũng Tàu, TP.HCM -> Nha Trang, Đà Lạt -> Nha Trang, Vũng Tàu -> Đà Lạt');
  console.log('   - Ngày: 01/11/2026, 02/11/2026, 03/11/2026, 04/11/2026, 05/11/2026');
  console.log('   - Nhà xe: Phương Trang (FUTA), Thành Bưởi, Hoa Mai');
  console.log('   - Đầy đủ các loại xe: Limousine, Giường nằm, Ghế ngồi, Xe Khuyến mãi 0đ');
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
