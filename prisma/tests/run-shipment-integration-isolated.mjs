import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../../apps/api/dist/generated/prisma/client.js';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');
const prismaCli = path.join(repoRoot, 'node_modules/prisma/build/index.js');
const vitestCli = path.join(repoRoot, 'node_modules/vitest/vitest.mjs');

function connectionConfig(connectionUrl) {
  const url = new URL(connectionUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\/+/, '')),
    allowPublicKeyRetrieval: true,
  };
}

function urlForDatabase(connectionUrl, database) {
  const url = new URL(connectionUrl);
  url.pathname = `/${database}`;
  return url.toString();
}

function runNode(script, args, env, cwd = repoRoot) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd,
    env,
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  if (output) {
    if (result.status === 0) console.log(output);
    else console.error(output);
  }
  return result.status ?? 1;
}

async function main() {
  const adminUrl = process.env.MIGRATION_URL ?? process.env.DATABASE_URL;
  if (!adminUrl) throw new Error('Set MIGRATION_URL or DATABASE_URL to a MySQL test server with CREATE/DROP DATABASE privileges.');
  if (!fs.existsSync(prismaCli) || !fs.existsSync(vitestCli)) {
    throw new Error('Prisma/Vitest CLI is missing; install dependencies and build the API before running this harness.');
  }

  const suffix = `${process.pid}_${Date.now().toString(36)}`;
  const database = `vexgo_shiptest_${suffix}`.slice(0, 60);
  const shadowDatabase = `vexgo_shipshadow_${suffix}`.slice(0, 60);
  const databaseUrl = urlForDatabase(adminUrl, database);
  const shadowDatabaseUrl = urlForDatabase(adminUrl, shadowDatabase);
  const admin = new PrismaClient({ adapter: new PrismaMariaDb(connectionConfig(adminUrl)) });
  let createdDatabase = false;
  let createdShadowDatabase = false;

  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    createdDatabase = true;
    await admin.$executeRawUnsafe(`CREATE DATABASE \`${shadowDatabase}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    createdShadowDatabase = true;

    const testEnv = {
      ...process.env,
      DATABASE_URL: databaseUrl,
      MIGRATION_URL: databaseUrl,
      SHADOW_DATABASE_URL: shadowDatabaseUrl,
      SHIPMENT_TEST_DATABASE_URL: databaseUrl,
    };
    const migrateStatus = runNode(prismaCli, ['migrate', 'deploy'], testEnv);
    if (migrateStatus !== 0) throw new Error(`Isolated shipment test database migration failed (${migrateStatus}).`);

    const requestedArgs = process.argv.slice(2);
    const repeatArgument = requestedArgs.find((arg) => arg.startsWith('--repeat='));
    const repeatCount = repeatArgument
      ? Number(repeatArgument.slice('--repeat='.length))
      : 1;
    if (!Number.isInteger(repeatCount) || repeatCount < 1) {
      throw new Error('--repeat must be a positive integer.');
    }
    const testFiles = requestedArgs.filter((arg) => !arg.startsWith('--repeat='));
    const selectedFiles = testFiles.length > 0
      ? testFiles
      : ['test/integration/shipments/shipments-status.spec.ts'];
    for (let run = 1; run <= repeatCount; run += 1) {
      console.log(`Shipment integration run ${run}/${repeatCount}`);
      const testStatus = runNode(
        vitestCli,
        ['run', '--config', 'vitest.config.ts', ...selectedFiles],
        testEnv,
        path.join(repoRoot, 'apps/api'),
      );
      if (testStatus !== 0) {
        process.exitCode = testStatus;
        break;
      }
    }
  } finally {
    if (createdShadowDatabase) {
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS \`${shadowDatabase}\``);
    }
    if (createdDatabase) {
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS \`${database}\``);
    }
    await admin.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
