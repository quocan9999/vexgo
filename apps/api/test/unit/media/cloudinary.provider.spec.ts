import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import {
  v2 as cloudinary,
  type UploadApiResponse,
  type UploadStream,
} from 'cloudinary';
import { PassThrough } from 'node:stream';
import { CloudinaryProvider } from '../../../src/media/cloudinary.provider.js';

const id = '83bf055f-f6c4-46b8-9270-63cfc9442aee';
const folder = 'vexgo/test/bus-companies/3/vehicles/14';
const publicId = `${folder}/${id}`;
const hash = 'a'.repeat(64);
function provider(overrides: Record<string, string> = {}) {
  return new CloudinaryProvider(
    new ConfigService({
      CLOUDINARY_ENABLED: 'true',
      CLOUDINARY_CLOUD_NAME: 'test-cloud',
      CLOUDINARY_API_KEY: 'test-key',
      CLOUDINARY_API_SECRET: 'test-secret',
      CLOUDINARY_ENVIRONMENT: 'test',
      CLOUDINARY_FOLDER_MODE: 'dynamic',
      ...overrides,
    }),
  );
}
function response(overrides: Record<string, unknown> = {}) {
  return {
    asset_id: 'asset123',
    public_id: publicId,
    asset_folder: folder,
    version: 1,
    bytes: 100,
    width: 2,
    height: 2,
    format: 'webp',
    resource_type: 'image',
    type: 'upload',
    context: { custom: { sha256: hash } },
    ...overrides,
  } as unknown as UploadApiResponse;
}
afterEach(() => vi.restoreAllMocks());

describe('Cloudinary provider and folder policy', () => {
  it('builds tenant/vehicle folders with UUIDs and separates environments', () => {
    expect(provider().location(3, 14, id)).toEqual({
      cloudName: 'test-cloud',
      folder,
      publicId,
    });
    expect(
      provider({ CLOUDINARY_ENVIRONMENT: 'dev' }).location(3, 14, id).folder,
    ).toBe('vexgo/dev/bus-companies/3/vehicles/14');
    expect(() =>
      provider({ CLOUDINARY_ENVIRONMENT: '../prod' }).settings(),
    ).toThrow();
    expect(() =>
      provider({ CLOUDINARY_ENABLED: 'false' }).settings(),
    ).toThrow();
    expect(() =>
      provider({
        NODE_ENV: 'production',
        CLOUDINARY_ENVIRONMENT: 'dev',
      }).settings(),
    ).toThrow();
  });

  it.each(['dynamic', 'fixed'])(
    'uses correct folder parameters in %s mode, never overwrites or uses user filenames',
    async (mode) => {
      const upload = vi
        .spyOn(cloudinary.uploader, 'upload_stream')
        .mockImplementation((...args: unknown[]) => {
          const callback = args[1] as
            ((error: undefined, result: UploadApiResponse) => void) | undefined;
          const stream = new PassThrough();
          stream.resume();
          queueMicrotask(() => callback?.(undefined, response()));
          return stream as UploadStream;
        });
      const result = await provider({ CLOUDINARY_FOLDER_MODE: mode }).upload(
        Buffer.from('already validated WebP'),
        publicId,
        folder,
        hash,
      );
      const delivered = new URL(result.url);
      expect(delivered.origin + delivered.pathname).toBe(
        `https://res.cloudinary.com/test-cloud/image/upload/v1/${publicId}.webp`,
      );
      expect(upload).toHaveBeenCalledWith(
        expect.objectContaining({
          overwrite: false,
          use_filename: false,
          type: 'upload',
          resource_type: 'image',
        }),
        expect.any(Function),
      );
      const options = upload.mock.calls[0]![0];
      if (mode === 'dynamic') {
        expect(options).toMatchObject({
          asset_folder: folder,
          public_id: publicId,
        });
        expect(options).not.toHaveProperty('folder');
      } else {
        expect(options).toMatchObject({ folder, public_id: id });
        expect(options).not.toHaveProperty('asset_folder');
      }
    },
  );

  it.each([
    { public_id: 'wrong-owner' },
    { type: 'authenticated' },
    { resource_type: 'raw' },
    { format: 'svg' },
    { context: { custom: { sha256: 'b'.repeat(64) } } },
    { width: 9000 },
  ])(
    'rejects mismatched provider identity or content metadata %j',
    async (changed) => {
      vi.spyOn(cloudinary.api, 'resource').mockResolvedValue(response(changed));
      await expect(
        provider().lookup(publicId, hash, 'test-cloud'),
      ).rejects.toMatchObject({
        response: { error: 'MEDIA_PROVIDER_UNAVAILABLE' },
      });
    },
  );

  it('does not leak provider errors and cannot reconcile against another account', async () => {
    const resource = vi.spyOn(cloudinary.api, 'resource').mockRejectedValue({
      message: 'provider error with credential or raw content',
    });
    await expect(
      provider().lookup(publicId, hash, 'other-cloud'),
    ).rejects.toMatchObject({
      response: { error: 'MEDIA_PROVIDER_UNAVAILABLE' },
    });
    expect(resource).not.toHaveBeenCalled();
    await expect(
      provider().lookup(publicId, hash, 'test-cloud'),
    ).rejects.not.toHaveProperty(
      'message',
      'provider error with credential or raw content',
    );
  });
});
