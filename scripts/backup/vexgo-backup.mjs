import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parseArgs } from 'node:util';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import {
  mkdir,
  writeFile,
  rename,
  readdir,
  lstat,
  rm,
  mkdtemp,
} from 'node:fs/promises';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import {
  archiveName,
  manifestName,
  inside,
  identifier,
  readKey,
  encryptSql,
  verifyArchive,
  decryptSql,
} from './archive.mjs';

const exec = promisify(execFile);
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const restoreLabel = 'vn.vexgo.backup-restore';
const mysqlShell =
  'export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; exec mysql --user=root --batch --raw --skip-column-names "$@"';
const dumpShell =
  'export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; exec mysqldump --user=root "$@"';
export const dumpOptions = [
  '--single-transaction',
  '--quick',
  '--no-tablespaces',
  '--set-gtid-purged=OFF',
  '--routines',
  '--events',
  '--triggers',
  '--hex-blob',
  '--default-character-set=utf8mb4',
  '--skip-add-locks',
  '--skip-comments',
];

function fail(code) {
  throw new Error(code);
}
function message(event, details = {}) {
  console.log(
    JSON.stringify({ time: new Date().toISOString(), event, ...details }),
  );
}

async function run(program, args, options = {}) {
  try {
    return (
      await exec(program, args, {
        timeout: 120_000,
        maxBuffer: 4 * 1024 * 1024,
        windowsHide: true,
        ...options,
      })
    ).stdout.trim();
  } catch {
    fail(
      program === 'docker'
        ? 'DOCKER_COMMAND_FAILED_CHECK_DAEMON_CONTAINER_AND_PRIVILEGES'
        : 'LOCAL_COMMAND_FAILED',
    );
  }
}

function mysqlArgs(container, args) {
  return ['exec', '-i', container, 'sh', '-c', mysqlShell, 'mysql', ...args];
}
async function query(container, sql, database) {
  return run(
    'docker',
    mysqlArgs(container, [
      ...(database ? [identifier(database)] : []),
      '--execute',
      sql,
    ]),
  );
}

// Never accept a restore destination: restore always creates its own isolated container.
export function restoreArgs(name, image, envFile) {
  if (!/^vexgo-restore-[a-f0-9-]{36}$/.test(name)) fail('INVALID_RESTORE_NAME');
  return [
    'run',
    '--detach',
    '--name',
    name,
    '--label',
    `${restoreLabel}=1`,
    '--network',
    'none',
    '--env-file',
    envFile,
    image,
    '--event-scheduler=OFF',
    '--local-infile=0',
  ];
}

async function protectFile(file) {
  if (process.platform === 'win32') {
    const identity = await run('whoami', ['/user', '/fo', 'csv', '/nh']);
    const sid = identity.match(/S-1-5-[0-9-]+/)?.[0];
    if (!sid) fail('WINDOWS_IDENTITY_UNAVAILABLE');
    await run('icacls', [file, '/inheritance:r', '/grant:r', `*${sid}:(F)`]);
  }
}

function externalPath(file) {
  const path = resolve(file);
  if (inside(repo, path)) fail('BACKUP_AND_KEYS_MUST_BE_OUTSIDE_REPOSITORY');
  return path;
}

async function inspect(container) {
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(container))
    fail('INVALID_CONTAINER_NAME');
  const info = JSON.parse(await run('docker', ['inspect', container]))[0];
  if (!info?.State?.Running) fail('SOURCE_CONTAINER_NOT_RUNNING');
  return info;
}

