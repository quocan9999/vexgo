import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../apps/api/dist/generated/prisma/client.js';

const url = new URL(process.env.DATABASE_URL ?? process.env.MIGRATION_URL);
const config = {
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: decodeURIComponent(url.pathname.replace(/^\/+/, '')),
  allowPublicKeyRetrieval: true,
};
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(config) });

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

  // 1.1 Kiểm tra/Tạo điểm trung chuyển cho Thành Bưởi (TB - nhaXeId 2)
  let tbTransferPoint = await prisma.diemDonTra.findFirst({
    where: { maDiem: 'TB-TC-HO-XUAN-HUONG', nhaXeId: 2 },
  });

  if (!tbTransferPoint) {
    // Tìm địa điểm của Đà Lạt
    const dalatBase = await prisma.diemDonTra.findUnique({
      where: { diemDonTraId: 4 }, // Bến xe Liên tỉnh Đà Lạt
    });

    tbTransferPoint = await prisma.diemDonTra.create({
      data: {
        maDiem: 'TB-TC-HO-XUAN-HUONG',
        tenDiem: 'Điểm đón trung chuyển Hồ Xuân Hương - Đà Lạt',
        loaiDiem: 'TRUNG_CHUYEN',
        diaChi: 'Quảng trường Lâm Viên, Đường Trần Quốc Toản, Phường 10, TP. Đà Lạt, Lâm Đồng',
        diaDiemCuId: dalatBase?.diaDiemCuId ?? null,
        diaDiemMoiId: dalatBase?.diaDiemMoiId ?? null,
        trangThai: 'HOAT_DONG',
        nhaXeId: 2,
        benTrungChuyenId: 4, // Gắn với Bến xe Liên tỉnh Đà Lạt
      },
    });
    console.log(`+ Đã tạo điểm trung chuyển Thành Bưởi: ${tbTransferPoint.tenDiem} (ID: ${tbTransferPoint.diemDonTraId})`);
  } else {
    console.log(`✓ Điểm trung chuyển Thành Bưởi đã tồn tại: ID ${tbTransferPoint.diemDonTraId}`);
  }

  // 1.2 Tuyến 5 của Thành Bưởi: TP.HCM -> Đà Lạt
  const tbRoute5StopsCount = await prisma.tuyenXeDiemDung.count({ where: { tuyenXeId: 5 } });
  if (tbRoute5StopsCount === 0) {
    const stopsRoute5 = [
      { diemDonTraId: 461, loaiDiem: 'DON', phutLech: -60, thuTu: 1, phuPhi: 0, phutCoMatTruoc: 15, nhanKhach: true, ghiChu: 'Đón tại VP Lê Hồng Phong - Q5' },
      { diemDonTraId: 475, loaiDiem: 'DON', phutLech: -30, thuTu: 2, phuPhi: 0, phutCoMatTruoc: 15, nhanKhach: true, ghiChu: 'Đón tại VP Hàng Xanh' },
      { diemDonTraId: 468, loaiDiem: 'DON', phutLech: 0, thuTu: 3, phuPhi: 0, phutCoMatTruoc: 15, nhanKhach: true, ghiChu: 'Xuất phát Bến xe Miền Đông Mới' },
      { diemDonTraId: 476, loaiDiem: 'TRA', phutLech: 240, thuTu: 4, phuPhi: 0, phutCoMatTruoc: 15, nhanKhach: true, ghiChu: 'Trả tại VP Bảo Lộc' },
      { diemDonTraId: 464, loaiDiem: 'TRA', phutLech: 360, thuTu: 5, phuPhi: 0, phutCoMatTruoc: 15, nhanKhach: true, ghiChu: 'Trả tại VP Đức Trọng' },
      { diemDonTraId: 4, loaiDiem: 'TRA', phutLech: 420, thuTu: 6, phuPhi: 0, phutCoMatTruoc: 15, nhanKhach: true, ghiChu: 'Trả tại Bến xe Liên tỉnh Đà Lạt' },
      { diemDonTraId: 466, loaiDiem: 'TRA', phutLech: 440, thuTu: 7, phuPhi: 0, phutCoMatTruoc: 15, nhanKhach: true, ghiChu: 'Trả tại VP Lữ Gia Đà Lạt' },
      { diemDonTraId: tbTransferPoint.diemDonTraId, loaiDiem: 'TRA', phutLech: 460, thuTu: 8, phuPhi: 15000, phutCoMatTruoc: 15, nhanKhach: true, ghiChu: 'Trung chuyển tận nơi trung tâm Đà Lạt' },
    ];
    for (const s of stopsRoute5) {
      await prisma.tuyenXeDiemDung.create({
        data: {
          tuyenXeId: 5,
          diemDonTraId: s.diemDonTraId,
          loaiDiem: s.loaiDiem,
          phutLech: s.phutLech,
          thuTu: s.thuTu,
          phuPhi: s.phuPhi,
          phutCoMatTruoc: s.phutCoMatTruoc,
          nhanKhach: s.nhanKhach,
          ghiChu: s.ghiChu,
        },
      });
    }
    console.log(`+ Đã cấu hình ${stopsRoute5.length} điểm dừng cho Tuyến 5 (TB: TP.HCM -> Đà Lạt)`);
  } else {
    console.log(`✓ Tuyến 5 (TB) đã có ${tbRoute5StopsCount} điểm dừng`);
  }

  // 1.3 Tuyến 4 của Thành Bưởi: Đà Lạt -> TP.HCM
  const tbRoute4StopsCount = await prisma.tuyenXeDiemDung.count({ where: { tuyenXeId: 4 } });
  if (tbRoute4StopsCount === 0) {
    const stopsRoute4 = [
      { diemDonTraId: tbTransferPoint.diemDonTraId, loaiDiem: 'DON', phutLech: -45, thuTu: 1, phuPhi: 15000, phutCoMatTruoc: 20, nhanKhach: true, ghiChu: 'Trung chuyển đón tại Hồ Xuân Hương' },
      { diemDonTraId: 466, loaiDiem: 'DON', phutLech: -20, thuTu: 2, phuPhi: 0, phutCoMatTruoc: 15, nhanKhach: true, ghiChu: 'Đón tại VP Lữ Gia Đà Lạt' },
      { diemDonTraId: 4, loaiDiem: 'DON', phutLech: 0, thuTu: 3, phuPhi: 0, phutCoMatTruoc: 15, nhanKhach: true, ghiChu: 'Xuất phát Bến xe Liên tỉnh Đà Lạt' },
      { diemDonTraId: 464, loaiDiem: 'DON', phutLech: 45, thuTu: 4, phuPhi: 0, phutCoMatTruoc: 15, nhanKhach: true, ghiChu: 'Đón tại VP Đức Trọng' },
      { diemDonTraId: 476, loaiDiem: 'TRA', phutLech: 180, thuTu: 5, phuPhi: 0, phutCoMatTruoc: 15, nhanKhach: true, ghiChu: 'Trả tại VP Bảo Lộc' },
      { diemDonTraId: 468, loaiDiem: 'TRA', phutLech: 380, thuTu: 6, phuPhi: 0, phutCoMatTruoc: 15, nhanKhach: true, ghiChu: 'Trả tại Bến xe Miền Đông Mới' },
      { diemDonTraId: 475, loaiDiem: 'TRA', phutLech: 410, thuTu: 7, phuPhi: 0, phutCoMatTruoc: 15, nhanKhach: true, ghiChu: 'Trả tại VP Hàng Xanh' },
      { diemDonTraId: 461, loaiDiem: 'TRA', phutLech: 430, thuTu: 8, phuPhi: 0, phutCoMatTruoc: 15, nhanKhach: true, ghiChu: 'Trả tại VP Lê Hồng Phong - Q5' },
    ];
    for (const s of stopsRoute4) {
      await prisma.tuyenXeDiemDung.create({
        data: {
          tuyenXeId: 4,
          diemDonTraId: s.diemDonTraId,
          loaiDiem: s.loaiDiem,
          phutLech: s.phutLech,
          thuTu: s.thuTu,
          phuPhi: s.phuPhi,
          phutCoMatTruoc: s.phutCoMatTruoc,
          nhanKhach: s.nhanKhach,
          ghiChu: s.ghiChu,
        },
      });
    }
    console.log(`+ Đã cấu hình ${stopsRoute4.length} điểm dừng cho Tuyến 4 (TB: Đà Lạt -> TP.HCM)`);
  } else {
    console.log(`✓ Tuyến 4 (TB) đã có ${tbRoute4StopsCount} điểm dừng`);
  }

  // 1.4 Tuyến 7 của Hoa Mai: Vũng Tàu -> TP.HCM
  const hmRoute7StopsCount = await prisma.tuyenXeDiemDung.count({ where: { tuyenXeId: 7 } });
  if (hmRoute7StopsCount === 0) {
    const stopsRoute7 = [
      { diemDonTraId: 523, loaiDiem: 'DON', phutLech: 0, thuTu: 1, phuPhi: 0, phutCoMatTruoc: 15, nhanKhach: true, ghiChu: 'Xuất phát VP Hoa Mai Vũng Tàu' },
      { diemDonTraId: 524, loaiDiem: 'DON', phutLech: 35, thuTu: 2, phuPhi: 0, phutCoMatTruoc: 15, nhanKhach: true, ghiChu: 'Đón tại Bến xe Bà Rịa' },
      { diemDonTraId: 522, loaiDiem: 'TRA', phutLech: 120, thuTu: 3, phuPhi: 0, phutCoMatTruoc: 15, nhanKhach: true, ghiChu: 'Trả tại VP Miền Đông' },
      { diemDonTraId: 532, loaiDiem: 'TRA', phutLech: 150, thuTu: 4, phuPhi: 0, phutCoMatTruoc: 15, nhanKhach: true, ghiChu: 'Trả tại VP Quận 5' },
    ];
    for (const s of stopsRoute7) {
      await prisma.tuyenXeDiemDung.create({
        data: {
          tuyenXeId: 7,
          diemDonTraId: s.diemDonTraId,
          loaiDiem: s.loaiDiem,
          phutLech: s.phutLech,
          thuTu: s.thuTu,
          phuPhi: s.phuPhi,
          phutCoMatTruoc: s.phutCoMatTruoc,
          nhanKhach: s.nhanKhach,
          ghiChu: s.ghiChu,
        },
      });
    }
    console.log(`+ Đã cấu hình ${stopsRoute7.length} điểm dừng cho Tuyến 7 (HM: Vũng Tàu -> TP.HCM)`);
  } else {
    console.log(`✓ Tuyến 7 (HM) đã có ${hmRoute7StopsCount} điểm dừng`);
  }
}

