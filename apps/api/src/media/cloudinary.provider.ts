import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, type UploadApiOptions } from 'cloudinary';

export type CloudinaryAsset = {
  assetId: string;
  publicId: string;
  url: string;
  version: number;
  bytes: number;
  width: number;
  height: number;
  format: 'webp';
};

function unavailable() {
  return new ServiceUnavailableException({
    error: 'MEDIA_PROVIDER_UNAVAILABLE',
    message:
      'Dịch vụ ảnh chưa sẵn sàng. Vui lòng kiểm tra lại trạng thái ảnh trước khi tải lại.',
  });
}

@Injectable()
export class CloudinaryProvider {
  constructor(private readonly config: ConfigService) {}

  settings() {
    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME')?.trim();
    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY')?.trim();
    const apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET')?.trim();
    const environment = this.config
      .get<string>('CLOUDINARY_ENVIRONMENT')
      ?.trim();
    const mode = this.config.get<string>('CLOUDINARY_FOLDER_MODE') ?? 'dynamic';
    if (
      this.config.get<string>('CLOUDINARY_ENABLED') !== 'true' ||
      !cloudName ||
      !/^[a-zA-Z0-9_-]{1,128}$/.test(cloudName) ||
      !apiKey ||
      !apiSecret ||
      !environment ||
      !['dev', 'test', 'prod'].includes(environment) ||
      !['dynamic', 'fixed'].includes(mode)
    ) {
      throw new ServiceUnavailableException({
        error: 'MEDIA_NOT_CONFIGURED',
        message: 'Chức năng tải ảnh chưa được cấu hình.',
      });
    }
    if (
      this.config.get<string>('NODE_ENV') === 'production' &&
      environment !== 'prod'
    ) {
      throw new ServiceUnavailableException({
        error: 'MEDIA_ENVIRONMENT_MISMATCH',
        message: 'Cấu hình môi trường ảnh không hợp lệ.',
      });
    }
    return { cloudName, apiKey, apiSecret, environment, mode };
  }

  location(tenantId: number, vehicleId: number, mediaId: string) {
    const { cloudName, environment } = this.settings();
    const folder = `vexgo/${environment}/bus-companies/${tenantId}/vehicles/${vehicleId}`;
    return { cloudName, folder, publicId: `${folder}/${mediaId}` };
  }

  private options(): UploadApiOptions {
    const settings = this.settings();
    return {
      cloud_name: settings.cloudName,
      api_key: settings.apiKey,
      api_secret: settings.apiSecret,
      secure: true,
      timeout: 20_000,
    };
  }

  private parse(
    value: unknown,
    publicId: string,
    sha256: string,
  ): CloudinaryAsset {
    const data = value as Record<string, unknown> | undefined;
    const context = data?.context as
      { custom?: { sha256?: string } } | undefined;
    const expectedFolder = publicId.split('/').slice(0, -1).join('/');
    if (
      !data ||
      data.public_id !== publicId ||
      data.resource_type !== 'image' ||
      data.type !== 'upload' ||
      data.format !== 'webp' ||
      typeof data.asset_id !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,128}$/.test(data.asset_id) ||
      context?.custom?.sha256 !== sha256 ||
      (this.settings().mode === 'dynamic' &&
        data.asset_folder !== expectedFolder) ||
      !['version', 'bytes', 'width', 'height'].every(
        (field) => Number.isSafeInteger(data[field]) && Number(data[field]) > 0,
      ) ||
      Number(data.width) > 1600 ||
      Number(data.height) > 1600 ||
      Number(data.bytes) > 5 * 1024 * 1024
    )
      throw unavailable();
    // Generate our own public delivery URL; don't trust arbitrary URLs in responses.
    const url = cloudinary.url(publicId, {
      cloud_name: this.settings().cloudName,
      secure: true,
      resource_type: 'image',
      type: 'upload',
      version: Number(data.version),
      format: 'webp',
    });
    return {
      assetId: data.asset_id,
      publicId,
      url,
      version: Number(data.version),
      bytes: Number(data.bytes),
      width: Number(data.width),
      height: Number(data.height),
      format: 'webp',
    };
  }

  async upload(
    buffer: Buffer,
    publicId: string,
    folder: string,
    sha256: string,
  ): Promise<CloudinaryAsset> {
    const { mode } = this.settings();
    const folderOptions =
      mode === 'dynamic'
        ? { asset_folder: folder, public_id: publicId }
        : { folder, public_id: publicId.split('/').at(-1) };
    const result = await new Promise<unknown>((resolve, reject) => {
      let stream:
        ReturnType<typeof cloudinary.uploader.upload_stream> | undefined;
      const timer = setTimeout(() => {
        stream?.destroy();
        reject(unavailable());
      }, 25_000);
      try {
        stream = cloudinary.uploader.upload_stream(
          {
            ...this.options(),
            ...folderOptions,
            resource_type: 'image',
            type: 'upload',
            overwrite: false,
            unique_filename: false,
            use_filename: false,
            format: 'webp',
            context: { sha256 },
            backup: true,
          },
          (error, response) => {
            clearTimeout(timer);
            if (error || !response) reject(unavailable());
            else resolve(response);
          },
        );
        stream.on('error', () => {
          clearTimeout(timer);
          reject(unavailable());
        });
        stream.end(buffer);
      } catch {
        clearTimeout(timer);
        reject(unavailable());
      }
    });
    return this.parse(result, publicId, sha256);
  }

  async lookup(
    publicId: string,
    sha256: string,
    cloudName: string,
  ): Promise<CloudinaryAsset> {
    if (this.settings().cloudName !== cloudName) throw unavailable();
    try {
      const result: unknown = await cloudinary.api.resource(publicId, {
        ...this.options(),
        resource_type: 'image',
        type: 'upload',
        context: true,
      });
      return this.parse(result, publicId, sha256);
    } catch {
      throw unavailable();
    }
  }
}
