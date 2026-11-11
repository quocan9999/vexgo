import { createHash } from 'node:crypto';

export const sha256 = (buffer) =>
  createHash('sha256').update(buffer).digest('hex');
export const MAX_ASSET_BYTES = 5 * 1024 * 1024;
export function check(condition, code) {
  if (!condition) throw new Error(code);
}
export function cloudSettings(environment, env = process.env) {
  const config = {
    cloud: env.CLOUDINARY_CLOUD_NAME?.trim(),
    key: env.CLOUDINARY_API_KEY?.trim(),
    secret: env.CLOUDINARY_API_SECRET?.trim(),
    mode: env.CLOUDINARY_FOLDER_MODE ?? 'dynamic',
    environment,
  };
  check(
    /^[a-zA-Z0-9_-]{1,128}$/.test(config.cloud ?? '') &&
      config.key &&
      config.secret,
    'CLOUDINARY_CONFIG_REQUIRED',
  );
  check(
    ['dev', 'test', 'prod'].includes(environment) &&
      ['dynamic', 'fixed'].includes(config.mode),
    'CLOUDINARY_ENVIRONMENT_OR_MODE_INVALID',
  );
  return config;
}

export function validateReference(row, config) {
  check(
    /^[a-f0-9-]{36}$/.test(row.mediaId ?? '') &&
      Number.isSafeInteger(row.tenantId) &&
      row.tenantId > 0 &&
      Number.isSafeInteger(row.vehicleId) &&
      row.vehicleId > 0,
    'INVALID_MEDIA_IDENTITY',
  );
  const folder = `vexgo/${config.environment}/bus-companies/${row.tenantId}/vehicles/${row.vehicleId}`;
  check(
    row.cloud === config.cloud &&
      row.folder === folder &&
      row.publicId === `${folder}/${row.mediaId}`,
    'MEDIA_ACCOUNT_OR_FOLDER_MISMATCH',
  );
  check(
    typeof row.assetId === 'string' &&
      /^[A-Za-z0-9_-]{1,128}$/.test(row.assetId) &&
      Number.isSafeInteger(row.version) &&
      row.version > 0 &&
      /^[a-f0-9]{64}$/.test(row.originalSha256 ?? ''),
    'MEDIA_NOT_FINALIZED',
  );
  check(['SAN_SANG', 'DA_GO'].includes(row.status), 'MEDIA_UPLOAD_NOT_SETTLED');
  return row;
}

export function uploadSignature(fields, secret) {
  const message = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join('&');
  return createHash('sha256')
    .update(message + secret)
    .digest('hex');
}

export class CloudinaryBackupClient {
  constructor(config, request = fetch) {
    this.config = config;
    this.request = request;
  }

  async fetch(url, options = {}) {
    try {
      const response = await this.request(url, {
        ...options,
        redirect: 'error',
        signal: AbortSignal.timeout(30_000),
      });
      check(
        response.ok,
        response.status === 429
          ? 'CLOUDINARY_RATE_LIMITED'
          : `CLOUDINARY_HTTP_${response.status}`,
      );
      return response;
    } catch (error) {
      if (/^CLOUDINARY_[A-Z0-9_]+$/.test(error.message ?? '')) throw error;
      throw new Error('CLOUDINARY_NETWORK_FAILED');
    }
  }

