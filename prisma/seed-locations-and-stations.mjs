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
        noiBat: popularNewCodes.has(p2.code),
        thuTuHienThi: popularNewCodes.has(p2.code) ? 10 : 0,
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
        noiBat: popularOldCodes.has(p1.code),
        thuTuHienThi: popularOldCodes.has(p1.code) ? 10 : 0,
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

  // 3. Seed các Quận/Huyện/TP trực thuộc nổi bật của hệ cũ
  const keyDistricts = [
    { code: 769, name: 'Thành phố Thủ Đức', provinceCode: 79, popular: true },
    { code: 672, name: 'Thành phố Đà Lạt', provinceCode: 68, popular: true },
    { code: 568, name: 'Thành phố Nha Trang', provinceCode: 56, popular: true },
    { code: 747, name: 'Thành phố Vũng Tàu', provinceCode: 77, popular: true },
    { code: 593, name: 'Thành phố Phan Thiết', provinceCode: 60, popular: true },
    { code: 718, name: 'Thành phố Thủ Dầu Một', provinceCode: 74, popular: true },
    { code: 540, name: 'Thành phố Quy Nhơn', provinceCode: 52, popular: true },
    { code: 643, name: 'Thành phố Buôn Ma Thuột', provinceCode: 66, popular: true },
  ];
  for (const dist of keyDistricts) {
    await prisma.danhMucDiaDiem.upsert({
      where: {
        code_laDiaDanhCu: {
          code: dist.code,
          laDiaDanhCu: true,
        },
      },
      update: {
        tenDiaDiem: dist.name,
        tenKhongDau: removeVietnameseTones(dist.name),
        capDiaDiem: 'QUAN_HUYEN',
        chuThichSapNhap: null,
        noiBat: dist.popular,
        thuTuHienThi: dist.popular ? 5 : 0,
      },
      create: {
        maDiaDiem: `VN-D1-${dist.code}`,
        code: dist.code,
        tenDiaDiem: dist.name,
        tenKhongDau: removeVietnameseTones(dist.name),
        capDiaDiem: 'QUAN_HUYEN',
        laDiaDanhCu: true,
        chuThichSapNhap: null,
        noiBat: dist.popular,
        thuTuHienThi: dist.popular ? 5 : 0,
      },
    });
  }

  // 4. Seed BangSapNhapDiaDiem (mapping cũ ↔ mới)
  console.log('Đang tạo mapping BangSapNhapDiaDiem (dùng diaDiemId nội bộ)...');
  const allLocations = await prisma.danhMucDiaDiem.findMany();
  const newMap = new Map(); // code -> diaDiemId (laDiaDanhCu = false)
  const oldMap = new Map(); // code -> diaDiemId (laDiaDanhCu = true)
  for (const loc of allLocations) {
    if (loc.laDiaDanhCu) {
      oldMap.set(loc.code, loc.diaDiemId);
    } else {
      newMap.set(loc.code, loc.diaDiemId);
    }
  }

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
          diaDiemMoiId_diaDiemCuId: {
            diaDiemMoiId,
            diaDiemCuId,
          },
        },
        update: {},
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
  const nhaXes = await prisma.nhaXe.findMany({ take: 3 });
  if (nhaXes.length > 0) {
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
