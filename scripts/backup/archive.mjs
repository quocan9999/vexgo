import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { Transform, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGzip, createGunzip } from 'node:zlib';

const magic = Buffer.from('VEXGOBK1');
export const archiveName = 'database.sql.gz.enc';
export const manifestName = 'manifest.json';

export function inside(parent, child) {
  const path = relative(resolve(parent), resolve(child));
  return path === '' || (!path.startsWith('..') && !isAbsolute(path));
}

export function identifier(value) {
  if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(value ?? '')) {
    throw new Error('INVALID_DATABASE_IDENTIFIER');
  }
  if (
    ['mysql', 'sys', 'performance_schema', 'information_schema'].includes(
      value.toLowerCase(),
    )
  ) {
    throw new Error('SYSTEM_DATABASE_REFUSED');
  }
  return value;
}

export async function readKey(file) {
  const key = await readFile(file);
  if (key.length !== 32) throw new Error('KEY_MUST_BE_32_BYTES');
  return key;
}

export async function checksum(file) {
  const hash = createHash('sha256');
  await pipeline(createReadStream(file), hash);
  return hash.digest('hex');
}

export function validateManifest(manifest) {
  if (
    manifest.format !== 1 ||
    manifest.kind !== 'vexgo-mysql-logical' ||
    (manifest.mediaRequired !== undefined &&
      typeof manifest.mediaRequired !== 'boolean') ||
    (manifest.mediaRequired === true &&
      !['dev', 'test', 'prod'].includes(manifest.cloudinaryEnvironment)) ||
    !/^vexgo-backup-[0-9TZ-]+-[a-f0-9]{8}$/.test(manifest.id ?? '') ||
    !/^8\.4\./.test(manifest.mysqlVersion ?? '') ||
    !/^sha256:[a-f0-9]{64}$/.test(manifest.sourceImage ?? '') ||
    !/^[a-f0-9]{64}$/.test(manifest.schemaSha256 ?? '') ||
    !/^[a-f0-9]{64}$/.test(manifest.migrationsSha256 ?? '') ||
    !Number.isFinite(Date.parse(manifest.createdAt)) ||
    !/^[a-f0-9]{64}$/.test(manifest.sha256 ?? '') ||
    !Number.isSafeInteger(manifest.bytes) ||
    manifest.bytes < 37 ||
    !Array.isArray(manifest.tables) ||
    manifest.tables.length === 0 ||
    !manifest.tables.every(
      (table) => typeof table === 'string' && /^[A-Za-z0-9_]+$/.test(table),
    )
  )
    throw new Error('INVALID_MANIFEST');
  identifier(manifest.database);
  return manifest;
}

function authenticatedMetadata(manifest) {
  const { sha256, bytes, ...metadata } = manifest;
  return Buffer.from(JSON.stringify(metadata));
}

// Format: magic (8), nonce (12), gzip SQL encrypted with AES-256-GCM, tag (16).
// Metadata is authenticated as AAD; checksums alone are not authenticity checks.
export async function encryptSql(input, directory, key, metadata) {
  await mkdir(directory, { recursive: false, mode: 0o700 });
  return encryptPayload(
    input,
    join(directory, archiveName),
    join(directory, manifestName),
    key,
    metadata,
  );
}

export async function encryptPayload(input, file, manifestFile, key, metadata) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(authenticatedMetadata(metadata));
  const header = Buffer.concat([magic, nonce]);
  let first = true;
  const envelope = new Transform({
    transform(chunk, encoding, callback) {
      if (first) {
        this.push(header);
        first = false;
      }
      callback(null, chunk);
    },
    flush(callback) {
      if (first) this.push(header);
      this.push(cipher.getAuthTag());
      callback();
    },
  });
  await pipeline(
    input,
    createGzip(),
    cipher,
    envelope,
    createWriteStream(file, { flags: 'wx', mode: 0o600 }),
  );
  const manifest = {
    ...metadata,
    sha256: await checksum(file),
    bytes: (await stat(file)).size,
  };
  await writeFile(manifestFile, JSON.stringify(manifest, null, 2) + '\n', {
    flag: 'wx',
    mode: 0o600,
  });
  return manifest;
}

export async function loadManifest(directory) {
  if ((await stat(join(directory, manifestName))).size > 1024 * 1024)
    throw new Error('MANIFEST_TOO_LARGE');
  return validateManifest(
    JSON.parse(await readFile(join(directory, manifestName), 'utf8')),
  );
}

export async function decryptSql(directory, key, output) {
  const manifest = await loadManifest(directory);
  const file = join(directory, archiveName);
  return decryptPayload(file, manifest, key, output);
}

export async function decryptPayload(file, manifest, key, output) {
  const size = (await stat(file)).size;
  if (size !== manifest.bytes || (await checksum(file)) !== manifest.sha256)
    throw new Error('CHECKSUM_MISMATCH');
  const { open } = await import('node:fs/promises');
  const handle = await open(file, 'r');
  let header, tag;
  try {
    header = Buffer.alloc(20);
    tag = Buffer.alloc(16);
    await handle.read(header, 0, 20, 0);
    await handle.read(tag, 0, 16, size - 16);
  } finally {
    await handle.close();
  }
  if (!header.subarray(0, 8).equals(magic))
    throw new Error('INVALID_ARCHIVE_HEADER');
  const decipher = createDecipheriv('aes-256-gcm', key, header.subarray(8));
  decipher.setAAD(authenticatedMetadata(manifest));
  decipher.setAuthTag(tag);
  await pipeline(
    createReadStream(file, { start: 20, end: size - 17 }),
    decipher,
    createGunzip(),
    output,
  );
  return manifest;
}

export async function verifyArchive(directory, key) {
  return decryptSql(
    directory,
    key,
    new Writable({
      write(chunk, encoding, callback) {
        callback();
      },
    }),
  );
}
