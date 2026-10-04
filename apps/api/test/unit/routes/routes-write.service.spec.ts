import 'reflect-metadata';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../../src/generated/prisma/client.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../../src/prisma/prisma.service.js';
import { RoutesService } from '../../../src/routes/routes.service.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';

const record = {
  tuyenXeId: 17,
  nhaXeId: 3,
  maTuyenXe: 'FUTA-TX-0100',
  diemDi: 'TP.HCM',
  diemDen: 'Đà Lạt',
  trangThai: 'HOAT_DONG',
  createdAt: new Date('2026-09-22T07:34:00.000Z'),
  updatedAt: new Date('2026-09-23T07:34:00.000Z'),
  nhaXe: { nhaXeId: 3, maNhaXe: 'FUTA', tenNhaXe: 'Phương Trang' },
};
const company = {
  nhaXeId: 3,
  maNhaXe: 'FUTA',
  tenNhaXe: 'Phương Trang',
  thongTinLienHe: null,
  trangThai: 'HOAT_DONG',
  createdAt: new Date('2026-09-22T07:34:00.000Z'),
  updatedAt: new Date('2026-09-22T07:34:00.000Z'),
};
const prisma = {
  nhaXe: { findUnique: vi.fn() },
  $transaction: vi.fn((operation: (transaction: Prisma.TransactionClient) => Promise<unknown>) =>
    operation(prisma as unknown as Prisma.TransactionClient),
  ),
  tuyenXe: {
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    findFirst: vi.fn(),
  },
} as unknown as PrismaService;
const service = new RoutesService(prisma);
const createInput = {
  code: 'FUTA-TX-0100',
  origin: 'TP.HCM',
  destination: 'Đà Lạt',
  busCompanyId: 3,
  status: 'HOAT_DONG' as const,
};

function tenantAdmin(nhaXeId: number | null): AuthPrincipal {
  return {
    taiKhoanId: 42,
    sessionId: 'test-session',
    roles: ['NHA_XE_ADMIN'],
    permissions: [],
    nhanVienId: 77,
    nhaXeId,
  };
}

function knownError(code: string, meta: Record<string, unknown> = {}) {
  return new Prisma.PrismaClientKnownRequestError('database failure', {
    code,
    clientVersion: 'test',
    meta,
  });
}

