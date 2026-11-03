import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../apps/api/dist/generated/prisma/client.js';

function databaseConfig() {
  const raw = process.env.DATABASE_URL ?? process.env.MIGRATION_URL;
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
  console.log('\n======================================================');
  console.log('   XÁC MINH DỮ LIỆU ĐÃ SEED VÀO DATABASE THÀNH CÔNG');
  console.log('======================================================\n');
  const pointsCount = await prisma.diemGiaoNhanHang.count();
  const linkedPointsCount = await prisma.diemGiaoNhanTuyenXe.count();
  const ratesCount = await prisma.bangCuocGuiHang.count();
  const totalTrips = await prisma.chuyenXe.count();

  console.log(`✓ Tổng số bưu cục thật (DiemGiaoNhanHang): ${pointsCount}`);
  console.log(`✓ Tổng số liên kết tuyến - bưu cục (DiemGiaoNhanTuyenXe): ${linkedPointsCount}`);
  console.log(`✓ Tổng số bản ghi bảng cước (BangCuocGuiHang): ${ratesCount}`);
  console.log(`✓ Tổng số chuyến xe toàn hệ thống: ${totalTrips}`);

  // Kiểm tra chuyến xe từ 03/11 đến 11/11
  const start = new Date(Date.UTC(2026, 10, 3));
  const end = new Date(Date.UTC(2026, 10, 11));
  const tripsInRange = await prisma.chuyenXe.findMany({
    where: {
      ngayKhoiHanh: { gte: start, lte: end },
      nhanGuiHang: true,
    },
    select: {
      chuyenXeId: true,
      ngayKhoiHanh: true,
      tuyenXe: { select: { diemDi: true, diemDen: true } },
    },
  });
  console.log(`\n✓ Số chuyến xe nhận gửi hàng từ 03/11 đến 11/11: ${tripsInRange.length} chuyến`);

  const byDate = {};
  tripsInRange.forEach((t) => {
    const d = t.ngayKhoiHanh.toISOString().slice(0, 10);
    byDate[d] = (byDate[d] || 0) + 1;
  });
  console.log('  Phân bổ chuyến mỗi ngày (03/11 -> 11/11):', byDate);

  // Tuyến Sài Gòn -> Đà Lạt
  const sgDalatRoutes = await prisma.tuyenXe.findMany({
    where: {
      diemDi: { contains: 'Hồ Chí Minh' },
      diemDen: { contains: 'Lâm Đồng' },
      trangThai: 'HOAT_DONG',
    },
    include: {
      nhaXe: true,
      diemGiaoNhanTuyenXes: {
        include: { diemGiaoNhanHang: true },
      },
    },
  });
  console.log(`\n✓ Tuyến TP.HCM -> Lâm Đồng (Đà Lạt): có ${sgDalatRoutes.length} tuyến`);
  for (const r of sgDalatRoutes) {
    const gui = r.diemGiaoNhanTuyenXes.filter((p) => p.vaiTro === 'GUI_HANG' || p.vaiTro === 'CA_HAI');
    const nhan = r.diemGiaoNhanTuyenXes.filter((p) => p.vaiTro === 'NHAN_HANG' || p.vaiTro === 'CA_HAI');
    console.log(`  + Nhà xe ${r.nhaXe.tenNhaXe}: ${gui.length} điểm gửi, ${nhan.length} điểm nhận.`);
  }

  // Tuyến Sài Gòn -> Cần Thơ
  const sgCtRoutes = await prisma.tuyenXe.findMany({
    where: {
      diemDi: { contains: 'Hồ Chí Minh' },
      diemDen: { contains: 'Cần Thơ' },
      trangThai: 'HOAT_DONG',
    },
    include: {
      nhaXe: true,
      diemGiaoNhanTuyenXes: {
        include: { diemGiaoNhanHang: true },
      },
    },
  });
  console.log(`\n✓ Tuyến TP.HCM -> Cần Thơ: có ${sgCtRoutes.length} tuyến`);
  for (const r of sgCtRoutes) {
    const gui = r.diemGiaoNhanTuyenXes.filter((p) => p.vaiTro === 'GUI_HANG' || p.vaiTro === 'CA_HAI');
    const nhan = r.diemGiaoNhanTuyenXes.filter((p) => p.vaiTro === 'NHAN_HANG' || p.vaiTro === 'CA_HAI');
    console.log(`  + Nhà xe ${r.nhaXe.tenNhaXe}: ${gui.length} điểm gửi, ${nhan.length} điểm nhận.`);
  }

  // Tuyến Sài Gòn -> Bà Rịa - Vũng Tàu
  const sgVtRoutes = await prisma.tuyenXe.findMany({
    where: {
      diemDi: { contains: 'Hồ Chí Minh' },
      diemDen: { contains: 'Vũng Tàu' },
      trangThai: 'HOAT_DONG',
    },
    include: {
      nhaXe: true,
      diemGiaoNhanTuyenXes: {
        include: { diemGiaoNhanHang: true },
      },
    },
  });
  console.log(`\n✓ Tuyến TP.HCM -> Bà Rịa - Vũng Tàu: có ${sgVtRoutes.length} tuyến`);
  for (const r of sgVtRoutes) {
    const gui = r.diemGiaoNhanTuyenXes.filter((p) => p.vaiTro === 'GUI_HANG' || p.vaiTro === 'CA_HAI');
    const nhan = r.diemGiaoNhanTuyenXes.filter((p) => p.vaiTro === 'NHAN_HANG' || p.vaiTro === 'CA_HAI');
    console.log(`  + Nhà xe ${r.nhaXe.tenNhaXe}: ${gui.length} điểm gửi, ${nhan.length} điểm nhận.`);
  }

  console.log('\n======================================================\n');
}

verify()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
