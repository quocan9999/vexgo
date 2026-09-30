import 'reflect-metadata';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../../src/generated/prisma/client.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';
import { VehicleTypesService } from '../../../src/vehicle-types/vehicle-types.service.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const vehicleTypeRecord = {
  loaiXeId: 8,
  nhaXeId: 4,
  tenLoai: 'Limousine 22 phòng',
  moTa: 'Loại xe giường phòng cao cấp',
  createdAt: new Date('2026-09-25T10:00:00.000Z'),
  updatedAt: new Date('2026-09-25T11:00:00.000Z'),
};

const prisma = {
  nhaXe: { findUnique: vi.fn() },
  loaiXe: {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
} as unknown as PrismaService;

const service = new VehicleTypesService(prisma);
const tenantAdmin: AuthPrincipal = {
  taiKhoanId: 7,
  sessionId: 'tenant-session',
  roles: ['NHA_XE_ADMIN'],
  permissions: [],
  nhanVienId: 9,
  nhaXeId: 4,
};

function knownRequestError(code: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError('database constraint error', {
    code,
    clientVersion: '7.10.0',
    meta,
  });
}

function mariaDbUniqueError(index: string) {
  return knownRequestError('P2002', {
    driverAdapterError: {
      cause: {
        kind: 'UniqueConstraintViolation',
        constraint: { index },
      },
    },
  });
}

describe('VehicleTypesService write operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.nhaXe.findUnique).mockResolvedValue({ nhaXeId: 4 } as never);
    vi.mocked(prisma.loaiXe.create).mockResolvedValue(vehicleTypeRecord);
    vi.mocked(prisma.loaiXe.update).mockResolvedValue(vehicleTypeRecord);
    vi.mocked(prisma.loaiXe.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.loaiXe.findFirst).mockResolvedValue(vehicleTypeRecord);
  });

  it('creates a vehicle type through the shared Prisma mapper', async () => {
    await expect(
      service.create({
        name: 'Limousine 22 phòng',
        description: 'Loại xe giường phòng cao cấp',
        busCompanyId: 4,
      }, tenantAdmin),
    ).resolves.toEqual({
      data: {
        vehicleTypeId: 8,
        name: 'Limousine 22 phòng',
        description: 'Loại xe giường phòng cao cấp',
        createdAt: '2026-09-25T10:00:00.000Z',
        updatedAt: '2026-09-25T11:00:00.000Z',
      },
    });
    expect(prisma.loaiXe.create).toHaveBeenCalledWith({
      data: {
        nhaXeId: 4,
        tenLoai: 'Limousine 22 phòng',
        moTa: 'Loại xe giường phòng cao cấp',
      },
      select: expect.objectContaining({
        loaiXeId: true,
        tenLoai: true,
        moTa: true,
        createdAt: true,
        updatedAt: true,
      }),
    });
  });

  it.each([
    ['standard field target', { target: ['tenLoai'] }],
    ['tenant composite target', { target: ['nhaXeId', 'tenLoai'] }],
    [
      'MariaDB adapter target',
      mariaDbUniqueError('LoaiXe_nhaXeId_tenLoai_key').meta,
    ],
  ])('maps the %s duplicate name to the domain conflict', async (_label, meta) => {
    const duplicateError =
      _label === 'MariaDB adapter target'
        ? mariaDbUniqueError('LoaiXe_nhaXeId_tenLoai_key')
        : knownRequestError('P2002', meta);
    vi.mocked(prisma.loaiXe.create).mockRejectedValueOnce(duplicateError);

    const error = await service
      .create({ name: 'Limousine', description: null, busCompanyId: 4 }, tenantAdmin)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ConflictException);
    if (!(error instanceof ConflictException)) {
      throw new Error('Expected a ConflictException');
    }
    expect(error.getStatus()).toBe(409);
    expect(error.getResponse()).toEqual({
      error: 'VEHICLE_TYPE_NAME_EXISTS',
      message: 'Tên loại xe đã tồn tại.',
    });
  });

  it.each([
    knownRequestError('P2002', { target: ['otherField'] }),
    knownRequestError('P2002', { target: ['tenLoai', 'otherField'] }),
    mariaDbUniqueError('LoaiXe_other_index'),
  ])('propagates a P2002 for an unrelated unique constraint', async (error) => {
    vi.mocked(prisma.loaiXe.create).mockRejectedValueOnce(error);

    await expect(
      service.create({ name: 'Limousine', description: null, busCompanyId: 4 }, tenantAdmin),
    ).rejects.toBe(error);
  });

  it('updates only the editable fields and maps the Prisma result', async () => {
    await expect(
      service.update(8, {
        name: 'Limousine 24 phòng',
        description: 'Phiên bản 24 phòng',
      }, tenantAdmin),
    ).resolves.toEqual({
      data: {
        vehicleTypeId: 8,
        name: 'Limousine 22 phòng',
        description: 'Loại xe giường phòng cao cấp',
        createdAt: '2026-09-25T10:00:00.000Z',
        updatedAt: '2026-09-25T11:00:00.000Z',
      },
    });
    expect(prisma.loaiXe.updateMany).toHaveBeenCalledWith({
      where: { loaiXeId: 8, nhaXeId: 4 },
      data: {
        tenLoai: 'Limousine 24 phòng',
        moTa: 'Phiên bản 24 phòng',
      },
    });
  });

  it('allows updating a vehicle type while keeping its current name', async () => {
    await expect(
      service.update(8, {
        name: 'Limousine 22 phòng',
        description: 'Mô tả đã cập nhật',
      }, tenantAdmin),
    ).resolves.toMatchObject({ data: { vehicleTypeId: 8 } });
    expect(prisma.loaiXe.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
      where: { loaiXeId: 8, nhaXeId: 4 },
        data: {
          tenLoai: 'Limousine 22 phòng',
          moTa: 'Mô tả đã cập nhật',
        },
      }),
    );
  });

  it('maps a duplicate name from update to the domain conflict', async () => {
    vi.mocked(prisma.loaiXe.updateMany).mockRejectedValueOnce(
      mariaDbUniqueError('LoaiXe_nhaXeId_tenLoai_key'),
    );

    const error = await service
      .update(8, { name: 'Khác', description: null }, tenantAdmin)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ConflictException);
    if (!(error instanceof ConflictException)) {
      throw new Error('Expected a ConflictException');
    }
    expect(error.getStatus()).toBe(409);
    expect(error.getResponse()).toEqual({
      error: 'VEHICLE_TYPE_NAME_EXISTS',
      message: 'Tên loại xe đã tồn tại.',
    });
  });

  it('propagates unrelated P2002 errors from update', async () => {
    const error = knownRequestError('P2002', { target: ['otherField'] });
    vi.mocked(prisma.loaiXe.updateMany).mockRejectedValueOnce(error);

    await expect(
      service.update(8, { name: 'Khác', description: null }, tenantAdmin),
    ).rejects.toBe(error);
  });

  it('maps Prisma P2025 from update to the vehicle type not-found contract', async () => {
    vi.mocked(prisma.loaiXe.updateMany).mockResolvedValueOnce({ count: 0 } as never);

    const error = await service
      .update(999, { name: 'Khác', description: null }, tenantAdmin)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(NotFoundException);
    if (!(error instanceof NotFoundException)) {
      throw new Error('Expected a NotFoundException');
    }
    expect(error.getStatus()).toBe(404);
    expect(error.getResponse()).toEqual({
      error: 'VEHICLE_TYPE_NOT_FOUND',
      message: 'Không tìm thấy loại xe.',
    });
  });

  it('rejects a create request that names a different tenant before querying or writing it', async () => {
    const error = await service
      .create({ name: 'Limousine', description: null, busCompanyId: 8 }, tenantAdmin)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toMatchObject({
      error: 'TENANT_SCOPE_VIOLATION',
    });
    expect(prisma.nhaXe.findUnique).not.toHaveBeenCalled();
    expect(prisma.loaiXe.create).not.toHaveBeenCalled();
  });
});