async function seedTrips() {
  console.log('\n--- 2. SEED CHUYẾN XE TỪ 12/11/2026 ĐẾN 30/11/2026 ---');

  // Lấy khuôn điểm dừng của các tuyến mục tiêu
  const targetRouteIds = [87, 89, 90, 7, 5, 4];
  const routes = await prisma.tuyenXe.findMany({
    where: { tuyenXeId: { in: targetRouteIds } },
    include: {
      tuyenXeDiemDungs: {
        orderBy: [{ phutLech: 'asc' }, { thuTu: 'asc' }],
      },
    },
  });

  const routesMap = new Map(routes.map((r) => [r.tuyenXeId, r]));

  // Lấy thông tin các xe và ghế
  const targetVehicleIds = [1, 2, 3, 7, 8, 9, 13, 14, 15];
  const vehicles = await prisma.xe.findMany({
    where: { xeId: { in: targetVehicleIds } },
    include: {
      loaiXe: true,
      ghes: true,
    },
  });
  const vehiclesMap = new Map(vehicles.map((v) => [v.xeId, v]));

  // Định nghĩa các chuyến chạy trong ngày
  // Tuyến 87: FUTA SG -> Cần Thơ (thời gian chạy: 210m)
  // Tuyến 89: FUTA SG -> Vũng Tàu (thời gian chạy: 150m)
  // Tuyến 5: TB SG -> Đà Lạt (thời gian chạy: 420m)
  // Tuyến 4: TB Đà Lạt -> SG (thời gian chạy: 420m)
  // Tuyến 90: HM SG -> Vũng Tàu (thời gian chạy: 150m)
  // Tuyến 7: HM Vũng Tàu -> SG (thời gian chạy: 150m)
  const tripDefinitions = [
    // FUTA
    { nhaXeId: 1, routeId: 87, time: '07:00', vehicleId: 1, codePrefix: 'FUTA-CX', routeCode: 'SGCT' },
    { nhaXeId: 1, routeId: 87, time: '13:30', vehicleId: 2, codePrefix: 'FUTA-CX', routeCode: 'SGCT' },
    { nhaXeId: 1, routeId: 89, time: '08:30', vehicleId: 3, codePrefix: 'FUTA-CX', routeCode: 'SGVT' },
    { nhaXeId: 1, routeId: 89, time: '15:00', vehicleId: 1, codePrefix: 'FUTA-CX', routeCode: 'SGVT' },

    // THÀNH BƯỞI (TB)
    { nhaXeId: 2, routeId: 5, time: '08:00', vehicleId: 8, codePrefix: 'TB-CX', routeCode: 'SGDL' },
    { nhaXeId: 2, routeId: 5, time: '22:00', vehicleId: 9, codePrefix: 'TB-CX', routeCode: 'SGDL' },
    { nhaXeId: 2, routeId: 4, time: '09:00', vehicleId: 8, codePrefix: 'TB-CX', routeCode: 'DLSG' },
    { nhaXeId: 2, routeId: 4, time: '23:00', vehicleId: 7, codePrefix: 'TB-CX', routeCode: 'DLSG' },

    // HOA MAI (HM)
    { nhaXeId: 3, routeId: 90, time: '06:30', vehicleId: 15, codePrefix: 'HM-CX', routeCode: 'SGVT' },
    { nhaXeId: 3, routeId: 90, time: '11:30', vehicleId: 13, codePrefix: 'HM-CX', routeCode: 'SGVT' },
    { nhaXeId: 3, routeId: 90, time: '16:30', vehicleId: 14, codePrefix: 'HM-CX', routeCode: 'SGVT' },
    { nhaXeId: 3, routeId: 7, time: '07:30', vehicleId: 15, codePrefix: 'HM-CX', routeCode: 'VTSG' },
    { nhaXeId: 3, routeId: 7, time: '13:00', vehicleId: 13, codePrefix: 'HM-CX', routeCode: 'VTSG' },
    { nhaXeId: 3, routeId: 7, time: '18:00', vehicleId: 14, codePrefix: 'HM-CX', routeCode: 'VTSG' },
  ];

  let totalTripsCreated = 0;
  let totalTripsSkipped = 0;
  let totalSeatsCreated = 0;
  let totalStopsCreated = 0;

  // Dải ngày: 12 đến 30 tháng 11 năm 2026
  for (let day = 12; day <= 30; day++) {
    const dayStr = day < 10 ? `0${day}` : `${day}`;
    const dateStr = `2026-11-${dayStr}`;
    const departureDate = new Date(`${dateStr}T00:00:00.000Z`);

    for (const def of tripDefinitions) {
      const route = routesMap.get(def.routeId);
      const vehicle = vehiclesMap.get(def.vehicleId);
      if (!route || !vehicle) continue;

      const timeWithoutColon = def.time.replace(':', '');
      const maChuyenXe = `${def.codePrefix}-202611${dayStr}-${def.routeCode}-${timeWithoutColon}`;

      // Kiểm tra xem chuyến xe đã tồn tại chưa (idempotent)
      const existingTrip = await prisma.chuyenXe.findUnique({
        where: { maChuyenXe },
        select: { chuyenXeId: true },
      });

      if (existingTrip) {
        totalTripsSkipped++;
        continue;
      }

      const departureTime = new Date(`1970-01-01T${def.time}:00.000Z`);
      const arrivalTime = calculateClockTime(departureTime, route.thoiGianChayPhut);

      // Tạo ChuyenXe
      const createdTrip = await prisma.chuyenXe.create({
        data: {
          maChuyenXe,
          ngayKhoiHanh: departureDate,
          gioKhoiHanh: departureTime,
          gioDen: arrivalTime,
          nhanGuiHang: true,
          sucChuaXeMay: vehicle.loaiXe.sucChuaXeMayMacDinh,
          sucChuaHangCongKenh: vehicle.loaiXe.sucChuaHangCongKenhMacDinh,
          sucChuaHangNhe: vehicle.loaiXe.sucChuaHangNheMacDinh,
          trangThai: 'CHUA_KHOI_HANH',
          nhaXeId: def.nhaXeId,
          tuyenXeId: def.routeId,
          xeId: def.vehicleId,
        },
      });

      // Tạo GheChuyenXe cho tất cả ghế của xe
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
        totalSeatsCreated += vehicle.ghes.length;
      }

      // Kế thừa điểm dừng từ TuyenXeDiemDung sang DiemDonTraChuyenXe
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
        totalStopsCreated += route.tuyenXeDiemDungs.length;
      }

      totalTripsCreated++;
    }
  }

  console.log(`\n=== KẾT QUẢ SEED CHUYẾN XE (12/11/2026 - 30/11/2026) ===`);
  console.log(`- Số chuyến mới được tạo: ${totalTripsCreated}`);
  console.log(`- Số chuyến đã có sẵn (bỏ qua): ${totalTripsSkipped}`);
  console.log(`- Số lượng bản ghi ghế chuyến xe (GheChuyenXe): ${totalSeatsCreated}`);
  console.log(`- Số lượng bản ghi điểm đón/trả chuyến xe (DiemDonTraChuyenXe): ${totalStopsCreated}`);
}

