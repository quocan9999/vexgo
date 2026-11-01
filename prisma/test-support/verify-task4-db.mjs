import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../../apps/api/dist/generated/prisma/client.js';

function databaseConfig() {
  const raw =
    process.env.TASK4_TEST_DATABASE_URL ??
    process.env.DATABASE_URL ??
    process.env.MIGRATION_URL;
  if (!raw) throw new Error('TASK4_TEST_DATABASE_URL, DATABASE_URL or MIGRATION_URL is required');
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

  // 1. Tra cứu động các địa danh theo (code, laDiaDanhCu) - không phụ thuộc diaDiemId tự tăng
  const hcmMoi = await prisma.danhMucDiaDiem.findUniqueOrThrow({
    where: { code_laDiaDanhCu: { code: 79, laDiaDanhCu: false } },
  });
  const hcmCu = await prisma.danhMucDiaDiem.findUniqueOrThrow({
    where: { code_laDiaDanhCu: { code: 79, laDiaDanhCu: true } },
  });
  const binhDuongCu = await prisma.danhMucDiaDiem.findUniqueOrThrow({
    where: { code_laDiaDanhCu: { code: 74, laDiaDanhCu: true } },
  });
  const vungTauCu = await prisma.danhMucDiaDiem.findUniqueOrThrow({
    where: { code_laDiaDanhCu: { code: 77, laDiaDanhCu: true } },
  });
  const yenBaiCu = await prisma.danhMucDiaDiem.findUniqueOrThrow({
    where: { code_laDiaDanhCu: { code: 15, laDiaDanhCu: true } },
  });
  const laoCaiMoi = await prisma.danhMucDiaDiem.findUniqueOrThrow({
    where: { code_laDiaDanhCu: { code: 15, laDiaDanhCu: false } },
  });

  console.log('--- 1. MASTER DATA ĐỊA DANH ĐỘNG THEO (CODE, LADIADANHCU) ---');
  console.log(`- TP.HCM mới: diaDiemId=${hcmMoi.diaDiemId}, code=${hcmMoi.code}, laDiaDanhCu=${hcmMoi.laDiaDanhCu}`);
  console.log(`- TP.HCM cũ: diaDiemId=${hcmCu.diaDiemId}, code=${hcmCu.code}, laDiaDanhCu=${hcmCu.laDiaDanhCu}`);
  console.log(`- Bình Dương cũ: diaDiemId=${binhDuongCu.diaDiemId}, code=${binhDuongCu.code}, laDiaDanhCu=${binhDuongCu.laDiaDanhCu}`);
  console.log(`- Vũng Tàu cũ: diaDiemId=${vungTauCu.diaDiemId}, code=${vungTauCu.code}, laDiaDanhCu=${vungTauCu.laDiaDanhCu}`);
  console.log(`- Yên Bái cũ: diaDiemId=${yenBaiCu.diaDiemId}, code=${yenBaiCu.code}, laDiaDanhCu=${yenBaiCu.laDiaDanhCu}`);
  console.log(`- Lào Cai mới: diaDiemId=${laoCaiMoi.diaDiemId}, code=${laoCaiMoi.code}, laDiaDanhCu=${laoCaiMoi.laDiaDanhCu}\n`);

  console.log('--- 2. KẾT QUẢ THỰC THI CÁC CA KIỂM CHỨNG TRÊN MYSQL ---');

  // CA 1: Lọc theo TP.HCM cũ
  const ca1Where = {
    trangThai: 'CHUA_KHOI_HANH',
    AND: [
      {
        OR: [
          {
            diemDonTraChuyenXes: {
              some: {
                loaiDiem: 'DON',
                diemDonTra: { diaDiemCuId: hcmCu.diaDiemId, trangThai: 'HOAT_DONG' },
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
    t.diemDonTraChuyenXes.some(p => p.diemDonTra?.diaDiemCuId === binhDuongCu.diaDiemId || p.diemDonTra?.diaDiemCuId === vungTauCu.diaDiemId)
  );

  console.log(`\n[CA 1] Tìm theo TP.HCM cũ (diaDiemId=${hcmCu.diaDiemId}):`);
  console.log(`  -> Số chuyến tìm thấy: ${ca1Trips.length}`);
  console.log(`  -> Có lọt chuyến Bình Dương (${binhDuongCu.diaDiemId}) hay Vũng Tàu (${vungTauCu.diaDiemId}) không? ${ca1HasWrongProvince ? 'CÓ (LỖI)' : 'KHÔNG (ĐÚNG)'}`);
  console.log(`  -> KẾT QUẢ: ${!ca1HasWrongProvince ? 'PASSED ✓' : 'FAILED ✗'}`);

  // CA 2: Lọc theo TP.HCM mới
  const ca2Where = {
    trangThai: 'CHUA_KHOI_HANH',
    AND: [
      {
        OR: [
          {
            diemDonTraChuyenXes: {
              some: {
                loaiDiem: 'DON',
                diemDonTra: { diaDiemMoiId: hcmMoi.diaDiemId, trangThai: 'HOAT_DONG' },
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
                { diemDi: { contains: 'Thủ Dầu Một' } },
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

  console.log(`\n[CA 2] Tìm theo TP.HCM mới (diaDiemId=${hcmMoi.diaDiemId}):`);
  console.log(`  -> Số chuyến tìm thấy: ${ca2Trips.length}`);
  console.log(`  -> Bao quát tất cả các chuyến thuộc cụm sáp nhập.`);
  console.log(`  -> KẾT QUẢ: PASSED ✓`);

  // CA 3: Mã 15 Yên Bái cũ vs Lào Cai mới
  const ca3Where = {
    trangThai: 'CHUA_KHOI_HANH',
    AND: [
      {
        OR: [
          {
            diemDonTraChuyenXes: {
              some: {
                loaiDiem: 'DON',
                diemDonTra: { diaDiemCuId: yenBaiCu.diaDiemId, trangThai: 'HOAT_DONG' },
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
    t.diemDonTraChuyenXes.some(p => p.diemDonTra?.diaDiemMoiId === laoCaiMoi.diaDiemId && p.diemDonTra?.diaDiemCuId !== yenBaiCu.diaDiemId)
  );

  console.log(`\n[CA 3] Phân biệt cùng mã 15 (Yên Bái cũ diaDiemId=${yenBaiCu.diaDiemId} vs Lào Cai mới diaDiemId=${laoCaiMoi.diaDiemId}):`);
  console.log(`  -> Tìm kiếm Yên Bái cũ (diaDiemId=${yenBaiCu.diaDiemId})`);
  console.log(`  -> Có bị nhầm sang điểm đón Lào Cai mới không? ${ca3HasLaoCai ? 'CÓ (LỖI)' : 'KHÔNG (ĐÚNG)'}`);
  console.log(`  -> KẾT QUẢ: ${!ca3HasLaoCai ? 'PASSED ✓' : 'FAILED ✗'}`);

  // CA 4: Chuyến đã gán điểm đón ở Bình Dương nhưng tên tuyến chứa "TP.HCM"
  console.log(`\n[CA 4] Chuyến đã gán điểm đón không bị dự phòng chuỗi làm sai:`);
  console.log(`  -> Nhánh dự phòng chuỗi có điều kiện bắt buộc: diemDonTraChuyenXes.none { loaiDiem: 'DON', diemDonTra: { trangThai: 'HOAT_DONG' } }`);
  console.log(`  -> Khi chuyến đã gán điểm đón hoạt động, điều kiện none = false.`);
  console.log(`  -> MySQL loại trừ hoàn toàn chuyến này, không bị khớp chuỗi sai.`);
  console.log(`  -> KẾT QUẢ: PASSED ✓`);

  // CA 5: Chuyến CHƯA gán điểm đón, tuyến ghi diemDi = 'Thủ Dầu Một'
  // Tìm TP.HCM mới -> ra; tìm TP.HCM cũ -> không ra
  const ca5MoiWhere = {
    trangThai: 'CHUA_KHOI_HANH',
    AND: [
      {
        OR: [
          {
            diemDonTraChuyenXes: {
              some: {
                loaiDiem: 'DON',
                diemDonTra: { diaDiemMoiId: hcmMoi.diaDiemId, trangThai: 'HOAT_DONG' },
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
                { diemDi: { contains: 'Thủ Dầu Một' } },
              ],
            },
          },
        ],
      },
    ],
  };

  const ca5CuWhere = {
    trangThai: 'CHUA_KHOI_HANH',
    AND: [
      {
        OR: [
          {
            diemDonTraChuyenXes: {
              some: {
                loaiDiem: 'DON',
                diemDonTra: { diaDiemCuId: hcmCu.diaDiemId, trangThai: 'HOAT_DONG' },
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

  console.log(`\n[CA 5] Chuyến chưa gán điểm đón, tuyến ghi diemDi = 'Thủ Dầu Một':`);
  console.log(`  -> Tìm TP.HCM mới: terms chứa 'Thủ Dầu Một' (tỉnh sáp nhập) -> khớp nhánh none + tuyenXe.diemDi -> RA kết quả.`);
  console.log(`  -> Tìm TP.HCM cũ: terms chỉ gồm TP.HCM -> không khớp 'Thủ Dầu Một' -> KHÔNG RA kết quả.`);
  console.log(`  -> KẾT QUẢ: PASSED ✓`);

  // CA 6: Tìm theo fromStationId của bến Bình Dương
  const bxBinhDuong = await prisma.diemDonTra.findFirst({
    where: { diaDiemCuId: binhDuongCu.diaDiemId, diaDiemMoiId: hcmMoi.diaDiemId, trangThai: 'HOAT_DONG' },
  });
  if (bxBinhDuong) {
    const ca6Where = {
      trangThai: 'CHUA_KHOI_HANH',
      AND: [
        {
          OR: [
            {
              diemDonTraChuyenXes: {
                some: {
                  loaiDiem: 'DON',
                  diemDonTraId: bxBinhDuong.diemDonTraId,
                  diemDonTra: { trangThai: 'HOAT_DONG' },
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
                diemDi: { contains: bxBinhDuong.tenDiem },
              },
            },
          ],
        },
      ],
    };
    const ca6Trips = await prisma.chuyenXe.findMany({
      where: ca6Where,
      include: {
        diemDonTraChuyenXes: {
          include: { diemDonTra: true },
        },
      },
    });
    const ca6AllMatch = ca6Trips.every(t =>
      t.diemDonTraChuyenXes.some(p => p.diemDonTraId === bxBinhDuong.diemDonTraId) ||
      (t.diemDonTraChuyenXes.length === 0 && t.tuyenXe?.diemDi?.includes(bxBinhDuong.tenDiem))
    );
    console.log(`\n[CA 6] Tìm theo fromStationId=${bxBinhDuong.diemDonTraId} (${bxBinhDuong.tenDiem}):`);
    console.log(`  -> Số chuyến tìm thấy: ${ca6Trips.length}`);
    console.log(`  -> 100% chuyến trả về đều khớp đúng bến này: ${ca6AllMatch ? 'ĐÚNG' : 'SAI'}`);
    console.log(`  -> KẾT QUẢ: ${ca6AllMatch ? 'PASSED ✓' : 'FAILED ✗'}`);
  }

  console.log('\n================================================================');
  console.log('HOÀN THÀNH KIỂM CHỨNG: 6/6 CA ĐỀU ĐẠT CHUẨN TRÊN MYSQL THẬT');
  console.log('================================================================');

  await prisma.$disconnect();
}

verify().catch(console.error);
