import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomersService } from '../../../src/customers/customers.service.js';
import { UpdateMeDto } from '../../../src/customers/dto/update-me.dto.js';
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
const prisma = {
  taiKhoan: { findUnique: vi.fn(), update: vi.fn() },
};
const service = new CustomersService(prisma as unknown as PrismaService);

describe('CustomersService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.taiKhoan.findUnique.mockResolvedValue(account);
    prisma.taiKhoan.update.mockResolvedValue(account);
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
    prisma.taiKhoan.update.mockResolvedValueOnce({
      ...account,
      hoTen: 'Nguyễn Văn Bình',
      ngaySinh: null,
      cccd: null,
      email: null,
    });

    const result = await service.updateMe(42, {
      fullName: 'Nguyễn Văn Bình',
      dateOfBirth: null,
      citizenId: null,
      email: null,
    });

    expect(prisma.taiKhoan.update).toHaveBeenCalledWith({
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
