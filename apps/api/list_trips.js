const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const trips = await prisma.chuyenXe.findMany({
    include: { tuyenXe: true },
    take: 5
  });
  console.log(trips.map(t => ({
    id: t.chuyenXeId,
    ngayKhoiHanh: t.ngayKhoiHanh,
    diemDi: t.tuyenXe.diemDi,
    diemDen: t.tuyenXe.diemDen
  })));
}
main().catch(console.error).finally(() => prisma.$disconnect());
