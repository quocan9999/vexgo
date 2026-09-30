import {
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../../src/generated/prisma/client.js';
import { AuthService } from '../../../src/auth/auth.service.js';
import type { RegisterDto } from '../../../src/auth/dto/auth.dto.js';
import type { OtpService } from '../../../src/auth/otp/otp.service.js';
import type { TokenService } from '../../../src/auth/tokens/token.service.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';

const NOW = new Date('2026-09-28T10:00:00.000Z');
const dto: RegisterDto = {
  otpProof: 'verified-one-time-proof',
  fullName: 'Nguyễn Văn An',
  phoneNumber: '+84901234567',
  password: 'VexGo@123',
  email: 'an@example.com',
  citizenId: '079123456789',
  dateOfBirth: '2000-02-29',
};
const account = {
  taiKhoanId: 42,
  hoTen: dto.fullName,
  soDienThoai: dto.phoneNumber,
  matKhau: '$2b$10$hashed',
  ngaySinh: new Date(`${dto.dateOfBirth}T00:00:00.000Z`),
  cccd: dto.citizenId,
  email: dto.email,
  daXacThucSoDienThoai: true,
  trangThai: 'HOAT_DONG',
  createdAt: NOW,
  updatedAt: NOW,
};
const customer = {
  khachHangId: 12,
  maKhachHang: 'KH00000042',
  diemTichLuy: 0,
  taiKhoanId: 42,
  createdAt: NOW,
  updatedAt: NOW,
};
const role = {
  vaiTroId: 7,
  tenVaiTro: 'KHACH_HANG',
  moTa: 'Khách hàng',
  createdAt: NOW,
  updatedAt: NOW,
};
const tokenResponse = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  tokenType: 'Bearer' as const,
  expiresIn: 900,
  user: {
    accountId: 42,
    customerId: 12,
    fullName: dto.fullName,
    phoneNumber: dto.phoneNumber,
    roles: ['KHACH_HANG'],
  },
};

const tx = {
  yeuCauOtp: { updateMany: vi.fn() },
  taiKhoan: { findUnique: vi.fn(), create: vi.fn() },
  khachHang: { create: vi.fn() },
  vaiTro: { findUnique: vi.fn() },
  taiKhoanVaiTro: { create: vi.fn() },
  phienDangNhap: { create: vi.fn() },
};
const prismaMock = {
  $transaction: vi.fn(async (callback) => callback(tx)),
};
const otpService = {
  consumeRegistrationProof: vi.fn(),
};
const tokenService = {
  createSession: vi.fn(),
};
const service = new AuthService(
  prismaMock as unknown as PrismaService,
  otpService as unknown as OtpService,
  tokenService as unknown as TokenService,
);

describe('AuthService register', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.clearAllMocks();
    otpService.consumeRegistrationProof.mockResolvedValue(undefined);
    tx.taiKhoan.findUnique.mockResolvedValue(null);
    tx.taiKhoan.create.mockResolvedValue(account);
    tx.khachHang.create.mockResolvedValue(customer);
    tx.vaiTro.findUnique.mockResolvedValue(role);
    tx.taiKhoanVaiTro.create.mockResolvedValue({
      taiKhoanId: account.taiKhoanId,
      vaiTroId: role.vaiTroId,
      createdAt: NOW,
    });
    tokenService.createSession.mockResolvedValue(tokenResponse);
  });

  it('consumes proof and creates the account, customer, role and session in one transaction', async () => {
    await expect(service.register(dto)).resolves.toEqual(tokenResponse);

    expect(otpService.consumeRegistrationProof).toHaveBeenCalledWith(tx, {
      soDienThoai: dto.phoneNumber,
      otpProof: dto.otpProof,
      usedAt: NOW,
    });
    expect(tx.taiKhoan.create).toHaveBeenCalledWith({
      data: {
        hoTen: dto.fullName,
        soDienThoai: dto.phoneNumber,
        matKhau: expect.not.stringMatching(/^VexGo@123$/),
        ngaySinh: new Date('2000-02-29T00:00:00.000Z'),
        email: dto.email,
        cccd: dto.citizenId,
        daXacThucSoDienThoai: true,
        trangThai: 'HOAT_DONG',
      },
    });
    expect(tx.khachHang.create).toHaveBeenCalledWith({
      data: {
        maKhachHang: 'KH00000042',
        diemTichLuy: 0,
        taiKhoanId: 42,
      },
    });
    expect(tx.taiKhoanVaiTro.create).toHaveBeenCalledWith({
      data: { taiKhoanId: 42, vaiTroId: 7 },
    });
    expect(tokenService.createSession).toHaveBeenCalledWith(tx, {
      accountId: 42,
      customerId: 12,
      fullName: dto.fullName,
      phoneNumber: dto.phoneNumber,
      roles: ['KHACH_HANG'],
    });
    expect(JSON.stringify(tokenResponse)).not.toContain('matKhau');
  });

  it('returns PHONE_ALREADY_REGISTERED without issuing a session', async () => {
    tx.taiKhoan.findUnique.mockResolvedValueOnce({ taiKhoanId: 99 });

    const registration = service.register(dto);
    await expect(registration).rejects.toBeInstanceOf(ConflictException);
    await expect(registration).rejects.toMatchObject({
      response: { error: 'PHONE_ALREADY_REGISTERED' },
    });
    expect(tokenService.createSession).not.toHaveBeenCalled();
  });

  it('normalizes registration email before persisting it', async () => {
    const response = await service.register({ ...dto, email: '  AN@EXAMPLE.COM ' });
    expect(tx.taiKhoan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: 'an@example.com' }),
      }),
    );
    expect(response).toEqual(tokenResponse);
  });

  it('maps duplicate registration email to a stable conflict', async () => {
    tx.taiKhoan.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['email'] },
      }),
    );

    await expect(service.register(dto)).rejects.toMatchObject({
      response: { error: 'EMAIL_ALREADY_REGISTERED' },
    });
    expect(tokenService.createSession).not.toHaveBeenCalled();
  });

  it('throws and does not issue a session when KHACH_HANG role is missing', async () => {
    tx.vaiTro.findUnique.mockResolvedValueOnce(null);

    await expect(service.register(dto)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    expect(tokenService.createSession).not.toHaveBeenCalled();
  });
});
