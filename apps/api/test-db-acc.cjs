const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const accounts = await prisma.taiKhoan.findMany({ take: 5 });
  console.log(accounts.map(a => ({ id: a.taiKhoanId, phone: a.soDienThoai, pass: a.matKhau })));
}
main().catch(console.error).finally(() => prisma.$disconnect());
