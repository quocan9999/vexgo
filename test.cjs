const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const chuyenXes = await prisma.chuyenXe.findMany({
      where: { trangThai: 'CHUA_KHOI_HANH' },
      include: {
        tuyenXe: { include: { nhaXe: true } },
        xe: { include: { loaiXe: true } },
        gheChuyenXes: { where: { trangThai: 'TRONG' } },
      },
    });

    console.log('ChuyenXes:', chuyenXes.length);
    if (chuyenXes.length > 0) {
      console.log('First:', JSON.stringify(chuyenXes[0], null, 2));
    }
  } catch (err) {
    console.error('ERROR:', err);
  }
}

main().finally(() => prisma.$disconnect());
