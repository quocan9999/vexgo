import { PrismaClient } from './src/generated/prisma/client.js';
const prisma = new PrismaClient();
async function main() {
  const accounts = await prisma.taiKhoan.findMany({ take: 5 });
  console.log(accounts.map(a => ({ id: a.taiKhoanId, phone: a.soDienThoai, pass: a.matKhau, status: a.trangThai })));
}
main().catch(console.error).finally(() => prisma.$disconnect());
