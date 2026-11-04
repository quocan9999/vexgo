import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import {
  MAX_IMAGE_BYTES,
  prepareImage,
} from '../../../src/media/media-image.js';

describe('vehicle image validation', () => {
  it('decodes real PNG, strips metadata, resizes and produces WebP with original content hash', async () => {
    const source = await sharp({
      create: { width: 1700, height: 100, channels: 3, background: '#cc1111' },
    })
      .png()
      .withMetadata()
      .toBuffer();
    const result = await prepareImage({
      buffer: source,
      mimetype: 'image/png',
      size: source.length,
    });
    const metadata = await sharp(result.buffer).metadata();
    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBe(1600);
    expect(metadata.exif).toBeUndefined();
    expect(result.sha256).toBe(
      createHash('sha256').update(source).digest('hex'),
    );
  });

  it('rejects missing and oversize files using actual bytes, not claimed size', async () => {
    await expect(prepareImage(undefined)).rejects.toMatchObject({
      response: { error: 'MEDIA_FILE_REQUIRED' },
    });
    await expect(
      prepareImage({
        buffer: Buffer.alloc(MAX_IMAGE_BYTES + 1),
        mimetype: 'image/png',
        size: 1,
      }),
    ).rejects.toMatchObject({ response: { error: 'MEDIA_FILE_TOO_LARGE' } });
  });

  it('rejects SVG, fake image headers, truncated files and mismatched MIME', async () => {
    const png = await sharp({
      create: { width: 2, height: 2, channels: 3, background: '#111111' },
    })
      .png()
      .toBuffer();
    for (const [buffer, mimetype] of [
      [
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
        'image/svg+xml',
      ],
      [Buffer.from('not a picture'), 'image/jpeg'],
      [png.subarray(0, 18), 'image/png'],
      [png, 'image/jpeg'],
    ] as const) {
      await expect(
        prepareImage({ buffer, mimetype, size: buffer.length }),
      ).rejects.toMatchObject({ response: { error: 'MEDIA_IMAGE_INVALID' } });
    }
  });

  it('rejects decoded images over the pixel limit', async () => {
    const buffer = await sharp({
      create: { width: 5000, height: 5000, channels: 3, background: '#111111' },
    })
      .png()
      .toBuffer();
    await expect(
      prepareImage({ buffer, mimetype: 'image/png', size: buffer.length }),
    ).rejects.toMatchObject({ response: { error: 'MEDIA_IMAGE_INVALID' } });
  });
});
