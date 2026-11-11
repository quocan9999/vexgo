import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { Readable, Writable } from 'node:stream';
import {
  encryptSql,
  decryptSql,
  verifyArchive,
  checksum,
  identifier,
  inside,
  archiveName,
  manifestName,
} from './archive.mjs';
import { dumpOptions, restoreArgs, main } from './vexgo-backup.mjs';

const metadata = {
  format: 1,
  kind: 'vexgo-mysql-logical',
  id: 'vexgo-backup-2026-11-03T00-00-00-000Z-12345678',
  database: 'vexgo',
  mysqlVersion: '8.4.7',
  createdAt: '2026-11-03T00:00:00.000Z',
  sourceImage: 'sha256:' + 'a'.repeat(64),
  schemaSha256: 'b'.repeat(64),
  migrationsSha256: 'c'.repeat(64),
  tables: ['Ve', '_prisma_migrations'],
};

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'vexgo-backup-test-'));
  t.after(async () => {
    // Exact directory from mkdtemp, never supplied by the operator.
    assert.ok(inside(tmpdir(), root));
    await rm(root, { recursive: true });
  });
  const directory = join(root, 'archive');
  const key = randomBytes(32);
  const sql = Buffer.from(
    "CREATE TABLE example(id INT, ten VARCHAR(100));\nINSERT INTO example VALUES (1, 'Đà Lạt 🎒');\n",
  );
  await encryptSql(
    Readable.from([sql.subarray(0, 7), sql.subarray(7)]),
    directory,
    key,
    metadata,
  );
  return { directory, key, sql };
}

test('encrypted gzip round trip preserves SQL bytes and Unicode; disk has no plaintext', async (t) => {
  const { directory, key, sql } = await fixture(t);
  const chunks = [];
  const manifest = await decryptSql(
    directory,
    key,
    new Writable({
      write(chunk, encoding, callback) {
        chunks.push(chunk);
        callback();
      },
    }),
  );
  assert.deepEqual(Buffer.concat(chunks), sql);
  assert.equal(manifest.database, 'vexgo');
  assert.equal(
    (await readFile(join(directory, archiveName))).includes(sql),
    false,
  );
});

test('wrong key is rejected by GCM authentication', async (t) => {
  const { directory } = await fixture(t);
  await assert.rejects(verifyArchive(directory, randomBytes(32)));
});

test('changed ciphertext is rejected even if attacker recomputes its checksum', async (t) => {
  const { directory, key } = await fixture(t);
  const file = join(directory, archiveName);
  const data = await readFile(file);
  data[24] ^= 1;
  await writeFile(file, data);
  const manifestFile = join(directory, manifestName);
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
  manifest.sha256 = await checksum(file);
  await writeFile(manifestFile, JSON.stringify(manifest));
  await assert.rejects(verifyArchive(directory, key));
});

test('tampered manifest cannot change the database or migration history', async (t) => {
  const { directory, key } = await fixture(t);
  const file = join(directory, manifestName);
  const manifest = JSON.parse(await readFile(file, 'utf8'));
  manifest.database = 'different_db';
  await writeFile(file, JSON.stringify(manifest));
  await assert.rejects(verifyArchive(directory, key));
});

test('truncated SQL archive is rejected before restore', async (t) => {
  const { directory, key } = await fixture(t);
  const file = join(directory, archiveName);
  await writeFile(file, (await readFile(file)).subarray(0, 35));
  await assert.rejects(verifyArchive(directory, key), /CHECKSUM_MISMATCH/);
});

test('dump failure cannot produce a manifest eligible for restore', async (t) => {
  const { directory, key } = await fixture(t);
  const partial = directory + '-partial';
  async function* broken() {
    yield Buffer.from('INSERT INTO x');
    throw new Error('source disconnected');
  }
  await assert.rejects(
    encryptSql(Readable.from(broken()), partial, key, metadata),
    /source disconnected/,
  );
  await assert.rejects(verifyArchive(partial, key));
});

test('identifiers reject SQL fragments, options and system databases', () => {
  assert.equal(identifier('vexgo_restore_01'), 'vexgo_restore_01');
  for (const name of [
    'mysql',
    'SYS',
    '--all-databases',
    'a;DROP DATABASE vexgo',
    '../vexgo',
    '',
    undefined,
  ]) {
    assert.throws(() => identifier(name));
  }
  assert.equal(inside('/backup', '/backup-other/a'), false);
  assert.equal(inside('/backup', '/backup/../secret'), false);
});

test('restore always uses a newly named container with no network, host port or source mount', () => {
  const args = restoreArgs(
    'vexgo-restore-12345678-1234-1234-1234-123456789abc',
    'sha256:' + 'a'.repeat(64),
    'private.env',
  );
  assert.equal(args[args.indexOf('--network') + 1], 'none');
  assert.ok(args.includes('--event-scheduler=OFF'));
  assert.ok(args.includes('--local-infile=0'));
  for (const flag of [
    '--publish',
    '-p',
    '--volume',
    '-v',
    '--mount',
    '--privileged',
  ])
    assert.equal(args.includes(flag), false);
  assert.throws(() =>
    restoreArgs('vexgo_web-mysql-1', 'mysql:8.4', 'private.env'),
  );
  assert.ok(dumpOptions.includes('--single-transaction'));
  assert.equal(dumpOptions.includes('--all-databases'), false);
});

test('CLI rejects a supplied restore destination and invalid retention before touching Docker', async () => {
  await assert.rejects(
    main(['restore-test', '--source', 'vexgo_web-mysql-1']),
    /UNSUPPORTED_COMMAND_OR_OPTIONS/,
  );
  await assert.rejects(
    main(['backup', '--keep', '0']),
    /KEEP_MUST_BE_POSITIVE_INTEGER/,
  );
  await assert.rejects(
    main(['backup', '--keep=-1']),
    /KEEP_MUST_BE_POSITIVE_INTEGER/,
  );
});
