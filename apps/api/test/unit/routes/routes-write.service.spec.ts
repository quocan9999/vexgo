import 'reflect-metadata';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../../src/generated/prisma/client.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../../src/prisma/prisma.service.js';
import { RoutesService } from '../../../src/routes/routes.service.js';

const record = {
  tuyenXeId: 17, nhaXeId: 3, maTuyenXe: 'FUTA-TX-0100',
  diemDi: 'TP.HCM', diemDen: 'Đà Lạt', trangThai: 'HOAT_DONG',
  createdAt: new Date('2026-09-22T07:34:00.000Z'),
  updatedAt: new Date('2026-09-23T07:34:00.000Z'),
  nhaXe: { nhaXeId: 3, maNhaXe: 'FUTA', tenNhaXe: 'Phương Trang' },
};
const company = {
  nhaXeId: 3, maNhaXe: 'FUTA', tenNhaXe: 'Phương Trang',
  thongTinLienHe: null, trangThai: 'HOAT_DONG',
  createdAt: new Date('2026-09-22T07:34:00.000Z'),
  updatedAt: new Date('2026-09-22T07:34:00.000Z'),
};
const prisma = {
  nhaXe: { findUnique: vi.fn() },
  tuyenXe: { create: vi.fn(), update: vi.fn() },
} as unknown as PrismaService;
const service = new RoutesService(prisma);
const createInput = {
  code: 'FUTA-TX-0100', origin: 'TP.HCM', destination: 'Đà Lạt',
  busCompanyId: 3, status: 'HOAT_DONG' as const,
};

function knownError(code: string, meta: Record<string, unknown> = {}) {
  return new Prisma.PrismaClientKnownRequestError('database failure', {
    code, clientVersion: 'test', meta,
  });
}

describe('RoutesService writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.nhaXe.findUnique).mockResolvedValue(company);
    vi.mocked(prisma.tuyenXe.create).mockResolvedValue(record);
    vi.mocked(prisma.tuyenXe.update).mockResolvedValue(record);
  });

  it('verifies the company and creates only the route with explicit status', async () => {
    const result = await service.create(createInput);
    expect(prisma.nhaXe.findUnique).toHaveBeenCalledWith({
      where: { nhaXeId: 3 }, select: { nhaXeId: true },
    });
    expect(prisma.tuyenXe.create).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        maTuyenXe: 'FUTA-TX-0100', diemDi: 'TP.HCM', diemDen: 'Đà Lạt',
        nhaXeId: 3, trangThai: 'HOAT_DONG',
      },
    }));
    expect(result.data).toMatchObject({
      routeId: 17, code: 'FUTA-TX-0100', busCompany: { busCompanyId: 3, code: 'FUTA', name: 'Phương Trang' },
    });
  });

  it('returns BUS_COMPANY_NOT_FOUND without writing for a missing company', async () => {
    vi.mocked(prisma.nhaXe.findUnique).mockResolvedValueOnce(null);
    const error = await service.create(createInput).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(NotFoundException);
    expect((error as NotFoundException).getResponse()).toEqual({
      error: 'BUS_COMPANY_NOT_FOUND', message: 'Không tìm thấy nhà xe.',
    });
    expect(prisma.tuyenXe.create).not.toHaveBeenCalled();
  });

  it.each([
    { target: ['nhaXeId', 'maTuyenXe'] },
    { target: 'TuyenXe_index_2' },
    { driverAdapterError: { cause: { kind: 'UniqueConstraintViolation', constraint: { index: 'TuyenXe_index_2' } } } },
  ])('maps only the scoped route code unique violation to 409', async (meta) => {
    vi.mocked(prisma.tuyenXe.create).mockRejectedValueOnce(knownError('P2002', meta));
    const error = await service.create(createInput).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toEqual({
      error: 'ROUTE_CODE_EXISTS', message: 'Mã tuyến đã tồn tại trong nhà xe này.',
    });
  });

  it.each([
    { target: ['maTuyenXe'] },
    { target: ['otherField', 'maTuyenXe'] },
    { driverAdapterError: { cause: { kind: 'UniqueConstraintViolation', constraint: { index: 'Other_index' } } } },
  ])('propagates unrelated unique violations', async (meta) => {
    const databaseError = knownError('P2002', meta);
    vi.mocked(prisma.tuyenXe.create).mockRejectedValueOnce(databaseError);
    await expect(service.create(createInput)).rejects.toBe(databaseError);
  });

  it('permits the same code for another company because there is no global pre-check', async () => {
    vi.mocked(prisma.nhaXe.findUnique).mockResolvedValueOnce({ ...company, nhaXeId: 4 });
    await service.create({ ...createInput, busCompanyId: 4 });
    expect(prisma.tuyenXe.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ nhaXeId: 4, maTuyenXe: 'FUTA-TX-0100' }),
    }));
    expect(prisma.tuyenXe.findFirst).toBeUndefined();
  });

  it('maps an FK race after company verification to BUS_COMPANY_NOT_FOUND', async () => {
    vi.mocked(prisma.tuyenXe.create).mockRejectedValueOnce(knownError('P2003'));
    const error = await service.create(createInput).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(NotFoundException);
    expect((error as NotFoundException).getResponse()).toMatchObject({ error: 'BUS_COMPANY_NOT_FOUND' });
  });

  it('updates only origin and destination and returns the full route contract', async () => {
    const result = await service.update(17, { origin: 'Đà Lạt', destination: 'Nha Trang' });
    expect(prisma.tuyenXe.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { tuyenXeId: 17 }, data: { diemDi: 'Đà Lạt', diemDen: 'Nha Trang' },
    }));
    expect(result.data).toMatchObject({ code: 'FUTA-TX-0100', status: 'HOAT_DONG', busCompany: { busCompanyId: 3 } });
  });

  it('returns ROUTE_NOT_FOUND on a missing update record', async () => {
    vi.mocked(prisma.tuyenXe.update).mockRejectedValueOnce(knownError('P2025'));
    const error = await service.update(999, { origin: 'A', destination: 'B' }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(NotFoundException);
    expect((error as NotFoundException).getResponse()).toEqual({
      error: 'ROUTE_NOT_FOUND', message: 'Không tìm thấy tuyến xe.',
    });
  });
});
