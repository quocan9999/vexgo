import pkg from '@prisma/client';
const { PrismaClient } = pkg;
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.chuyenXe.count();
  console.log('ChuyenXe count:', count);
  
  if (count > 0) {
    const first = await prisma.chuyenXe.findFirst();
    console.log('First:', first);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
