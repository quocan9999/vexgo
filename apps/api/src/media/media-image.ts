import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import type {} from 'multer';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_VEHICLE_IMAGES = 10;
export const ACTIVE_MEDIA_STATUSES = ['DANG_TAI', 'CHO_DOI_SOAT', 'SAN_SANG'];

export type UploadedImage = Pick<
  Express.Multer.File,
  'buffer' | 'mimetype' | 'size'
>;

export async function prepareImage(file: UploadedImage | undefined) {
  if (!file?.buffer?.length)
    throw new BadRequestException({
      error: 'MEDIA_FILE_REQUIRED',
      message: 'Vui lòng chọn ảnh.',
    });
  if (file.buffer.length > MAX_IMAGE_BYTES)
    throw new PayloadTooLargeException({
      error: 'MEDIA_FILE_TOO_LARGE',
      message: 'Ảnh tối đa 5 MB.',
    });
  const sha256 = createHash('sha256').update(file.buffer).digest('hex');
  try {
    const prefix = file.buffer;
    const expectedMime = prefix
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      ? 'image/png'
      : prefix.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
        ? 'image/jpeg'
        : prefix.toString('ascii', 0, 4) === 'RIFF' &&
            prefix.toString('ascii', 8, 12) === 'WEBP'
          ? 'image/webp'
          : null;
    if (!expectedMime || expectedMime !== file.mimetype)
      throw new Error('invalid image header');
    const image = sharp(file.buffer, {
      limitInputPixels: 20_000_000,
      failOn: 'warning',
      animated: true,
    });
    const metadata = await image.metadata();
    const mime: Record<string, string> = {
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
    };
    if (
      !metadata.format ||
      mime[metadata.format] !== file.mimetype ||
      !metadata.width ||
      !metadata.height ||
      (metadata.pages ?? 1) !== 1
    )
      throw new Error('invalid image');
    // Decode and re-encode, strip metadata/EXIF, apply orientation and limit dimensions.
    const normalized = await image
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();
    return { sha256, buffer: normalized };
  } catch {
    throw new BadRequestException({
      error: 'MEDIA_IMAGE_INVALID',
      message:
        'Chỉ nhận ảnh JPEG, PNG hoặc WebP hợp lệ, không động, tối đa 20 megapixel.',
    });
  }
}
