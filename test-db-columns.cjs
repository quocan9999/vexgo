const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const columns = await prisma.$queryRaw`SHOW COLUMNS FROM ChuyenXe;`;
    console.log(columns);
}
main().finally(() => prisma.$disconnect());
