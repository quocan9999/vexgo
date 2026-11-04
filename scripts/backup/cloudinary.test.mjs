import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import {
  inside,
  encryptPayload,
  decryptPayload,
  checksum,
} from './archive.mjs';
import {
  CloudinaryBackupClient,
  cloudSettings,
  validateReference,
  uploadSignature,
  sha256,
} from './cloudinary-client.mjs';
import { MediaRecords } from './cloudinary-bundle.mjs';

const bytes = Buffer.from(
  'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA',
  'base64',
);
const ref = {
  mediaId: '83bf055f-f6c4-46b8-9270-63cfc9442aee',
  tenantId: 3,
  vehicleId: 14,
  cloud: 'fixture-cloud',
  folder: 'vexgo/test/bus-companies/3/vehicles/14',
  publicId:
    'vexgo/test/bus-companies/3/vehicles/14/83bf055f-f6c4-46b8-9270-63cfc9442aee',
  assetId: 'abcdef012345',
  version: 1,
  status: 'SAN_SANG',
  originalSha256: 'a'.repeat(64),
};
const config = {
  cloud: 'fixture-cloud',
  key: 'fixture-key',
  secret: 'fixture-secret',
  environment: 'test',
  mode: 'dynamic',
};
const metadata = {
  asset_id: ref.assetId,
  public_id: ref.publicId,
  asset_folder: ref.folder,
  version: 1,
  type: 'upload',
  resource_type: 'image',
  format: 'webp',
  bytes: bytes.length,
  etag: 'b'.repeat(32),
  context: { custom: { sha256: ref.originalSha256 } },
};

test('reference validation prevents cross-environment/account/path injection and unfinalized uploads', () => {
  assert.equal(validateReference(ref, config), ref);
  for (const changed of [
    { cloud: 'different' },
    { folder: 'vexgo/prod/private' },
    { publicId: '../../private' },
    { assetId: null },
    { status: 'DANG_TAI' },
    { version: 0 },
  ])
    assert.throws(() => validateReference({ ...ref, ...changed }, config));
  assert.throws(() => cloudSettings('prod', { CLOUDINARY_CLOUD_NAME: 'x' }));
});

test('REST signing covers the exact sorted parameters and never includes credentials/file', () => {
  const signature = uploadSignature(
    { timestamp: '123', public_id: 'abc', overwrite: 'false' },
    'fixture-secret',
  );
  assert.equal(
    signature,
    createHash('sha256')
      .update('overwrite=false&public_id=abc&timestamp=123fixture-secret')
      .digest('hex'),
  );
});

test('download ignores provider URL fields, verifies identity/version/context/ETag and streams exact bytes', async () => {
  const calls = [];
  const client = new CloudinaryBackupClient(config, async (url, options) => {
    calls.push({ url, options });
    if (url.startsWith('https://api.cloudinary.com/'))
      return Response.json({
        ...metadata,
        secure_url: 'http://127.0.0.1/private',
      });
    return new Response(bytes, {
      headers: { 'content-type': 'image/webp', etag: `"${metadata.etag}"` },
    });
  });
  const result = await client.download(ref);
  assert.deepEqual(result.buffer, bytes);
  assert.equal(result.sha256, sha256(bytes));
  assert.ok(calls[0].url.includes('media_metadata=true'));
  assert.ok(
    calls[1].url.startsWith(
      'https://res.cloudinary.com/fixture-cloud/image/upload/v1/vexgo/test/',
    ),
  );
  assert.equal(calls[1].options.redirect, 'error');
  assert.equal(calls[1].options.headers['If-Match'], `"${metadata.etag}"`);
});

test('changed cloud identity, version, content hash, folder or CDN ETag fails closed', async () => {
  for (const changed of [
    { asset_id: 'different' },
    { version: 2 },
    { asset_folder: 'vexgo/prod' },
    { context: { custom: { sha256: 'c'.repeat(64) } } },
  ]) {
    const client = new CloudinaryBackupClient(config, async () =>
      Response.json({ ...metadata, ...changed }),
    );
    await assert.rejects(client.download(ref));
  }
  const client = new CloudinaryBackupClient(config, async (url) =>
    url.startsWith('https://api.')
      ? Response.json(metadata)
      : new Response(bytes, {
          headers: { 'content-type': 'image/webp', etag: '"different"' },
        }),
  );
  await assert.rejects(client.download(ref), /ETAG_MISMATCH/);
});

test('provider failures expose bounded codes, not response bodies or credentials', async () => {
  const client = new CloudinaryBackupClient(
    config,
    async () => new Response('sensitive provider text', { status: 401 }),
  );
  await assert.rejects(client.download(ref), {
    message: 'CLOUDINARY_HTTP_401',
  });
  const disconnected = new CloudinaryBackupClient(config, async () => {
    throw new Error('fixture-secret in raw diagnostic');
  });
  await assert.rejects(disconnected.download(ref), {
    message: 'CLOUDINARY_NETWORK_FAILED',
  });
});

test('media records require exact file hashes, membership and a complete newline-terminated stream', async () => {
  const valid = {
    mediaId: ref.mediaId,
    fileSha256: sha256(bytes),
    base64: bytes.toString('base64'),
  };
  for (const records of [
    [{ ...valid, fileSha256: 'd'.repeat(64) }],
    [valid, valid],
    [{ ...valid, mediaId: 'unknown' }],
    [],
  ]) {
    const sink = new MediaRecords([ref]);
    await assert.rejects(
      new Promise((resolve, reject) => {
        sink.on('finish', resolve).on('error', reject);
        sink.end(
          records.map((record) => JSON.stringify(record) + '\n').join(''),
        );
      }),
    );
  }
});

test('encrypted media round trip preserves bytes and wrong key/altered metadata or ciphertext cannot verify', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'vexgo-media-archive-'));
  t.after(async () => {
    assert.ok(inside(tmpdir(), root));
    await rm(root, { recursive: true });
  });
  const key = randomBytes(32),
    file = join(root, 'assets.enc'),
    manifestFile = join(root, 'manifest.json');
  const line =
    JSON.stringify({
      mediaId: ref.mediaId,
      fileSha256: sha256(bytes),
      base64: bytes.toString('base64'),
    }) + '\n';
  const manifest = await encryptPayload(
    Readable.from([line]),
    file,
    manifestFile,
    key,
    { kind: 'vexgo-cloudinary-files', references: [ref] },
  );
  let called = 0;
  await decryptPayload(
    file,
    manifest,
    key,
    new MediaRecords([ref], async (record, buffer) => {
      called++;
      assert.deepEqual(buffer, bytes);
      assert.equal(record.fileSha256, sha256(bytes));
    }),
  );
  assert.equal(called, 1);
  assert.equal((await readFile(file)).includes(bytes), false);
  await assert.rejects(
    decryptPayload(file, manifest, randomBytes(32), new MediaRecords([ref])),
  );
  await assert.rejects(
    decryptPayload(
      file,
      { ...manifest, kind: 'different' },
      key,
      new MediaRecords([ref]),
    ),
  );
  const corrupted = await readFile(file);
  corrupted[24] ^= 1;
  await writeFile(file, corrupted);
  await assert.rejects(
    decryptPayload(
      file,
      { ...manifest, sha256: await checksum(file) },
      key,
      new MediaRecords([ref]),
    ),
  );
});
