import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import {
  mkdtemp,
  writeFile,
  readFile,
  readdir,
  mkdir,
  rm,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { PassThrough } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';
import {
  encryptSql,
  decryptSql,
  readKey,
  loadManifest,
  inside,
} from './archive.mjs';
import {
  main,
  restoreArgs,
  mirrorBackup,
  pruneBackups,
} from './vexgo-backup.mjs';
import {
  backupMediaForDatabase,
  verifyMediaForDatabase,
  restoreMediaTest,
} from './cloudinary-bundle.mjs';
import {
  CloudinaryBackupClient,
  cloudSettings,
  validateReference,
  sha256,
} from './cloudinary-client.mjs';

const exec = promisify(execFile);
const live = process.env.VEXGO_CLOUDINARY_LIVE_TEST === '1';
const sample = Buffer.from(
  'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA',
  'base64',
);
const shell =
  'export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; exec mysql --protocol=TCP --host=127.0.0.1 --user=root --batch --raw --skip-column-names "$MYSQL_DATABASE"';

async function sql(container, input) {
  const child = spawn('docker', ['exec', '-i', container, 'sh', '-c', shell], {
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk;
  });
  child.stderr.resume();
  const done = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) =>
      code === 0
        ? resolve(output.trim())
        : reject(new Error('FIXTURE_SQL_FAILED')),
    );
  });
  child.stdin.on('error', () => {});
  child.stdin.end(input);
  return done;
}

