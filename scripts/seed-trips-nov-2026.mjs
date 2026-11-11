import 'dotenv/config';
import crypto from 'node:crypto';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../apps/api/dist/generated/prisma/client.js';
import { databaseConfig } from '../prisma/lib/db-config.mjs';

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(databaseConfig()) });

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

async function prepareRouteTemplates() {
  console.log('--- 1. CẤU HÌNH KHUÔN ĐIỂM DỪNG CHO CÁC TUYẾN CHƯA CÓ ---');

  let tbTransferPoint = await prisma.diemDonTra.findFirst({
    where: { maDiem: deterministicUuid('DDT', 2, 'TB-TC-HO-XUAN-HUONG'), nhaXeId: 2 },
  });

  if (!tbTransferPoint) {
    const dalatBase = await prisma.diemDonTra.findFirst({
      where: { nhaXeId: 2, tenDiem: { contains: 'Đà Lạt' } },
    });

    tbTransferPoint = await prisma.diemDonTra.create({
      data: {
        maDiem: deterministicUuid('DDT', 2, 'TB-TC-HO-XUAN-HUONG'),
        tenDiem: 'Điểm đón trung chuyển Hồ Xuân Hương - Đà Lạt',
        loaiDiem: 'TRUNG_CHUYEN',
        diaChi: 'Quảng trường Lâm Viên, Đường Trần Quốc Toản, Phường 10, TP. Đà Lạt, Lâm Đồng',
        diaDiemCuId: dalatBase?.diaDiemCuId ?? null,
        diaDiemMoiId: dalatBase?.diaDiemMoiId ?? null,
        trangThai: 'HOAT_DONG',
        nhaXeId: 2,
        benTrungChuyenId: dalatBase?.diemDonTraId ?? null,
      },
    });
    console.log(`+ Đã tạo điểm trung chuyển Thành Bưởi: ${tbTransferPoint.tenDiem} (ID: ${tbTransferPoint.diemDonTraId})`);
  } else {
    console.log(`✓ Điểm trung chuyển Thành Bưởi đã tồn tại: ID ${tbTransferPoint.diemDonTraId}`);
  }

  async function findPoint(nhaXeId, keyword) {
    const pt = await prisma.diemDonTra.findFirst({
      where: {
        nhaXeId,
        tenDiem: { contains: keyword },
      },
      select: { diemDonTraId: true },
    });
    return pt?.diemDonTraId ?? null;
  }

  // Tuyến 5 của Thành Bưởi: TP.HCM -> Đà Lạt
  const tbRoute5StopsCount = await prisma.tuyenXeDiemDung.count({ where: { tuyenXeId: 5 } });
  if (tbRoute5StopsCount === 0) {
    const pLeHongPhong = await findPoint(2, 'Lê Hồng Phong');
    const pHangXanh = await findPoint(2, 'Hàng Xanh');
    const pMienDong = await findPoint(2, 'Miền Đông');
    const pBaoLoc = await findPoint(2, 'Bảo Lộc');
    const pDucTrong = await findPoint(2, 'Đức Trọng');
    const pDaLat = await findPoint(2, 'Đà Lạt');
    const pLuGia = await findPoint(2, 'Lữ Gia');

    const rawStops = [
      { id: pLeHongPhong, loaiDiem: 'DON', phutLech: -60, phuPhi: 0, ghiChu: 'Đón tại VP Lê Hồng Phong - Q5' },
      { id: pHangXanh, loaiDiem: 'DON', phutLech: -30, phuPhi: 0, ghiChu: 'Đón tại VP Hàng Xanh' },
      { id: pMienDong, loaiDiem: 'DON', phutLech: 0, phuPhi: 0, ghiChu: 'Xuất phát Bến xe Miền Đông Mới' },
      { id: pBaoLoc, loaiDiem: 'TRA', phutLech: 240, phuPhi: 0, ghiChu: 'Trả tại VP Bảo Lộc' },
      { id: pDucTrong, loaiDiem: 'TRA', phutLech: 360, phuPhi: 0, ghiChu: 'Trả tại VP Đức Trọng' },
      { id: pDaLat, loaiDiem: 'TRA', phutLech: 420, phuPhi: 0, ghiChu: 'Trả tại Bến xe Liên tỉnh Đà Lạt' },
      { id: pLuGia, loaiDiem: 'TRA', phutLech: 440, phuPhi: 0, ghiChu: 'Trả tại VP Lữ Gia Đà Lạt' },
      { id: tbTransferPoint?.diemDonTraId, loaiDiem: 'TRA', phutLech: 460, phuPhi: 15000, ghiChu: 'Trung chuyển tận nơi trung tâm Đà Lạt' },
    ];

    let order = 1;
    for (const s of rawStops) {
      if (!s.id) continue;
      await prisma.tuyenXeDiemDung.create({
        data: {
          tuyenXeId: 5,
          diemDonTraId: s.id,
          loaiDiem: s.loaiDiem,
          phutLech: s.phutLech,
          thuTu: order++,
          phuPhi: s.phuPhi,
          phutCoMatTruoc: 15,
          nhanKhach: true,
          ghiChu: s.ghiChu,
        },
      });
    }
    console.log(`+ Đã cấu hình điểm dừng cho Tuyến 5 (TB: TP.HCM -> Đà Lạt)`);
  }

  // Tuyến 4 của Thành Bưởi: Đà Lạt -> TP.HCM
  const tbRoute4StopsCount = await prisma.tuyenXeDiemDung.count({ where: { tuyenXeId: 4 } });
  if (tbRoute4StopsCount === 0) {
    const pLeHongPhong = await findPoint(2, 'Lê Hồng Phong');
    const pHangXanh = await findPoint(2, 'Hàng Xanh');
    const pMienDong = await findPoint(2, 'Miền Đông');
    const pBaoLoc = await findPoint(2, 'Bảo Lộc');
    const pDucTrong = await findPoint(2, 'Đức Trọng');
    const pDaLat = await findPoint(2, 'Đà Lạt');
    const pLuGia = await findPoint(2, 'Lữ Gia');

    const rawStops = [
      { id: tbTransferPoint?.diemDonTraId, loaiDiem: 'DON', phutLech: -45, phuPhi: 15000, ghiChu: 'Trung chuyển đón tại Hồ Xuân Hương' },
      { id: pLuGia, loaiDiem: 'DON', phutLech: -20, phuPhi: 0, ghiChu: 'Đón tại VP Lữ Gia Đà Lạt' },
      { id: pDaLat, loaiDiem: 'DON', phutLech: 0, phuPhi: 0, ghiChu: 'Xuất phát Bến xe Liên tỉnh Đà Lạt' },
      { id: pDucTrong, loaiDiem: 'DON', phutLech: 45, phuPhi: 0, ghiChu: 'Đón tại VP Đức Trọng' },
      { id: pBaoLoc, loaiDiem: 'TRA', phutLech: 180, phuPhi: 0, ghiChu: 'Trả tại VP Bảo Lộc' },
      { id: pMienDong, loaiDiem: 'TRA', phutLech: 380, phuPhi: 0, ghiChu: 'Trả tại Bến xe Miền Đông Mới' },
      { id: pHangXanh, loaiDiem: 'TRA', phutLech: 410, phuPhi: 0, ghiChu: 'Trả tại VP Hàng Xanh' },
      { id: pLeHongPhong, loaiDiem: 'TRA', phutLech: 430, phuPhi: 0, ghiChu: 'Trả tại VP Lê Hồng Phong - Q5' },
    ];

    let order = 1;
    for (const s of rawStops) {
      if (!s.id) continue;
      await prisma.tuyenXeDiemDung.create({
        data: {
          tuyenXeId: 4,
          diemDonTraId: s.id,
          loaiDiem: s.loaiDiem,
          phutLech: s.phutLech,
          thuTu: order++,
          phuPhi: s.phuPhi,
          phutCoMatTruoc: 15,
          nhanKhach: true,
          ghiChu: s.ghiChu,
        },
      });
    }
    console.log(`+ Đã cấu hình điểm dừng cho Tuyến 4 (TB: Đà Lạt -> TP.HCM)`);
  }

  // Tuyến 7 của Hoa Mai: Vũng Tàu -> TP.HCM
  const hmRoute7StopsCount = await prisma.tuyenXeDiemDung.count({ where: { tuyenXeId: 7 } });
  if (hmRoute7StopsCount === 0) {
    const pVungTau = await findPoint(3, 'Vũng Tàu');
    const pBaRia = await findPoint(3, 'Bà Rịa');
    const pMienDong = await findPoint(3, 'Miền Đông');
    const pQuan5 = await findPoint(3, 'Quận 5');

    const rawStops = [
      { id: pVungTau, loaiDiem: 'DON', phutLech: 0, phuPhi: 0, ghiChu: 'Xuất phát VP Hoa Mai Vũng Tàu' },
      { id: pBaRia, loaiDiem: 'DON', phutLech: 35, phuPhi: 0, ghiChu: 'Đón tại Bến xe Bà Rịa' },
      { id: pMienDong, loaiDiem: 'TRA', phutLech: 120, phuPhi: 0, ghiChu: 'Trả tại VP Miền Đông' },
      { id: pQuan5, loaiDiem: 'TRA', phutLech: 150, phuPhi: 0, ghiChu: 'Trả tại VP Quận 5' },
    ];

    let order = 1;
    for (const s of rawStops) {
      if (!s.id) continue;
      await prisma.tuyenXeDiemDung.create({
        data: {
          tuyenXeId: 7,
          diemDonTraId: s.id,
          loaiDiem: s.loaiDiem,
          phutLech: s.phutLech,
          thuTu: order++,
          phuPhi: s.phuPhi,
          phutCoMatTruoc: 15,
          nhanKhach: true,
          ghiChu: s.ghiChu,
        },
      });
    }
    console.log(`+ Đã cấu hình điểm dừng cho Tuyến 7 (HM: Vũng Tàu -> TP.HCM)`);
  }
}

