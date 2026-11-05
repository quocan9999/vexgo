import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../../apps/api/dist/generated/prisma/client.js';

async function main() {
  const db = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL) });

  try {
    const configs = await db.cauHinhQuyenVaiTroNhaXe.findMany();
    console.log('Existing overrides count:', configs.length);

    const res1 = await db.$executeRawUnsafe(`
      INSERT IGNORE INTO \`CauHinhQuyenVaiTroNhaXeChiTiet\` (\`nhaXeId\`, \`vaiTroId\`, \`quyenId\`)
      SELECT \`config\`.\`nhaXeId\`, \`config\`.\`vaiTroId\`, \`permission\`.\`quyenId\`
      FROM \`CauHinhQuyenVaiTroNhaXe\` AS \`config\`
      JOIN \`VaiTro\` AS \`role\` ON \`role\`.\`vaiTroId\` = \`config\`.\`vaiTroId\`
      JOIN \`Quyen\` AS \`permission\` ON \`permission\`.\`tenQuyen\` IN ('review:read', 'review:moderate')
      WHERE \`role\`.\`tenVaiTro\` = 'NHA_XE_ADMIN';
    `);
    console.log('Inserted for NHA_XE_ADMIN:', res1);

    const res2 = await db.$executeRawUnsafe(`
      INSERT IGNORE INTO \`CauHinhQuyenVaiTroNhaXeChiTiet\` (\`nhaXeId\`, \`vaiTroId\`, \`quyenId\`)
      SELECT \`config\`.\`nhaXeId\`, \`config\`.\`vaiTroId\`, \`permission\`.\`quyenId\`
      FROM \`CauHinhQuyenVaiTroNhaXe\` AS \`config\`
      JOIN \`VaiTro\` AS \`role\` ON \`role\`.\`vaiTroId\` = \`config\`.\`vaiTroId\`
      JOIN \`Quyen\` AS \`permission\` ON \`permission\`.\`tenQuyen\` = 'review:read'
      WHERE \`role\`.\`tenVaiTro\` = 'NHAN_VIEN_CSKH';
    `);
    console.log('Inserted for NHAN_VIEN_CSKH:', res2);
  } finally {
    await db.$disconnect();
  }
}

main().catch(console.error);
