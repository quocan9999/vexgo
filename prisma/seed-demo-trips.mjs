import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../apps/api/dist/generated/prisma/client.js';

function databaseConfig() {
  const raw = process.env.DATABASE_URL ?? process.env.MIGRATION_URL;
  if (!raw) throw new Error('MIGRATION_URL or DATABASE_URL is required');
  const url = new URL(raw);
  if (url.protocol !== 'mysql:') throw new Error('Database URL must use mysql: protocol');
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\/+/, '')),
    allowPublicKeyRetrieval: true,
  };
}

function calculateClockTime(departureTime, phutLech) {
  const result = new Date(departureTime.getTime());
  result.setUTCMinutes(result.getUTCMinutes() + phutLech);
  return result;
}

function dateToYmd(d) {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

export async function runSeedDemoTrips() {
  console.log(`\n===============================================================`);
  console.log(`  VEXGO DEMO TRIPS & ROUTE TEMPLATES SEEDER`);
  console.log(`===============================================================\n`);

  const prisma = new PrismaClient({ adapter: new PrismaMariaDb(databaseConfig()) });

  try {
    // 1. Kiểm tra nhà xe FUTA & HM
    const futa = await prisma.nhaXe.findUnique({ where: { maNhaXe: 'FUTA' } });
    const hm = await prisma.nhaXe.findUnique({ where: { maNhaXe: 'HM' } });
    if (!futa || !hm) {
      throw new Error('Cần có nhà xe FUTA và HM trong DB trước khi seed chuyến demo');
    }

    // 2. Điểm trung chuyển demo
    console.log('1. Đang kiểm tra/tạo các điểm trung chuyển demo...');

    // Tìm bến xe Miền Tây của FUTA để làm bến đích trung chuyển
    let futaWestStation = await prisma.diemDonTra.findFirst({
      where: {
        nhaXeId: futa.nhaXeId,
        maDiem: { in: ['BX-MT', 'FUTA-BEN-XE-MIEN-TAY-11265'] },
        trangThai: 'HOAT_DONG',
      },
    });
    if (!futaWestStation) {
      futaWestStation = await prisma.diemDonTra.findFirst({
        where: { nhaXeId: futa.nhaXeId, loaiDiem: 'BEN_XE', trangThai: 'HOAT_DONG' },
      });
    }

    // Tìm văn phòng / bến xe TP.HCM của HM
    let hmSgStation = await prisma.diemDonTra.findFirst({
      where: {
        nhaXeId: hm.nhaXeId,
        loaiDiem: { in: ['BEN_XE', 'VAN_PHONG'] },
        trangThai: 'HOAT_DONG',
      },
    });

    const transferPointsToCreate = [];

    if (futaWestStation) {
      transferPointsToCreate.push({
        nhaXeId: futa.nhaXeId,
        maDiem: 'FUTA-TC-QUAN-5',
        tenDiem: 'Điểm đón trung chuyển Quận 5 (Demo)',
        loaiDiem: 'TRUNG_CHUYEN',
        diaChi: '128 Nguyễn Trãi, Phường 3, Quận 5, TP. Hồ Chí Minh',
        diaDiemCuId: futaWestStation.diaDiemCuId,
        diaDiemMoiId: futaWestStation.diaDiemMoiId,
        benTrungChuyenId: futaWestStation.diemDonTraId,
        trangThai: 'HOAT_DONG',
      });
      transferPointsToCreate.push({
        nhaXeId: futa.nhaXeId,
        maDiem: 'FUTA-TC-HANG-XANH',
        tenDiem: 'Điểm đón trung chuyển Hàng Xanh (Demo)',
        loaiDiem: 'TRUNG_CHUYEN',
        diaChi: '486 Điện Biên Phủ, Phường 21, Bình Thạnh, TP. Hồ Chí Minh',
        diaDiemCuId: futaWestStation.diaDiemCuId,
        diaDiemMoiId: futaWestStation.diaDiemMoiId,
        benTrungChuyenId: futaWestStation.diemDonTraId,
        trangThai: 'HOAT_DONG',
      });
    }

    if (hmSgStation) {
      transferPointsToCreate.push({
        nhaXeId: hm.nhaXeId,
        maDiem: 'HM-TC-SAN-BAY',
        tenDiem: 'Điểm đón trung chuyển Sân Bay Tân Sơn Nhất (Demo)',
        loaiDiem: 'TRUNG_CHUYEN',
        diaChi: 'Cột B1 Ga Quốc Nội, Sân Bay Tân Sơn Nhất, Quận Tân Bình, TP. Hồ Chí Minh',
        diaDiemCuId: hmSgStation.diaDiemCuId,
        diaDiemMoiId: hmSgStation.diaDiemMoiId,
        benTrungChuyenId: hmSgStation.diemDonTraId,
        trangThai: 'HOAT_DONG',
      });
    }

    const transferPointMap = new Map();
    for (const item of transferPointsToCreate) {
      const existing = await prisma.diemDonTra.findFirst({
        where: { nhaXeId: item.nhaXeId, maDiem: item.maDiem },
      });
      if (existing) {
        const updated = await prisma.diemDonTra.update({
          where: { diemDonTraId: existing.diemDonTraId },
          data: {
            tenDiem: item.tenDiem,
            diaChi: item.diaChi,
            benTrungChuyenId: item.benTrungChuyenId,
            trangThai: 'HOAT_DONG',
          },
        });
        transferPointMap.set(item.maDiem, updated);
      } else {
        const created = await prisma.diemDonTra.create({ data: item });
        transferPointMap.set(item.maDiem, created);
      }
    }
    console.log(`   ✓ Đã chuẩn bị ${transferPointMap.size} điểm trung chuyển demo.`);

    // 3. Đọc route-templates.json
    console.log('2. Đang đọc và nạp khuôn lộ trình (route templates)...');
    const templatesPath = path.resolve(process.cwd(), 'prisma/data/route-templates.json');
    const allTemplates = JSON.parse(fs.readFileSync(templatesPath, 'utf8'));
    const validTemplates = allTemplates.filter((t) => !t.incomplete);

    console.log(`   ✓ Tìm thấy ${validTemplates.length} khuôn hợp lệ (bỏ qua các khuôn incomplete).`);

    // Tuyến xe tương ứng cho từng khuôn
    const routeSpecs = [
      {
        nhaXe: futa,
        templateName: 'Sài Gòn - Cần Thơ / Tiền Giang',
        maTuyenXe: 'DEMO-FUTA-SG-CT',
        tenTuyen: 'TP. Hồ Chí Minh - Cần Thơ (Có trung chuyển & giờ đón trả)',
        diemDi: 'Thành phố Hồ Chí Minh',
        diemDen: 'Cần Thơ',
        thoiGianChayPhut: 210,
        extraStops: [
          {
            maDiem: 'FUTA-TC-QUAN-5',
            loaiDiem: 'DON',
            phutLech: -90,
            phuPhi: 15000,
            phutCoMatTruoc: 15,
            nhanKhach: true,
            ghiChu: 'Trung chuyển đón tận nơi tại Quận 5',
          },
        ],
      },
      {
        nhaXe: futa,
        templateName: 'Cần Thơ - Sài Gòn',
        maTuyenXe: 'DEMO-FUTA-CT-SG',
        tenTuyen: 'Cần Thơ - TP. Hồ Chí Minh',
        diemDi: 'Cần Thơ',
        diemDen: 'Thành phố Hồ Chí Minh',
        thoiGianChayPhut: 210,
        extraStops: [],
      },
      {
        nhaXe: futa,
        templateName: 'Sài Gòn - Vũng Tàu',
        maTuyenXe: 'DEMO-FUTA-SG-VT',
        tenTuyen: 'TP. Hồ Chí Minh - Bà Rịa - Vũng Tàu',
        diemDi: 'Thành phố Hồ Chí Minh',
        diemDen: 'Bà Rịa - Vũng Tàu',
        thoiGianChayPhut: 150,
        extraStops: [],
      },
      {
        nhaXe: hm,
        templateName: 'Sài Gòn - Vũng Tàu',
        maTuyenXe: 'DEMO-HM-SG-VT',
        tenTuyen: 'TP. Hồ Chí Minh - Bà Rịa - Vũng Tàu (Hoa Mai VIP)',
        diemDi: 'Thành phố Hồ Chí Minh',
        diemDen: 'Bà Rịa - Vũng Tàu',
        thoiGianChayPhut: 150,
        extraStops: [
          {
            maDiem: 'HM-TC-SAN-BAY',
            loaiDiem: 'DON',
            phutLech: -45,
            phuPhi: 20000,
            phutCoMatTruoc: 20,
            nhanKhach: true,
            ghiChu: 'Trung chuyển đón từ Sân Bay Tân Sơn Nhất',
          },
        ],
      },
    ];

    const preparedRoutes = [];

    for (const spec of routeSpecs) {
      const template = validTemplates.find(
        (t) => t.nhaXeCode === spec.nhaXe.maNhaXe && t.tuyenThamChieu === spec.templateName,
      );
      if (!template) {
        console.warn(`   [WARN] Không tìm thấy khuôn ${spec.templateName} cho nhà xe ${spec.nhaXe.maNhaXe}`);
        continue;
      }

      // Tạo hoặc cập nhật Tuyến xe
      const existingRoute = await prisma.tuyenXe.findFirst({
        where: { nhaXeId: spec.nhaXe.nhaXeId, maTuyenXe: spec.maTuyenXe },
      });
      let route;
      if (existingRoute) {
        route = await prisma.tuyenXe.update({
          where: { tuyenXeId: existingRoute.tuyenXeId },
          data: {
            diemDi: spec.diemDi,
            diemDen: spec.diemDen,
            thoiGianChayPhut: spec.thoiGianChayPhut,
            trangThai: 'HOAT_DONG',
          },
        });
      } else {
        route = await prisma.tuyenXe.create({
          data: {
            maTuyenXe: spec.maTuyenXe,
            diemDi: spec.diemDi,
            diemDen: spec.diemDen,
            thoiGianChayPhut: spec.thoiGianChayPhut,
            trangThai: 'HOAT_DONG',
            nhaXeId: spec.nhaXe.nhaXeId,
          },
        });
      }

      // Đảm bảo có bảng giá BangGia cho tuyến này với từng loại xe của nhà xe
      const loaiXes = await prisma.loaiXe.findMany({
        where: { nhaXeId: spec.nhaXe.nhaXeId },
      });
      for (const lx of loaiXes) {
        const existingFare = await prisma.bangGia.findFirst({
          where: {
            nhaXeId: spec.nhaXe.nhaXeId,
            tuyenXeId: route.tuyenXeId,
            loaiXeId: lx.loaiXeId,
            trangThai: 'HOAT_DONG',
          },
        });
        if (!existingFare) {
          await prisma.bangGia.create({
            data: {
              giaNiemYet: 200000,
              tuNgay: new Date('2026-01-01T00:00:00.000Z'),
              denNgay: null,
              trangThai: 'HOAT_DONG',
              nhaXeId: spec.nhaXe.nhaXeId,
              tuyenXeId: route.tuyenXeId,
              loaiXeId: lx.loaiXeId,
            },
          });
        }
      }

      // Gom điểm dừng từ template và extraStops
      const allStopsRaw = [...template.stops];
      if (spec.extraStops && spec.extraStops.length > 0) {
        allStopsRaw.push(...spec.extraStops);
      }

      // Map maDiem sang diemDonTraId trong DB
      const stationCodes = allStopsRaw.map((s) => s.maDiem);
      const dbStations = await prisma.diemDonTra.findMany({
        where: { nhaXeId: spec.nhaXe.nhaXeId, maDiem: { in: stationCodes } },
      });
      const stationMap = new Map(dbStations.map((s) => [s.maDiem, s]));

      const validStopEntries = [];
      for (const stop of allStopsRaw) {
        const st = stationMap.get(stop.maDiem);
        if (!st) continue;
        validStopEntries.push({
          diemDonTraId: st.diemDonTraId,
          loaiDiem: stop.loaiDiem,
          phutLech: stop.phutLech ?? 0,
          phuPhi: stop.phuPhi ?? 0,
          phutCoMatTruoc: stop.phutCoMatTruoc ?? 15,
          nhanKhach: stop.nhanKhach ?? true,
          ghiChu: stop.ghiChu ?? null,
        });
      }

      // Sắp xếp theo phutLech asc, gán thuTu
      validStopEntries.sort((a, b) => a.phutLech - b.phutLech);
      validStopEntries.forEach((s, idx) => {
        s.thuTu = idx + 1;
      });

      // Lưu TuyenXeDiemDung trong transaction
      await prisma.$transaction(async (tx) => {
        await tx.tuyenXeDiemDung.deleteMany({ where: { tuyenXeId: route.tuyenXeId } });
        for (const s of validStopEntries) {
          await tx.tuyenXeDiemDung.create({
            data: {
              tuyenXeId: route.tuyenXeId,
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
      });

      console.log(`   ✓ Tuyến [${route.maTuyenXe}] có ${validStopEntries.length} điểm dừng trong khuôn mẫu.`);
      preparedRoutes.push({ route, spec, stops: validStopEntries });
    }

    // 4. Tạo chuyến xe demo cho 7 ngày tới
    console.log('3. Đang tạo các chuyến xe demo cho 7 ngày tới...');
    const now = new Date();
    const daysAhead = 7;
    const departureHours = [8, 14, 18];

    // Lấy xe cho FUTA và HM
    const futaVehicles = await prisma.xe.findMany({
      where: { nhaXeId: futa.nhaXeId, trangThai: 'HOAT_DONG' },
      include: { ghes: true, loaiXe: true },
    });
    const hmVehicles = await prisma.xe.findMany({
      where: { nhaXeId: hm.nhaXeId, trangThai: 'HOAT_DONG' },
      include: { ghes: true, loaiXe: true },
    });

    if (futaVehicles.length === 0 || hmVehicles.length === 0) {
      console.warn('   [WARN] Thiếu xe hoạt động cho FUTA hoặc HM, bỏ qua sinh chuyến');
      return;
    }

    let createdTripsCount = 0;
    let totalPointsCreated = 0;

    for (let dayOffset = 1; dayOffset <= daysAhead; dayOffset++) {
      const tripDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + dayOffset));
      const ymd = dateToYmd(tripDate);

      for (const item of preparedRoutes) {
        const vehicles = item.spec.nhaXe.maNhaXe === 'FUTA' ? futaVehicles : hmVehicles;

        for (let i = 0; i < departureHours.length; i++) {
          const hour = departureHours[i];
          const vehicle = vehicles[(dayOffset + i) % vehicles.length];
          const hourStr = String(hour).padStart(2, '0') + '00';
          const maChuyenXe = `${item.spec.nhaXe.maNhaXe}-CX-${ymd}-${item.route.maTuyenXe.replace('DEMO-', '')}-${hourStr}`;

          const departureTime = new Date(Date.UTC(1970, 0, 1, hour, 0, 0));
          const arrivalMinutes = item.route.thoiGianChayPhut || 180;
          const arrivalTime = calculateClockTime(departureTime, arrivalMinutes);

          // Kiểm tra chuyến xe đã có chưa
          let trip = await prisma.chuyenXe.findFirst({
            where: { maChuyenXe },
          });

          if (!trip) {
            trip = await prisma.chuyenXe.create({
              data: {
                maChuyenXe,
                ngayKhoiHanh: tripDate,
                gioKhoiHanh: departureTime,
                gioDen: arrivalTime,
                nhanGuiHang: true,
                sucChuaXeMay: vehicle.loaiXe?.sucChuaXeMayMacDinh ?? 2,
                sucChuaHangCongKenh: vehicle.loaiXe?.sucChuaHangCongKenhMacDinh ?? 5,
                sucChuaHangNhe: vehicle.loaiXe?.sucChuaHangNheMacDinh ?? 50,
                trangThai: 'CHUA_KHOI_HANH',
                nhaXeId: item.spec.nhaXe.nhaXeId,
                tuyenXeId: item.route.tuyenXeId,
                xeId: vehicle.xeId,
                gheChuyenXes: {
                  create: vehicle.ghes.map((g) => ({
                    gheId: g.gheId,
                    trangThai: 'TRONG',
                    tang: g.tang ?? 1,
                    toaDoX: g.toaDoX ?? 0,
                    toaDoY: g.toaDoY ?? 0,
                  })),
                },
              },
            });
            createdTripsCount++;
          }

          // Sao chép điểm dừng từ template sang DiemDonTraChuyenXe (idempotent)
          const existingTripPoints = await prisma.diemDonTraChuyenXe.count({
            where: { chuyenXeId: trip.chuyenXeId },
          });

          if (existingTripPoints === 0 && item.stops.length > 0) {
            for (const stop of item.stops) {
              const thoiGianDuKien = calculateClockTime(departureTime, stop.phutLech);
              await prisma.diemDonTraChuyenXe.create({
                data: {
                  chuyenXeId: trip.chuyenXeId,
                  diemDonTraId: stop.diemDonTraId,
                  loaiDiem: stop.loaiDiem,
                  thoiGianDuKien,
                  phutLech: stop.phutLech,
                  thuTu: stop.thuTu,
                  phuPhi: stop.phuPhi,
                  phutCoMatTruoc: stop.phutCoMatTruoc,
                  nhanKhach: stop.nhanKhach,
                  ghiChu: stop.ghiChu,
                },
              });
              totalPointsCreated++;
            }
          }
        }
      }
    }

    console.log(`\n===============================================================`);
    console.log(`                   KẾT QUẢ SEED DEMO CHUYẾN XE                 `);
    console.log(`===============================================================`);
    console.log(`- Tuyến xe đã cấu hình khuôn: ${preparedRoutes.length}`);
    console.log(`- Chuyến xe demo mới tạo:     ${createdTripsCount}`);
    console.log(`- Điểm dừng chuyến đã nạp:    ${totalPointsCreated}`);
    console.log(`===============================================================\n`);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && process.argv[1].endsWith('seed-demo-trips.mjs')) {
  runSeedDemoTrips().catch((err) => {
    console.error('Lỗi khi seed demo trips:', err);
    process.exit(1);
  });
}