async function snapshot(container, database) {
  const engineRows = await query(
    container,
    `SELECT TABLE_NAME, COALESCE(ENGINE,'VIEW') FROM information_schema.TABLES WHERE TABLE_SCHEMA='${database}' ORDER BY TABLE_NAME`,
  );
  if (!engineRows) fail('EMPTY_DATABASE_REFUSED');
  const objects = engineRows.split('\n').map((row) => row.split('\t'));
  if (objects.some(([, engine]) => !['InnoDB', 'VIEW'].includes(engine)))
    fail('NON_INNODB_TABLES_REQUIRE_OFFLINE_BACKUP');
  const tables = objects.map(([name]) => {
    if (!/^[A-Za-z0-9_]+$/.test(name)) fail('UNSUPPORTED_TABLE_NAME');
    return name;
  });
  const migrations = tables.includes('_prisma_migrations')
    ? await query(
        container,
        'SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations ORDER BY migration_name',
        database,
      )
    : '';
  if (tables.includes('_prisma_migrations')) {
    const unresolved = await query(
      container,
      'SELECT COUNT(*) FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL',
      database,
    );
    if (unresolved !== '0') fail('MIGRATION_IN_PROGRESS_OR_FAILED');
  }
  const columns = await query(
    container,
    `SELECT TABLE_NAME,COLUMN_NAME,ORDINAL_POSITION,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT,EXTRA,COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='${database}' ORDER BY TABLE_NAME,ORDINAL_POSITION`,
  );
  const indexes = await query(
    container,
    `SELECT TABLE_NAME,INDEX_NAME,NON_UNIQUE,SEQ_IN_INDEX,COLUMN_NAME,SUB_PART,INDEX_TYPE FROM information_schema.STATISTICS WHERE TABLE_SCHEMA='${database}' ORDER BY TABLE_NAME,INDEX_NAME,SEQ_IN_INDEX`,
  );
  const [databaseCharset, databaseCollation] = (
    await query(
      container,
      `SELECT DEFAULT_CHARACTER_SET_NAME,DEFAULT_COLLATION_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='${database}'`,
    )
  ).split('\t');
  return {
    tables,
    databaseCharset,
    databaseCollation,
    migrationsSha256: createHash('sha256').update(migrations).digest('hex'),
    schemaSha256: createHash('sha256')
      .update(JSON.stringify([engineRows, columns, indexes]))
      .digest('hex'),
  };
}

