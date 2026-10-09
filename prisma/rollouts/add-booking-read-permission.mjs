import 'dotenv/config';
import mariadb from 'mariadb';

const permissionKey = 'booking:read';
const roleName = 'NHA_XE_ADMIN';
const confirmationVariable = 'BOOKING_READ_PERMISSION_ROLLOUT_CONFIRM_DATABASE';

function readDatabaseTarget(name) {
  const value = process.env[name];
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
  };
}

function assertSafeTargets() {
  const runtime = readDatabaseTarget('DATABASE_URL');
  const migration = readDatabaseTarget('MIGRATION_URL');
  const shadow = readDatabaseTarget('SHADOW_DATABASE_URL');

  if (
    runtime.host !== migration.host ||
    runtime.port !== migration.port ||
    runtime.database !== migration.database
  ) {
    throw new Error(
      'DATABASE_URL and MIGRATION_URL must target the same database.',
    );
  }
  if (
    shadow.host === runtime.host &&
    shadow.port === runtime.port &&
    shadow.database === runtime.database
  ) {
    throw new Error('SHADOW_DATABASE_URL must target a separate database.');
  }
  if (!runtime.database || runtime.database.toLowerCase() === 'vexgo') {
    throw new Error('The rollout refuses the original VexGo database.');
  }
  if (['localhost', '127.0.0.1', '::1'].includes(runtime.host)) {
    const isCi = process.env.CI === 'true';
    const allowedPort = isCi
      ? runtime.port === 3306 || runtime.port === 3307
      : runtime.port === 3307;
    if (!allowedPort || !runtime.database.startsWith('vexgo_feature07')) {
      throw new Error(
        isCi
          ? 'CI rollout is restricted to port 3306/3307 and a vexgo_feature07 database.'
          : 'Local rollout is restricted to port 3307 and a vexgo_feature07 database.',
      );
    }
  }
  if (process.env[confirmationVariable] !== runtime.database) {
    throw new Error(
      `${confirmationVariable} must exactly match the target database name.`,
    );
  }

  return runtime;
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
  for (const name of ['DATABASE_URL', 'MIGRATION_URL', 'SHADOW_DATABASE_URL']) {
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

rollout().catch((error) => {
  console.error(
    `Booking permission rollout failed: ${redactConnectionSecrets(error)}`,
  );
  process.exitCode = 1;
});
