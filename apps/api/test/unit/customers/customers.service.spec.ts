import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../../src/generated/prisma/client.js';
import { CustomersService } from '../../../src/customers/customers.service.js';
import { UpdateMeDto } from '../../../src/customers/dto/update-me.dto.js';
import { UpdateCustomerStatusDto } from '../../../src/customers/dto/update-customer-status.dto.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';

const account = {
  taiKhoanId: 42,
  hoTen: 'Nguyễn Văn An',
  soDienThoai: '+84901234567',
  matKhau: '$2b$10$hidden',
  ngaySinh: new Date('2000-02-29T00:00:00.000Z'),
  cccd: '079123456789',
  email: 'an@example.com',
  daXacThucSoDienThoai: true,
  trangThai: 'HOAT_DONG',
  createdAt: new Date('2026-09-28T10:00:00.000Z'),
  updatedAt: new Date('2026-09-28T10:05:00.000Z'),
  khachHang: {
    khachHangId: 12,
    maKhachHang: 'KH00000042',
    diemTichLuy: 25,
    taiKhoanId: 42,
    createdAt: new Date('2026-09-28T10:00:00.000Z'),
    updatedAt: new Date('2026-09-28T10:00:00.000Z'),
  },
  taiKhoanVaiTros: [{ vaiTro: { tenVaiTro: 'KHACH_HANG' } }],
};
const tx = {
  khachHang: { update: vi.fn() },
  taiKhoan: { update: vi.fn(), findUnique: vi.fn() },
  phienDangNhap: { updateMany: vi.fn() },
};
const sessionInvalidator = {
  invalidateAccount: vi.fn(),
  revalidateAccount: vi.fn(),
};
const prisma = {
  $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
  taiKhoan: { findUnique: vi.fn(), update: vi.fn() },
  khachHang: { update: vi.fn(), findFirst: vi.fn() },
};
const service = new CustomersService(prisma as unknown as PrismaService, sessionInvalidator as any);

describe('CustomersService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.taiKhoan.findUnique.mockResolvedValue(account);
    prisma.taiKhoan.update.mockResolvedValue(account);
    tx.taiKhoan.update.mockResolvedValue(account);
    tx.khachHang.update.mockResolvedValue(account.khachHang);
  });

  it('maps the authenticated customer profile without sensitive fields', async () => {
    await expect(service.getMe(42)).resolves.toEqual({
      accountId: 42,
      customerId: 12,
      customerCode: 'KH00000042',
      loyaltyPoints: 25,
      fullName: 'Nguyễn Văn An',
      phoneNumber: '+84901234567',
      dateOfBirth: '2000-02-29',
      citizenId: '079123456789',
      email: 'an@example.com',
      phoneVerified: true,
      status: 'HOAT_DONG',
      createdAt: '2026-09-28T10:00:00.000Z',
      updatedAt: '2026-09-28T10:05:00.000Z',
    });
    expect(prisma.taiKhoan.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { taiKhoanId: 42 } }),
    );
  });

  it('rejects an account without the customer role', async () => {
    prisma.taiKhoan.findUnique.mockResolvedValueOnce({
      ...account,
      khachHang: null,
      taiKhoanVaiTros: [{ vaiTro: { tenVaiTro: 'SUPER_ADMIN' } }],
    });

    const profile = service.getMe(42);
    await expect(profile).rejects.toBeInstanceOf(ForbiddenException);
    await expect(profile).rejects.toMatchObject({
      response: { error: 'CUSTOMER_ROLE_REQUIRED' },
    });
  });

  it('returns CUSTOMER_PROFILE_NOT_FOUND for a role/profile integrity gap', async () => {
    prisma.taiKhoan.findUnique.mockResolvedValueOnce({
      ...account,
      khachHang: null,
    });

    await expect(service.getMe(42)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates only the authenticated account and supports clearing optional fields', async () => {
    tx.taiKhoan.update.mockResolvedValueOnce({
      ...account,
      hoTen: 'Nguyễn Văn Bình',
      ngaySinh: null,
      cccd: null,
      email: null,
      khachHang: {
        ...account.khachHang,
        hoTen: 'Nguyễn Văn Bình',
        ngaySinh: null,
      },
    });

    const result = await service.updateMe(42, {
      fullName: 'Nguyễn Văn Bình',
      dateOfBirth: null,
      citizenId: null,
      email: null,
    });

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(tx.khachHang.update).toHaveBeenCalledWith({
      where: { taiKhoanId: 42 },
      data: {
        hoTen: 'Nguyễn Văn Bình',
        ngaySinh: null,
      },
    });
    expect(tx.taiKhoan.update).toHaveBeenCalledWith({
      where: { taiKhoanId: 42 },
      data: {
        hoTen: 'Nguyễn Văn Bình',
        ngaySinh: null,
        cccd: null,
        email: null,
      },
      include: expect.any(Object),
    });
    expect(result).toMatchObject({
      accountId: 42,
      fullName: 'Nguyễn Văn Bình',
      dateOfBirth: null,
      citizenId: null,
      email: null,
    });
  });

  it('normalizes profile email and returns a conflict for duplicate email', async () => {
    await service.updateMe(42, { email: '  NEW@EXAMPLE.COM ' });
    expect(tx.taiKhoan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: 'new@example.com' }),
      }),
    );

    tx.taiKhoan.update.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['email'] },
      }),
    );
    const duplicate = service.updateMe(42, { email: 'used@example.com' });
    await expect(duplicate).rejects.toBeInstanceOf(ConflictException);
    await expect(duplicate).rejects.toMatchObject({
      response: { error: 'EMAIL_ALREADY_REGISTERED' },
    });
  });
});