async function streamed(program, args, consume) {
  const child = spawn(program, args, {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.resume(); // Do not expose data, credentials or SQL in diagnostics.
  const completed = new Promise((resolve, reject) => {
    child.once('error', () => reject(new Error('DUMP_START_FAILED')));
    child.once('close', (code) =>
      code === 0 ? resolve() : reject(new Error('DUMP_FAILED')),
    );
  });
  const watchdog = setTimeout(() => child.kill(), 30 * 60_000);
  try {
    await Promise.all([completed, consume(child.stdout)]);
  } catch (error) {
    child.kill();
    throw error;
  } finally {
    clearTimeout(watchdog);
  }
}

async function verifyCompleteArchive(directory, key, skipMedia = false) {
  const manifest = await verifyArchive(directory, key);
  if (manifest.mediaRequired && !skipMedia) {
    const { verifyMediaForDatabase } = await import('./cloudinary-bundle.mjs');
    await verifyMediaForDatabase(directory, key, manifest);
  }
  return manifest;
}

async function backup(options) {
  if (!options.source || !options.out || !options.key)
    fail('BACKUP_REQUIRES_SOURCE_OUT_KEY');
  const root = externalPath(options.out);
  const keyPath = externalPath(options.key);
  if (inside(root, keyPath)) fail('KEY_MUST_BE_SEPARATE_FROM_BACKUPS');
  const key = await readKey(keyPath);
  const info = await inspect(options.source);
  // Only read the database name from Docker metadata; never print the environment.
  const database = identifier(
    info.Config.Env.find((entry) => entry.startsWith('MYSQL_DATABASE='))?.slice(
      15,
    ),
  );
  const mysqlVersion = await query(info.Id, 'SELECT @@version');
  if (!/^8\.4\./.test(mysqlVersion)) fail('ONLY_MYSQL_8_4_SUPPORTED');
  const before = await snapshot(info.Id, database);
  const id = `vexgo-backup-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomBytes(4).toString('hex')}`;
  await mkdir(root, { recursive: true });
  const partial = join(root, `.partial-${id}`);
  const final = join(root, id);
  if (!inside(root, partial) || !inside(root, final))
    fail('UNSAFE_BACKUP_PATH');
  const metadata = {
    format: 1,
    kind: 'vexgo-mysql-logical',
    id,
    createdAt: new Date().toISOString(),
    database,
    mysqlVersion,
    sourceImage: info.Image,
    toolRevision: await run('git', ['-C', repo, 'rev-parse', 'HEAD']),
    toolFilesSha256: Object.fromEntries(
      await Promise.all(
        (options['cloudinary-environment']
          ? [
              'archive.mjs',
              'vexgo-backup.mjs',
              'cloudinary-client.mjs',
              'cloudinary-bundle.mjs',
            ]
          : ['archive.mjs', 'vexgo-backup.mjs']
        ).map(async (file) => {
          const { checksum } = await import('./archive.mjs');
          return [file, await checksum(join(repo, 'scripts', 'backup', file))];
        }),
      ),
    ),
    deployedRevision: options.revision ?? null,
    ...before,
    mediaRequired: Boolean(options['cloudinary-environment']),
    cloudinaryEnvironment: options['cloudinary-environment'] ?? null,
    scope: options['cloudinary-environment']
      ? 'database + snapshot-linked public Cloudinary vehicle images; service secrets excluded'
      : 'database-only; external files and service secrets not included',
  };
  message('BACKUP_STARTED', { id });
  try {
    await streamed(
      'docker',
      [
        'exec',
        info.Id,
        'sh',
        '-c',
        dumpShell,
        'mysqldump',
        ...dumpOptions,
        database,
      ],
      (stream) => encryptSql(stream, partial, key, metadata),
    );
    const after = await snapshot(info.Id, database);
    if (JSON.stringify(before) !== JSON.stringify(after))
      fail('SCHEMA_OR_MIGRATIONS_CHANGED_DURING_BACKUP');
    await verifyArchive(partial, key);
    await rename(partial, final);
    message(
      options['cloudinary-environment']
        ? 'DATABASE_SNAPSHOT_VERIFIED'
        : 'BACKUP_VERIFIED',
      {
        directory: final,
        tables: before.tables.length,
      },
    );
  } catch (error) {
    // Incomplete artifacts remain visibly quarantined, never eligible for retention/mirroring.
    message('BACKUP_INCOMPLETE', { directory: partial });
    throw error;
  }
  if (options['cloudinary-environment']) {
    try {
      const { backupMediaForDatabase } =
        await import('./cloudinary-bundle.mjs');
      await backupMediaForDatabase({
        databaseBackup: final,
        keyPath,
        environment: options['cloudinary-environment'],
      });
      await verifyCompleteArchive(final, key);
      message('BACKUP_VERIFIED', {
        directory: final,
        tables: before.tables.length,
        cloudinary: true,
      });
    } catch (error) {
      // Keep the valid SQL and failed-media diagnostics, but never publish an incomplete full backup.
      await rename(final, partial);
      message('BACKUP_INCOMPLETE', {
        directory: partial,
        component: 'cloudinary',
      });
      throw error;
    }
  }
  if (options.mirror) await mirrorBackup(final, options.mirror, key);
  if (options.keep) await prune(root, options.keep, key);
  return final;
}

async function mirrorBackup(directory, destination, key) {
  const { copyFile } = await import('node:fs/promises');
  const root = externalPath(destination);
  if (inside(directory, root) || inside(root, directory))
    fail('MIRROR_MUST_BE_SEPARATE');
  const manifest = await verifyCompleteArchive(directory, key);
  await mkdir(root, { recursive: true });
  const partial = join(root, `.partial-${manifest.id}`);
  if (!inside(root, partial) || !inside(root, join(root, manifest.id)))
    fail('UNSAFE_MIRROR_PATH');
  await mkdir(partial, { recursive: false });
  for (const file of [archiveName, manifestName])
    await copyFile(join(directory, file), join(partial, file));
  if (manifest.mediaRequired) {
    await mkdir(join(partial, 'media'));
    for (const file of ['assets.jsonl.gz.enc', 'manifest.json'])
      await copyFile(
        join(directory, 'media', file),
        join(partial, 'media', file),
      );
  }
  await verifyCompleteArchive(partial, key);
  await rename(partial, join(root, manifest.id));
  message('MIRROR_VERIFIED', { directory: join(root, manifest.id) });
}

async function prune(root, keepValue, key) {
  if (!/^[1-9][0-9]*$/.test(String(keepValue)))
    fail('KEEP_MUST_BE_POSITIVE_INTEGER');
  const keep = Number(keepValue);
  const backups = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (
      !entry.isDirectory() ||
      !/^vexgo-backup-[0-9TZ-]+-[a-f0-9]{8}$/.test(entry.name)
    )
      continue;
    const directory = resolve(root, entry.name);
    if (!inside(root, directory) || (await lstat(directory)).isSymbolicLink())
      fail('UNSAFE_RETENTION_PATH');
    // Fail closed on damaged packages. Never delete unknown files or partial backups.
    const manifest = await verifyCompleteArchive(directory, key);
    if (manifest.id !== entry.name) fail('BACKUP_DIRECTORY_ID_MISMATCH');
    backups.push({ directory, createdAt: manifest.createdAt });
  }
  backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const item of backups.slice(keep)) {
    await rm(item.directory, { recursive: true });
    message('RETENTION_REMOVED', { directory: item.directory });
  }
}

