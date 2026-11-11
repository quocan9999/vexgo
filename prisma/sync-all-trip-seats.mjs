import 'dotenv/config';
import crypto from 'node:crypto';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../apps/api/dist/generated/prisma/client.js';
import { getVehicleSeatLayout } from './lib/seat-layouts.mjs';
import { databaseConfig } from './lib/db-config.mjs';

function deterministicUuid(...parts) {
  const hash = crypto.createHash('md5').update(parts.map(String).join(':')).digest('hex');
  return `${hash.slice(0, 12)}4${hash.slice(13, 16)}a${hash.slice(17, 32)}`;
}

async function main() {
  console.log('\n===============================================================');
  console.log('  ĐỒNG BỘ SƠ ĐỒ GHẾ THỰC TẾ (FUTA, THÀNH BƯỞI, HOA MAI)');
  console.log('===============================================================\n');

  const prisma = new PrismaClient({ adapter: new PrismaMariaDb(databaseConfig()) });

  try {
    // 1. Lấy danh sách xe và nhà xe
    const vehicles = await prisma.xe.findMany({
      include: {
        nhaXe: true,
        loaiXe: true,
        ghes: {
          orderBy: { gheId: 'asc' },
        },
      },
    });

    console.log(`1. Đang chuẩn hóa sơ đồ ghế thực tế cho ${vehicles.length} xe theo layout...`);

    for (const vehicle of vehicles) {
      const opCode = vehicle.nhaXe.maNhaXe;
      const typeName = vehicle.loaiXe.tenLoai;
      const targetLayout = getVehicleSeatLayout(opCode, typeName, vehicle.ghes.length);

      // Bước 1a: Đổi tên tạm để tránh đụng Unique Constraint @@unique([xeId, tenGhe]) & @@unique([xeId, tang, toaDoX, toaDoY])
      for (let i = 0; i < vehicle.ghes.length; i++) {
        await prisma.ghe.update({
          where: { gheId: vehicle.ghes[i].gheId },
          data: {
            tenGhe: `TMP_${vehicle.ghes[i].gheId}`,
            toaDoX: null,
            toaDoY: null,
          },
        });
      }

      // Bước 1b: Cập nhật các ghế hiện có theo layout chuẩn
      const updateCount = Math.min(vehicle.ghes.length, targetLayout.length);
      for (let i = 0; i < updateCount; i++) {
        const spec = targetLayout[i];
        await prisma.ghe.update({
          where: { gheId: vehicle.ghes[i].gheId },
          data: {
            tenGhe: spec.tenGhe,
            viTri: spec.viTri,
            tang: spec.tang,
            toaDoX: spec.toaDoX,
            toaDoY: spec.toaDoY,
          },
        });
      }

      // Bước 1c: Tạo thêm ghế nếu targetLayout nhiều hơn số ghế hiện tại
      if (targetLayout.length > vehicle.ghes.length) {
        for (let i = vehicle.ghes.length; i < targetLayout.length; i++) {
          const spec = targetLayout[i];
          await prisma.ghe.create({
            data: {
              maGhe: deterministicUuid('GHE', vehicle.bienSoXe, spec.tenGhe),
              tenGhe: spec.tenGhe,
              viTri: spec.viTri,
              tang: spec.tang,
              toaDoX: spec.toaDoX,
              toaDoY: spec.toaDoY,
              xeId: vehicle.xeId,
            },
          });
        }
      }

      // Bước 1d: Xử lý ghế dư (nếu có) - Chuyển vé sang ghế chính và xóa sạch ghế thừa
      if (vehicle.ghes.length > targetLayout.length) {
        const primaryGheIds = vehicle.ghes.slice(0, targetLayout.length).map((g) => g.gheId);
        for (let i = targetLayout.length; i < vehicle.ghes.length; i++) {
          const extraGhe = vehicle.ghes[i];
          const tickets = await prisma.ve.findMany({
            where: { gheChuyenXe: { gheId: extraGhe.gheId } },
            include: { gheChuyenXe: true },
          });

          for (const ticket of tickets) {
            const tripId = ticket.gheChuyenXe.chuyenXeId;
            const replacementGheChuyenXe = await prisma.gheChuyenXe.findFirst({
              where: {
                chuyenXeId: tripId,
                gheId: { in: primaryGheIds },
                trangThai: 'TRONG',
              },
            });
            if (replacementGheChuyenXe) {
              await prisma.ve.update({
                where: { veId: ticket.veId },
                data: { gheChuyenXeId: replacementGheChuyenXe.gheChuyenXeId },
              });
              await prisma.gheChuyenXe.update({
                where: { gheChuyenXeId: replacementGheChuyenXe.gheChuyenXeId },
                data: { trangThai: ticket.gheChuyenXe.trangThai },
              });
            }
          }

          await prisma.gheChuyenXe.deleteMany({ where: { gheId: extraGhe.gheId } });
          await prisma.ghe.delete({ where: { gheId: extraGhe.gheId } });
        }
      }

      console.log(`   ✓ Xe ${vehicle.bienSoXe} (${opCode} - ${typeName}): Hoàn tất sơ đồ ${targetLayout.length} chỗ.`);
    }

    // 2. Đồng bộ tầng và tọa độ (tang, toaDoX, toaDoY) sang toàn bộ GheChuyenXe
    console.log('\n2. Đang đồng bộ tầng và tọa độ (tang, toaDoX, toaDoY) sang GheChuyenXe...');
    const syncResult = await prisma.$executeRawUnsafe(`
      UPDATE GheChuyenXe gc
      JOIN Ghe g ON gc.gheId = g.gheId
      SET gc.tang = g.tang,
          gc.toaDoX = g.toaDoX,
          gc.toaDoY = g.toaDoY;
    `);
    console.log(`   ✓ Đã cập nhật tọa độ cho ${syncResult} bản ghi GheChuyenXe.`);

    // 3. Bổ sung tất cả các ghế chuyến còn thiếu cho mọi chuyến xe theo đúng cấu hình xe
    console.log('\n3. Đang bổ sung ghế chuyến còn thiếu cho toàn bộ chuyến xe...');
    const insertedMissingSeats = await prisma.$executeRawUnsafe(`
      INSERT INTO GheChuyenXe (chuyenXeId, gheId, trangThai, tang, toaDoX, toaDoY)
      SELECT c.chuyenXeId, g.gheId, 'TRONG', g.tang, g.toaDoX, g.toaDoY
      FROM ChuyenXe c
      JOIN Ghe g ON c.xeId = g.xeId
      LEFT JOIN GheChuyenXe gc ON c.chuyenXeId = gc.chuyenXeId AND g.gheId = gc.gheId
      WHERE gc.gheChuyenXeId IS NULL;
    `);
    console.log(`   ✓ Đã bổ sung thành công ${insertedMissingSeats} ghế chuyến còn thiếu.`);

    // 4. Kiểm chứng cuối cùng
    const totalTrips = await prisma.chuyenXe.count();
    const tripsWithSeats = await prisma.chuyenXe.count({
      where: {
        gheChuyenXes: {
          some: {},
        },
      },
    });
    const missingSeatsCount = totalTrips - tripsWithSeats;
    const totalTripSeats = await prisma.gheChuyenXe.count();
    const seatsWithCoords = await prisma.gheChuyenXe.count({
      where: {
        toaDoX: { not: null },
        toaDoY: { not: null },
      },
    });

    const mismatchRows = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as mismatchCount
      FROM (
        SELECT c.chuyenXeId, COUNT(gc.gheChuyenXeId) as tripSeats, (SELECT COUNT(*) FROM Ghe g WHERE g.xeId = c.xeId) as vehicleSeats
        FROM ChuyenXe c
        LEFT JOIN GheChuyenXe gc ON c.chuyenXeId = gc.chuyenXeId
        GROUP BY c.chuyenXeId
        HAVING tripSeats < vehicleSeats
      ) as t;
    `);
    const mismatchCount = Number(mismatchRows[0]?.mismatchCount || 0);

    console.log('\n===============================================================');
    console.log('  KẾT QUẢ KIỂM CHỨNG TOÀN DIỆN SƠ ĐỒ GHẾ VEXGO:');
    console.log(`  - Tổng số chuyến xe: ${totalTrips}`);
    console.log(`  - Chuyến có sơ đồ ghế: ${tripsWithSeats} / ${totalTrips} (${((tripsWithSeats / totalTrips) * 100).toFixed(1)}%)`);
    console.log(`  - Chuyến thiếu sơ đồ ghế: ${missingSeatsCount}`);
    console.log(`  - Chuyến lệch số lượng ghế với xe: ${mismatchCount}`);
    console.log(`  - Tổng số ghế chuyến xe: ${totalTripSeats}`);
    console.log(`  - Ghế có đầy đủ tọa độ X, Y: ${seatsWithCoords} / ${totalTripSeats} (${((seatsWithCoords / totalTripSeats) * 100).toFixed(1)}%)`);
    console.log('===============================================================\n');

    if (missingSeatsCount > 0 || seatsWithCoords < totalTripSeats || mismatchCount > 0) {
      throw new Error(`Vẫn còn chuyến xe thiếu sơ đồ ghế hoặc ghế thiếu tọa độ! (Thiếu tọa độ: ${totalTripSeats - seatsWithCoords}, Chuyến lệch ghế: ${mismatchCount})`);
    }
    console.log('🎉 TẤT CẢ CHUYẾN XE ĐÃ CÓ ĐẦY ĐỦ SƠ ĐỒ GHẾ VÀ TỌA ĐỘ CHUẨN XÁC 100%!');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('❌ Lỗi khi đồng bộ sơ đồ ghế:', err);
  process.exit(1);
});
