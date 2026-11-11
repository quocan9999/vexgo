import { spawnSync } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const node = 'node';

function runStep(title, command, args) {
  const startTime = Date.now();
  console.log(`\n===============================================================`);
  console.log(`>>> [SEED PIPELINE] ${title}`);
  console.log(`===============================================================\n`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.error) {
    console.error(`\n❌ [LỖI THỰC THI]: ${title}`, result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`\n❌ [THẤT BẠI]: ${title} kết thúc với mã lỗi ${result.status}`);
    process.exit(result.status ?? 1);
  }
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✓ Hoàn tất: ${title} (${duration}s)\n`);
}

const pipelineStart = Date.now();
console.log(`\n===============================================================`);
console.log(`       🚀 BẮT ĐẦU CHUỖI SEED DỮ LIỆU TOÀN DIỆN VEXGO          `);
console.log(`===============================================================`);

// 0. Build API (Prisma Client & backend modules)
runStep('0. Build @vexgo/api', npm, ['run', 'build', '--workspace=@vexgo/api']);

// 1. Seed nền tảng (Nhà xe, vai trò, quyền, tài khoản, loại xe, xe, tuyến cơ bản, chuyến T9, chat, bưu cục cơ bản)
runStep('1. Dữ liệu nền tảng hệ thống (seed.mjs)', node, ['prisma/seed.mjs']);

// 2. Seed Danh mục 63 tỉnh thành & Bến xe mẫu
runStep('2. Danh mục 63 Tỉnh thành & Bến xe mẫu (seed-locations-and-stations.mjs)', node, ['prisma/seed-locations-and-stations.mjs']);

// 3. Seed bến bãi, văn phòng, bưu cục, điểm đón/trả thực tế từ crawler
runStep('3. Điểm đón/trả, văn phòng, bưu cục thực tế (seed-crawled-operator-data.mjs)', node, ['prisma/seed-crawled-operator-data.mjs', '--apply']);

// 4. Seed chuyến xe & ghế từ 12/11/2026 đến 31/12/2026
runStep('4. Chuyến xe & Ghế Tháng 11 & Tháng 12/2026 (seed-trips-nov-2026.mjs)', node, ['scripts/seed-trips-nov-2026.mjs']);

// 5. Seed chuyến xe Tháng 10 & Doanh thu/Giao dịch hoàn tất
runStep('5. Chuyến xe & Doanh thu Tháng 10/2026 (seed-october-revenue.mjs)', node, ['scripts/seed-october-revenue.mjs']);

// 6. Đồng bộ sơ đồ ghế thực tế cho 100% chuyến xe (FUTA, Thành Bưởi, Hoa Mai)
runStep('6. Đồng bộ sơ đồ ghế thực tế 100% chuyến xe (sync-all-trip-seats.mjs)', node, ['prisma/sync-all-trip-seats.mjs']);

// 7. Đồng bộ lộ trình điểm dừng tuần tự cho 100% tuyến xe & chuyến xe
runStep('7. Đồng bộ lộ trình điểm đón/trả theo giờ cho 100% tuyến & chuyến xe (sync-all-route-and-trip-stops.mjs)', node, ['prisma/sync-all-route-and-trip-stops.mjs']);

// 8. Tự động kiểm chứng toàn bộ 14 bảng nghiệp vụ
runStep('8. Kiểm chứng chuẩn UUID v4 toàn bộ 14 bảng dữ liệu (verify-uuid4-all.mjs)', node, ['scripts/verify-uuid4-all.mjs']);

const totalDuration = ((Date.now() - pipelineStart) / 1000).toFixed(1);
console.log(`\n===============================================================`);
console.log(`  🎉 TOÀN BỘ QUÁ TRÌNH SEED ĐÃ HOÀN TẤT THÀNH CÔNG 100% (${totalDuration}s)`);
console.log(`  Hệ thống đã sẵn sàng với đầy đủ dữ liệu từ Tháng 9 đến Tháng 12/2026!`);
console.log(`===============================================================\n`);