async function verifySeededTrips() {
  console.log('\n--- 3. VERIFICATION QUERY ---');
  const fromDate = new Date('2026-11-12T00:00:00.000Z');
  const toDate = new Date('2026-11-30T23:59:59.999Z');

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

  console.log('Thống kê chuyến xe từ 12/11 đến 30/11/2026 theo từng nhà xe:');
  for (const c of countByOperator) {
    const op = opMap.get(c.nhaXeId);
    console.log(`  • ${op?.tenNhaXe} (${op?.maNhaXe}): ${c._count.chuyenXeId} chuyến`);
  }

  // Lấy mẫu 1 chuyến của mỗi nhà xe để hiển thị chi tiết điểm dừng
  for (const opId of [1, 2, 3]) {
    const op = opMap.get(opId);
    const sampleTrip = await prisma.chuyenXe.findFirst({
      where: {
        nhaXeId: opId,
        ngayKhoiHanh: { gte: fromDate, lte: toDate },
      },
      include: {
        tuyenXe: true,
        xe: { include: { loaiXe: true } },
        diemDonTraChuyenXes: {
          include: { diemDonTra: true },
          orderBy: [{ phutLech: 'asc' }, { thuTu: 'asc' }],
        },
        _count: { select: { gheChuyenXes: true } },
      },
    });

    if (sampleTrip) {
      console.log(`\n[MẪU CHUYẾN XE - ${op?.tenNhaXe}]`);
      console.log(`  Mã chuyến: ${sampleTrip.maChuyenXe}`);
      console.log(`  Tuyến: ${sampleTrip.tuyenXe.tenTuyen ?? sampleTrip.tuyenXe.maTuyenXe} (${sampleTrip.tuyenXe.diemDi} -> ${sampleTrip.tuyenXe.diemDen})`);
      console.log(`  Ngày: ${sampleTrip.ngayKhoiHanh.toISOString().slice(0, 10)} | Khởi hành: ${sampleTrip.gioKhoiHanh.toISOString().slice(11, 16)} | Đến: ${sampleTrip.gioDen?.toISOString().slice(11, 16)}`);
      console.log(`  Loại xe: ${sampleTrip.xe.loaiXe.tenLoai} (${sampleTrip._count.gheChuyenXes} ghế trống)`);
      console.log(`  Danh sách điểm dừng (${sampleTrip.diemDonTraChuyenXes.length} điểm):`);
      for (const d of sampleTrip.diemDonTraChuyenXes) {
        const timeStr = d.thoiGianDuKien?.toISOString().slice(11, 16) ?? '--:--';
        const surchargeStr = Number(d.phuPhi) > 0 ? ` (+${Number(d.phuPhi).toLocaleString('vi-VN')}đ)` : '';
        console.log(`    [${d.loaiDiem}] ${timeStr} (phút ${d.phutLech >= 0 ? '+' : ''}${d.phutLech}): ${d.diemDonTra.tenDiem} (${d.diemDonTra.loaiDiem})${surchargeStr}`);
      }
    }
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
