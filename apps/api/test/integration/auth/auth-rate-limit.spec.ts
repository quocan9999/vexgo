import { type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AuthModule } from '../../../src/auth/auth.module.js';
import { AuthService } from '../../../src/auth/auth.service.js';
import { SMS_SENDER } from '../../../src/auth/sms/sms-sender.js';
import { configureApi } from '../../../src/common/configure-api.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';

describe('Admin login rate limit', () => {
  let app: INestApplication;
  const login = vi.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              JWT_ACCESS_SECRET:
                'test-only-jwt-secret-for-vexgo-unit-tests-2026',
              OTP_HASH_SECRET: 'test-only-otp-secret-for-vexgo-unit-tests-2026',
              CORS_ALLOWED_ORIGINS:
                'http://localhost:3000,http://localhost:3001',
              ADMIN_AUTH_COOKIE_ALLOWED_ORIGINS: 'http://localhost:3001',
              AUTH_LOGIN_RATE_LIMIT: '20',
              AUTH_LOGIN_RATE_TTL_MS: '900000',
            }),
          ],
        }),
        AuthModule,
      ],
    })
      .overrideProvider(AuthService)
      .useValue({ login })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(JwtService)
      .useValue({})
      .overrideProvider(SMS_SENDER)
      .useValue({ sendOtp: vi.fn() })
      .compile();

    app = moduleRef.createNestApplication();
    configureApi(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('limits all login attempts from one IP before reaching the login service', async () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({})
        .expect(400);
    }

    const limited = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({})
      .expect(429);

    expect(limited.body.message).toBeDefined();
    expect(login).not.toHaveBeenCalled();
  });
});
