import 'dotenv/config';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../../apps/api/dist/generated/prisma/client.js';

// Pin the actual develop schema + complete seed reviewed for Feature 10.
const baseline = '0a2888f9e836fc40c6b5f057cce517802dd7d6fb';
const migration = '20261015184828_add_promotion_quota_usage_ledger';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const cli = path.join(root, 'node_modules/prisma/build/index.js');
const adminUrl = new URL(process.env.PROMOTION_UPGRADE_ADMIN_DATABASE_URL ?? 'invalid:');
assert(process.env.CI === 'true' && process.env.GITHUB_ACTIONS === 'true', 'Upgrade harness requires isolated GitHub Actions MySQL; never run against local shared databases.');
assert(adminUrl.protocol === 'mysql:' && adminUrl.hostname === '127.0.0.1' && adminUrl.port === '3306' && adminUrl.pathname === '/vexgo_ci' && adminUrl.username === 'root', 'Unexpected CI database target');
const database = `vexgo_promotion_upgrade_${randomBytes(8).toString('hex')}`;
assert(/^vexgo_promotion_upgrade_[a-f0-9]{16}$/.test(database));
const target = new URL(adminUrl); target.pathname = `/${database}`;
const config = (url) => ({ host: url.hostname, port: 3306, user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: url.pathname.slice(1), allowPublicKeyRetrieval: true });
const admin = new PrismaClient({ adapter: new PrismaMariaDb(config(adminUrl)) });
const db = new PrismaClient({ adapter: new PrismaMariaDb(config(target)) });
const temp = fs.mkdtempSync(path.join(root, 'prisma/.promotion-upgrade-'));
const env = { ...process.env, DATABASE_URL: target.toString(), MIGRATION_URL: target.toString(), SHADOW_DATABASE_URL: adminUrl.toString() };
const run = (exe, args) => execFileSync(exe, args, { cwd: root, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 20 * 1024 * 1024 });
let created = false;
try {
  run('git', ['fetch', '--no-tags', '--depth=1', 'origin', baseline]);
  const schema = run('git', ['show', `${baseline}:prisma/schema.prisma`])
    .replace(/provider\s*=\s*"prisma-client"/, 'provider = "prisma-client-js"')
    .replace(/output\s*=\s*"[^\"]+"/, 'output = "./historical-client"');
  fs.writeFileSync(path.join(temp, 'schema.prisma'), schema);
  const before = path.join(temp, 'migrations'); fs.mkdirSync(before);
  fs.copyFileSync(path.join(root, 'prisma/migrations/migration_lock.toml'), path.join(before, 'migration_lock.toml'));
  for (const entry of fs.readdirSync(path.join(root, 'prisma/migrations'), { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name < migration) fs.cpSync(path.join(root, 'prisma/migrations', entry.name), path.join(before, entry.name), { recursive: true });
  }
  const configPath = path.join(temp, 'config.ts');
  const writeConfig = (migrations) => fs.writeFileSync(configPath, `import { defineConfig } from 'prisma/config'; export default defineConfig({schema:${JSON.stringify(path.join(temp, 'schema.prisma'))},migrations:{path:${JSON.stringify(migrations)}},datasource:{url:process.env.MIGRATION_URL}});`);
  writeConfig(before);
  await admin.$executeRawUnsafe(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`); created = true;
  run(process.execPath, [cli, 'migrate', 'deploy', '--config', configPath]);
  run(process.execPath, [cli, 'generate', '--config', configPath]);
  const seed = run('git', ['show', `${baseline}:prisma/seed.mjs`])
    .replace("'../apps/api/dist/generated/prisma/client.js'", "'./historical-client/index.js'")
    .replace("'../apps/api/dist/auth/permissions/permission-catalog.js'", JSON.stringify(pathToFileURL(path.join(root, 'apps/api/dist/auth/permissions/permission-catalog.js')).href));
  fs.writeFileSync(path.join(temp, 'seed.mjs'), seed);
  run(process.execPath, [path.join(temp, 'seed.mjs')]);
  const oldPromotions = await db.$queryRawUnsafe('SELECT * FROM KhuyenMai ORDER BY khuyenMaiId');
  assert.equal(oldPromotions.length, 15, 'Must run the full develop seed, not an empty schema fixture');
  assert(oldPromotions.some(p => p.denNgay === null));
  await db.$executeRawUnsafe('UPDATE KhuyenMai SET maKhuyenMai = NULL WHERE khuyenMaiId = ?', oldPromotions[1].khuyenMaiId);
  oldPromotions[1].maKhuyenMai = null;
  // Exercise legacy references in both domains in addition to the real develop seed.
  await db.$executeRawUnsafe('UPDATE PhieuDatVe SET khuyenMaiId = ? ORDER BY phieuDatVeId LIMIT 1', oldPromotions[0].khuyenMaiId);
  await db.$executeRawUnsafe('UPDATE PhieuGuiHang SET khuyenMaiId = ? ORDER BY phieuGuiHangId LIMIT 1', oldPromotions[0].khuyenMaiId);
  const tables = ['PhieuDatVe', 'PhieuGuiHang', 'DonGiaoDich', 'Ve', 'ThanhToan', 'HoaDon'];
  const snapshots = [];
  for (const table of tables) {
    const rows = await db.$queryRawUnsafe(`SELECT * FROM \`${table}\` ORDER BY 1`);
    snapshots.push({ table, columns: Object.keys(rows[0]), rows });
  }
  writeConfig(path.join(root, 'prisma/migrations'));
  run(process.execPath, [cli, 'migrate', 'deploy', '--config', configPath]);
  for (const snapshot of snapshots) {
    const columns = snapshot.columns.map(c => `\`${c}\``).join(',');
    assert.deepEqual(await db.$queryRawUnsafe(`SELECT ${columns} FROM \`${snapshot.table}\` ORDER BY 1`), snapshot.rows, `${snapshot.table} historical data changed`);
  }
  const upgraded = await db.$queryRawUnsafe('SELECT * FROM KhuyenMai ORDER BY khuyenMaiId');
  assert.equal(upgraded.length, 15);
  for (let i = 0; i < upgraded.length; i++) {
    const { denNgay, trangThai, ...preserved } = oldPromotions[i];
    const { denNgay: end, trangThai: status, soLuotToiDa, soLuotDaSuDung, ...actual } = upgraded[i];
    assert.deepEqual(actual, { ...preserved, maKhuyenMai: preserved.maKhuyenMai ?? `LEGACY-${preserved.khuyenMaiId}` });
    assert.deepEqual(end, denNgay ?? oldPromotions[i].tuNgay);
    assert.equal(status, 'LEGACY_UNCONFIGURED'); assert.equal(soLuotToiDa, 1); assert.equal(soLuotDaSuDung, 0);
  }
  assert.equal(Number((await db.$queryRawUnsafe('SELECT COUNT(*) AS n FROM SuDungKhuyenMai'))[0].n), 0);
  // A second deploy must be a no-op.
  run(process.execPath, [cli, 'migrate', 'deploy', '--config', configPath]);
  assert.deepEqual(await db.$queryRawUnsafe('SELECT * FROM KhuyenMai ORDER BY khuyenMaiId'), upgraded);
  console.log('PASS promotion upgrade: full develop seed (15 legacy promotions), preserved financial records/references, no invented usage, repeat deploy');
} finally {
  await db.$disconnect();
  if (created) await admin.$executeRawUnsafe(`DROP DATABASE \`${database}\``);
  await admin.$disconnect();
  assert(path.dirname(temp) === path.join(root, 'prisma') && path.basename(temp).startsWith('.promotion-upgrade-'));
  fs.rmSync(temp, { recursive: true, force: true });
}
