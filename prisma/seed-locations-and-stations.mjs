import 'dotenv/config';
import fs from 'fs';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../apps/api/dist/generated/prisma/client.js';

function databaseConfig() {
  const raw = process.env.DATABASE_URL ?? process.env.MIGRATION_URL;
  if (!raw) throw new Error('MIGRATION_URL or DATABASE_URL is required for seed');
  const url = new URL(raw);
  if (url.protocol !== 'mysql:') throw new Error('Seed URL must use mysql: protocol');
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

function removeVietnameseTones(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  console.log('--- Bắt đầu nạp DanhMucDiaDiem, BangSapNhapDiaDiem và DiemDonTra ---');

  const clusters = JSON.parse(fs.readFileSync('docs/features/tinh_thanh/tinh-sap-nhap.json', 'utf8'));
  const v1 = JSON.parse(fs.readFileSync('docs/features/tinh_thanh/provinces-v1.json', 'utf8'));
  const v2 = JSON.parse(fs.readFileSync('docs/features/tinh_thanh/provinces-v2.json', 'utf8'));

  // 1. Seed 34 Tỉnh mới (laDiaDanhCu = false)
  const popularNewCodes = new Set([1, 79, 48, 92, 68]);
  console.log(`Đang nạp ${v2.length} tỉnh thành mới (sau sáp nhập)...`);
  for (const p2 of v2) {
    const cluster = clusters.find(c => c.newProvinceCode === p2.code);
    let chuThichSapNhap = null;
    if (cluster && cluster.oldProvinces.length > 1) {
      const oldNames = cluster.oldProvinces
        .map(o => o.name.replace(/^(Tỉnh|Thành phố)\s+/i, '').trim())
        .join(', ');
      chuThichSapNhap = `Sáp nhập từ ${oldNames}`;
    }

    await prisma.danhMucDiaDiem.upsert({
      where: {
        code_laDiaDanhCu: {
          code: p2.code,
          laDiaDanhCu: false,
        },
      },
      update: {
        tenDiaDiem: p2.name,
        tenKhongDau: removeVietnameseTones(p2.name),
        capDiaDiem: 'TINH_THANH',
        chuThichSapNhap,
      },
      create: {
        maDiaDiem: `VN-P2-${p2.code}`,
        code: p2.code,
        tenDiaDiem: p2.name,
        tenKhongDau: removeVietnameseTones(p2.name),
        capDiaDiem: 'TINH_THANH',
        laDiaDanhCu: false,
        chuThichSapNhap,
        noiBat: popularNewCodes.has(p2.code),
        thuTuHienThi: popularNewCodes.has(p2.code) ? 10 : 0,
      },
    });
  }

  // 2. Seed 63 Tỉnh cũ (laDiaDanhCu = true)
  const popularOldCodes = new Set([1, 79, 48, 68, 77, 74, 56, 52]);
  console.log(`Đang nạp ${v1.length} tỉnh thành cũ (trước sáp nhập)...`);
  for (const p1 of v1) {
    await prisma.danhMucDiaDiem.upsert({
      where: {
        code_laDiaDanhCu: {
          code: p1.code,
          laDiaDanhCu: true,
        },
      },
      update: {
        tenDiaDiem: p1.name,
        tenKhongDau: removeVietnameseTones(p1.name),
        capDiaDiem: 'TINH_THANH',
        chuThichSapNhap: null,
      },
      create: {
        maDiaDiem: `VN-P1-${p1.code}`,
        code: p1.code,
        tenDiaDiem: p1.name,
        tenKhongDau: removeVietnameseTones(p1.name),
        capDiaDiem: 'TINH_THANH',
        laDiaDanhCu: true,
        chuThichSapNhap: null,
        noiBat: popularOldCodes.has(p1.code),
        thuTuHienThi: popularOldCodes.has(p1.code) ? 10 : 0,
      },
    });
  }

  // Dựng mapping tỉnh cũ và mới (CHỈ lấy địa danh có capDiaDiem = 'TINH_THANH')
  const provinceLocations = await prisma.danhMucDiaDiem.findMany({
    where: { capDiaDiem: 'TINH_THANH' },
  });
  const newMap = new Map(); // code -> diaDiemId (laDiaDanhCu = false)
  const oldMap = new Map(); // code -> diaDiemId (laDiaDanhCu = true)
  for (const loc of provinceLocations) {
    if (loc.laDiaDanhCu) {
      oldMap.set(loc.code, loc.diaDiemId);
    } else {
      newMap.set(loc.code, loc.diaDiemId);
    }
  }

  // 3. Seed các Quận/Huyện/TP trực thuộc nổi bật của hệ cũ (gán diaDiemChaId tới tỉnh CŨ cha)
  const allDistrictsMap = new Map();
  for (const p of v1) {
    if (Array.isArray(p.districts)) {
      for (const d of p.districts) {
        allDistrictsMap.set(d.code, {
          code: d.code,
          name: d.name,
          parentProvinceCode: p.code,
        });
      }
    }
  }

  const keyDistricts = [
    { code: 769, expectedParentCode: 79, popular: true }, // TP. Thủ Đức -> TP.HCM (79)
    { code: 672, expectedParentCode: 68, popular: true }, // TP. Đà Lạt -> Lâm Đồng (68)
    { code: 568, expectedParentCode: 56, popular: true }, // TP. Nha Trang -> Khánh Hòa (56)
    { code: 747, expectedParentCode: 77, popular: true }, // TP. Vũng Tàu -> Bà Rịa - Vũng Tàu (77)
    { code: 593, expectedParentCode: 60, popular: true }, // TP. Phan Thiết -> Bình Thuận (60)
    { code: 718, expectedParentCode: 74, popular: true }, // TP. Thủ Dầu Một -> Bình Dương (74)
    { code: 540, expectedParentCode: 52, popular: true }, // TP. Quy Nhơn -> Bình Định (52)
    { code: 643, expectedParentCode: 66, popular: true }, // TP. Buôn Ma Thuột -> Đắk Lắk (66)
  ];

  console.log(`Đang nạp ${keyDistricts.length} quận/huyện/thị xã (có liên kết diaDiemChaId)...`);
  for (const item of keyDistricts) {
    const foundDist = allDistrictsMap.get(item.code);
    if (!foundDist) {
      throw new Error(`LỖI SEED: Không tìm thấy quận/huyện code=${item.code} trong docs/features/tinh_thanh/provinces-v1.json`);
    }
    if (foundDist.parentProvinceCode !== item.expectedParentCode) {
      throw new Error(`LỖI SEED: Quận/huyện code=${item.code} (${foundDist.name}) thuộc tỉnh code=${foundDist.parentProvinceCode}, không khớp với tỉnh cha mong đợi ${item.expectedParentCode}`);
    }

    const diaDiemChaId = oldMap.get(item.expectedParentCode);
    if (!diaDiemChaId) {
      throw new Error(`LỖI SEED: Không tìm thấy diaDiemId của tỉnh cha code=${item.expectedParentCode} trong DanhMucDiaDiem`);
    }

    await prisma.danhMucDiaDiem.upsert({
      where: {
        code_laDiaDanhCu: {
          code: foundDist.code,
          laDiaDanhCu: true,
        },
      },
      update: {
        tenDiaDiem: foundDist.name,
        tenKhongDau: removeVietnameseTones(foundDist.name),
        capDiaDiem: 'QUAN_HUYEN',
        diaDiemChaId,
        chuThichSapNhap: null,
      },
      create: {
        maDiaDiem: `VN-D1-${foundDist.code}`,
        code: foundDist.code,
        tenDiaDiem: foundDist.name,
        tenKhongDau: removeVietnameseTones(foundDist.name),
        capDiaDiem: 'QUAN_HUYEN',
        laDiaDanhCu: true,
        diaDiemChaId,
        chuThichSapNhap: null,
        noiBat: item.popular,
        thuTuHienThi: item.popular ? 5 : 0,
      },
    });
  }

  // 4. Seed BangSapNhapDiaDiem (mapping cũ ↔ mới)
  console.log('Đang tạo mapping BangSapNhapDiaDiem (dùng diaDiemId nội bộ)...');

  let mapCount = 0;
  for (const cluster of clusters) {
    const diaDiemMoiId = newMap.get(cluster.newProvinceCode);
    if (!diaDiemMoiId) {
      console.warn(`Không tìm thấy tỉnh mới code=${cluster.newProvinceCode}`);
      continue;
    }
    for (const oldCode of cluster.oldProvinceCodes) {
      const diaDiemCuId = oldMap.get(oldCode);
      if (!diaDiemCuId) {
        console.warn(`Không tìm thấy tỉnh cũ code=${oldCode}`);
        continue;
      }
      await prisma.bangSapNhapDiaDiem.upsert({
        where: {
          diaDiemCuId,
        },
        update: {
          diaDiemMoiId,
        },
        create: {
          diaDiemMoiId,
          diaDiemCuId,
        },
      });
      mapCount++;
    }
  }
  console.log(`Đã nạp ${mapCount} liên kết ánh xạ sáp nhập.`);

  // 5. Seed Bến bãi / Điểm đón trả thuộc Nhà xe (DiemDonTra)
  const nhaXes = await prisma.nhaXe.findMany({ take: 3, orderBy: { nhaXeId: 'asc' } });
  if (nhaXes.length === 0) {
    console.warn('CẢNH BÁO: Không tìm thấy bất kỳ nhà xe (NhaXe) nào trong cơ sở dữ liệu để tạo DiemDonTra mẫu!');
  } else {
    const futa = nhaXes.find(nx => nx.maNhaXe === 'FUTA') ?? nhaXes[0];
    const hm = nhaXes.find(nx => nx.maNhaXe === 'HM') ?? futa;
    const tb = nhaXes.find(nx => nx.maNhaXe === 'TB') ?? futa;

    // Helper: Tự suy ra diaDiemMoiId từ diaDiemCuId thông qua BangSapNhapDiaDiem
    async function getNewLocationId(diaDiemCuId) {
      const record = await prisma.bangSapNhapDiaDiem.findFirst({
        where: { diaDiemCuId },
      });
      return record ? record.diaDiemMoiId : null;
    }

    const tphcmCuId = oldMap.get(79); // TPHCM cũ
    const vungTauCuId = oldMap.get(77); // Bà Rịa - Vũng Tàu cũ
    const lamDongCuId = oldMap.get(68); // Lâm Đồng cũ
    const haNoiCuId = oldMap.get(1); // Hà Nội cũ
    const binhDuongCuId = oldMap.get(74); // Bình Dương cũ
    const binhThuanCuId = oldMap.get(60); // Bình Thuận cũ (Phan Thiết)
    const dakNongCuId = oldMap.get(67); // Đắk Nông cũ

    const sampleStations = [
      {
        maDiem: 'BX-MD-MOI',
        tenDiem: 'Bến xe Miền Đông mới',
        loaiDiem: 'BEN_XE',
        diaChi: '501 Hoàng Hữu Nam, Phường Long Bình, TP. Thủ Đức, TP. Hồ Chí Minh',
        diaDiemCuId: tphcmCuId,
        viDo: 10.8756,
        kinhDo: 106.8222,
        soDienThoai: '19006067',
        nhaXeId: futa.nhaXeId,
      },
      {
        maDiem: 'BX-MT',
        tenDiem: 'Bến xe Miền Tây',
        loaiDiem: 'BEN_XE',
        diaChi: '395 Kinh Dương Vương, Phường An Lạc, Quận Bình Tân, TP. Hồ Chí Minh',
        diaDiemCuId: tphcmCuId,
        viDo: 10.7412,
        kinhDo: 106.6186,
        soDienThoai: '19006067',
        nhaXeId: futa.nhaXeId,
      },
      {
        maDiem: 'BX-VT',
        tenDiem: 'Bến xe Vũng Tàu',
        loaiDiem: 'BEN_XE',
        diaChi: '192 Nam Kỳ Khởi Nghĩa, Phường 3, TP. Vũng Tàu, Bà Rịa - Vũng Tàu',
        diaDiemCuId: vungTauCuId,
        viDo: 10.3541,
        kinhDo: 107.0852,
        soDienThoai: '19006067',
        nhaXeId: hm.nhaXeId,
      },
      {
        maDiem: 'BX-DL',
        tenDiem: 'Bến xe Liên tỉnh Đà Lạt',
        loaiDiem: 'BEN_XE',
        diaChi: '01 Tô Hiến Thành, Phường 3, TP. Đà Lạt, Lâm Đồng',
        diaDiemCuId: lamDongCuId,
        viDo: 11.9328,
        kinhDo: 108.4419,
        soDienThoai: '19006067',
        nhaXeId: tb.nhaXeId,
      },
      {
        maDiem: 'BX-GP',
        tenDiem: 'Bến xe Giáp Bát',
        loaiDiem: 'BEN_XE',
        diaChi: 'Km 6 Đường Giải Phóng, Giáp Bát, Hoàng Mai, Hà Nội',
        diaDiemCuId: haNoiCuId,
        viDo: 20.9818,
        kinhDo: 105.8415,
        soDienThoai: '19006067',
        nhaXeId: futa.nhaXeId,
      },
      {
        maDiem: 'BX-BD',
        tenDiem: 'Bến xe Bình Dương (Thủ Dầu Một)',
        loaiDiem: 'BEN_XE',
        diaChi: 'Đường 30/4, Phường Phú Hòa, TP. Thủ Dầu Một, Bình Dương',
        diaDiemCuId: binhDuongCuId,
        viDo: 10.9752,
        kinhDo: 106.6713,
        soDienThoai: '19006067',
        nhaXeId: futa.nhaXeId,
      },
      {
        maDiem: 'BX-PT',
        tenDiem: 'Bến xe Phan Thiết',
        loaiDiem: 'BEN_XE',
        diaChi: '01 Từ Văn Tư, Phường Phú Trinh, TP. Phan Thiết, Bình Thuận',
        diaDiemCuId: binhThuanCuId,
        viDo: 10.9321,
        kinhDo: 108.0988,
        soDienThoai: '19006067',
        nhaXeId: hm.nhaXeId,
      },
      {
        maDiem: 'BX-GN',
        tenDiem: 'Bến xe Gia Nghĩa (Đắk Nông)',
        loaiDiem: 'BEN_XE',
        diaChi: 'Phường Nghĩa Thành, TP. Gia Nghĩa, Đắk Nông',
        diaDiemCuId: dakNongCuId,
        viDo: 12.0025,
        kinhDo: 107.6912,
        soDienThoai: '19006067',
        nhaXeId: tb.nhaXeId,
      },
      {
        maDiem: 'VP-Q1',
        tenDiem: 'Văn phòng Đề Thám (Quận 1)',
        loaiDiem: 'VAN_PHONG',
        diaChi: '272 Đề Thám, Phường Phạm Ngũ Lão, Quận 1, TP. Hồ Chí Minh',
        diaDiemCuId: tphcmCuId,
        viDo: 10.7682,
        kinhDo: 106.6934,
        soDienThoai: '02838386852',
        nhaXeId: futa.nhaXeId,
      },
    ];

    console.log('Đang nạp bến bãi & văn phòng (tự động suy ra diaDiemMoiId từ BangSapNhapDiaDiem)...');
    for (const station of sampleStations) {
      if (!station.diaDiemCuId) continue;
      const diaDiemMoiId = await getNewLocationId(station.diaDiemCuId);
      if (!diaDiemMoiId) {
        console.warn(`Không thể suy ra diaDiemMoiId cho diaDiemCuId=${station.diaDiemCuId}`);
        continue;
      }

      await prisma.diemDonTra.upsert({
        where: {
          nhaXeId_maDiem: {
            nhaXeId: station.nhaXeId,
            maDiem: station.maDiem,
          },
        },
        update: {
          tenDiem: station.tenDiem,
          loaiDiem: station.loaiDiem,
          diaChi: station.diaChi,
          diaDiemCuId: station.diaDiemCuId,
          diaDiemMoiId,
          viDo: station.viDo,
          kinhDo: station.kinhDo,
          soDienThoai: station.soDienThoai,
        },
        create: {
          maDiem: station.maDiem,
          tenDiem: station.tenDiem,
          loaiDiem: station.loaiDiem,
          diaChi: station.diaChi,
          diaDiemCuId: station.diaDiemCuId,
          diaDiemMoiId,
          viDo: station.viDo,
          kinhDo: station.kinhDo,
          soDienThoai: station.soDienThoai,
          nhaXeId: station.nhaXeId,
        },
      });
    }
    console.log('Đã nạp xong các bến bãi & văn phòng mẫu.');
  }

  console.log('--- Hoàn tất seed dữ liệu Master Data địa điểm & bến bãi! ---');
}

main()
  .catch((e) => {
    console.error('Lỗi seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