describe('UpdateMeDto', () => {
  const options = { whitelist: true, forbidNonWhitelisted: true };

  it('accepts a partial profile update and null-clearing', async () => {
    const dto = plainToInstance(UpdateMeDto, {
      fullName: 'Nguyễn Văn Bình',
      dateOfBirth: null,
      email: null,
      citizenId: null,
    });
    await expect(validate(dto, options)).resolves.toEqual([]);
  });

  it.each([
    ['impossible date', { dateOfBirth: '2026-02-30' }, 'dateOfBirth'],
    ['phone cannot change', { phoneNumber: '+84909999999' }, 'phoneNumber'],
    ['customer id cannot change', { customerId: 99 }, 'customerId'],
  ])('rejects %s', async (_name, payload, field) => {
    const dto = plainToInstance(UpdateMeDto, payload);
    const errors = await validate(dto, options);
    expect(errors.map(({ property }) => property)).toContain(field);
  });
});


describe('CustomersService - Admin operations', () => {
  const tenantPrincipal = {
    taiKhoanId: 1,
    email: 'admin@futa.vn',
    roles: ['NHA_XE_ADMIN'],
    nhaXeId: 10,
    busCompanyId: 10,
    employee: { busCompanyId: 10 },
  } as unknown as AuthPrincipal;

  const mockAdminCustomer = {
    khachHangId: 12,
    maKhachHang: 'KH00000042',
    hoTen: 'Nguyễn Văn An',
    ngaySinh: new Date('2000-02-29T00:00:00.000Z'),
    gioiTinh: 'NAM',
    diaChi: '123 Đường Lê Lợi, TP.HCM',
    diemTichLuy: 25,
    taiKhoanId: 42,
    createdAt: new Date('2026-09-28T10:00:00.000Z'),
    updatedAt: new Date('2026-09-28T10:00:00.000Z'),
    taiKhoan: {
      taiKhoanId: 42,
      hoTen: 'Nguyễn Văn An',
      soDienThoai: '+84901234567',
      matKhau: '$2b$10$hidden',
      ngaySinh: new Date('2000-02-29T00:00:00.000Z'),
      cccd: '079123456789',
      email: 'an@example.com',
      daXacThucSoDienThoai: true,
      trangThai: 'HOAT_DONG',
      createdAt: new Date('2026-09-28T10:00:00.000Z'),
      updatedAt: new Date('2026-09-28T10:05:00.000Z'),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.khachHang.findFirst.mockResolvedValue(mockAdminCustomer);
    tx.taiKhoan.update.mockResolvedValue(mockAdminCustomer.taiKhoan);
    tx.taiKhoan.findUnique.mockResolvedValue(mockAdminCustomer.taiKhoan);
    tx.phienDangNhap.updateMany.mockResolvedValue({ count: 1 });
  });

  describe('getAdminCustomerById', () => {
    it('returns customer details with profile fields formatted correctly', async () => {
      const result = await service.getAdminCustomerById(tenantPrincipal, 12);

      expect(result).toEqual({
        data: {
          customerId: 12,
          customerCode: 'KH00000042',
          fullName: 'Nguyễn Văn An',
          phoneNumber: '+84901234567',
          email: 'an@example.com',
          dateOfBirth: '29-02-2000',
          gender: 'NAM',
          address: '123 Đường Lê Lợi, TP.HCM',
          citizenId: '079123456789',
          loyaltyPoints: 25,
          account: {
            accountId: 42,
            status: 'HOAT_DONG',
            phoneVerified: true,
            createdAt: '2026-09-28T10:00:00.000Z',
            updatedAt: '2026-09-28T10:05:00.000Z',
          },
          createdAt: '2026-09-28T10:00:00.000Z',
          updatedAt: '2026-09-28T10:00:00.000Z',
        },
      });
    });

    it('throws NotFoundException when customer is not found in tenant scope', async () => {
      prisma.khachHang.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.getAdminCustomerById(tenantPrincipal, 999),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('updateCustomerStatus', () => {
    it('locks customer account and revokes active sessions', async () => {
      tx.taiKhoan.findUnique.mockResolvedValueOnce({
        taiKhoanId: 42,
        trangThai: 'TAM_KHOA',
        updatedAt: new Date('2026-11-02T02:00:00.000Z'),
      });

      const result = await service.updateCustomerStatus(tenantPrincipal, 12, {
        status: 'TAM_KHOA',
        reason: 'Khách hàng có dấu hiệu đặt chỗ ảo nhiều lần',
      });

      expect(prisma.$transaction).toHaveBeenCalledOnce();
      expect(tx.taiKhoan.update).toHaveBeenCalledWith({
        where: { taiKhoanId: 42 },
        data: { trangThai: 'TAM_KHOA' },
      });
      expect(tx.phienDangNhap.updateMany).toHaveBeenCalledWith({
        where: {
          taiKhoanId: 42,
          thuHoiLuc: null,
          hetHanLuc: { gt: expect.any(Date) },
        },
        data: { thuHoiLuc: expect.any(Date) },
      });
      expect(sessionInvalidator.invalidateAccount).toHaveBeenCalledWith(
        42,
        'SESSION_REVOKED',
      );
      expect(result).toMatchObject({
        data: {
          customerId: 12,
          accountStatus: 'TAM_KHOA',
          message: 'Cập nhật trạng thái tài khoản thành công.',
        },
      });
    });

    it('unlocks customer account and revalidates session', async () => {
      prisma.khachHang.findFirst.mockResolvedValueOnce({
        ...mockAdminCustomer,
        taiKhoan: { ...mockAdminCustomer.taiKhoan, trangThai: 'TAM_KHOA' },
      });
      tx.taiKhoan.findUnique.mockResolvedValueOnce({
        taiKhoanId: 42,
        trangThai: 'HOAT_DONG',
        updatedAt: new Date('2026-11-02T02:00:00.000Z'),
      });

      const result = await service.updateCustomerStatus(tenantPrincipal, 12, {
        status: 'HOAT_DONG',
        reason: 'Khách hàng đã giải trình và hoàn tất xác minh',
      });

      expect(tx.taiKhoan.update).toHaveBeenCalledWith({
        where: { taiKhoanId: 42 },
        data: { trangThai: 'HOAT_DONG' },
      });
      expect(tx.phienDangNhap.updateMany).not.toHaveBeenCalled();
      expect(sessionInvalidator.revalidateAccount).toHaveBeenCalledWith(42);
      expect(result).toMatchObject({
        data: {
          customerId: 12,
          accountStatus: 'HOAT_DONG',
          message: 'Cập nhật trạng thái tài khoản thành công.',
        },
      });
    });

    it('throws NotFoundException when customer to update status does not exist', async () => {
      prisma.khachHang.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.updateCustomerStatus(tenantPrincipal, 999, {
          status: 'TAM_KHOA',
          reason: 'Lý do khóa tài khoản',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});

describe('UpdateCustomerStatusDto', () => {
  const options = { whitelist: true, forbidNonWhitelisted: true };

  it('accepts valid status and reason', async () => {
    const dto = plainToInstance(UpdateCustomerStatusDto, {
      status: 'TAM_KHOA',
      reason: 'Vi phạm chính sách đặt vé nhiều lần',
    });
    await expect(validate(dto, options)).resolves.toEqual([]);
  });

  it('rejects invalid status', async () => {
    const dto = plainToInstance(UpdateCustomerStatusDto, {
      status: 'INVALID_STATUS',
      reason: 'Lý do hợp lệ',
    });
    const errors = await validate(dto, options);
    expect(errors.some((e) => e.property === 'status')).toBe(true);
  });

  it('rejects short reason (less than 5 chars)', async () => {
    const dto = plainToInstance(UpdateCustomerStatusDto, {
      status: 'TAM_KHOA',
      reason: 'abc',
    });
    const errors = await validate(dto, options);
    expect(errors.some((e) => e.property === 'reason')).toBe(true);
  });
});
