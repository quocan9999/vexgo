import { ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminAccountsService } from '../../../src/admin-accounts/admin-accounts.service.js';
import type { CreateAdminAccountDto } from '../../../src/admin-accounts/dto/create-admin-account.dto.js';
import type { AdminAccountQueryDto } from '../../../src/admin-accounts/dto/admin-account-query.dto.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import { Prisma } from '../../../src/generated/prisma/client.js';

const now = new Date('2026-09-29T10:00:00.000Z');
const adminRecord = {
  taiKhoanId: 101,
  hoTen: 'Nguyễn Minh Anh',
  soDienThoai: '+84912345678',
  ngaySinh: new Date('1990-02-28T00:00:00.000Z'),
  cccd: '079123456789',
  email: 'admin@example.com',
  daXacThucSoDienThoai: true,
  trangThai: 'HOAT_DONG',
  createdAt: now,
  updatedAt: now,
  taiKhoanVaiTros: [{ vaiTro: { tenVaiTro: 'NHA_XE_ADMIN' } }],
  nhanVien: {
    nhanVienId: 201,
    maNhanVien: 'FUTA-NV-0001',
    trangThaiLamViec: 'DANG_LAM_VIEC',
    nhaXe: {
      nhaXeId: 12,
      maNhaXe: 'FUTA',
      tenNhaXe: 'FUTA',
      trangThai: 'HOAT_DONG',
    },
  },
};

function knownError(code: string, target: string[]) {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code,
    clientVersion: 'test',
    meta: { target },
  });
}

