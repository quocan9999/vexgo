import { PrismaClient } from './node_modules/@prisma/client/index.js';
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.taiKhoan.findMany({
    where: { hoTen: { contains: 'Bình' } },
    include: { taiKhoanVaiTros: { include: { vaiTro: true } }, khachHang: true, nhanVien: true }
  });
  console.log(JSON.stringify(users, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