async function restore(options) {
  if (!options.backup || !options.key) fail('RESTORE_REQUIRES_BACKUP_KEY');
  const directory = resolve(options.backup);
  const key = await readKey(externalPath(options.key));
  const manifest = await verifyCompleteArchive(
    directory,
    key,
    options.skipMediaVerification === true,
  ); // Authenticate completely before executing SQL.
  if (basename(directory) !== manifest.id)
    fail('RESTORE_REQUIRES_PUBLISHED_BACKUP_DIRECTORY');
  const name = `vexgo-restore-${randomUUID()}`;
  const temp = await mkdtemp(join(tmpdir(), 'vexgo-restore-'));
  const envFile = join(temp, 'mysql.env');
  let container;
  try {
    await writeFile(
      envFile,
      `MYSQL_ROOT_PASSWORD=${randomBytes(32).toString('hex')}\nMYSQL_DATABASE=${manifest.database}\n`,
      { flag: 'wx', mode: 0o600 },
    );
    await protectFile(envFile);
    // The source image must already exist locally, with identical immutable image ID.
    if (!/^sha256:[a-f0-9]{64}$/.test(manifest.sourceImage))
      fail('INVALID_SOURCE_IMAGE');
    await run('docker', ['image', 'inspect', manifest.sourceImage]);
    container = await run(
      'docker',
      restoreArgs(name, manifest.sourceImage, envFile),
    );
    message('RESTORE_CONTAINER_CREATED', { container: name });
    let ready = false;
    for (let attempt = 0; attempt < 90; attempt++) {
      // Initial entrypoint server uses a socket only; require the final TCP server.
      try {
        await query(container, 'SELECT 1', undefined);
        const info = await inspect(container);
        if (
          await run('docker', [
            'exec',
            info.Id,
            'sh',
            '-c',
            'export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; exec mysql --protocol=TCP --host=127.0.0.1 --user=root --execute "SELECT 1"',
          ])
        ) {
          ready = true;
          break;
        }
      } catch {
        /* wait for initialization, without printing credentials */
      }
      await delay(1000);
    }
    if (!ready) fail('RESTORE_MYSQL_NOT_READY');
    message('RESTORE_MYSQL_READY');
    if (manifest.databaseCharset && manifest.databaseCollation) {
      if (
        ![manifest.databaseCharset, manifest.databaseCollation].every((value) =>
          /^[a-z0-9_]{1,64}$/.test(value),
        )
      )
        fail('INVALID_DATABASE_CHARACTER_SET');
      await query(
        container,
        `ALTER DATABASE \`${manifest.database}\` CHARACTER SET ${manifest.databaseCharset} COLLATE ${manifest.databaseCollation}`,
      );
    } else message('LEGACY_BACKUP_DATABASE_DEFAULTS_NOT_RECORDED');
    const child = spawn(
      'docker',
      mysqlArgs(container, [manifest.database, '--binary-mode=1']),
      { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] },
    );
    child.stderr.resume();
    const done = new Promise((resolve, reject) => {
      child.once('error', () => reject(new Error('RESTORE_START_FAILED')));
      child.once('close', (code) =>
        code === 0 ? resolve() : reject(new Error('RESTORE_SQL_FAILED')),
      );
    });
    const watchdog = setTimeout(() => child.kill(), 30 * 60_000);
    try {
      await Promise.all([done, decryptSql(directory, key, child.stdin)]);
    } catch (error) {
      child.kill();
      throw error;
    } finally {
      clearTimeout(watchdog);
    }
    message('RESTORE_SQL_IMPORTED');
    const restored = await snapshot(container, manifest.database);
    if (
      JSON.stringify(restored.tables) !== JSON.stringify(manifest.tables) ||
      restored.migrationsSha256 !== manifest.migrationsSha256 ||
      restored.schemaSha256 !== manifest.schemaSha256 ||
      (manifest.databaseCharset &&
        restored.databaseCharset !== manifest.databaseCharset) ||
      (manifest.databaseCollation &&
        restored.databaseCollation !== manifest.databaseCollation)
    )
      fail('RESTORED_SCHEMA_OR_MIGRATIONS_MISMATCH');
    const check = await query(
      container,
      `CHECK TABLE ${restored.tables.map((table) => `\`${table}\``).join(',')}`,
      manifest.database,
    );
    const statuses = check.split('\n').map((row) => row.split('\t'));
    if (
      statuses.length !== restored.tables.length ||
      statuses.some((row) => row[2] !== 'status' || row[3] !== 'OK')
    )
      fail('RESTORE_TABLE_CHECK_FAILED');
    if ((await query(container, 'SELECT @@event_scheduler')) !== 'OFF')
      fail('RESTORE_EVENTS_MUST_BE_OFF');
    let totalRows = 0;
    for (const table of restored.tables)
      totalRows += Number(
        await query(
          container,
          `SELECT COUNT(*) FROM \`${table}\``,
          manifest.database,
        ),
      );
    const report = {
      time: new Date().toISOString(),
      backupId: manifest.id,
      container: name,
      network: 'none',
      tables: restored.tables.length,
      totalRows,
      verified: [
        'AES-GCM',
        'SHA256',
        'table inventory',
        'columns and indexes',
        'migration history',
        'CHECK TABLE',
      ],
      notVerified: [
        'application API flows',
        'external attachments',
        'payment provider reconciliation',
      ],
    };
    const reportFile = join(directory, `restore-report-${Date.now()}.json`);
    await writeFile(reportFile, JSON.stringify(report, null, 2) + '\n', {
      flag: 'wx',
      mode: 0o600,
    });
    message('RESTORE_DATABASE_VERIFIED', {
      report: reportFile,
      container: name,
    });
    message('RESTORE_LEFT_ISOLATED', {
      cleanup: `docker rm --force --volumes ${name}`,
    });
    return report;
  } catch (error) {
    if (container)
      await run('docker', ['rm', '--force', '--volumes', container]);
    throw error;
  } finally {
    // Only delete the exact private file created here; no recursive host deletion.
    await rm(envFile, { force: true });
    const { rmdir } = await import('node:fs/promises');
    await rmdir(temp);
  }
}