describe('RoutesService writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.nhaXe.findUnique).mockResolvedValue(company);
    vi.mocked(prisma.tuyenXe.create).mockResolvedValue(record);
    vi.mocked(prisma.tuyenXe.update).mockResolvedValue(record);
    vi.mocked(prisma.tuyenXe.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.tuyenXe.findFirst).mockImplementation(((args?: Prisma.TuyenXeFindFirstArgs) =>
      Promise.resolve(args?.where?.diemDi !== undefined ? null : record)) as never,
    );
  });

  it.each(['HOAT_DONG', 'TAM_NGUNG'] as const)(
    'sets only target status %s and returns mapped detail',
    async (status) => {
      vi.mocked(prisma.tuyenXe.updateMany).mockResolvedValueOnce({ count: 1 });
      vi.mocked(prisma.tuyenXe.findFirst).mockResolvedValueOnce({
        ...record,
        trangThai: status,
      });
      const result = await service.updateStatus(17, status, tenantAdmin(3));
      expect(prisma.tuyenXe.updateMany).toHaveBeenCalledWith({
        where: { tuyenXeId: 17, nhaXeId: 3 },
        data: { trangThai: status },
      });
      expect(prisma.tuyenXe.findFirst).toHaveBeenCalledWith({
        where: { tuyenXeId: 17, nhaXeId: 3 },
        select: expect.any(Object),
      });
      expect(result.data).toMatchObject({
        routeId: 17,
        code: record.maTuyenXe,
        origin: record.diemDi,
        destination: record.diemDen,
        status,
        busCompany: { busCompanyId: 3, code: 'FUTA' },
      });
    },
  );

  it('maps missing status target and propagates unrelated database errors', async () => {
    vi.mocked(prisma.tuyenXe.updateMany).mockResolvedValueOnce({ count: 0 });
    const missing = await service
      .updateStatus(999, 'TAM_NGUNG', tenantAdmin(3))
      .catch((caught: unknown) => caught);
    expect(missing).toBeInstanceOf(NotFoundException);
    expect((missing as NotFoundException).getResponse()).toMatchObject({
      error: 'ROUTE_NOT_FOUND',
    });
    const other = knownError('P2003');
    vi.mocked(prisma.tuyenXe.updateMany).mockRejectedValueOnce(other);
    await expect(
      service.updateStatus(17, 'TAM_NGUNG', tenantAdmin(3)),
    ).rejects.toBe(other);
  });

  it('verifies the company and creates only the route with explicit status', async () => {
    const result = await service.create(createInput, tenantAdmin(3));
    expect(prisma.nhaXe.findUnique).toHaveBeenCalledWith({
      where: { nhaXeId: 3 },
      select: { nhaXeId: true },
    });
    expect(prisma.tuyenXe.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          maTuyenXe: 'FUTA-TX-0100',
          diemDi: 'TP.HCM',
          diemDen: 'Đà Lạt',
          nhaXeId: 3,
          trangThai: 'HOAT_DONG',
        },
      }),
    );
    expect(result.data).toMatchObject({
      routeId: 17,
      code: 'FUTA-TX-0100',
      busCompany: { busCompanyId: 3, code: 'FUTA', name: 'Phương Trang' },
    });
  });

  it('rejects a second route with the same ordered endpoints even when its code differs', async () => {
    vi.mocked(prisma.tuyenXe.findFirst).mockResolvedValueOnce({ ...record, tuyenXeId: 16 });

    const error = await service.create(
      { ...createInput, code: 'FUTA-TX-0101' },
      tenantAdmin(3),
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toEqual({
      error: 'ROUTE_DUPLICATE_ENDPOINTS',
      message: 'Đã có tuyến xe cùng điểm đi và điểm đến trong nhà xe này.',
    });
    expect(prisma.tuyenXe.create).not.toHaveBeenCalled();
  });

  it('returns BUS_COMPANY_NOT_FOUND without writing for a missing company', async () => {
    vi.mocked(prisma.nhaXe.findUnique).mockResolvedValueOnce(null);
    const error = await service
      .create(createInput, tenantAdmin(3))
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(NotFoundException);
    expect((error as NotFoundException).getResponse()).toEqual({
      error: 'BUS_COMPANY_NOT_FOUND',
      message: 'Không tìm thấy nhà xe.',
    });
    expect(prisma.tuyenXe.create).not.toHaveBeenCalled();
  });

  it('rejects a create request that names another tenant before any database access', async () => {
    const error = await service
      .create({ ...createInput, busCompanyId: 4 }, tenantAdmin(3))
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toMatchObject({
      error: 'TENANT_SCOPE_VIOLATION',
    });
    expect(prisma.nhaXe.findUnique).not.toHaveBeenCalled();
    expect(prisma.tuyenXe.create).not.toHaveBeenCalled();
  });

  it('rejects tenant writes when the trusted principal has no tenant identity', async () => {
    const error = await service
      .create(createInput, tenantAdmin(null))
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toMatchObject({
      error: 'TENANT_SCOPE_REQUIRED',
    });
    expect(prisma.nhaXe.findUnique).not.toHaveBeenCalled();
    expect(prisma.tuyenXe.create).not.toHaveBeenCalled();
  });

  it.each([
    { target: ['nhaXeId', 'maTuyenXe'] },
    { target: 'TuyenXe_index_2' },
    {
      driverAdapterError: {
        cause: {
          kind: 'UniqueConstraintViolation',
          constraint: { index: 'TuyenXe_index_2' },
        },
      },
    },
  ])(
    'maps only the scoped route code unique violation to 409',
    async (meta) => {
      vi.mocked(prisma.tuyenXe.create).mockRejectedValueOnce(
        knownError('P2002', meta),
      );
      const error = await service
        .create(createInput, tenantAdmin(3))
        .catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toEqual({
        error: 'ROUTE_CODE_EXISTS',
        message: 'Mã tuyến đã tồn tại trong nhà xe này.',
      });
    },
  );

  it.each([
    { target: ['maTuyenXe'] },
    { target: ['otherField', 'maTuyenXe'] },
    {
      driverAdapterError: {
        cause: {
          kind: 'UniqueConstraintViolation',
          constraint: { index: 'Other_index' },
        },
      },
    },
  ])('propagates unrelated unique violations', async (meta) => {
    const databaseError = knownError('P2002', meta);
    vi.mocked(prisma.tuyenXe.create).mockRejectedValueOnce(databaseError);
    await expect(service.create(createInput, tenantAdmin(3))).rejects.toBe(
      databaseError,
    );
  });

  it('does not allow a tenant admin to create routes for a different company', async () => {
    const error = await service
      .create({ ...createInput, busCompanyId: 4 }, tenantAdmin(3))
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toMatchObject({
      error: 'TENANT_SCOPE_VIOLATION',
    });
    expect(prisma.nhaXe.findUnique).not.toHaveBeenCalled();
    expect(prisma.tuyenXe.create).not.toHaveBeenCalled();
  });

  it('maps an FK race after company verification to BUS_COMPANY_NOT_FOUND', async () => {
    vi.mocked(prisma.tuyenXe.create).mockRejectedValueOnce(knownError('P2003'));
    const error = await service
      .create(createInput, tenantAdmin(3))
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(NotFoundException);
    expect((error as NotFoundException).getResponse()).toMatchObject({
      error: 'BUS_COMPANY_NOT_FOUND',
    });
  });

  it('updates only origin and destination and returns the full route contract', async () => {
    const result = await service.update(
      17,
      { origin: 'Đà Lạt', destination: 'Nha Trang' },
      tenantAdmin(3),
    );
    expect(prisma.tuyenXe.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tuyenXeId: 17, nhaXeId: 3 },
        data: { diemDi: 'Đà Lạt', diemDen: 'Nha Trang' },
      }),
    );
    expect(result.data).toMatchObject({
      code: 'FUTA-TX-0100',
      status: 'HOAT_DONG',
      busCompany: { busCompanyId: 3 },
    });
  });

  it('returns ROUTE_NOT_FOUND on a missing update record', async () => {
    vi.mocked(prisma.tuyenXe.updateMany).mockResolvedValueOnce({ count: 0 });
    const error = await service
      .update(999, { origin: 'A', destination: 'B' }, tenantAdmin(3))
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(NotFoundException);
    expect((error as NotFoundException).getResponse()).toEqual({
      error: 'ROUTE_NOT_FOUND',
      message: 'Không tìm thấy tuyến xe.',
    });
  });
});
