import 'dotenv/config';
import crypto from 'node:crypto';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../apps/api/dist/generated/prisma/client.js';

const url = new URL(process.env.DATABASE_URL);
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

export function deterministicUuid(...parts) {
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
  console.log('=== BẮT ĐẦU CHUẨN HOÁ MÃ NGHIỆP VỤ SANG UUID V4 VÀ TÁI SEED DB ===\n');

  // 1. Chuẩn hoá mã Tuyến xe (TuyenXe)
  console.log('--- 1. Chuẩn hoá mã Tuyến xe (maTuyenXe) ---');
  const routes = await prisma.tuyenXe.findMany();
  for (const r of routes) {
    const newCode = deterministicUuid('TX', r.tuyenXeId);
    await prisma.tuyenXe.update({
      where: { tuyenXeId: r.tuyenXeId },
      data: { maTuyenXe: newCode },
    });
  }
  console.log(`✓ Đã chuẩn hoá ${routes.length} mã tuyến xe sang UUID v4.\n`);

  // 2. Chuẩn hoá mã Ghế (Ghe)
  console.log('--- 2. Chuẩn hoá mã Ghế (maGhe) và tên ghế (tenGhe) ---');
  const seats = await prisma.ghe.findMany();
  for (const s of seats) {
    const newCode = deterministicUuid('GHE', s.gheId, s.xeId);
    await prisma.ghe.update({
      where: { gheId: s.gheId },
      data: {
        maGhe: newCode,
        tenGhe: s.tenGhe || `G${s.gheId}`,
      },
    });
  }
  console.log(`✓ Đã chuẩn hoá ${seats.length} ghế sang mã UUID v4.\n`);

  // 3. Chuẩn hoá mã Nhân viên (NhanVien)
  console.log('--- 3. Chuẩn hoá mã Nhân viên (maNhanVien) ---');
  const employees = await prisma.nhanVien.findMany();
  for (const e of employees) {
    const newCode = deterministicUuid('NV', e.nhanVienId);
    await prisma.nhanVien.update({
      where: { nhanVienId: e.nhanVienId },
      data: { maNhanVien: newCode },
    });
  }
  console.log(`✓ Đã chuẩn hoá ${employees.length} mã nhân viên sang UUID v4.\n`);

  // 4. Chuẩn hoá mã Khách hàng (KhachHang)
  console.log('--- 4. Chuẩn hoá mã Khách hàng (maKhachHang) ---');
  const customers = await prisma.khachHang.findMany();
  for (const c of customers) {
    const newCode = deterministicUuid('KH', c.khachHangId);
    await prisma.khachHang.update({
      where: { khachHangId: c.khachHangId },
      data: { maKhachHang: newCode },
    });
  }
  console.log(`✓ Đã chuẩn hoá ${customers.length} mã khách hàng sang UUID v4.\n`);

  // 5. Chuẩn hoá mã Giao dịch / Đặt vé / Vé / Hàng hoá / Hoá đơn
  console.log('--- 5. Chuẩn hoá mã Đơn giao dịch, Phiếu đặt vé, Vé, Vận đơn, Hoá đơn ---');
  const transactions = await prisma.donGiaoDich.findMany();
  for (const tx of transactions) {
    const newTxCode = deterministicUuid('GD', tx.donGiaoDichId);
    await prisma.donGiaoDich.update({
      where: { donGiaoDichId: tx.donGiaoDichId },
      data: { maDonGiaoDich: newTxCode },
    });
  }
  console.log(`✓ Đã chuẩn hoá ${transactions.length} mã đơn giao dịch.`);

  const bookings = await prisma.phieuDatVe.findMany();
  for (const bk of bookings) {
    const newBkCode = deterministicUuid('PDV', bk.phieuDatVeId);
    await prisma.phieuDatVe.update({
      where: { phieuDatVeId: bk.phieuDatVeId },
      data: { maPhieuDatVe: newBkCode },
    });
  }
  console.log(`✓ Đã chuẩn hoá ${bookings.length} mã phiếu đặt vé.`);

  const tickets = await prisma.ve.findMany();
  for (const tk of tickets) {
    const newTkCode = deterministicUuid('VE', tk.veId);
    await prisma.ve.update({
      where: { veId: tk.veId },
      data: { maVe: newTkCode },
    });
  }
  console.log(`✓ Đã chuẩn hoá ${tickets.length} mã vé.`);

  const shipments = await prisma.phieuGuiHang.findMany();
  for (const sm of shipments) {
    const newSmCode = deterministicUuid('VD', sm.phieuGuiHangId);
    await prisma.phieuGuiHang.update({
      where: { phieuGuiHangId: sm.phieuGuiHangId },
      data: { maVanDon: newSmCode },
    });
  }
  console.log(`✓ Đã chuẩn hoá ${shipments.length} mã vận đơn.`);

  const invoices = await prisma.hoaDon.findMany();
  for (const iv of invoices) {
    const newIvCode = deterministicUuid('HD', iv.hoaDonId);
    await prisma.hoaDon.update({
      where: { hoaDonId: iv.hoaDonId },
      data: { maHoaDon: newIvCode },
    });
  }
  console.log(`✓ Đã chuẩn hoá ${invoices.length} mã hoá đơn.\n`);

  // 6. Chuẩn hoá mã Chuyến xe hiện có
  console.log('--- 6. Chuẩn hoá mã các Chuyến xe hiện có sang UUID v4 ---');
  const existingTrips = await prisma.chuyenXe.findMany();
  for (const tr of existingTrips) {
    const newTripCode = deterministicUuid('CX', tr.chuyenXeId);
    await prisma.chuyenXe.update({
      where: { chuyenXeId: tr.chuyenXeId },
      data: { maChuyenXe: newTripCode },
    });
  }
  console.log(`✓ Đã chuẩn hoá ${existingTrips.length} chuyến xe hiện có sang UUID v4.\n`);

  // 7. Seed mở rộng Chuyến xe Tháng 11 (12/11 -> 30/11) và Tháng 12 (1/12 -> 31/12)
  console.log('--- 7. Seed thêm Chuyến xe Tháng 11 & Tháng 12 năm 2026 chuẩn UUID v4 ---');
  const allRoutes = await prisma.tuyenXe.findMany({
    where: { trangThai: 'HOAT_DONG' },
    include: {
      tuyenXeDiemDungs: {
        include: { diemDonTra: true },
        orderBy: [{ phutLech: 'asc' }, { thuTu: 'asc' }],
      },
    },
  });
  const routesMap = new Map(allRoutes.map((r) => [r.tuyenXeId, r]));

  const vehicles = await prisma.xe.findMany({
    where: { trangThai: 'HOAT_DONG' },
    include: { loaiXe: true, ghes: true },
  });
  const vehiclesByOperator = new Map();
  for (const v of vehicles) {
    if (!vehiclesByOperator.has(v.nhaXeId)) vehiclesByOperator.set(v.nhaXeId, []);
    vehiclesByOperator.get(v.nhaXeId).push(v);
  }

  // Danh sách cấu hình chuyến cố định trong ngày cho 3 nhà xe
  const dailySchedules = [
    // FUTA (nhaXeId 1)
    { nhaXeId: 1, routeId: 1, time: '06:00', duration: 420 },
    { nhaXeId: 1, routeId: 1, time: '13:00', duration: 420 },
    { nhaXeId: 1, routeId: 2, time: '08:00', duration: 420 },
    { nhaXeId: 1, routeId: 2, time: '15:00', duration: 420 },
    { nhaXeId: 1, routeId: 87, time: '07:00', duration: 210 },
    { nhaXeId: 1, routeId: 87, time: '14:00', duration: 210 },
    { nhaXeId: 1, routeId: 89, time: '08:30', duration: 150 },
    { nhaXeId: 1, routeId: 89, time: '16:00', duration: 150 },

    // TB (nhaXeId 2)
    { nhaXeId: 2, routeId: 5, time: '08:00', duration: 420 },
    { nhaXeId: 2, routeId: 5, time: '22:00', duration: 420 },
    { nhaXeId: 2, routeId: 4, time: '09:00', duration: 420 },
    { nhaXeId: 2, routeId: 4, time: '23:00', duration: 420 },

    // HM (nhaXeId 3)
    { nhaXeId: 3, routeId: 90, time: '06:30', duration: 150 },
    { nhaXeId: 3, routeId: 90, time: '12:00', duration: 150 },
    { nhaXeId: 3, routeId: 90, time: '17:00', duration: 150 },
    { nhaXeId: 3, routeId: 7, time: '07:30', duration: 150 },
    { nhaXeId: 3, routeId: 7, time: '13:30', duration: 150 },
    { nhaXeId: 3, routeId: 7, time: '18:30', duration: 150 },
    { nhaXeId: 3, routeId: 10, time: '08:00', duration: 420 },
    { nhaXeId: 3, routeId: 11, time: '14:00', duration: 420 },
  ];

  let addedTrips = 0;
  let addedTripSeats = 0;
  let addedTripStops = 0;

  // Dải ngày: Từ 12/11/2026 đến 31/12/2026
  // (Tháng 11: ngày 12 -> 30; Tháng 12: ngày 1 -> 31)
  const targetDates = [];
  for (let d = 12; d <= 30; d++) {
    targetDates.push({ year: 2026, month: 11, day: d });
  }
  for (let d = 1; d <= 31; d++) {
    targetDates.push({ year: 2026, month: 12, day: d });
  }

  for (const { year, month, day } of targetDates) {
    const monthStr = month < 10 ? `0${month}` : `${month}`;
    const dayStr = day < 10 ? `0${day}` : `${day}`;
    const dateStr = `${year}-${monthStr}-${dayStr}`;
    const departureDate = new Date(`${dateStr}T00:00:00.000Z`);

    for (let i = 0; i < dailySchedules.length; i++) {
      const schedule = dailySchedules[i];
      const route = routesMap.get(schedule.routeId);
      if (!route) continue;

      const opVehicles = vehiclesByOperator.get(schedule.nhaXeId) || [];
      if (opVehicles.length === 0) continue;
      const vehicle = opVehicles[(day + i) % opVehicles.length];

      // Mã chuyến xe là UUID v4 32 hex lowercase
      const maChuyenXe = deterministicUuid('CX', schedule.nhaXeId, schedule.routeId, dateStr, schedule.time);

      const existing = await prisma.chuyenXe.findUnique({
        where: { maChuyenXe },
        select: { chuyenXeId: true },
      });
      if (existing) continue;

      const [hour, min] = schedule.time.split(':').map(Number);
      const departureTime = new Date(`1970-01-01T${schedule.time}:00.000Z`);
      const arrivalTime = calculateClockTime(departureTime, schedule.duration);

      const createdTrip = await prisma.chuyenXe.create({
        data: {
          maChuyenXe,
          ngayKhoiHanh: departureDate,
          gioKhoiHanh: departureTime,
          gioDen: arrivalTime,
          nhanGuiHang: true,
          sucChuaXeMay: vehicle.loaiXe.sucChuaXeMayMacDinh ?? 1,
          sucChuaHangCongKenh: vehicle.loaiXe.sucChuaHangCongKenhMacDinh ?? 5,
          sucChuaHangNhe: vehicle.loaiXe.sucChuaHangNheMacDinh ?? 45,
          trangThai: 'CHUA_KHOI_HANH',
          nhaXeId: schedule.nhaXeId,
          tuyenXeId: schedule.routeId,
          xeId: vehicle.xeId,
        },
      });
      addedTrips++;

      // Tạo ghế chuyến xe
      if (vehicle.ghes.length > 0) {
        await prisma.gheChuyenXe.createMany({
          data: vehicle.ghes.map((ghe) => ({
            chuyenXeId: createdTrip.chuyenXeId,
            gheId: ghe.gheId,
            trangThai: 'TRONG',
            tang: ghe.tang,
            toaDoX: ghe.toaDoX,
            toaDoY: ghe.toaDoY,
          })),
        });
        addedTripSeats += vehicle.ghes.length;
      }

      // Kế thừa điểm dừng
      if (route.tuyenXeDiemDungs.length > 0) {
        await prisma.diemDonTraChuyenXe.createMany({
          data: route.tuyenXeDiemDungs.map((stop) => ({
            chuyenXeId: createdTrip.chuyenXeId,
            diemDonTraId: stop.diemDonTraId,
            loaiDiem: stop.loaiDiem,
            thoiGianDuKien: calculateClockTime(departureTime, stop.phutLech),
            phutLech: stop.phutLech,
            thuTu: stop.thuTu,
            phuPhi: stop.phuPhi,
            phutCoMatTruoc: stop.phutCoMatTruoc,
            nhanKhach: stop.nhanKhach,
            ghiChu: stop.ghiChu,
          })),
        });
        addedTripStops += route.tuyenXeDiemDungs.length;
      }
    }
  }

  console.log(`✓ Đã tạo thêm ${addedTrips} chuyến xe mới (từ 12/11/2026 đến 31/12/2026).`);
  console.log(`✓ Đã tạo thêm ${addedTripSeats} ghế chuyến xe.`);
  console.log(`✓ Đã tạo thêm ${addedTripStops} điểm đón/trả chuyến xe.`);

  console.log('\n=== HOÀN TẤT CHUẨN HOÁ VÀ SEED DỮ LIỆU ===');
}

main()
  .catch((err) => {
    console.error('LỖI:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
