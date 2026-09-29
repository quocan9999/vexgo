const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const all = await prisma.chuyenXe.findMany();
  console.log("Total ChuyenXe:", all.length);
  if (all.length > 0) {
      console.log("Statuses in DB:", Array.from(new Set(all.map(c => c.trangThai))));
  }
}
main().finally(() => prisma.$disconnect());
