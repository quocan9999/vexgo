import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../src/app.module.js';
import { SMS_SENDER, type SmsSender } from '../../src/auth/sms/sms-sender.js';
import { configureApi } from '../../src/common/configure-api.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

describe('phone auth and customer profile flow', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const phone = `+849${Date.now().toString().slice(-8)}`;
  const capturedOtps = new Map<string, string>();
  const smsSender: SmsSender = {
    async sendOtp({ soDienThoai, otp }) {
      capturedOtps.set(soDienThoai, otp);
    },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SMS_SENDER)
      .useValue(smsSender)
      .compile();

    app = moduleRef.createNestApplication();
    configureApi(app);
    await app.init();
    prisma = app.get(PrismaService);

    const customerRole = await prisma.vaiTro.findUnique({
      where: { tenVaiTro: 'KHACH_HANG' },
    });
    if (!customerRole) {
      throw new Error('Seed role KHACH_HANG is required for auth E2E');
    }
  }, 30000); // Tăng thời gian timeout lên 30 giây (30000ms)

  afterAll(async () => {
    if (prisma) {
      const account = await prisma.taiKhoan.findUnique({
        where: { soDienThoai: phone },
        select: { taiKhoanId: true },
      });
      if (account) {
        await prisma.$transaction([
          prisma.phienDangNhap.deleteMany({
            where: { taiKhoanId: account.taiKhoanId },
          }),
          prisma.taiKhoanVaiTro.deleteMany({
            where: { taiKhoanId: account.taiKhoanId },
          }),
          prisma.khachHang.deleteMany({
            where: { taiKhoanId: account.taiKhoanId },
          }),
          prisma.taiKhoan.deleteMany({
            where: { taiKhoanId: account.taiKhoanId },
          }),
        ]);
      }
      await prisma.yeuCauOtp.deleteMany({ where: { soDienThoai: phone } });
    }
    await app?.close();
  });

  it('runs OTP, registration, profile, refresh and logout against MySQL', async () => {
    const otpRequest = await request(app.getHttpServer())
      .post('/api/v1/auth/register/request-otp')
      .send({ phoneNumber: phone })
      .expect(201);
    const otp = capturedOtps.get(phone);
    expect(otp).toMatch(/^\d{6}$/);

    const verification = await request(app.getHttpServer())
      .post('/api/v1/auth/register/verify-otp')
      .send({
        challengeId: otpRequest.body.data.challengeId,
        phoneNumber: phone,
        otp,
      })
      .expect(201);

    const registration = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        otpProof: verification.body.data.otpProof,
        fullName: 'Khách Hàng E2E',
        phoneNumber: phone,
        password: 'VexGo@123',
        email: 'e2e@example.com',
        citizenId: '079123456789',
        dateOfBirth: '2000-02-29',
      })
      .expect(201);
    const firstAccessToken = registration.body.data.accessToken as string;
    const firstRefreshToken = registration.body.data.refreshToken as string;
    expect(firstAccessToken).toBeTruthy();
    expect(firstRefreshToken).toBeTruthy();

    const profile = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${firstAccessToken}`)
      .expect(200);
    expect(profile.body.data).toMatchObject({
      fullName: 'Khách Hàng E2E',
      phoneNumber: phone,
      dateOfBirth: '2000-02-29',
      email: 'e2e@example.com',
    });

    const updated = await request(app.getHttpServer())
      .patch('/api/v1/me')
      .set('Authorization', `Bearer ${firstAccessToken}`)
      .send({ fullName: 'Khách Hàng E2E Đã Sửa', email: null })
      .expect(200);
    expect(updated.body.data).toMatchObject({
      fullName: 'Khách Hàng E2E Đã Sửa',
      email: null,
    });

    const refresh = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Authorization', 'Bearer expired-access-token')
      .send({ refreshToken: firstRefreshToken })
      .expect(200);
    const secondAccessToken = refresh.body.data.accessToken as string;
    const secondRefreshToken = refresh.body.data.refreshToken as string;
    expect(secondRefreshToken).not.toBe(firstRefreshToken);

    const replay = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: firstRefreshToken })
      .expect(401);
    expect(replay.body.error).toBe('REFRESH_TOKEN_INVALID');

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({ refreshToken: secondRefreshToken })
      .expect(204);

    const revokedAccess = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${secondAccessToken}`)
      .expect(401);
    expect(revokedAccess.body.error).toBe('ACCESS_TOKEN_INVALID');
  });
});
