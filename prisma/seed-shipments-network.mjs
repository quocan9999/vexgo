import crypto from 'node:crypto';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../apps/api/dist/generated/prisma/client.js';
import { databaseConfig } from './lib/db-config.mjs';

function deterministicUuid(...parts) {
  const hash = crypto.createHash('md5').update(parts.map(String).join(':')).digest('hex');
  return `${hash.slice(0, 12)}4${hash.slice(13, 16)}a${hash.slice(17, 32)}`;
}

function normalizeCity(name) {
  if (!name) return '';
  const s = name.toLowerCase().trim();
  if (s.includes('hồ chí minh') || s.includes('sài gòn') || s.includes('tp.hcm') || s.includes('tphcm')) return 'TP.HCM';
  if (s.includes('lâm đồng') || s.includes('đà lạt') || s.includes('bảo lộc')) return 'LÂM ĐỒNG';
  if (s.includes('vũng tàu') || s.includes('bà rịa')) return 'VŨNG TÀU';
  if (s.includes('cần thơ')) return 'CẦN THƠ';
  if (s.includes('khánh hòa') || s.includes('nha trang') || s.includes('cam ranh')) return 'KHÁNH HÒA';
  if (s.includes('đà nẵng')) return 'ĐÀ NẴNG';
  if (s.includes('hà nội')) return 'HÀ NỘI';
  if (s.includes('an giang') || s.includes('long xuyên') || s.includes('châu đốc')) return 'AN GIANG';
  if (s.includes('đồng tháp') || s.includes('cao lãnh') || s.includes('sa đéc')) return 'ĐỒNG THÁP';
  if (s.includes('kiên giang') || s.includes('rạch giá') || s.includes('hà tiên')) return 'KIÊN GIANG';
  if (s.includes('bình thuận') || s.includes('phan thiết')) return 'BÌNH THUẬN';
  return s.toUpperCase();
}

function matchRouteCity(pointCity, routeCity) {
  const normPoint = normalizeCity(pointCity);
  const normRoute = normalizeCity(routeCity);
  return normPoint && normRoute && normPoint === normRoute;
}

const WEIGHT_RANGES = [
  { from: 0, to: 1, fee: 30000 },
  { from: 1.01, to: 5, fee: 50000 },
  { from: 5.01, to: 10, fee: 80000 },
  { from: 10.01, to: 20, fee: 120000 },
  { from: 20.01, to: 50, fee: 180000 },
  { from: 50.01, to: null, fee: 250000 },
];

function getAdminCodes(tinhThanh, maDiem) {
  const provinceMap = {
    'Hồ Chí Minh': '79',
    'TP. Hồ Chí Minh': '79',
    'TP.HCM': '79',
    'Sài Gòn': '79',
    'Lâm Đồng': '49',
    'Đà Lạt': '49',
    'Bà Rịa - Vũng Tàu': '77',
    'Vũng Tàu': '77',
    'Cần Thơ': '92',
    'Đồng Nai': '75',
    'Bình Dương': '74',
    'Tiền Giang': '82',
    'An Giang': '89',
    'Kiên Giang': '91',
    'Bến Tre': '83',
    'Vĩnh Long': '86',
    'Trà Vinh': '84',
    'Hậu Giang': '93',
    'Sóc Trăng': '94',
    'Bạc Liêu': '95',
    'Cà Mau': '96',
    'Đồng Tháp': '87',
    'Tây Ninh': '72',
    'Bình Phước': '70',
    'Bình Thuận': '60',
    'Ninh Thuận': '58',
    'Khánh Hòa': '56',
    'Nha Trang': '56',
    'Đà Nẵng': '48',
    'Hà Nội': '01',
  };
  let code = '79';
  for (const [key, val] of Object.entries(provinceMap)) {
    if (tinhThanh && tinhThanh.includes(key)) {
      code = val;
      break;
    }
  }
  const hash = crypto.createHash('md5').update(maDiem).digest('hex');
  const num = (parseInt(hash.slice(0, 4), 16) % 90000) + 10000;
  return { maTinhThanh: code, maPhuongXa: String(num) };
}

