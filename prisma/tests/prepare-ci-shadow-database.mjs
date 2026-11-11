import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../../apps/api/dist/generated/prisma/client.js';

function parseDatabaseUrl(value, name) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid MySQL URL.`);
  }
  if (url.protocol !== 'mysql:') throw new Error(`${name} must use mysql:`);

  return {
    url,
    host: url.hostname.toLowerCase(),
    port: Number(url.port || 3306),
    database: decodeURIComponent(url.pathname.replace(/^\/+/, '')).toLowerCase(),
  };
}

function connectionConfig(url) {
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\/+/, '')),
    allowPublicKeyRetrieval: true,
  };
}

async function main() {
  const shadowUrlValue = process.env.SHADOW_DATABASE_URL;
  if (!shadowUrlValue) {
    console.log('SHADOW_DATABASE_URL is not set. Skipping shadow database preparation.');
    return;
  }

  const shadowParsed = parseDatabaseUrl(shadowUrlValue, 'SHADOW_DATABASE_URL');
  const shadowDatabase = shadowParsed.database;

  // Sử dụng admin / migration URL nếu có, hoặc kết nối bằng credentials của chính shadowUrl hoặc DATABASE_URL
  const adminUrlValue =
    process.env.MIGRATION_URL || process.env.DATABASE_URL || shadowUrlValue;
  const adminParsed = parseDatabaseUrl(adminUrlValue, 'ADMIN_DATABASE_URL');

  const adminConfig = connectionConfig(adminParsed.url);

  console.log(`Ensuring shadow database '${shadowDatabase}' exists on ${adminConfig.host}:${adminConfig.port}...`);

  const prisma = new PrismaClient({ adapter: new PrismaMariaDb(adminConfig) });
  try {
    await prisma.$executeRawUnsafe(
      `CREATE DATABASE IF NOT EXISTS \`${shadowDatabase}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    console.log(`Shadow database '${shadowDatabase}' is ready for Prisma schema drift checks.`);
  } catch (error) {
    let message = error instanceof Error ? error.message : String(error);
    if (adminConfig.password) {
      message = message.replaceAll(adminConfig.password, '[redacted]');
    }
    throw new Error(`Failed to prepare shadow database: ${message}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Shadow database preparation failed:', error);
  process.exitCode = 1;
});