export {
  restore as restoreIsolatedDatabase,
  mirrorBackup,
  prune as pruneBackups,
};

export async function main(argv = process.argv.slice(2)) {
  const command = argv[0];
  const { values: options, positionals } = parseArgs({
    args: argv.slice(1),
    strict: true,
    allowPositionals: true,
    options: Object.fromEntries(
      [
        'source',
        'out',
        'key',
        'backup',
        'mirror',
        'keep',
        'revision',
        'cloudinary-environment',
      ].map((name) => [name, { type: 'string' }]),
    ),
  });
  if (positionals.length) fail('UNEXPECTED_ARGUMENTS');
  const allowed = {
    keygen: ['key'],
    backup: [
      'source',
      'out',
      'key',
      'mirror',
      'keep',
      'revision',
      'cloudinary-environment',
    ],
    verify: ['backup', 'key'],
    'restore-test': ['backup', 'key'],
  }[command];
  if (!allowed || Object.keys(options).some((name) => !allowed.includes(name)))
    fail('UNSUPPORTED_COMMAND_OR_OPTIONS');
  if (options.keep && !/^[1-9][0-9]*$/.test(options.keep))
    fail('KEEP_MUST_BE_POSITIVE_INTEGER');
  if (options.revision && !/^[a-f0-9]{40}$/.test(options.revision))
    fail('REVISION_MUST_BE_FULL_GIT_SHA');
  if (
    options['cloudinary-environment'] &&
    !['dev', 'test', 'prod'].includes(options['cloudinary-environment'])
  )
    fail('CLOUDINARY_ENVIRONMENT_INVALID');
  if (command === 'keygen') {
    if (!options.key) fail('KEYGEN_REQUIRES_KEY_PATH');
    const file = externalPath(options.key);
    await mkdir(dirname(file), { recursive: true, mode: 0o700 });
    await writeFile(file, randomBytes(32), { flag: 'wx', mode: 0o600 });
    await protectFile(file);
    message('KEY_CREATED_STORE_A_SEPARATE_SECURE_COPY', { file });
  } else if (command === 'backup') await backup(options);
  else if (command === 'verify') {
    if (!options.backup || !options.key) fail('VERIFY_REQUIRES_BACKUP_KEY');
    const manifest = await verifyCompleteArchive(
      resolve(options.backup),
      await readKey(externalPath(options.key)),
    );
    if (basename(resolve(options.backup)) !== manifest.id)
      fail('VERIFY_REQUIRES_PUBLISHED_BACKUP_DIRECTORY');
    message('BACKUP_VERIFIED', { id: manifest.id });
  } else if (command === 'restore-test') await restore(options);
  else fail('COMMANDS_KEYGEN_BACKUP_VERIFY_RESTORE_TEST');
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    // Never log raw Docker/SQL errors, stacks, input values, or environment variables.
    const code = /^[A-Z][A-Z0-9_]+$/.test(error.message ?? '')
      ? error.message
      : 'BACKUP_OPERATION_FAILED';
    console.error(
      JSON.stringify({ time: new Date().toISOString(), event: 'FAILED', code }),
    );
    process.exitCode = 1;
  });
}
