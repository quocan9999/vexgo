import 'dotenv/config';
import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../../apps/api/dist/generated/prisma/client.js';

const ADMIN_URL_ENV = 'FEATURE07_ADMIN_DATABASE_URL';
const TEST_PASSWORD_ENV = 'FEATURE07_TEST_PASSWORD';
const TEST_DATABASE_URL_ENV = 'FEATURE07_TEST_DATABASE_URL';
const testDatabase = 'vexgo_feature07_ci_test';
const testUser = 'vexgo_feature07_ci_test';

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
  const adminUrlValue = process.env[ADMIN_URL_ENV];
  const configuredTestPassword = process.env[TEST_PASSWORD_ENV];
  if (!adminUrlValue) {
    throw new Error(`${ADMIN_URL_ENV} is required.`);
  }
  if (!configuredTestPassword && !process.env.GITHUB_ENV) {
    throw new Error(`${TEST_PASSWORD_ENV} or GITHUB_ENV is required.`);
  }
  const testPassword = configuredTestPassword ?? randomBytes(24).toString('base64url');
  if (!/^[A-Za-z0-9_-]{24,64}$/.test(testPassword)) {
    throw new Error(`${TEST_PASSWORD_ENV} must be 24-64 simple ASCII characters.`);
  }

  const admin = parseDatabaseUrl(adminUrlValue, ADMIN_URL_ENV);
  if (['localhost', '127.0.0.1', '::1'].includes(admin.host) === false) {
    throw new Error('CI Feature 07 test database setup only allows a local MySQL service.');
  }
  if (admin.database === testDatabase) {
    throw new Error(`${ADMIN_URL_ENV} must not point to the Feature 07 test schema.`);
  }

  const target = { host: admin.host, port: admin.port, database: testDatabase };
  for (const name of ['DATABASE_URL', 'MIGRATION_URL', 'SHADOW_DATABASE_URL']) {
    const value = process.env[name];
    if (!value) continue;
    const other = parseDatabaseUrl(value, name);
    if (
      target.host === other.host &&
      target.port === other.port &&
      target.database === other.database
    ) {
      throw new Error(`Feature 07 test schema must be separate from ${name}.`);
    }
  }

  const prisma = new PrismaClient({ adapter: new PrismaMariaDb(connectionConfig(admin.url)) });
  try {
    try {
      await prisma.$executeRawUnsafe(
        `CREATE DATABASE IF NOT EXISTS \`${testDatabase}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      );
      await prisma.$executeRawUnsafe(
        `CREATE USER IF NOT EXISTS '${testUser}'@'%' IDENTIFIED BY '${testPassword}'`,
      );
      await prisma.$executeRawUnsafe(
        `ALTER USER '${testUser}'@'%' IDENTIFIED BY '${testPassword}'`,
      );
      await prisma.$executeRawUnsafe(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON \`${testDatabase}\`.* TO '${testUser}'@'%'`,
      );
    } catch (error) {
      let message = error instanceof Error ? error.message : String(error);
      for (const secret of [testPassword, decodeURIComponent(admin.url.password)]) {
        if (secret) message = message.replaceAll(secret, '[redacted]');
      }
      throw new Error(message);
    }
  } finally {
    await prisma.$disconnect();
  }

  if (process.env.GITHUB_ENV) {
    const testDatabaseUrl = new URL(admin.url);
    testDatabaseUrl.pathname = `/${testDatabase}`;
    testDatabaseUrl.username = testUser;
    testDatabaseUrl.password = testPassword;
    process.stdout.write(`::add-mask::${testPassword}\n`);
    fs.appendFileSync(
      process.env.GITHUB_ENV,
      `${TEST_DATABASE_URL_ENV}=${testDatabaseUrl.toString()}${process.platform === 'win32' ? '\r\n' : '\n'}`,
    );
  }

  console.log(
    `Prepared ${testDatabase}; ${testUser} has SELECT/INSERT/UPDATE/DELETE on this schema only.`,
  );
}

main().catch((error) => {
  console.error('Feature 07 test database preparation failed:', error);
  process.exitCode = 1;
});