test(
  live
    ? 'live Cloudinary: encrypted snapshot-linked backup, restore in test folder and DB relinking'
    : 'MySQL + mocked Cloudinary: complete media bundle, mirror, corruption guard and restore relinking',
  {
    skip: process.env.VEXGO_BACKUP_DOCKER_TEST !== '1',
    timeout: 240_000,
  },
  async (t) => {
    const evidenceRoot = live
      ? process.env.VEXGO_MEDIA_EVIDENCE_ROOT
      : undefined;
    if (live) {
      assert.ok(evidenceRoot, 'live evidence root required');
      assert.equal(inside(process.cwd(), evidenceRoot), false);
      await mkdir(evidenceRoot, { recursive: true });
    }
    const root = await mkdtemp(
      join(evidenceRoot ?? tmpdir(), 'vexgo-media-bundle-'),
    );
    let source;
    t.after(async () => {
      if (source)
        await exec('docker', ['rm', '--force', '--volumes', source], {
          windowsHide: true,
        });
      if (!live) {
        assert.ok(inside(tmpdir(), root));
        await rm(root, { recursive: true });
      } else {
        await rm(join(root, 'mysql.env'), { force: true });
        console.log(`MEDIA_BUNDLE_EVIDENCE=${root}`);
      }
    });
    const config = live
      ? cloudSettings('test')
      : {
          cloud: 'fixture-cloud',
          key: 'fixture-key',
          secret: 'fixture-secret',
          mode: 'dynamic',
          environment: 'test',
        };
    const ref = live
      ? {
          ...JSON.parse(
            await readFile(process.env.VEXGO_CLOUDINARY_REFERENCE_FILE, 'utf8'),
          ),
          status: 'SAN_SANG',
        }
      : {
          mediaId: randomUUID(),
          tenantId: 3,
          vehicleId: 14,
          cloud: config.cloud,
          folder: 'vexgo/test/bus-companies/3/vehicles/14',
          assetId: 'testasset123',
          version: 1,
          status: 'SAN_SANG',
          originalSha256: 'a'.repeat(64),
        };
    ref.publicId ??= `${ref.folder}/${ref.mediaId}`;
    validateReference(ref, config);
    let restoreCalls = 0;
    const actual = live ? new CloudinaryBackupClient(config) : null;
    const client = {
      config,
      download: actual
        ? actual.download.bind(actual)
        : async () => ({ buffer: sample, sha256: sha256(sample) }),
      restoreTest: async (row, buffer, restoreId) => {
        restoreCalls++;
        if (actual) return actual.restoreTest(row, buffer, restoreId);
        assert.equal(sha256(buffer), row.fileSha256);
        const folder = `vexgo/test/restores/${restoreId}/bus-companies/${row.tenantId}/vehicles/${row.vehicleId}`;
        const publicId = `${folder}/${row.mediaId}`;
        return {
          ...row,
          folder,
          publicId,
          assetId: randomUUID(),
          version: 2,
          url: `https://res.cloudinary.com/${config.cloud}/image/upload/v2/${publicId}.webp`,
        };
      },
    };
    const secret = randomBytes(32).toString('hex');
    const envFile = join(root, 'mysql.env');
    await writeFile(
      envFile,
      `MYSQL_ROOT_PASSWORD=${secret}\nMYSQL_DATABASE=vexgo_media_fixture\n`,
      { mode: 0o600 },
    );
    const image = JSON.parse(
      (await exec('docker', ['image', 'inspect', 'mysql:8.4'])).stdout,
    )[0].Id;
    source = (
      await exec(
        'docker',
        restoreArgs(`vexgo-restore-${randomUUID()}`, image, envFile),
        { windowsHide: true },
      )
    ).stdout.trim();
    let ready = false;
    for (let i = 0; i < 90; i++) {
      try {
        await sql(source, 'SELECT 1;');
        ready = true;
        break;
      } catch {
        await delay(1000);
      }
    }
    assert.ok(ready);
    const originalUrl = `https://res.cloudinary.com/${config.cloud}/image/upload/v${ref.version}/${ref.publicId}.webp`;
    await sql(
      source,
      `CREATE TABLE TaiNguyenMedia (taiNguyenMediaId VARCHAR(36) PRIMARY KEY,nhaXeId INT,xeId INT,tenCloud VARCHAR(128),thuMuc VARCHAR(255),cloudinaryPublicId VARCHAR(500),cloudinaryAssetId VARCHAR(128),phienBan BIGINT,sha256 CHAR(64),trangThai VARCHAR(30),urlCongKhai VARCHAR(1000)); INSERT INTO TaiNguyenMedia VALUES('${ref.mediaId}',${ref.tenantId},${ref.vehicleId},'${ref.cloud}','${ref.folder}','${ref.publicId}','${ref.assetId}',${ref.version},'${ref.originalSha256}','SAN_SANG','${originalUrl}');`,
    );
    const keyPath = join(root, 'private', 'backup.key');
    await main(['keygen', '--key', keyPath]);
    const rawRoot = join(root, 'raw'),
      boundRoot = join(root, 'bound'),
      mirrorRoot = join(root, 'mirror');
    await main([
      'backup',
      '--source',
      source,
      '--out',
      rawRoot,
      '--key',
      keyPath,
    ]);
    const original = join(rawRoot, (await readdir(rawRoot))[0]);
    const key = await readKey(keyPath),
      originalManifest = await loadManifest(original);
    const {
      sha256: ignoredHash,
      bytes: ignoredSize,
      ...sourceMetadata
    } = originalManifest;
    await mkdir(boundRoot);
    const bind = async () => {
      const id = `vexgo-backup-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomBytes(4).toString('hex')}`;
      const directory = join(boundRoot, id),
        stream = new PassThrough();
      await Promise.all([
        decryptSql(original, key, stream),
        encryptSql(stream, directory, key, {
          ...sourceMetadata,
          id,
          createdAt: new Date().toISOString(),
          mediaRequired: true,
          cloudinaryEnvironment: 'test',
        }),
      ]);
      return directory;
    };
    const bound = await bind();
    await assert.rejects(
      main(['verify', '--backup', bound, '--key', keyPath]),
      'media-required DB alone is never a complete backup',
    );
    await backupMediaForDatabase({
      databaseBackup: bound,
      keyPath,
      environment: 'test',
      client,
    });
    const verified = await verifyMediaForDatabase(
      bound,
      key,
      await loadManifest(bound),
    );
    assert.equal(verified.files.length, 1);
    await main(['verify', '--backup', bound, '--key', keyPath]);
    await mirrorBackup(bound, mirrorRoot, key);
    await main([
      'verify',
      '--backup',
      join(mirrorRoot, (await loadManifest(bound)).id),
      '--key',
      keyPath,
    ]);
    const report = await restoreMediaTest({
      databaseBackup: bound,
      keyPath,
      client,
    });
    if (live)
      await writeFile(
        join(root, 'live-restore-report.json'),
        JSON.stringify(report, null, 2) + '\n',
        { mode: 0o600 },
      );
    assert.equal(report.state, 'VERIFIED');
    assert.equal(report.databaseRelinkedInIsolatedContainer, true);
    assert.equal(report.mapping.length, 1);
    assert.ok(
      report.mapping[0].restored.folder.startsWith('vexgo/test/restores/'),
    );
    assert.notEqual(report.mapping[0].restored.publicId, ref.publicId);
    assert.equal(
      await sql(source, 'SELECT urlCongKhai FROM TaiNguyenMedia;'),
      originalUrl,
      'source SQL unchanged',
    );
    const archive = join(bound, 'media', 'assets.jsonl.gz.enc'),
      clean = await readFile(archive),
      bad = Buffer.from(clean);
    bad[24] ^= 1;
    await writeFile(archive, bad);
    const countBefore = restoreCalls;
    await assert.rejects(
      restoreMediaTest({ databaseBackup: bound, keyPath, client }),
    );
    assert.equal(
      restoreCalls,
      countBefore,
      'corruption rejected before upload',
    );
    await writeFile(archive, clean);
    // A failed new package must stop retention instead of deleting the last complete one.
    const incomplete = await bind();
    await assert.rejects(pruneBackups(boundRoot, '1', key));
    assert.ok(
      (await readdir(boundRoot)).includes((await loadManifest(bound)).id),
    );
    await backupMediaForDatabase({
      databaseBackup: incomplete,
      keyPath,
      environment: 'test',
      client,
    });
    await pruneBackups(boundRoot, '1', key);
    assert.equal((await readdir(boundRoot)).length, 1);
    assert.equal((await readdir(mirrorRoot)).length, 1);
    const savedFetch = globalThis.fetch;
    const envKeys = [
      'CLOUDINARY_CLOUD_NAME',
      'CLOUDINARY_API_KEY',
      'CLOUDINARY_API_SECRET',
      'CLOUDINARY_FOLDER_MODE',
    ];
    const savedEnv = Object.fromEntries(
      envKeys.map((key) => [key, process.env[key]]),
    );
    if (!live) {
      process.env.CLOUDINARY_CLOUD_NAME = ref.cloud;
      process.env.CLOUDINARY_API_KEY = 'fixture-key';
      process.env.CLOUDINARY_API_SECRET = 'fixture-secret';
      process.env.CLOUDINARY_FOLDER_MODE = 'dynamic';
      globalThis.fetch = async (url) =>
        String(url).startsWith('https://api.cloudinary.com/')
          ? Response.json({
              asset_id: ref.assetId,
              public_id: ref.publicId,
              asset_folder: ref.folder,
              version: ref.version,
              type: 'upload',
              resource_type: 'image',
              format: 'webp',
              bytes: sample.length,
              etag: 'b'.repeat(32),
              context: { custom: { sha256: ref.originalSha256 } },
            })
          : new Response(sample, {
              headers: {
                'content-type': 'image/webp',
                etag: '"' + 'b'.repeat(32) + '"',
              },
            });
    }
    try {
      const completeRoot = join(root, 'integrated-cli'),
        completeMirror = join(root, 'integrated-mirror');
      await main([
        'backup',
        '--source',
        source,
        '--out',
        completeRoot,
        '--key',
        keyPath,
        '--cloudinary-environment',
        'test',
        '--mirror',
        completeMirror,
        '--keep',
        '1',
      ]);
      const complete = join(completeRoot, (await readdir(completeRoot))[0]);
      assert.equal((await loadManifest(complete)).mediaRequired, true);
      await main(['verify', '--backup', complete, '--key', keyPath]);
      assert.equal((await readdir(completeMirror)).length, 1);
    } finally {
      globalThis.fetch = savedFetch;
      for (const key of envKeys)
        if (savedEnv[key] === undefined) delete process.env[key];
        else process.env[key] = savedEnv[key];
    }
    const failedRoot = join(root, 'failed');
    await assert.rejects(
      main([
        'backup',
        '--source',
        source,
        '--out',
        failedRoot,
        '--key',
        keyPath,
        '--cloudinary-environment',
        'prod',
        '--keep',
        '1',
      ]),
    );
    const failed = await readdir(failedRoot);
    assert.equal(failed.length, 1);
    assert.ok(
      failed[0].startsWith('.partial-'),
      'a failed integrated media job never publishes a complete backup',
    );
    assert.equal(
      (await readdir(mirrorRoot)).length,
      1,
      'media failure cannot delete the second copy',
    );
  },
);
