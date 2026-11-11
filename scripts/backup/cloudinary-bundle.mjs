import { execFile } from 'node:child_process';
import { promisify, parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { Readable, Writable } from 'node:stream';
import { mkdir, readFile, writeFile, rename, stat } from 'node:fs/promises';
import { join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  encryptPayload,
  decryptPayload,
  verifyArchive,
  identifier,
  readKey,
  inside,
} from './archive.mjs';
import {
  CloudinaryBackupClient,
  cloudSettings,
  validateReference,
  check,
  sha256,
  MAX_ASSET_BYTES,
} from './cloudinary-client.mjs';

const exec = promisify(execFile);
const archiveFile = 'assets.jsonl.gz.enc';
const repo = resolve(import.meta.dirname, '../..');
const shell =
  'export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; exec mysql --user=root --batch --raw --skip-column-names "$@"';

async function docker(args) {
  try {
    return (
      await exec('docker', args, {
        windowsHide: true,
        timeout: 120_000,
        maxBuffer: 16 * 1024 * 1024,
      })
    ).stdout.trim();
  } catch {
    throw new Error('MEDIA_SNAPSHOT_DOCKER_FAILED');
  }
}
async function ownedContainer(container) {
  check(
    /^vexgo-restore-[a-f0-9-]{36}$/.test(container),
    'MEDIA_RESTORE_CONTAINER_INVALID',
  );
  const info = JSON.parse(await docker(['inspect', container]))[0];
  check(
    info?.State?.Running &&
      info.Config.Labels?.['vn.vexgo.backup-restore'] === '1' &&
      info.HostConfig.NetworkMode === 'none' &&
      !Object.keys(info.HostConfig.PortBindings ?? {}).length,
    'MEDIA_RESTORE_CONTAINER_NOT_ISOLATED',
  );
  return info.Id;
}
async function sql(container, database, query) {
  return docker([
    'exec',
    '-i',
    await ownedContainer(container),
    'sh',
    '-c',
    shell,
    'mysql',
    identifier(database),
    '--execute',
    query,
  ]);
}
async function cleanup(container) {
  if (container)
    await docker([
      'rm',
      '--force',
      '--volumes',
      await ownedContainer(container),
    ]);
}

async function snapshotReferences(databaseBackup, keyPath, manifest) {
  check(
    manifest.tables.includes('TaiNguyenMedia'),
    'MEDIA_REGISTRY_NOT_IN_DB_SNAPSHOT',
  );
  const { restoreIsolatedDatabase } = await import('./vexgo-backup.mjs');
  const report = await restoreIsolatedDatabase({
    backup: databaseBackup,
    key: keyPath,
    skipMediaVerification: true,
  });
  try {
    const query = `SELECT JSON_OBJECT('mediaId',taiNguyenMediaId,'tenantId',nhaXeId,'vehicleId',xeId,'cloud',tenCloud,'folder',thuMuc,'publicId',cloudinaryPublicId,'assetId',cloudinaryAssetId,'version',phienBan,'originalSha256',sha256,'status',trangThai) FROM TaiNguyenMedia ORDER BY taiNguyenMediaId`;
    const output = await sql(report.container, manifest.database, query);
    const rows = output
      ? output.split('\n').map((line) => JSON.parse(line))
      : [];
    check(rows.length <= 1000, 'MEDIA_BACKUP_LIMIT_1000_REQUIRES_REVIEW');
    check(
      !rows.some((row) => ['DANG_TAI', 'CHO_DOI_SOAT'].includes(row.status)),
      'MEDIA_UPLOADS_NOT_SETTLED',
    );
    // A removed reservation without an uploaded asset has no public binary to restore.
    return rows.filter(
      (row) => !(row.status === 'DA_GO' && !row.assetId && !row.version),
    );
  } finally {
    await cleanup(report.container);
  }
}

export class MediaRecords extends Writable {
  constructor(references, handler = async () => {}) {
    super();
    this.references = new Map(references.map((ref) => [ref.mediaId, ref]));
    this.handler = handler;
    this.carry = '';
    this.seen = new Set();
    this.results = [];
    check(
      this.references.size === references.length,
      'MEDIA_DUPLICATE_REFERENCE',
    );
  }
  _write(chunk, encoding, callback) {
    (async () => {
      this.carry += chunk.toString('utf8');
      while (this.carry.includes('\n')) {
        const position = this.carry.indexOf('\n');
        const line = this.carry.slice(0, position);
        this.carry = this.carry.slice(position + 1);
        check(line.length <= 8 * 1024 * 1024, 'MEDIA_RECORD_TOO_LARGE');
        const record = JSON.parse(line);
        const ref = this.references.get(record.mediaId);
        check(
          ref && !this.seen.has(record.mediaId),
          'MEDIA_RECORD_UNKNOWN_OR_DUPLICATE',
        );
        check(
          typeof record.base64 === 'string' &&
            record.base64.length <= Math.ceil(MAX_ASSET_BYTES / 3) * 4 &&
            /^[a-f0-9]{64}$/.test(record.fileSha256 ?? ''),
          'MEDIA_RECORD_INVALID',
        );
        const buffer = Buffer.from(record.base64, 'base64');
        check(
          buffer.toString('base64') === record.base64 &&
            buffer.length > 0 &&
            buffer.length <= MAX_ASSET_BYTES &&
            sha256(buffer) === record.fileSha256 &&
            buffer.toString('ascii', 0, 4) === 'RIFF' &&
            buffer.toString('ascii', 8, 12) === 'WEBP',
          'MEDIA_RECORD_HASH_OR_BYTES_INVALID',
        );
        this.seen.add(record.mediaId);
        this.results.push({
          mediaId: record.mediaId,
          fileSha256: record.fileSha256,
          bytes: buffer.length,
        });
        await this.handler({ ...ref, fileSha256: record.fileSha256 }, buffer);
      }
      check(this.carry.length <= 8 * 1024 * 1024, 'MEDIA_RECORD_TOO_LARGE');
    })().then(() => callback(), callback);
  }
  _final(callback) {
    try {
      check(
        !this.carry.length && this.seen.size === this.references.size,
        'MEDIA_ARCHIVE_INCOMPLETE',
      );
      callback();
    } catch (error) {
      callback(error);
    }
  }
}

async function mediaManifest(databaseBackup, databaseManifest) {
  const path = join(databaseBackup, 'media', 'manifest.json');
  check((await stat(path)).size <= 2 * 1024 * 1024, 'MEDIA_MANIFEST_TOO_LARGE');
  const manifest = JSON.parse(await readFile(path, 'utf8'));
  check(
    manifest.format === 1 &&
      manifest.kind === 'vexgo-cloudinary-files' &&
      manifest.sourceBackupId === databaseManifest.id &&
      manifest.sourceSqlSha256 === databaseManifest.sha256 &&
      manifest.environment === databaseManifest.cloudinaryEnvironment &&
      /^[a-zA-Z0-9_-]{1,128}$/.test(manifest.cloud ?? ''),
    'MEDIA_MANIFEST_OR_DB_MISMATCH',
  );
  check(
    Array.isArray(manifest.references) &&
      manifest.references.length <= 1000 &&
      /^[a-f0-9]{64}$/.test(manifest.sha256 ?? '') &&
      Number.isSafeInteger(manifest.bytes) &&
      manifest.bytes >= 37,
    'MEDIA_MANIFEST_INVALID',
  );
  for (const ref of manifest.references)
    validateReference(ref, {
      cloud: manifest.cloud,
      environment: manifest.environment,
    });
  return manifest;
}

export async function verifyMediaForDatabase(
  databaseBackup,
  key,
  databaseManifest,
) {
  const manifest = await mediaManifest(databaseBackup, databaseManifest);
  const records = new MediaRecords(manifest.references);
  await decryptPayload(
    join(databaseBackup, 'media', archiveFile),
    manifest,
    key,
    records,
  );
  return { manifest, files: records.results };
}

export async function backupMediaForDatabase({
  databaseBackup,
  keyPath,
  environment,
  client,
}) {
  const key = await readKey(keyPath);
  const db = await verifyArchive(databaseBackup, key);
  check(
    db.mediaRequired === true && db.cloudinaryEnvironment === environment,
    'MEDIA_BACKUP_REQUIRES_AUTHENTICATED_DB_BINDING',
  );
  const remote =
    client ?? new CloudinaryBackupClient(cloudSettings(environment));
  const references = await snapshotReferences(databaseBackup, keyPath, db);
  for (const ref of references) validateReference(ref, remote.config);
  const folder = join(databaseBackup, `.media-partial-${randomUUID()}`);
  check(
    inside(databaseBackup, folder) &&
      inside(databaseBackup, join(databaseBackup, 'media')),
    'UNSAFE_MEDIA_PATH',
  );
  await mkdir(folder, { mode: 0o700 });
  const metadata = {
    format: 1,
    kind: 'vexgo-cloudinary-files',
    sourceBackupId: db.id,
    sourceSqlSha256: db.sha256,
    environment,
    cloud: remote.config.cloud,
    createdAt: new Date().toISOString(),
    references,
  };
  async function* payload() {
    for (const ref of references) {
      const file = await remote.download(ref);
      yield Buffer.from(
        JSON.stringify({
          mediaId: ref.mediaId,
          fileSha256: file.sha256,
          base64: file.buffer.toString('base64'),
        }) + '\n',
      );
    }
  }
  await encryptPayload(
    Readable.from(payload()),
    join(folder, archiveFile),
    join(folder, 'manifest.json'),
    key,
    metadata,
  );
  // Authenticate and validate all records before declaring this media component complete.
  const manifest = JSON.parse(
    await readFile(join(folder, 'manifest.json'), 'utf8'),
  );
  await decryptPayload(
    join(folder, archiveFile),
    manifest,
    key,
    new MediaRecords(references),
  );
  await rename(folder, join(databaseBackup, 'media'));
  console.log(
    JSON.stringify({
      event: 'MEDIA_BACKUP_VERIFIED',
      assets: references.length,
      databaseBackupId: db.id,
    }),
  );
  return verifyMediaForDatabase(databaseBackup, key, db);
}

async function relinkSnapshot(container, database, mapping) {
  if (!mapping.length) return;
  const proc = `RestoreMedia_${randomUUID().replaceAll('-', '')}`;
  // Values below are validated IDs/hashes, generated URLs and bounded numeric metadata,
  // never free text, credentials, filenames or an operator-supplied SQL fragment.
  const statements = mapping.map(({ original, restored }) => {
    check(
      /^[a-f0-9-]{36}$/.test(original.mediaId) &&
        /^[a-zA-Z0-9_/-]+$/.test(original.publicId) &&
        /^[a-zA-Z0-9_/-]+$/.test(restored.publicId) &&
        /^[a-zA-Z0-9_-]+$/.test(restored.cloud) &&
        /^[a-zA-Z0-9_-]+$/.test(restored.assetId) &&
        Number.isSafeInteger(restored.version),
      'MEDIA_RELINK_VALUE_INVALID',
    );
    check(
      restored.folder === restored.publicId.split('/').slice(0, -1).join('/') &&
        restored.url ===
          `https://res.cloudinary.com/${restored.cloud}/image/upload/v${restored.version}/${restored.publicId}.webp`,
      'MEDIA_RELINK_URL_INVALID',
    );
    return `UPDATE TaiNguyenMedia SET tenCloud='${restored.cloud}',thuMuc='${restored.folder}',cloudinaryPublicId='${restored.publicId}',cloudinaryAssetId='${restored.assetId}',phienBan=${restored.version},urlCongKhai='${restored.url}' WHERE taiNguyenMediaId='${original.mediaId}' AND cloudinaryPublicId='${original.publicId}'; IF ROW_COUNT() <> 1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='MEDIA_RELINK_CONFLICT'; END IF;`;
  });
  const command = `DELIMITER $$\nCREATE PROCEDURE ${proc}() BEGIN DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END; START TRANSACTION; ${statements.join('\n')} COMMIT; END$$\nDELIMITER ;\nCALL ${proc}(); DROP PROCEDURE ${proc};`;
  // Pass batch SQL through stdin, so mysql recognizes DELIMITER and no SQL is shell-expanded.
  const { spawn } = await import('node:child_process');
  const id = await ownedContainer(container);
  const child = spawn(
    'docker',
    ['exec', '-i', id, 'sh', '-c', shell, 'mysql', identifier(database)],
    { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] },
  );
  child.stderr.resume();
  const done = new Promise((resolve, reject) => {
    child.once('error', () => reject(new Error('MEDIA_RELINK_FAILED')));
    child.once('close', (code) =>
      code === 0 ? resolve() : reject(new Error('MEDIA_RELINK_FAILED')),
    );
  });
  child.stdin.on('error', () => {});
  child.stdin.end(command);
  await done;
  const result = await sql(
    container,
    database,
    'SELECT COUNT(*) FROM TaiNguyenMedia',
  );
  check(
    Number.isSafeInteger(Number(result)),
    'MEDIA_RELINK_VERIFICATION_FAILED',
  );
}

