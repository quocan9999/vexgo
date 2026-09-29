import { PrismaClient } from './node_modules/@prisma/client/index.js';
const prisma = new PrismaClient();
async function main() {
  const chuyenXes = await prisma.chuyenXe.findMany({
    include: {
      tuyenXe: { include: { nhaXe: true } },
      xe: { include: { loaiXe: true } },
      gheChuyenXes: { where: { trangThai: 'TRONG' } },
    },
  });
  console.log('Trips count:', chuyenXes.length);
  for (const cx of chuyenXes) {
      const b = cx.tuyenXe.nhaXe.nhaXeId;
  }
  console.log('Done!');
}
main().catch(console.error).finally(() => prisma.$disconnect());
