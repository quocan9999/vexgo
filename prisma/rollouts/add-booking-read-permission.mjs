import 'dotenv/config';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import mariadb from 'mariadb';

const require = createRequire(import.meta.url);
const { assertFeature07TestDatabase, sameDatabaseTarget } = require(
  '../test-support/feature07-test-database.cjs',
);

const permissionKey = 'booking:read';
const roleName = 'NHA_XE_ADMIN';
const confirmationVariable = 'BOOKING_READ_PERMISSION_ROLLOUT_CONFIRM_DATABASE';

function readDatabaseTarget(name, environment = process.env) {
  const value = environment[name];
  if (!value) throw new Error(`${name} is required.`);

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid MySQL URL.`);
  }
  if (url.protocol !== 'mysql:') {
    throw new Error(`${name} must use the mysql: protocol.`);
  }

  return {
    url,
    host: url.hostname.toLowerCase(),
    port: Number(url.port || 3306),
    database: decodeURIComponent(url.pathname.replace(/^\/+/, '')),
    username: decodeURIComponent(url.username),
  };
}

function assertSafeTargets(environment = process.env) {
  const target = readDatabaseTarget('DATABASE_URL', environment);
  const migration = readDatabaseTarget('MIGRATION_URL', environment);
  const shadow = readDatabaseTarget('SHADOW_DATABASE_URL', environment);
  const isTestMode =
    environment.BOOKING_READ_PERMISSION_ROLLOUT_TEST_MODE === 'true';

  if (!sameDatabaseTarget(target, migration)) {
    throw new Error(
      'DATABASE_URL and MIGRATION_URL must target the same database.',
    );
  }
  if (sameDatabaseTarget(shadow, target)) {
    throw new Error('SHADOW_DATABASE_URL must target a separate database.');
  }

  if (isTestMode) {
    if (target.username !== migration.username) {
      throw new Error(
        'Test rollout DATABASE_URL and MIGRATION_URL must use the same scoped account.',
      );
    }
    if (environment.DATABASE_URL !== environment.FEATURE07_TEST_DATABASE_URL) {
      throw new Error(
        'Test rollout DATABASE_URL must exactly match FEATURE07_TEST_DATABASE_URL.',
      );
    }
    assertFeature07TestDatabase({
      testDatabaseUrl: environment.FEATURE07_TEST_DATABASE_URL,
      ci: environment.CI,
      protectedDatabaseUrls: [
        { name: 'runtime', value: environment.FEATURE07_RUNTIME_DATABASE_URL },
        { name: 'shadow', value: environment.SHADOW_DATABASE_URL },
      ],
    });
  } else {
    if (!target.database || target.database.toLowerCase() === 'vexgo') {
      throw new Error('The rollout refuses the original VexGo database.');
    }
    if (['localhost', '127.0.0.1', '::1', '[::1]'].includes(target.host)) {
      const isCi = environment.CI === 'true';
      const allowedPorts = isCi ? [3306, 3307] : [3010, 3307];
      if (
        !allowedPorts.includes(target.port) ||
        !target.database.toLowerCase().startsWith('vexgo_feature07')
      ) {
        throw new Error(
          isCi
            ? 'CI rollout is restricted to port 3306/3307 and a vexgo_feature07 database.'
            : 'Local rollout is restricted to port 3010/3307 and a vexgo_feature07 database.',
        );
      }
    }
  }

  if (environment[confirmationVariable] !== target.database) {
    throw new Error(
      `${confirmationVariable} must exactly match the target database name.`,
    );
  }

  return target;
}

async function rollout() {
  const target = assertSafeTargets();
  const connection = await mariadb.createConnection({
    host: target.url.hostname,
    port: target.port,
    user: decodeURIComponent(target.url.username),
    password: decodeURIComponent(target.url.password),
    database: target.database,
    allowPublicKeyRetrieval: true,
  });

  try {
    await connection.beginTransaction();
    await connection.execute(
      'INSERT IGNORE INTO `Quyen` (`tenQuyen`, `moTa`) VALUES (?, ?)',
      [
        permissionKey,
        'Xem danh sách, chi tiết và lịch sử phiếu đặt vé trong phạm vi nhà xe.',
      ],
    );
    const permissions = await connection.execute(
      'SELECT `quyenId` FROM `Quyen` WHERE `tenQuyen` = ? LIMIT 1',
      [permissionKey],
    );
    const roles = await connection.execute(
      'SELECT `vaiTroId` FROM `VaiTro` WHERE `tenVaiTro` = ? LIMIT 1',
      [roleName],
    );
    if (permissions.length !== 1 || roles.length !== 1) {
      throw new Error(
        `Canonical role or permission ${permissionKey} is missing.`,
      );
    }

    await connection.execute(
      'INSERT IGNORE INTO `VaiTroQuyen` (`vaiTroId`, `quyenId`) VALUES (?, ?)',
      [roles[0].vaiTroId, permissions[0].quyenId],
    );
    await connection.commit();
    console.log(
      `Applied ${permissionKey} for ${roleName} on ${target.database}; tenant overrides were not changed.`,
    );
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

function redactConnectionSecrets(error) {
  let message = error instanceof Error ? error.message : String(error);
  for (const name of [
    'DATABASE_URL',
    'MIGRATION_URL',
    'SHADOW_DATABASE_URL',
    'FEATURE07_TEST_DATABASE_URL',
    'FEATURE07_RUNTIME_DATABASE_URL',
  ]) {
    const value = process.env[name];
    if (!value) continue;
    try {
      const url = new URL(value);
      for (const secret of [
        url.password,
        decodeURIComponent(url.password),
        url.username,
      ]) {
        if (secret) message = message.replaceAll(secret, '[redacted]');
      }
    } catch {
      // Do not echo malformed connection values.
    }
  }
  return message;
}

export { assertSafeTargets };

const isDirectExecution =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirectExecution) {
  rollout().catch((error) => {
    console.error(
      `Booking permission rollout failed: ${redactConnectionSecrets(error)}`,
    );
    process.exitCode = 1;
  });
}