export async function restoreMediaTest({ databaseBackup, keyPath, client }) {
  const key = await readKey(keyPath);
  const db = await verifyArchive(databaseBackup, key);
  check(
    db.mediaRequired === true && basename(databaseBackup) === db.id,
    'MEDIA_RESTORE_REQUIRES_COMPLETE_PUBLISHED_BACKUP',
  );
  const verified = await verifyMediaForDatabase(databaseBackup, key, db); // Full GCM authentication before any upload.
  const remote =
    client ??
    new CloudinaryBackupClient(cloudSettings(verified.manifest.environment));
  const restoreId = randomUUID();
  const mapPath = join(databaseBackup, `media-restore-${restoreId}.json`);
  const report = {
    restoreId,
    databaseBackupId: db.id,
    folderPrefix: `vexgo/test/restores/${restoreId}`,
    state: 'UPLOADING',
    mapping: [],
  };
  await writeFile(mapPath, JSON.stringify(report, null, 2) + '\n', {
    flag: 'wx',
    mode: 0o600,
  });
  const records = new MediaRecords(
    verified.manifest.references,
    async (ref, buffer) => {
      const restored = await remote.restoreTest(ref, buffer, restoreId);
      report.mapping.push({ original: ref, restored });
      await writeFile(mapPath, JSON.stringify(report, null, 2) + '\n', {
        mode: 0o600,
      });
    },
  );
  await decryptPayload(
    join(databaseBackup, 'media', archiveFile),
    verified.manifest,
    key,
    records,
  );
  const { restoreIsolatedDatabase } = await import('./vexgo-backup.mjs');
  const snapshot = await restoreIsolatedDatabase({
    backup: databaseBackup,
    key: keyPath,
  });
  try {
    await relinkSnapshot(snapshot.container, db.database, report.mapping);
    for (const { original, restored } of report.mapping) {
      const count = await sql(
        snapshot.container,
        db.database,
        `SELECT COUNT(*) FROM TaiNguyenMedia WHERE taiNguyenMediaId='${original.mediaId}' AND cloudinaryPublicId='${restored.publicId}' AND cloudinaryAssetId='${restored.assetId}' AND phienBan=${restored.version}`,
      );
      check(count === '1', 'MEDIA_RELINK_VERIFICATION_FAILED');
    }
    report.state = 'VERIFIED';
    report.checkedAt = new Date().toISOString();
    report.databaseRelinkedInIsolatedContainer = true;
    await writeFile(mapPath, JSON.stringify(report, null, 2) + '\n', {
      mode: 0o600,
    });
    console.log(
      JSON.stringify({
        event: 'MEDIA_RESTORE_TEST_VERIFIED',
        assets: report.mapping.length,
        report: mapPath,
        cloudFilesRetained: true,
        databaseMainUnchanged: true,
      }),
    );
    return report;
  } finally {
    await cleanup(snapshot.container);
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const command = process.argv[2];
  const execute = async () => {
    const { values, positionals } = parseArgs({
      args: process.argv.slice(3),
      strict: true,
      allowPositionals: true,
      options: { backup: { type: 'string' }, key: { type: 'string' } },
    });
    check(
      command === 'restore-test' &&
        !positionals.length &&
        values.backup &&
        values.key,
      'MEDIA_RESTORE_USAGE_BACKUP_AND_KEY',
    );
    check(!inside(repo, resolve(values.key)), 'MEDIA_KEY_MUST_BE_OUTSIDE_REPO');
    await restoreMediaTest({
      databaseBackup: resolve(values.backup),
      keyPath: resolve(values.key),
    });
  };
  execute().catch((error) => {
    console.error(
      JSON.stringify({
        event: 'FAILED',
        code: /^[A-Z][A-Z0-9_]+$/.test(error.message ?? '')
          ? error.message
          : 'MEDIA_OPERATION_FAILED',
      }),
    );
    process.exitCode = 1;
  });
}
