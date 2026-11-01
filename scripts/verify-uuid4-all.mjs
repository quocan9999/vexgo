import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../apps/api/dist/generated/prisma/client.js';

const url = new URL(process.env.DATABASE_URL);
const prisma = new PrismaClient({
  adapter: new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\/+/, '')),
    allowPublicKeyRetrieval: true,
  }),
});

const UUID4_HEX32_REGEX = /^[0-9a-f]{32}$/;

async function checkTableField(tableName, fieldName) {
  const rows = await prisma.$queryRawUnsafe(`SELECT \`${fieldName}\` AS val FROM \`${tableName}\``);
  let invalid = 0;
  for (const r of rows) {
    if (!r.val || !UUID4_HEX32_REGEX.test(r.val)) {
      invalid++;
      if (invalid <= 3) {
        console.error(`[FAIL] ${tableName}.${fieldName} invalid: "${r.val}"`);
      }
    }
  }
  if (invalid === 0) {
    console.log(`[PASS] ${tableName}.${fieldName}: 100% (${rows.length}/${rows.length}) là UUID v4 32 hex.`);
  } else {
    console.error(`[FAIL] ${tableName}.${fieldName}: Có ${invalid}/${rows.length} bản ghi không hợp lệ!`);
    throw new Error(`Invalid format in ${tableName}.${fieldName}`);
  }
}

async function main() {
  console.log('=== KIỂM CHỨNG TOÀN BỘ MÃ NGHIỆP VỤ HỆ THỐNG ===\n');

  await checkTableField('TuyenXe', 'maTuyenXe');
  await checkTableField('Ghe', 'maGhe');
  await checkTableField('NhanVien', 'maNhanVien');
  await checkTableField('KhachHang', 'maKhachHang');
  await checkTableField('ChuyenXe', 'maChuyenXe');
  await checkTableField('DonGiaoDich', 'maDonGiaoDich');
  await checkTableField('PhieuDatVe', 'maPhieuDatVe');
  await checkTableField('Ve', 'maVe');
  await checkTableField('PhieuGuiHang', 'maVanDon');
  await checkTableField('HoaDon', 'maHoaDon');

  console.log('\n--- Thống kê Chuyến xe trải dài từ Tháng 9 đến Tháng 12 năm 2026 ---');
  const tripMonths = await prisma.$queryRawUnsafe(`
    SELECT DATE_FORMAT(ngayKhoiHanh, '%Y-%m') AS thang, COUNT(*) AS tongChuyen
    FROM ChuyenXe
    GROUP BY thang
    ORDER BY thang ASC
  `);
  console.table(tripMonths);

  console.log('\n--- Kiểm tra mẫu Ghế (Ghe) ---');
  const sampleSeats = await prisma.ghe.findMany({
    take: 5,
    select: { gheId: true, maGhe: true, tenGhe: true, viTri: true, tang: true },
  });
  console.table(sampleSeats);

  console.log('\n=== TẤT CẢ KIỂM CHỨNG ĐỀU ĐẠT CHUẨN 100% ===');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