  async metadata(ref) {
    const url = `https://api.cloudinary.com/v1_1/${this.config.cloud}/resources/image/upload/${encodeURIComponent(ref.publicId)}?context=true&media_metadata=true`;
    const response = await this.fetch(url, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.config.key}:${this.config.secret}`).toString('base64')}`,
      },
    });
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error('CLOUDINARY_METADATA_INVALID');
    }
    check(
      data.public_id === ref.publicId &&
        data.asset_id === ref.assetId &&
        data.version === ref.version &&
        data.type === 'upload' &&
        data.resource_type === 'image' &&
        data.format === 'webp',
      'CLOUDINARY_ASSET_CHANGED',
    );
    check(
      data.context?.custom?.sha256 === ref.originalSha256,
      'CLOUDINARY_CONTEXT_MISMATCH',
    );
    check(
      Number.isSafeInteger(data.bytes) &&
        data.bytes > 0 &&
        data.bytes <= MAX_ASSET_BYTES &&
        typeof data.etag === 'string' &&
        /^[a-f0-9]{32,64}$/.test(data.etag),
      'CLOUDINARY_METADATA_INVALID',
    );
    if (this.config.mode === 'dynamic')
      check(data.asset_folder === ref.folder, 'CLOUDINARY_FOLDER_CHANGED');
    return data;
  }

  async download(ref) {
    const metadata = await this.metadata(ref);
    // Never fetch a URL supplied by the DB, an API response or an archive.
    const url = `https://res.cloudinary.com/${this.config.cloud}/image/upload/v${ref.version}/${ref.publicId}.webp`;
    const response = await this.fetch(url, {
      headers: { 'If-Match': `"${metadata.etag}"` },
    });
    check(
      /^image\/webp(?:;|$)/i.test(response.headers.get('content-type') ?? ''),
      'CLOUDINARY_CONTENT_TYPE_INVALID',
    );
    check(
      response.headers.get('etag')?.replace(/^W\//, '').replaceAll('"', '') ===
        metadata.etag,
      'CLOUDINARY_ETAG_MISMATCH',
    );
    const chunks = [];
    let length = 0;
    for await (const chunk of response.body) {
      length += chunk.length;
      if (length > MAX_ASSET_BYTES) {
        await response.body.cancel().catch(() => {});
        throw new Error('CLOUDINARY_FILE_TOO_LARGE');
      }
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    check(
      length === metadata.bytes &&
        buffer.toString('ascii', 0, 4) === 'RIFF' &&
        buffer.toString('ascii', 8, 12) === 'WEBP',
      'CLOUDINARY_FILE_INVALID',
    );
    return { buffer, sha256: sha256(buffer), metadata };
  }

  async restoreTest(ref, buffer, restoreId) {
    check(
      /^[a-f0-9-]{36}$/.test(restoreId) && sha256(buffer) === ref.fileSha256,
      'RESTORE_MEDIA_HASH_MISMATCH',
    );
    const folder = `vexgo/test/restores/${restoreId}/bus-companies/${ref.tenantId}/vehicles/${ref.vehicleId}`;
    const publicId = `${folder}/${ref.mediaId}`;
    const fields = {
      timestamp: String(Math.floor(Date.now() / 1000)),
      overwrite: 'false',
      format: 'webp',
      backup: 'true',
      context: `sha256=${ref.originalSha256}|backup_sha256=${ref.fileSha256}|restore_run=${restoreId}`,
      ...(this.config.mode === 'dynamic'
        ? { public_id: publicId, asset_folder: folder }
        : { public_id: ref.mediaId, folder }),
    };
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.append(key, value);
    form.append('api_key', this.config.key);
    form.append('signature', uploadSignature(fields, this.config.secret));
    form.append(
      'file',
      new Blob([buffer], { type: 'image/webp' }),
      `${ref.mediaId}.webp`,
    );
    const response = await this.fetch(
      `https://api.cloudinary.com/v1_1/${this.config.cloud}/image/upload`,
      { method: 'POST', body: form },
    );
    const data = await response.json();
    check(
      data.public_id === publicId &&
        /^[a-zA-Z0-9_-]{1,128}$/.test(data.asset_id ?? '') &&
        Number.isSafeInteger(data.version),
      'CLOUDINARY_RESTORE_RESPONSE_INVALID',
    );
    const restored = {
      ...ref,
      cloud: this.config.cloud,
      publicId,
      folder,
      assetId: data.asset_id,
      version: data.version,
    };
    const readback = await this.download(restored);
    check(
      readback.sha256 === ref.fileSha256,
      'CLOUDINARY_RESTORE_BYTES_CHANGED',
    );
    return {
      ...restored,
      url: `https://res.cloudinary.com/${this.config.cloud}/image/upload/v${data.version}/${publicId}.webp`,
    };
  }
}