async function seedTrips() {
  console.log('\n--- 2. SEED CHUYẾN XE TỪ 12/11/2026 ĐẾN 31/12/2026 ---');

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

  const dailySchedules = [
    // FUTA (nhaXeId 1)
    { nhaXeId: 1, routeId: 1, time: '06:00', duration: 420 },
    { nhaXeId: 1, routeId: 1, time: '13:00', duration: 420 },
    { nhaXeId: 1, routeId: 2, time: '08:00', duration: 420 },
    { nhaXeId: 1, routeId: 2, time: '15:00', duration: 420 },

    // TB (nhaXeId 2)
    { nhaXeId: 2, routeId: 5, time: '08:00', duration: 420 },
    { nhaXeId: 2, routeId: 5, time: '22:00', duration: 420 },
    { nhaXeId: 2, routeId: 4, time: '09:00', duration: 420 },
    { nhaXeId: 2, routeId: 4, time: '23:00', duration: 420 },

    // HM (nhaXeId 3)
    { nhaXeId: 3, routeId: 7, time: '07:30', duration: 150 },
    { nhaXeId: 3, routeId: 7, time: '13:30', duration: 150 },
    { nhaXeId: 3, routeId: 7, time: '18:30', duration: 150 },
    { nhaXeId: 3, routeId: 8, time: '06:30', duration: 150 },
    { nhaXeId: 3, routeId: 8, time: '12:00', duration: 150 },
    { nhaXeId: 3, routeId: 8, time: '17:00', duration: 150 },
    { nhaXeId: 3, routeId: 10, time: '08:00', duration: 420 },
    { nhaXeId: 3, routeId: 11, time: '14:00', duration: 420 },
  ];

  let addedTrips = 0;
  let skippedTrips = 0;
  let addedTripSeats = 0;
  let addedTripStops = 0;

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

      const departureTime = new Date(`1970-01-01T${schedule.time}:00.000Z`);
      const arrivalTime = calculateClockTime(departureTime, schedule.duration);
      const maChuyenXe = deterministicUuid('CX', schedule.nhaXeId, schedule.routeId, dateStr, schedule.time);

      const existing = await prisma.chuyenXe.findFirst({
        where: {
          OR: [
            { maChuyenXe },
            {
              tuyenXeId: schedule.routeId,
              ngayKhoiHanh: departureDate,
              gioKhoiHanh: departureTime,
            },
          ],
        },
        select: {
          chuyenXeId: true,
          _count: { select: { diemDonTraChuyenXes: true } },
        },
      });
      if (existing) {
        if (existing._count.diemDonTraChuyenXes === 0 && route.tuyenXeDiemDungs.length > 0) {
          await prisma.diemDonTraChuyenXe.createMany({
            data: route.tuyenXeDiemDungs.map((stop) => ({
              chuyenXeId: existing.chuyenXeId,
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
            skipDuplicates: true,
          });
          addedTripStops += route.tuyenXeDiemDungs.length;
        }
        skippedTrips++;
        continue;
      }

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

  console.log(`\n=== KẾT QUẢ SEED CHUYẾN XE (12/11/2026 - 31/12/2026) ===`);
  console.log(`- Số chuyến mới được tạo: ${addedTrips}`);
  console.log(`- Số chuyến đã có sẵn (bỏ qua): ${skippedTrips}`);
  console.log(`- Số lượng ghế chuyến xe mới: ${addedTripSeats}`);
  console.log(`- Số lượng điểm dừng chuyến xe mới: ${addedTripStops}`);
}

async function verifySeededTrips() {
  console.log('\n--- 3. VERIFICATION QUERY ---');
  const fromDate = new Date('2026-11-12T00:00:00.000Z');
  const toDate = new Date('2026-12-31T23:59:59.999Z');

  const countByOperator = await prisma.chuyenXe.groupBy({
    by: ['nhaXeId'],
    where: {
      ngayKhoiHanh: { gte: fromDate, lte: toDate },
    },
    _count: { chuyenXeId: true },
  });

  const operators = await prisma.nhaXe.findMany({
    where: { nhaXeId: { in: [1, 2, 3] } },
    select: { nhaXeId: true, tenNhaXe: true, maNhaXe: true },
  });
  const opMap = new Map(operators.map((o) => [o.nhaXeId, o]));

  console.log('Thống kê chuyến xe từ 12/11 đến 31/12/2026 theo từng nhà xe:');
  for (const c of countByOperator) {
    const op = opMap.get(c.nhaXeId);
    console.log(`  • ${op?.tenNhaXe} (${op?.maNhaXe}): ${c._count.chuyenXeId} chuyến`);
  }
}

async function main() {
  try {
    await prepareRouteTemplates();
    await seedTrips();
    await verifySeededTrips();
  } catch (error) {
    console.error('LỖI KHI SEED CHUYẾN XE:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
