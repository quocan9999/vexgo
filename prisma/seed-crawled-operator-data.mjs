import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../apps/api/dist/generated/prisma/client.js';
import {
  normalizeName,
  normalizeProvinceName,
  matchProvince,
  mapLoaiDiem,
  normalizePhone,
  formatAddress,
  deduplicateFixedPoints,
  generateRoutePointMaDiem,
  buildRouteTemplates,
} from './lib/crawled-data.mjs';

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

export async function runSeed({ apply = false } = {}) {
  const isApply = apply;
  console.log(`\n===============================================================`);
  console.log(`  VEXGO CRAWLED DATA SEEDER - ${isApply ? 'MODE: APPLY (GHI DB)' : 'MODE: DRY-RUN (CHỈ KIỂM TRA)'}`);
  console.log(`===============================================================\n`);

  const prisma = new PrismaClient({ adapter: new PrismaMariaDb(databaseConfig()) });

  try {
    // 1. Kiểm tra Nhà xe
    const targetOperators = ['FUTA', 'HM', 'TB'];
    const dbOperators = await prisma.nhaXe.findMany({
      where: { maNhaXe: { in: targetOperators } },
    });

    const operatorMap = new Map();
    for (const op of dbOperators) {
      operatorMap.set(op.maNhaXe, op);
    }

    const missingOperators = targetOperators.filter(code => !operatorMap.has(code));
    if (missingOperators.length > 0) {
      console.warn(`[CẢNH BÁO] Không tìm thấy nhà xe trong DB: ${missingOperators.join(', ')} -> DỪNG xử lý các nhà xe này.`);
    }

    // 2. Tải danh mục tỉnh thành cũ và bảng sáp nhập
    const oldProvinces = await prisma.danhMucDiaDiem.findMany({
      where: { laDiaDanhCu: true, capDiaDiem: 'TINH_THANH' },
      select: { diaDiemId: true, code: true, tenDiaDiem: true },
    });

    const provinceLookup = new Map();
    for (const p of oldProvinces) {
      const norm = normalizeProvinceName(p.tenDiaDiem);
      provinceLookup.set(norm, p);
      if (norm === 'thua thien hue') {
        provinceLookup.set('hue', p);
      }
    }

    const mergeMappings = await prisma.bangSapNhapDiaDiem.findMany({
      select: { diaDiemCuId: true, diaDiemMoiId: true },
    });
    const newLocationLookup = new Map();
    for (const m of mergeMappings) {
      newLocationLookup.set(m.diaDiemCuId, m.diaDiemMoiId);
    }

    // 3. Tải bến mẫu hiện có từ DB (các bến mẫu được tạo bởi seed-locations-and-stations.mjs)
    const sampleStationCodes = [
      'BX-MD-MOI',
      'BX-MT',
      'BX-VT',
      'BX-DL',
      'BX-GP',
      'BX-BD',
      'BX-PT',
      'BX-GN',
      'VP-Q1',
    ];
    const existingStations = await prisma.diemDonTra.findMany({
      where: { maDiem: { in: sampleStationCodes } },
      include: { nhaXe: true },
    });

    // operatorCode -> Map<normalizedName, station>
    const sampleStationMap = new Map();
    for (const s of existingStations) {
      const opCode = s.nhaXe.maNhaXe;
      if (!sampleStationMap.has(opCode)) {
        sampleStationMap.set(opCode, new Map());
      }
      sampleStationMap.get(opCode).set(normalizeName(s.tenDiem), s);
    }

    // 4. Đọc dữ liệu crawl
    const stationsPath = path.resolve('prisma/data/crawled-stations-offices.json');
    const routePointsPath = path.resolve('prisma/data/crawled-route-points.json');

    const crawledStationsData = JSON.parse(fs.readFileSync(stationsPath, 'utf8'));
    const crawledRoutePointsData = JSON.parse(fs.readFileSync(routePointsPath, 'utf8'));

    // Thống kê báo cáo
    const report = {
      operators: {},
      deduplicatedList: [],
      unmappedProvincesList: [],
      vpBenXeAsBenXeList: [],
      sampleReusedList: [],
      truncatedFieldsList: [],
    };

    for (const code of targetOperators) {
      report.operators[code] = {
        read: 0,
        created: 0,
        updated: 0,
        skipped: 0,
      };
    }

    // Lưu trữ mapping tên điểm -> maDiem đã phân giải cho template lộ trình
    // operatorCode -> Map<normalizedName, maDiem>
    const resolvedPointCodeMap = new Map();
    for (const code of targetOperators) {
      resolvedPointCodeMap.set(code, new Map());
      // Nạp các bến mẫu vào mapping trước
      if (sampleStationMap.has(code)) {
        for (const [normName, station] of sampleStationMap.get(code).entries()) {
          resolvedPointCodeMap.get(code).set(normName, station.maDiem);
        }
      }
    }

    // =========================================================================
    // XỬ LÝ 1: ĐIỂM CỐ ĐỊNH (crawled-stations-offices.json)
    // =========================================================================
    for (const opCode of targetOperators) {
      if (!operatorMap.has(opCode)) continue;
      const nhaXe = operatorMap.get(opCode);
      const opData = crawledStationsData.find(d => d.operatorCode === opCode);
      if (!opData || !Array.isArray(opData.points)) continue;

      const rawPoints = opData.points;
      report.operators[opCode].read += rawPoints.length;

      // Loại trùng trong cùng nhà xe theo (tenDiem chuẩn hóa, diaChi chuẩn hóa)
      const { uniquePoints, duplicates } = deduplicateFixedPoints(rawPoints);
      for (const d of duplicates) {
        report.deduplicatedList.push({
          opCode,
          tenDiem: d.duplicate.tenDiem,
          keptId: d.kept.id,
          duplicateId: d.duplicate.id,
          keptMaDiem: d.kept.maDiem,
          duplicateMaDiem: d.duplicate.maDiem,
          diaChi: d.duplicate.diaChi,
        });
        report.operators[opCode].skipped++;
      }

      for (const p of uniquePoints) {
        // Kiểm tra điểm "VP Bến xe..." đang là BEN_XE
        if (p.loaiDiem === 'BEN_XE' && /vp\s+bến\s+xe/i.test(p.tenDiem)) {
          report.vpBenXeAsBenXeList.push({
            opCode,
            maDiem: p.maDiem,
            tenDiem: p.tenDiem,
            loaiDiem: p.loaiDiem,
          });
        }

        // Ánh xạ tỉnh cũ
        const matchedProvince = matchProvince(p.tinhThanh, p.quanHuyen, provinceLookup);
        if (!matchedProvince) {
          report.unmappedProvincesList.push({
            opCode,
            sourceId: p.id,
            maDiem: p.maDiem,
            tenDiem: p.tenDiem,
            tinhThanh: p.tinhThanh,
            quanHuyen: p.quanHuyen,
            reason: 'Không tìm thấy tỉnh thành cũ tương ứng từ tinhThanh hoặc quanHuyen',
          });
          report.operators[opCode].skipped++;
          continue;
        }

        const diaDiemCuId = matchedProvince.diaDiemId;
        const diaDiemMoiId = newLocationLookup.get(diaDiemCuId);
        if (!diaDiemMoiId) {
          report.unmappedProvincesList.push({
            opCode,
            sourceId: p.id,
            maDiem: p.maDiem,
            tenDiem: p.tenDiem,
            tinhThanh: p.tinhThanh,
            quanHuyen: p.quanHuyen,
            reason: `Không tìm thấy ánh xạ sáp nhập (diaDiemMoiId) cho diaDiemCuId=${diaDiemCuId}`,
          });
          report.operators[opCode].skipped++;
          continue;
        }

        // Kiểm tra trùng tên chuẩn hóa với bến mẫu đã có trong DB
        const normName = normalizeName(p.tenDiem);
        const sampleStation = sampleStationMap.get(opCode)?.get(normName);

        if (sampleStation) {
          // Tái sử dụng bến mẫu theo quyết định của user: KHÔNG tạo dòng thứ hai, không sửa bến mẫu
          report.sampleReusedList.push({
            opCode,
            pointType: 'FIXED',
            crawledMaDiem: p.maDiem,
            sampleMaDiem: sampleStation.maDiem,
            tenDiem: p.tenDiem,
            crawledDiaChi: p.diaChi,
            sampleDiaChi: sampleStation.diaChi,
            crawledPhone: p.soDienThoai,
            samplePhone: sampleStation.soDienThoai,
          });
          resolvedPointCodeMap.get(opCode).set(normName, sampleStation.maDiem);
          report.operators[opCode].skipped++;
          continue;
        }

        // Chuẩn hóa dữ liệu điểm
        const rawPhone = p.soDienThoai;
        const normalizedPhone = normalizePhone(rawPhone);
        const formattedAddress = formatAddress(p.diaChi, p.quanHuyen, p.tinhThanh);
        const mappedLoaiDiem = mapLoaiDiem(p.loaiDiem);
        const maDiem = p.maDiem.slice(0, 50);
        const tenDiem = p.tenDiem.slice(0, 150);

        if (rawPhone && rawPhone.length > 20) {
          const parts = rawPhone.split(',').map(s => s.trim());
          report.truncatedFieldsList.push({
            opCode,
            maDiem,
            tenDiem: p.tenDiem,
            fieldName: 'soDienThoai',
            rawLength: rawPhone.length,
            limit: 20,
            rawValue: rawPhone,
            keptValue: normalizedPhone,
            lostValue: parts.slice(1).join(', '),
          });
        }

        resolvedPointCodeMap.get(opCode).set(normName, maDiem);

        if (isApply) {
          const existing = await prisma.diemDonTra.findUnique({
            where: {
              nhaXeId_maDiem: {
                nhaXeId: nhaXe.nhaXeId,
                maDiem,
              },
            },
          });

          await prisma.diemDonTra.upsert({
            where: {
              nhaXeId_maDiem: {
                nhaXeId: nhaXe.nhaXeId,
                maDiem,
              },
            },
            update: {
              tenDiem,
              loaiDiem: mappedLoaiDiem,
              diaChi: formattedAddress,
              diaDiemCuId,
              diaDiemMoiId,
              soDienThoai: normalizedPhone,
              trangThai: 'HOAT_DONG',
            },
            create: {
              nhaXeId: nhaXe.nhaXeId,
              maDiem,
              tenDiem,
              loaiDiem: mappedLoaiDiem,
              diaChi: formattedAddress,
              diaDiemCuId,
              diaDiemMoiId,
              soDienThoai: normalizedPhone,
              trangThai: 'HOAT_DONG',
            },
          });

          if (existing) {
            report.operators[opCode].updated++;
          } else {
            report.operators[opCode].created++;
          }
        } else {
          report.operators[opCode].created++;
        }
      }
    }

    // =========================================================================
    // XỬ LÝ 2: ĐIỂM DỌC TUYẾN (crawled-route-points.json)
    // =========================================================================
    // Chỉ lấy dòng có nhaXeThamChieu chứa "Phương Trang" (FUTA) hoặc "Hoa Mai" (HM)
    const routePointsFuta = crawledRoutePointsData.filter(d => (d.nhaXeThamChieu || '').includes('Phương Trang'));
    const routePointsHm = crawledRoutePointsData.filter(d => (d.nhaXeThamChieu || '').includes('Hoa Mai'));

    const routePointsByOp = [
      { opCode: 'FUTA', points: routePointsFuta },
      { opCode: 'HM', points: routePointsHm },
    ];

    // Để lưu điểm dọc tuyến duy nhất theo từng nhà xe
    // opCode -> Map<tenDiemNorm + '|||' + diaChiNorm, maDiem>
    const createdRoutePointsByOp = new Map();
    createdRoutePointsByOp.set('FUTA', new Map());
    createdRoutePointsByOp.set('HM', new Map());

    for (const { opCode, points } of routePointsByOp) {
      if (!operatorMap.has(opCode)) continue;
      const nhaXe = operatorMap.get(opCode);
      report.operators[opCode].read += points.length;

      for (const p of points) {
        const normName = normalizeName(p.tenDiem);

        // A. Kiểm tra trùng bến mẫu trong DB
        const sampleStation = sampleStationMap.get(opCode)?.get(normName);
        if (sampleStation) {
          const alreadyReported = report.sampleReusedList.some(
            s => s.opCode === opCode && s.sampleMaDiem === sampleStation.maDiem
          );
          if (!alreadyReported) {
            report.sampleReusedList.push({
              opCode,
              pointType: 'ROUTE',
              crawledMaDiem: '(Điểm dọc tuyến)',
              sampleMaDiem: sampleStation.maDiem,
              tenDiem: p.tenDiem,
              crawledDiaChi: p.diaChi,
              sampleDiaChi: sampleStation.diaChi,
              crawledPhone: null,
              samplePhone: sampleStation.soDienThoai,
            });
          }
          resolvedPointCodeMap.get(opCode).set(normName, sampleStation.maDiem);
          report.operators[opCode].skipped++;
          continue;
        }

        // B. Kiểm tra trùng điểm cố định đã có của cùng nhà xe (đã nạp ở bước 1)
        if (resolvedPointCodeMap.get(opCode).has(normName)) {
          report.operators[opCode].skipped++;
          continue;
        }

        // C. Điểm dọc tuyến mới: kiểm tra xem trong danh sách dọc tuyến đã tạo chưa
        const formattedAddress = formatAddress(p.diaChi, p.quanHuyen, p.tinhThanh);
        const normAddr = normalizeName(formattedAddress);
        const routeKey = `${normName}|||${normAddr}`;

        if (createdRoutePointsByOp.get(opCode).has(routeKey)) {
          report.operators[opCode].skipped++;
          continue;
        }

        // Ánh xạ tỉnh cũ cho điểm dọc tuyến (nếu tinhThanh null thì thử quanHuyen)
        const matchedProvince = matchProvince(p.tinhThanh, p.quanHuyen, provinceLookup);
        if (!matchedProvince) {
          report.unmappedProvincesList.push({
            opCode,
            sourceId: '(Điểm dọc tuyến)',
            maDiem: '(Chưa tạo)',
            tenDiem: p.tenDiem,
            tinhThanh: p.tinhThanh,
            quanHuyen: p.quanHuyen,
            reason: 'Không tìm thấy tỉnh thành cũ tương ứng từ tinhThanh hoặc quanHuyen',
          });
          report.operators[opCode].skipped++;
          continue;
        }

        const diaDiemCuId = matchedProvince.diaDiemId;
        const diaDiemMoiId = newLocationLookup.get(diaDiemCuId);
        if (!diaDiemMoiId) {
          report.unmappedProvincesList.push({
            opCode,
            sourceId: '(Điểm dọc tuyến)',
            maDiem: '(Chưa tạo)',
            tenDiem: p.tenDiem,
            tinhThanh: p.tinhThanh,
            quanHuyen: p.quanHuyen,
            reason: `Không tìm thấy ánh xạ sáp nhập (diaDiemMoiId) cho diaDiemCuId=${diaDiemCuId}`,
          });
          report.operators[opCode].skipped++;
          continue;
        }

        // Sinh mã ổn định cho điểm dọc tuyến
        const maDiem = generateRoutePointMaDiem(opCode, p.tenDiem, p.viDo, p.kinhDo);
        const tenDiem = p.tenDiem.slice(0, 150);
        const mappedLoaiDiem = mapLoaiDiem(p.loaiDiem);

        createdRoutePointsByOp.get(opCode).set(routeKey, maDiem);
        resolvedPointCodeMap.get(opCode).set(normName, maDiem);

        if (isApply) {
          const existing = await prisma.diemDonTra.findUnique({
            where: {
              nhaXeId_maDiem: {
                nhaXeId: nhaXe.nhaXeId,
                maDiem,
              },
            },
          });

          await prisma.diemDonTra.upsert({
            where: {
              nhaXeId_maDiem: {
                nhaXeId: nhaXe.nhaXeId,
                maDiem,
              },
            },
            update: {
              tenDiem,
              loaiDiem: mappedLoaiDiem,
              diaChi: formattedAddress,
              diaDiemCuId,
              diaDiemMoiId,
              viDo: p.viDo ? Number(p.viDo) : null,
              kinhDo: p.kinhDo ? Number(p.kinhDo) : null,
              soDienThoai: null,
              trangThai: 'HOAT_DONG',
            },
            create: {
              nhaXeId: nhaXe.nhaXeId,
              maDiem,
              tenDiem,
              loaiDiem: mappedLoaiDiem,
              diaChi: formattedAddress,
              diaDiemCuId,
              diaDiemMoiId,
              viDo: p.viDo ? Number(p.viDo) : null,
              kinhDo: p.kinhDo ? Number(p.kinhDo) : null,
              soDienThoai: null,
              trangThai: 'HOAT_DONG',
            },
          });

          if (existing) {
            report.operators[opCode].updated++;
          } else {
            report.operators[opCode].created++;
          }
        } else {
          report.operators[opCode].created++;
        }
      }
    }

    // =========================================================================
    // XỬ LÝ 3: SINH FILE KHUÔN LỘ TRÌNH (prisma/data/route-templates.json)
    // =========================================================================
    const allRelevantRoutePoints = [...routePointsFuta, ...routePointsHm];
    const templatesLookup = {};
    for (const [code, codeMap] of resolvedPointCodeMap.entries()) {
      templatesLookup[code] = {};
      for (const [normName, maDiem] of codeMap.entries()) {
        templatesLookup[code][normName] = maDiem;
      }
    }

    const templates = buildRouteTemplates(allRelevantRoutePoints, templatesLookup);
    const templatesPath = path.resolve('prisma/data/route-templates.json');
    fs.writeFileSync(templatesPath, JSON.stringify(templates, null, 2), 'utf8');
    console.log(`[INFO] Đã ghi khuôn lộ trình vào: ${templatesPath} (${templates.length} lộ trình)`);

    // =========================================================================
    // IN BÁO CÁO TỔNG KẾT
    // =========================================================================
    printReport(report, isApply);

    return { report, isApply };
  } finally {
    await prisma.$disconnect();
  }
}

