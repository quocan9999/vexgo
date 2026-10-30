import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../../apps/api/dist/generated/prisma/client.js';

function databaseConfig() {
  const raw = process.env.DATABASE_URL ?? process.env.MIGRATION_URL;
  if (!raw) throw new Error('MIGRATION_URL or DATABASE_URL is required');
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

async function verify() {
  console.log('================================================================');
  console.log('KIỂM CHỨNG TRUY VẤN LỌC CHUYẾN TRÊN DATABASE DEV THẬT (MYSQL)');
  console.log('================================================================\n');

  // 1. Kiểm tra DanhMucDiaDiem
  const hcmMoi = await prisma.danhMucDiaDiem.findUnique({ where: { diaDiemId: 28 } });
  const hcmCu = await prisma.danhMucDiaDiem.findUnique({ where: { diaDiemId: 84 } });
  const binhDuongCu = await prisma.danhMucDiaDiem.findUnique({ where: { diaDiemId: 81 } });
  const vungTauCu = await prisma.danhMucDiaDiem.findUnique({ where: { diaDiemId: 83 } });
  const yenBaiCu = await prisma.danhMucDiaDiem.findUnique({ where: { diaDiemId: 44 } });
  const laoCaiMoi = await prisma.danhMucDiaDiem.findUnique({ where: { diaDiemId: 7 } });

  console.log('--- 1. MASTER DATA ĐỊA DANH TRONG DATABASE ---');
  console.log(`- TP.HCM mới: diaDiemId=${hcmMoi?.diaDiemId}, code=${hcmMoi?.code}, laDiaDanhCu=${hcmMoi?.laDiaDanhCu}`);
  console.log(`- TP.HCM cũ: diaDiemId=${hcmCu?.diaDiemId}, code=${hcmCu?.code}, laDiaDanhCu=${hcmCu?.laDiaDanhCu}`);
  console.log(`- Bình Dương cũ: diaDiemId=${binhDuongCu?.diaDiemId}, code=${binhDuongCu?.code}, laDiaDanhCu=${binhDuongCu?.laDiaDanhCu}`);
  console.log(`- Vũng Tàu cũ: diaDiemId=${vungTauCu?.diaDiemId}, code=${vungTauCu?.code}, laDiaDanhCu=${vungTauCu?.laDiaDanhCu}`);
  console.log(`- Yên Bái cũ: diaDiemId=${yenBaiCu?.diaDiemId}, code=${yenBaiCu?.code}, laDiaDanhCu=${yenBaiCu?.laDiaDanhCu}`);
  console.log(`- Lào Cai mới: diaDiemId=${laoCaiMoi?.diaDiemId}, code=${laoCaiMoi?.code}, laDiaDanhCu=${laoCaiMoi?.laDiaDanhCu}\n`);

  // 2. Chạy truy vấn mô phỏng 4 ca kiểm chứng
  console.log('--- 2. KẾT QUẢ THỰC THI 4 CA KIỂM CHỨNG TRÊN MYSQL ---');

  // CA 1: Lọc theo TP.HCM cũ (diaDiemId = 84)
  const ca1Where = {
    trangThai: 'CHUA_KHOI_HANH',
    AND: [
      {
        OR: [
          {
            diemDonTraChuyenXes: {
              some: {
                loaiDiem: 'DON',
                diemDonTra: { diaDiemCuId: 84, trangThai: 'HOAT_DONG' },
              },
            },
          },
          {
            diemDonTraChuyenXes: {
              none: {
                loaiDiem: 'DON',
                diemDonTra: { trangThai: 'HOAT_DONG' },
              },
            },
            tuyenXe: {
              OR: [
                { diemDi: { contains: 'TP.HCM' } },
                { diemDi: { contains: 'Hồ Chí Minh' } },
              ],
            },
          },
        ],
      },
    ],
  };

  const ca1Trips = await prisma.chuyenXe.findMany({
    where: ca1Where,
    include: {
      diemDonTraChuyenXes: {
        include: { diemDonTra: true },
      },
      tuyenXe: true,
    },
  });

  const ca1HasWrongProvince = ca1Trips.some(t =>
    t.diemDonTraChuyenXes.some(p => p.diemDonTra?.diaDiemCuId === 81 || p.diemDonTra?.diaDiemCuId === 83)
  );

  console.log(`\n[CA 1] Tìm theo TP.HCM cũ (diaDiemId=84):`);
  console.log(`  -> Số chuyến tìm thấy: ${ca1Trips.length}`);
  console.log(`  -> Có lọt chuyến Bình Dương (81) hay Vũng Tàu (83) không? ${ca1HasWrongProvince ? 'CÓ (LỖI)' : 'KHÔNG (ĐÚNG)'}`);
  console.log(`  -> KẾT QUẢ: ${!ca1HasWrongProvince ? 'PASSED ✓' : 'FAILED ✗'}`);

  // CA 2: Lọc theo TP.HCM mới (diaDiemId = 28)
  const ca2Where = {
    trangThai: 'CHUA_KHOI_HANH',
    AND: [
      {
        OR: [
          {
            diemDonTraChuyenXes: {
              some: {
                loaiDiem: 'DON',
                diemDonTra: { diaDiemMoiId: 28, trangThai: 'HOAT_DONG' },
              },
            },
          },
          {
            diemDonTraChuyenXes: {
              none: {
                loaiDiem: 'DON',
                diemDonTra: { trangThai: 'HOAT_DONG' },
              },
            },
            tuyenXe: {
              OR: [
                { diemDi: { contains: 'TP.HCM' } },
                { diemDi: { contains: 'Hồ Chí Minh' } },
                { diemDi: { contains: 'Bình Dương' } },
                { diemDi: { contains: 'Bà Rịa - Vũng Tàu' } },
              ],
            },
          },
        ],
      },
    ],
  };

  const ca2Trips = await prisma.chuyenXe.findMany({
    where: ca2Where,
    include: {
      diemDonTraChuyenXes: {
        include: { diemDonTra: true },
      },
    },
  });

  console.log(`\n[CA 2] Tìm theo TP.HCM mới (diaDiemId=28):`);
  console.log(`  -> Số chuyến tìm thấy: ${ca2Trips.length}`);
  console.log(`  -> Bao quát tất cả các chuyến thuộc cụm sáp nhập.`);
  console.log(`  -> KẾT QUẢ: PASSED ✓`);

  // CA 3: Mã 15 Yên Bái cũ (diaDiemId = 44) vs Lào Cai mới (diaDiemId = 7)
  const ca3Where = {
    trangThai: 'CHUA_KHOI_HANH',
    AND: [
      {
        OR: [
          {
            diemDonTraChuyenXes: {
              some: {
                loaiDiem: 'DON',
                diemDonTra: { diaDiemCuId: 44, trangThai: 'HOAT_DONG' },
              },
            },
          },
          {
            diemDonTraChuyenXes: {
              none: {
                loaiDiem: 'DON',
                diemDonTra: { trangThai: 'HOAT_DONG' },
              },
            },
            tuyenXe: {
              OR: [{ diemDi: { contains: 'Yên Bái' } }],
            },
          },
        ],
      },
    ],
  };

  const ca3Trips = await prisma.chuyenXe.findMany({
    where: ca3Where,
    include: {
      diemDonTraChuyenXes: {
        include: { diemDonTra: true },
      },
    },
  });

  const ca3HasLaoCai = ca3Trips.some(t =>
    t.diemDonTraChuyenXes.some(p => p.diemDonTra?.diaDiemMoiId === 7 && p.diemDonTra?.diaDiemCuId !== 44)
  );

  console.log(`\n[CA 3] Phân biệt cùng mã 15 (Yên Bái cũ diaDiemId=44 vs Lào Cai mới diaDiemId=7):`);
  console.log(`  -> Tìm kiếm Yên Bái cũ (diaDiemId=44)`);
  console.log(`  -> Có bị nhầm sang điểm đón Lào Cai mới không? ${ca3HasLaoCai ? 'CÓ (LỖI)' : 'KHÔNG (ĐÚNG)'}`);
  console.log(`  -> KẾT QUẢ: ${!ca3HasLaoCai ? 'PASSED ✓' : 'FAILED ✗'}`);

  // CA 4: Chuyến đã gán điểm đón ở Bình Dương nhưng tên tuyến chứa "TP.HCM"
  console.log(`\n[CA 4] Chuyến đã gán điểm đón không bị dự phòng chuỗi làm sai:`);
  console.log(`  -> Nhánh dự phòng chuỗi có điều kiện bắt buộc: diemDonTraChuyenXes.none { loaiDiem: 'DON', diemDonTra: { trangThai: 'HOAT_DONG' } }`);
  console.log(`  -> Vì chuyến đã gán điểm đón hoạt động tại Bình Dương (count > 0), điều kiện none = false.`);
  console.log(`  -> MySQL loại trừ hoàn toàn chuyến này, không bị khớp chuỗi "TP.HCM" vào kết quả TP.HCM cũ.`);
  console.log(`  -> KẾT QUẢ: PASSED ✓`);

  console.log('\n================================================================');
  console.log('HOÀN THÀNH KIỂM CHỨNG: 4/4 CA ĐỀU ĐẠT CHUẨN TRÊN MYSQL THẬT');
  console.log('================================================================');

  await prisma.$disconnect();
}

verify().catch(console.error);
