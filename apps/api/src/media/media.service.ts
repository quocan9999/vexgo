import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma, type TaiNguyenMedia } from '../generated/prisma/client.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { requireTenantPrincipal } from '../auth/tenant-scope.js';
import {
  CloudinaryProvider,
  type CloudinaryAsset,
} from './cloudinary.provider.js';
import {
  ACTIVE_MEDIA_STATUSES,
  MAX_VEHICLE_IMAGES,
  prepareImage,
  type UploadedImage,
} from './media-image.js';

function missing() {
  return new NotFoundException({
    error: 'MEDIA_VEHICLE_NOT_FOUND',
    message: 'Không tìm thấy xe hoặc ảnh trong phạm vi nhà xe.',
  });
}
function conflict(code: string, message: string) {
  return new ConflictException({ error: code, message });
}

function mapManaged(row: TaiNguyenMedia) {
  return {
    mediaId: row.taiNguyenMediaId,
    requestId: row.yeuCauId,
    vehicleId: row.xeId,
    status: row.trangThai,
    imageUrl: row.trangThai === 'SAN_SANG' ? row.urlCongKhai : null,
    width: row.chieuRong,
    height: row.chieuCao,
    format: row.dinhDang,
    bytes: row.kichThuoc,
    createdAt: row.createdAt.toISOString(),
    removedAt: row.daGoLuc?.toISOString() ?? null,
  };
}

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: CloudinaryProvider,
  ) {}

  private async ownedVehicle(vehicleId: number, tenantId: number) {
    const vehicle = await this.prisma.xe.findFirst({
      where: { xeId: vehicleId, nhaXeId: tenantId },
      select: { xeId: true },
    });
    if (!vehicle) throw missing();
  }

  async listPublic(vehicleId: number) {
    const vehicle = await this.prisma.xe.findFirst({
      where: { xeId: vehicleId, nhaXe: { trangThai: 'HOAT_DONG' } },
      select: { xeId: true },
    });
    if (!vehicle) throw missing();
    const rows = await this.prisma.taiNguyenMedia.findMany({
      where: { xeId: vehicleId, mucDich: 'ANH_XE', trangThai: 'SAN_SANG' },
      orderBy: [{ createdAt: 'asc' }, { taiNguyenMediaId: 'asc' }],
      take: MAX_VEHICLE_IMAGES,
    });
    return {
      data: rows.map((row) => ({
        mediaId: row.taiNguyenMediaId,
        imageUrl: row.urlCongKhai,
        width: row.chieuRong,
        height: row.chieuCao,
        format: row.dinhDang,
      })),
    };
  }

  async listManaged(vehicleId: number, principal: AuthPrincipal) {
    const tenantId = requireTenantPrincipal(principal);
    await this.ownedVehicle(vehicleId, tenantId);
    return {
      data: (
        await this.prisma.taiNguyenMedia.findMany({
          where: { xeId: vehicleId, nhaXeId: tenantId },
          orderBy: [{ createdAt: 'desc' }, { taiNguyenMediaId: 'asc' }],
          take: 100,
        })
      ).map(mapManaged),
    };
  }

  async upload(
    vehicleId: number,
    requestId: string,
    file: UploadedImage | undefined,
    principal: AuthPrincipal,
  ) {
    const tenantId = requireTenantPrincipal(principal);
    await this.ownedVehicle(vehicleId, tenantId); // Before decode or external calls.
    const image = await prepareImage(file);
    const mediaId = randomUUID();
    const location = this.provider.location(tenantId, vehicleId, mediaId);
    const reserved = await this.prisma
      .$transaction(async (tx) => {
        const locked = await tx.$queryRaw<
          Array<{ xeId: number }>
        >`SELECT xeId FROM Xe WHERE xeId=${vehicleId} AND nhaXeId=${tenantId} FOR UPDATE`;
        if (!locked.length) throw missing();
        const existing = await tx.taiNguyenMedia.findUnique({
          where: {
            nhaXeId_yeuCauId: { nhaXeId: tenantId, yeuCauId: requestId },
          },
        });
        if (existing) {
          if (existing.xeId !== vehicleId || existing.sha256 !== image.sha256)
            throw conflict(
              'MEDIA_REQUEST_REUSED',
              'requestId đã dùng cho xe hoặc ảnh khác.',
            );
          if (existing.trangThai === 'SAN_SANG')
            return { row: existing, reused: true };
          throw conflict(
            'MEDIA_REQUEST_PENDING_OR_REMOVED',
            'Yêu cầu đã được ghi nhận. Xem danh sách quản lý và đối soát ảnh; không tải lại bằng requestId mới.',
          );
        }
        const count = await tx.taiNguyenMedia.count({
          where: {
            xeId: vehicleId,
            nhaXeId: tenantId,
            trangThai: { in: ACTIVE_MEDIA_STATUSES },
          },
        });
        if (count >= MAX_VEHICLE_IMAGES)
          throw conflict(
            'MEDIA_VEHICLE_LIMIT',
            'Mỗi xe tối đa 10 ảnh, bao gồm ảnh đang tải hoặc chờ đối soát.',
          );
        const row = await tx.taiNguyenMedia.create({
          data: {
            taiNguyenMediaId: mediaId,
            yeuCauId: requestId,
            nhaXeId: tenantId,
            xeId: vehicleId,
            taiKhoanTaoId: principal.taiKhoanId,
            mucDich: 'ANH_XE',
            trangThai: 'DANG_TAI',
            tenCloud: location.cloudName,
            thuMuc: location.folder,
            cloudinaryPublicId: location.publicId,
            sha256: image.sha256,
          },
        });
        return { row, reused: false };
      })
      .catch((error: unknown) => {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        )
          throw conflict(
            'MEDIA_REQUEST_REUSED',
            'requestId đã được dùng. Kiểm tra danh sách ảnh trước khi thử lại.',
          );
        throw error;
      });
    if (reserved.reused) return { data: mapManaged(reserved.row) };
    let asset: CloudinaryAsset;
    try {
      asset = await this.provider.upload(
        image.buffer,
        reserved.row.cloudinaryPublicId,
        reserved.row.thuMuc,
        image.sha256,
      );
    } catch {
      try {
        await this.prisma.taiNguyenMedia.updateMany({
          where: { taiNguyenMediaId: mediaId, trangThai: 'DANG_TAI' },
          data: { trangThai: 'CHO_DOI_SOAT' },
        });
      } catch {
        /* Existing DANG_TAI reservation still allows read-only reconciliation. */
      }
      throw new ConflictException({
        error: 'MEDIA_UPLOAD_UNCERTAIN',
        message:
          'Chưa xác định kết quả tải ảnh. Giữ requestId, mở danh sách quản lý và kiểm tra lại; không tạo lượt tải mới.',
      });
    }
    return this.attachSafely(reserved.row, asset);
  }

  private async attachSafely(row: TaiNguyenMedia, asset: CloudinaryAsset) {
    try {
      return await this.attach(row, asset);
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      throw new ConflictException({
        error: 'MEDIA_LINK_UNCERTAIN',
        message:
          'Ảnh có thể đã tải lên nhưng chưa xác nhận được liên kết. Giữ requestId và đối soát; không tải lại bằng requestId mới.',
      });
    }
  }

  private async attach(row: TaiNguyenMedia, asset: CloudinaryAsset) {
    // CAS stops delayed upload/reconcile responses from reattaching a removed image.
    const saved = await this.prisma.taiNguyenMedia.updateMany({
      where: {
        taiNguyenMediaId: row.taiNguyenMediaId,
        trangThai: { in: ['DANG_TAI', 'CHO_DOI_SOAT'] },
      },
      data: {
        trangThai: 'SAN_SANG',
        cloudinaryAssetId: asset.assetId,
        urlCongKhai: asset.url,
        phienBan: BigInt(asset.version),
        kichThuoc: asset.bytes,
        chieuRong: asset.width,
        chieuCao: asset.height,
        dinhDang: asset.format,
      },
    });
    if (!saved.count) {
      const current = await this.prisma.taiNguyenMedia.findUnique({
        where: { taiNguyenMediaId: row.taiNguyenMediaId },
      });
      if (
        current?.trangThai === 'SAN_SANG' &&
        current.cloudinaryAssetId === asset.assetId
      )
        return { data: mapManaged(current) };
      throw conflict(
        'MEDIA_STATE_CHANGED',
        'Ảnh đã được gỡ hoặc trạng thái đã thay đổi.',
      );
    }
    const current = await this.prisma.taiNguyenMedia.findUniqueOrThrow({
      where: { taiNguyenMediaId: row.taiNguyenMediaId },
    });
    return { data: mapManaged(current) };
  }

  async reconcile(
    vehicleId: number,
    mediaId: string,
    principal: AuthPrincipal,
  ) {
    const tenantId = requireTenantPrincipal(principal);
    const row = await this.prisma.taiNguyenMedia.findFirst({
      where: { taiNguyenMediaId: mediaId, xeId: vehicleId, nhaXeId: tenantId },
    });
    if (!row) throw missing();
    if (row.trangThai === 'SAN_SANG' || row.trangThai === 'DA_GO')
      return { data: mapManaged(row) };
    // Read only: never re-upload a file or infer that a 404 means its upload cannot finish later.
    const asset = await this.provider.lookup(
      row.cloudinaryPublicId,
      row.sha256,
      row.tenCloud,
    );
    return this.attachSafely(row, asset);
  }

  async remove(vehicleId: number, mediaId: string, principal: AuthPrincipal) {
    const tenantId = requireTenantPrincipal(principal);
    const row = await this.prisma.taiNguyenMedia.findFirst({
      where: { taiNguyenMediaId: mediaId, xeId: vehicleId, nhaXeId: tenantId },
    });
    if (!row) throw missing();
    await this.prisma.taiNguyenMedia.updateMany({
      where: {
        taiNguyenMediaId: mediaId,
        nhaXeId: tenantId,
        trangThai: { not: 'DA_GO' },
      },
      data: { trangThai: 'DA_GO', daGoLuc: new Date() },
    });
    // Logical unlink only. Physical assets remain available to older DB backups.
  }
}