function printReport(report, isApply) {
  console.log(`\n===============================================================`);
  console.log(`                    BÁO CÁO THỐNG KÊ SEED                      `);
  console.log(`===============================================================`);
  console.log(`Chế độ thực thi: ${isApply ? 'APPLY (Đã ghi vào DB)' : 'DRY-RUN (Chưa ghi vào DB)'}\n`);

  console.log(`1. THỐNG KÊ THEO NHÀ XE:`);
  console.log(`---------------------------------------------------------------`);
  console.log(`Nhà xe | Đọc nguồn | Tạo mới | Cập nhật | Bỏ qua / Trùng`);
  console.log(`---------------------------------------------------------------`);
  for (const [op, stats] of Object.entries(report.operators)) {
    console.log(
      `${op.padEnd(6)} | ${String(stats.read).padStart(9)} | ${String(stats.created).padStart(7)} | ${String(stats.updated).padStart(8)} | ${String(stats.skipped).padStart(15)}`
    );
  }
  console.log(`---------------------------------------------------------------`);

  console.log(`\n2. DANH SÁCH ĐIỂM BỊ LOẠI TRÙNG TRONG CÙNG NHÀ XE (${report.deduplicatedList.length} điểm):`);
  if (report.deduplicatedList.length === 0) {
    console.log(`   (Không có điểm trùng nào)`);
  } else {
    for (const d of report.deduplicatedList) {
      console.log(`   - [${d.opCode}] "${d.tenDiem}": loại bản ghi id ${d.duplicateId} (${d.duplicateMaDiem}), giữ bản ghi id ${d.keptId} (${d.keptMaDiem})`);
      console.log(`     Địa chỉ: ${d.diaChi}`);
    }
  }

  console.log(`\n3. DANH SÁCH ĐIỂM KHÔNG ÁNH XẠ ĐƯỢC TỈNH (${report.unmappedProvincesList.length} điểm):`);
  if (report.unmappedProvincesList.length === 0) {
    console.log(`   (Tất cả các điểm hợp lệ đều ánh xạ thành công)`);
  } else {
    for (const u of report.unmappedProvincesList) {
      console.log(`   - [${u.opCode}] "${u.tenDiem}" (mã: ${u.maDiem}, id: ${u.sourceId}): ${u.reason}`);
      console.log(`     Dữ liệu nguồn: tinhThanh="${u.tinhThanh}", quanHuyen="${u.quanHuyen}"`);
    }
  }

  console.log(`\n4. DANH SÁCH ĐIỂM "VP BẾN XE..." ĐANG CÓ LOẠI BEN_XE (${report.vpBenXeAsBenXeList.length} điểm):`);
  for (const v of report.vpBenXeAsBenXeList) {
    console.log(`   - [${v.opCode}] ${v.maDiem}: "${v.tenDiem}" -> giữ nguyên loaiDiem="${v.loaiDiem}"`);
  }

  console.log(`\n5. DANH SÁCH ĐIỂM TÁI SỬ DỤNG BẾN MẪU CÓ SẴN TRONG DB (${report.sampleReusedList.length} lượt):`);
  for (const s of report.sampleReusedList) {
    console.log(`   - [${s.opCode}][${s.pointType}] "${s.tenDiem}": dùng lại bến mẫu maDiem="${s.sampleMaDiem}" (mã crawl: ${s.crawledMaDiem})`);
    if (s.crawledDiaChi && s.sampleDiaChi && s.crawledDiaChi !== s.sampleDiaChi) {
      console.log(`     * Khác biệt địa chỉ: crawl="${s.crawledDiaChi}" vs mẫu="${s.sampleDiaChi}"`);
    }
    if (s.crawledPhone && s.samplePhone && s.crawledPhone !== s.samplePhone) {
      console.log(`     * Khác biệt SĐT: crawl="${s.crawledPhone}" vs mẫu="${s.samplePhone}"`);
    }
  }

  console.log(`\n6. DANH SÁCH TRƯỜNG BỊ CẮT CHUỖI / RÚT GỌN (${report.truncatedFieldsList.length} trường):`);
  if (report.truncatedFieldsList.length === 0) {
    console.log(`   (Không có trường nào vượt giới hạn độ dài cột DB)`);
  } else {
    for (const t of report.truncatedFieldsList) {
      console.log(`   - [${t.opCode}] "${t.tenDiem}" (${t.maDiem}): trường ${t.fieldName} dài ${t.rawLength} ký tự (giới hạn VarChar(${t.limit}))`);
      console.log(`     * Giá trị nguồn: "${t.rawValue}"`);
      console.log(`     * Giá trị sau khi rút gọn: "${t.keptValue}"`);
      if (t.lostValue) {
        console.log(`     * Phần thông tin bị lược bỏ: "${t.lostValue}"`);
      }
    }
  }
  console.log(`===============================================================\n`);
}

// Chạy trực tiếp qua CLI
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve('prisma/seed-crawled-operator-data.mjs');
if (isMain) {
  const apply = process.argv.includes('--apply');
  runSeed({ apply })
    .then(() => process.exit(0))
    .catch(err => {
      console.error('[LỖI CHẠY SEED]:', err);
      process.exit(1);
    });
}
