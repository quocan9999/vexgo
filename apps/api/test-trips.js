import { PrismaClient } from './src/generated/prisma/index.js';

const prisma = new PrismaClient();

async function test() {
  const where = { trangThai: 'CHUA_KHOI_HANH' };
  
  try {
    const chuyenXes = await prisma.chuyenXe.findMany({
      where,
      include: {
        tuyenXe: { include: { nhaXe: true } },
        xe: { include: { loaiXe: true } },
        gheChuyenXes: { where: { trangThai: 'TRONG' } },
      },
    });
    
    console.log(`Found ${chuyenXes.length} trips`);
  } catch (err) {
    console.error("Prisma error:", err);
  }
}

test().finally(() => prisma.$disconnect());