describe('AdminAccountsService', () => {
  const tx = {
    nhaXe: { findUnique: vi.fn() },
    vaiTro: { findUnique: vi.fn() },
    taiKhoan: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    nhanVien: { create: vi.fn() },
    taiKhoanVaiTro: { create: vi.fn() },
    phienDangNhap: { updateMany: vi.fn() },
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) =>
      callback(tx),
    ),
    taiKhoan: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
  };
  const service = new AdminAccountsService(prisma as unknown as PrismaService);
  const createInput: CreateAdminAccountDto = {
    fullName: 'Nguyễn Minh Anh',
    phoneNumber: '+84912345678',
    password: 'VexGo@123',
    busCompanyId: 12,
    employeeCode: 'FUTA-NV-0001',
    dateOfBirth: '1990-02-28',
    email: 'admin@example.com',
    citizenId: '079123456789',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    tx.nhaXe.findUnique.mockResolvedValue({ nhaXeId: 12 });
    tx.vaiTro.findUnique.mockResolvedValue({
      vaiTroId: 4,
      tenVaiTro: 'NHA_XE_ADMIN',
    });
    tx.taiKhoan.findUnique.mockResolvedValue(null);
    tx.taiKhoan.create.mockResolvedValue({ taiKhoanId: 101 });
    tx.nhanVien.create.mockResolvedValue({ nhanVienId: 201 });
    tx.taiKhoanVaiTro.create.mockResolvedValue({});
    tx.taiKhoan.findFirst.mockResolvedValue(adminRecord);
    tx.taiKhoan.updateMany.mockResolvedValue({ count: 1 });
    tx.phienDangNhap.updateMany.mockResolvedValue({ count: 1 });
    prisma.taiKhoan.findMany.mockResolvedValue([adminRecord]);
    prisma.taiKhoan.findFirst.mockResolvedValue(adminRecord);
    prisma.taiKhoan.count.mockResolvedValue(1);
    prisma.taiKhoan.updateMany.mockResolvedValue({ count: 1 });
  });

  it('creates account, employee, and fixed role atomically with a password hash', async () => {
    const response = await service.create(createInput);
    const storedPassword = tx.taiKhoan.create.mock.calls[0][0].data.matKhau;

    expect(await bcrypt.compare(createInput.password, storedPassword)).toBe(
      true,
    );
    expect(storedPassword).not.toBe(createInput.password);
    expect(tx.nhanVien.create).toHaveBeenCalledWith({
      data: {
        maNhanVien: createInput.employeeCode,
        trangThaiLamViec: 'DANG_LAM_VIEC',
        nhaXeId: 12,
        taiKhoanId: 101,
      },
    });
    expect(tx.taiKhoanVaiTro.create).toHaveBeenCalledWith({
      data: { taiKhoanId: 101, vaiTroId: 4 },
    });
    expect(response.data).toMatchObject({
      accountId: 101,
      roles: ['NHA_XE_ADMIN'],
      employee: { employeeCode: 'FUTA-NV-0001' },
      busCompany: { busCompanyId: 12, code: 'FUTA' },
    });
    expect(JSON.stringify(response)).not.toContain('matKhau');
    expect(JSON.stringify(response)).not.toContain('refreshTokenHash');
  });

  it('does not write when the phone number is already registered', async () => {
    tx.taiKhoan.findUnique.mockResolvedValueOnce({ taiKhoanId: 55 });

    await expect(service.create(createInput)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(tx.taiKhoan.create).not.toHaveBeenCalled();
    expect(tx.nhanVien.create).not.toHaveBeenCalled();
    expect(tx.taiKhoanVaiTro.create).not.toHaveBeenCalled();
  });

  it('maps a racing duplicate phone insert to a stable conflict', async () => {
    tx.taiKhoan.create.mockRejectedValueOnce(
      knownError('P2002', ['soDienThoai']),
    );

    await expect(service.create(createInput)).rejects.toMatchObject({
      response: { error: 'PHONE_ALREADY_REGISTERED' },
    });
    expect(tx.nhanVien.create).not.toHaveBeenCalled();
  });

  it('maps a duplicate employee code to a stable conflict and rolls back account creation', async () => {
    tx.nhanVien.create.mockRejectedValueOnce(
      knownError('P2002', ['nhaXeId', 'maNhanVien']),
    );

    await expect(service.create(createInput)).rejects.toMatchObject({
      response: { error: 'EMPLOYEE_CODE_EXISTS' },
    });
    expect(tx.taiKhoanVaiTro.create).not.toHaveBeenCalled();
  });

  it('requires an existing carrier and configured NHA_XE_ADMIN seed role', async () => {
    tx.nhaXe.findUnique.mockResolvedValueOnce(null);
    await expect(service.create(createInput)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(tx.taiKhoan.create).not.toHaveBeenCalled();

    tx.nhaXe.findUnique.mockResolvedValueOnce({ nhaXeId: 12 });
    tx.vaiTro.findUnique.mockResolvedValueOnce(null);
    await expect(service.create(createInput)).rejects.toMatchObject({
      response: { error: 'AUTH_ROLE_NOT_CONFIGURED' },
    });
    expect(tx.taiKhoan.create).not.toHaveBeenCalled();
  });

  it('lists only managed admin accounts and applies platform filters', async () => {
    const query: AdminAccountQueryDto = {
      page: 2,
      pageSize: 5,
      sortBy: 'fullName',
      sortDirection: 'desc',
      search: 'FUTA',
      busCompanyId: 12,
      status: 'HOAT_DONG',
    };

    await expect(service.findAll(query)).resolves.toMatchObject({
      data: [{ accountId: 101, roles: ['NHA_XE_ADMIN'] }],
      meta: { page: 2, pageSize: 5, totalItems: 1, totalPages: 1 },
    });
    const queryUsed = prisma.taiKhoan.findMany.mock.calls[0][0];
    expect(queryUsed.where).toEqual(
      expect.objectContaining({
        AND: expect.arrayContaining([
          expect.objectContaining({
            taiKhoanVaiTros: expect.any(Object),
            nhanVien: expect.any(Object),
          }),
          { trangThai: 'HOAT_DONG' },
          { nhanVien: { is: { nhaXeId: 12 } } },
        ]),
      }),
    );
    expect(JSON.stringify(queryUsed.select)).not.toContain('matKhau');
  });

  it('returns not found for IDs outside the managed admin-account collection', async () => {
    prisma.taiKhoan.findFirst.mockResolvedValueOnce(null);

    await expect(service.findOne(77)).rejects.toMatchObject({
      response: { error: 'ADMIN_ACCOUNT_NOT_FOUND' },
    });
    const where = prisma.taiKhoan.findFirst.mock.calls[0][0].where;
    expect(where.taiKhoanVaiTros).toBeDefined();
    expect(where.nhanVien).toEqual({ isNot: null });
  });

  it('locks account and revokes active sessions in the same transaction', async () => {
    tx.taiKhoan.findFirst
      .mockResolvedValueOnce(adminRecord)
      .mockResolvedValueOnce({ ...adminRecord, trangThai: 'TAM_KHOA' });

    await service.updateStatus(101, { status: 'TAM_KHOA' });

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(tx.taiKhoan.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ taiKhoanId: 101 }),
        data: { trangThai: 'TAM_KHOA' },
      }),
    );
    expect(tx.phienDangNhap.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          taiKhoanId: 101,
          thuHoiLuc: null,
          hetHanLuc: { gt: expect.any(Date) },
        },
        data: { thuHoiLuc: expect.any(Date) },
      }),
    );
  });

  it('does not create or restore sessions when an account is unlocked', async () => {
    tx.taiKhoan.findFirst
      .mockResolvedValueOnce({ ...adminRecord, trangThai: 'TAM_KHOA' })
      .mockResolvedValueOnce(adminRecord);

    await service.updateStatus(101, { status: 'HOAT_DONG' });

    expect(tx.taiKhoan.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { trangThai: 'HOAT_DONG' } }),
    );
    expect(tx.phienDangNhap.updateMany).not.toHaveBeenCalled();
  });

  it('updates only the editable account profile fields and supports null clearing', async () => {
    prisma.taiKhoan.findFirst
      .mockResolvedValueOnce(adminRecord)
      .mockResolvedValueOnce({
        ...adminRecord,
        ngaySinh: null,
        cccd: null,
        email: null,
      });

    const response = await service.update(101, {
      dateOfBirth: null,
      citizenId: null,
      email: null,
    });

    expect(prisma.taiKhoan.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ taiKhoanId: 101 }),
      data: { ngaySinh: null, cccd: null, email: null },
    });
    expect(response.data).toMatchObject({
      dateOfBirth: null,
      citizenId: null,
      email: null,
    });
  });
});