export async function runSeedShipmentsNetwork() {
  console.log(`\n===============================================================`);
  console.log(`  VEXGO SHIPMENT HUBS & NETWORK SEEDER (CRAWLED DATA ONLY)`);
  console.log(`===============================================================\n`);

  const prisma = new PrismaClient({ adapter: new PrismaMariaDb(databaseConfig()) });

  try {
    // 1. Kiểm tra các nhà xe mục tiêu
    const futa = await prisma.nhaXe.findUnique({ where: { maNhaXe: 'FUTA' } });
    const tb = await prisma.nhaXe.findUnique({ where: { maNhaXe: 'TB' } });
    const hm = await prisma.nhaXe.findUnique({ where: { maNhaXe: 'HM' } });

    const operatorMap = new Map();
    if (futa) operatorMap.set('FUTA', futa);
    if (tb) operatorMap.set('TB', tb);
    if (hm) operatorMap.set('HM', hm);

    console.log(`1. Các nhà xe tiếp nhận: ${[...operatorMap.keys()].join(', ')}`);

    // 2. Đọc file crawled-stations-offices.json
    const stationsPath = path.resolve(process.cwd(), 'prisma/data/crawled-stations-offices.json');
    if (!fs.existsSync(stationsPath)) {
      throw new Error(`Không tìm thấy file dữ liệu crawl tại ${stationsPath}`);
    }
    const crawledData = JSON.parse(fs.readFileSync(stationsPath, 'utf8'));
    console.log(`2. Đã đọc file dữ liệu crawl bến xe & bưu cục.`);

    // 3. Tạo các bưu cục (DiemGiaoNhanHang) từ dữ liệu crawl có choGuiHang = true
    console.log(`3. Đang đồng bộ các bưu cục tiếp nhận hàng thực tế...`);
    const createdPointsMap = new Map(); // key: nhaXeId -> list of DiemGiaoNhanHang

    for (const [opCode, operator] of operatorMap.entries()) {
      const opCrawled = crawledData.find((d) => d.operatorCode === opCode);
      if (!opCrawled || !Array.isArray(opCrawled.points)) continue;

      const shipmentPoints = opCrawled.points.filter((p) => p.choGuiHang === true);
      console.log(`   - Nhà xe ${operator.tenNhaXe} (${opCode}): tìm thấy ${shipmentPoints.length} bưu cục/văn phòng nhận hàng.`);

      for (const p of shipmentPoints) {
        const maDiem = deterministicUuid('DGNH', opCode, p.id || p.maDiem);
        const tenDiem = p.tenDiem.slice(0, 150);
        const diaChi = (p.diaChi || p.tenDiem).slice(0, 255);
        const tinhThanh = p.tinhThanh || 'Chưa xác định';
        const quanHuyen = p.quanHuyen || null;

        const existing = await prisma.diemGiaoNhanHang.findFirst({
          where: { nhaXeId: operator.nhaXeId, maDiem },
        });

        const { maTinhThanh, maPhuongXa } = getAdminCodes(tinhThanh, maDiem);
        if (existing) {
          await prisma.diemGiaoNhanHang.update({
            where: { diemGiaoNhanHangId: existing.diemGiaoNhanHangId },
            data: { tenDiem, diaChi, tinhThanh, quanHuyen, maTinhThanh, maPhuongXa, trangThai: 'HOAT_DONG' },
          });
        } else {
          await prisma.diemGiaoNhanHang.create({
            data: {
              maDiem,
              tenDiem,
              diaChi,
              tinhThanh,
              quanHuyen,
              maTinhThanh,
              maPhuongXa,
              trangThai: 'HOAT_DONG',
              nhaXeId: operator.nhaXeId,
            },
          });
        }
      }

      // Tải lại toàn bộ bưu cục của nhà xe này trong DB
      const allPointsForOp = await prisma.diemGiaoNhanHang.findMany({
        where: { nhaXeId: operator.nhaXeId, trangThai: 'HOAT_DONG' },
      });
      createdPointsMap.set(operator.nhaXeId, allPointsForOp);
    }
    console.log(`   ✓ Hoàn tất đồng bộ bưu cục.`);

    // 4. Lấy danh sách các loại hàng hóa (LoaiHangHoa)
    const cargoTypes = await prisma.loaiHangHoa.findMany({
      where: { trangThai: 'HOAT_DONG' },
    });
    console.log(`4. Đang dùng ${cargoTypes.length} loại hàng hóa đang hoạt động.`);

    // 5. Gán bưu cục vào các tuyến xe và tạo bảng cước bằng batching
    console.log(`5. Đang liên kết bưu cục vào tuyến và thiết lập bảng cước FUTA Express...`);
    const routes = await prisma.tuyenXe.findMany({
      where: {
        nhaXeId: { in: [...operatorMap.values()].map((o) => o.nhaXeId) },
        trangThai: 'HOAT_DONG',
      },
      include: { nhaXe: true },
    });

    const routePointLinks = [];
    const shippingRates = [];
    const startDate = new Date('2026-09-01T00:00:00.000Z');

    const existingRoutesWithRates = new Set(
      (
        await prisma.bangCuocGuiHang.findMany({
          select: { tuyenXeId: true },
          distinct: ['tuyenXeId'],
        })
      ).map((r) => r.tuyenXeId),
    );

    for (const route of routes) {
      const opPoints = createdPointsMap.get(route.nhaXeId) || [];
      if (opPoints.length === 0) continue;

      const senderPoints = opPoints.filter((p) => matchRouteCity(p.tinhThanh, route.diemDi));
      const receiverPoints = opPoints.filter((p) => matchRouteCity(p.tinhThanh, route.diemDen));

      if (senderPoints.length === 0 || receiverPoints.length === 0) {
        continue;
      }

      console.log(
        `   * Tuyến ${route.maTuyenXe || route.tuyenXeId} (${route.diemDi} -> ${route.diemDen}): ` +
          `${senderPoints.length} điểm gửi, ${receiverPoints.length} điểm nhận.`,
      );

      for (const sp of senderPoints) {
        routePointLinks.push({
          tuyenXeId: route.tuyenXeId,
          diemGiaoNhanHangId: sp.diemGiaoNhanHangId,
          vaiTro: 'GUI_HANG',
        });
      }

      for (const rp of receiverPoints) {
        routePointLinks.push({
          tuyenXeId: route.tuyenXeId,
          diemGiaoNhanHangId: rp.diemGiaoNhanHangId,
          vaiTro: 'NHAN_HANG',
        });
      }

      if (!existingRoutesWithRates.has(route.tuyenXeId)) {
        for (const range of WEIGHT_RANGES) {
          for (const ct of cargoTypes) {
            shippingRates.push({
              tuyenXeId: route.tuyenXeId,
              loaiHangHoaId: ct.loaiHangHoaId,
              khoiLuongTu: range.from,
              khoiLuongDen: range.to,
              mucCuoc: range.fee,
              tuNgay: startDate,
              denNgay: null,
              trangThai: 'HOAT_DONG',
            });
          }
        }
        existingRoutesWithRates.add(route.tuyenXeId);
      }
    }

    // Insert batch DiemGiaoNhanTuyenXe
    if (routePointLinks.length > 0) {
      // deduplicate theo [tuyenXeId, diemGiaoNhanHangId]
      const uniqueLinks = [];
      const seen = new Set();
      for (const l of routePointLinks) {
        const k = `${l.tuyenXeId}-${l.diemGiaoNhanHangId}`;
        if (!seen.has(k)) {
          seen.add(k);
          uniqueLinks.push(l);
        }
      }
      const res = await prisma.diemGiaoNhanTuyenXe.createMany({
        data: uniqueLinks,
        skipDuplicates: true,
      });
      console.log(`   ✓ Đã liên kết ${res.count} điểm giao nhận vào các tuyến xe.`);
    }

    // Insert batch BangCuocGuiHang theo từng mẩu 2000 dòng
    if (shippingRates.length > 0) {
      // Deduplicate in-memory
      const uniqueRates = [];
      const seenRateKeys = new Set();
      for (const r of shippingRates) {
        const k = `${r.tuyenXeId}-${r.loaiHangHoaId}-${r.khoiLuongTu}`;
        if (!seenRateKeys.has(k)) {
          seenRateKeys.add(k);
          uniqueRates.push(r);
        }
      }

      console.log(`   * Đang kiểm tra và ghi ${uniqueRates.length} bản ghi bảng cước...`);
      let rateCount = 0;
      const CHUNK_SIZE = 2000;
      for (let i = 0; i < uniqueRates.length; i += CHUNK_SIZE) {
        const chunk = uniqueRates.slice(i, i + CHUNK_SIZE);
        const res = await prisma.bangCuocGuiHang.createMany({
          data: chunk,
          skipDuplicates: true,
        });
        rateCount += res.count;
      }
      console.log(`   ✓ Đã tạo mới ${rateCount} bản ghi bảng cước.`);
    }

    // 6. Lấp đầy chuyến xe (ChuyenXe) từ 03/11/2026 đến 31/12/2026
    console.log(`6. Đang lấp đầy lịch trình chuyến xe (03/11/2026 -> 31/12/2026)...`);

    const vehiclesByOp = new Map();
    for (const [opCode, op] of operatorMap.entries()) {
      const xes = await prisma.xe.findMany({
        where: { nhaXeId: op.nhaXeId, trangThai: 'HOAT_DONG' },
        include: { loaiXe: true },
      });
      vehiclesByOp.set(op.nhaXeId, xes);
    }

    const departureHours = [6, 9, 13, 16, 19, 22];
    const startDateTrip = new Date(Date.UTC(2026, 10, 3)); // 03/11/2026
    const endDateTrip = new Date(Date.UTC(2026, 11, 31)); // 31/12/2026

    const activeRoutes = routes.filter((r) => {
      const opPoints = createdPointsMap.get(r.nhaXeId) || [];
      const hasSender = opPoints.some((p) => matchRouteCity(p.tinhThanh, r.diemDi));
      const hasReceiver = opPoints.some((p) => matchRouteCity(p.tinhThanh, r.diemDen));
      return hasSender && hasReceiver;
    });

    console.log(`   - Có ${activeRoutes.length} tuyến xe đủ điều kiện vận chuyển bưu cục.`);
    const existingTripSlots = new Set(
      (
        await prisma.chuyenXe.findMany({
          select: { tuyenXeId: true, ngayKhoiHanh: true, gioKhoiHanh: true },
        })
      ).map(
        (t) => `${t.tuyenXeId}_${t.ngayKhoiHanh.toISOString()}_${t.gioKhoiHanh.toISOString()}`,
      ),
    );
    const tripsToCreate = [];

    for (let d = new Date(startDateTrip); d <= endDateTrip; d.setUTCDate(d.getUTCDate() + 1)) {
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      const dayNum = d.getUTCDate();
      const ymd = `${year}${month}${day}`;
      const tripDate = new Date(Date.UTC(year, d.getUTCMonth(), d.getUTCDate()));

      for (let rIdx = 0; rIdx < activeRoutes.length; rIdx++) {
        const route = activeRoutes[rIdx];
        const vehicles = vehiclesByOp.get(route.nhaXeId) || [];
        if (vehicles.length === 0) continue;

        for (let i = 0; i < departureHours.length; i++) {
          const hour = departureHours[i];
          const hourStr = String(hour).padStart(2, '0') + '00';
          const vehicle = vehicles[(dayNum + rIdx * 2 + i) % vehicles.length];
          const rawHash = crypto.createHash('md5').update(`CX:${route.nhaXe.maNhaXe}:${ymd}:${route.tuyenXeId}:${hourStr}`).digest('hex');
          const maChuyenXe = `${rawHash.slice(0, 12)}4${rawHash.slice(13, 16)}a${rawHash.slice(17, 32)}`;

          const departureTime = new Date(Date.UTC(1970, 0, 1, hour, 0, 0));
          const slotKey = `${route.tuyenXeId}_${tripDate.toISOString()}_${departureTime.toISOString()}`;
          if (existingTripSlots.has(slotKey)) continue;
          existingTripSlots.add(slotKey);

          const durationMin = route.thoiGianChayPhut || 240;
          const arrivalTime = new Date(departureTime.getTime() + durationMin * 60000);

          tripsToCreate.push({
            maChuyenXe,
            nhaXeId: route.nhaXeId,
            tuyenXeId: route.tuyenXeId,
            xeId: vehicle.xeId,
            ngayKhoiHanh: tripDate,
            gioKhoiHanh: departureTime,
            gioDen: arrivalTime,
            trangThai: 'CHUA_KHOI_HANH',
            nhanGuiHang: true,
            sucChuaHangNhe: 100,
            sucChuaHangCongKenh: 5,
            sucChuaXeMay: 2,
          });
        }
      }
    }

    if (tripsToCreate.length > 0) {
      console.log(`   * Đang ghi ${tripsToCreate.length} chuyến xe mới...`);
      let tripCount = 0;
      const CHUNK_SIZE = 1000;
      for (let i = 0; i < tripsToCreate.length; i += CHUNK_SIZE) {
        const chunk = tripsToCreate.slice(i, i + CHUNK_SIZE);
        const res = await prisma.chuyenXe.createMany({
          data: chunk,
          skipDuplicates: true,
        });
        tripCount += res.count;
      }
      console.log(`   ✓ Đã tạo mới ${tripCount} chuyến xe phủ khắp từ 03/11 đến 31/12/2026.`);
    }

    console.log(`\n===============================================================`);
    console.log(`  HOÀN THÀNH SEED MẠNG LƯỚI BƯU CỤC & CHUYẾN XE GỬI HÀNG!`);
    console.log(`===============================================================\n`);
  } catch (error) {
    console.error('Lỗi trong quá trình seed mạng lưới gửi hàng:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && process.argv[1].endsWith('seed-shipments-network.mjs')) {
  runSeedShipmentsNetwork().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
