import {
  UnauthorizedException,
  type ExecutionContext,
  type INestApplication,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminAccountsModule } from '../../../src/admin-accounts/admin-accounts.module.js';
import { AdminAccountsService } from '../../../src/admin-accounts/admin-accounts.service.js';
import { AuthorizationGuard } from '../../../src/auth/guards/authorization.guard.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';
import { BusCompaniesModule } from '../../../src/bus-companies/bus-companies.module.js';
import { BusCompaniesService } from '../../../src/bus-companies/bus-companies.service.js';
import { configureApi } from '../../../src/common/configure-api.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';

const TOKENS = {
  adminAccountRead: 'Bearer platform-admin-account-read',
  adminAccountCreate: 'Bearer platform-admin-account-create',
  adminAccountUpdate: 'Bearer platform-admin-account-update',
  busCompanyRead: 'Bearer platform-bus-company-read',
  busCompanyCreate: 'Bearer platform-bus-company-create',
  busCompanyUpdate: 'Bearer platform-bus-company-update',
  tenant: 'Bearer tenant-admin',
} as const;

const principalByToken = new Map<string, AuthPrincipal>([
  [TOKENS.adminAccountRead, {
    taiKhoanId: 1,
    sessionId: 'platform-read-session',
    roles: ['SUPER_ADMIN'],
    permissions: ['admin-account:read'],
    nhanVienId: null,
    nhaXeId: null,
  }],
  [TOKENS.adminAccountCreate, {
    taiKhoanId: 1,
    sessionId: 'platform-create-session',
    roles: ['SUPER_ADMIN'],
    permissions: ['admin-account:create'],
    nhanVienId: null,
    nhaXeId: null,
  }],
  [TOKENS.adminAccountUpdate, {
    taiKhoanId: 1,
    sessionId: 'platform-update-session',
    roles: ['SUPER_ADMIN'],
    permissions: ['admin-account:update'],
    nhanVienId: null,
    nhaXeId: null,
  }],
  [TOKENS.busCompanyRead, {
    taiKhoanId: 1,
    sessionId: 'platform-bus-read-session',
    roles: ['SUPER_ADMIN'],
    permissions: ['bus-company:read'],
    nhanVienId: null,
    nhaXeId: null,
  }],
  [TOKENS.busCompanyCreate, {
    taiKhoanId: 1,
    sessionId: 'platform-bus-create-session',
    roles: ['SUPER_ADMIN'],
    permissions: ['bus-company:create'],
    nhanVienId: null,
    nhaXeId: null,
  }],
  [TOKENS.busCompanyUpdate, {
    taiKhoanId: 1,
    sessionId: 'platform-bus-update-session',
    roles: ['SUPER_ADMIN'],
    permissions: ['bus-company:update'],
    nhanVienId: null,
    nhaXeId: null,
  }],
  [TOKENS.tenant, {
    taiKhoanId: 2,
    sessionId: 'tenant-session',
    roles: ['NHA_XE_ADMIN'],
    permissions: [],
    nhanVienId: 12,
    nhaXeId: 4,
  }],
]);

const adminAccountsService = {
  findAll: vi.fn().mockResolvedValue({ data: [], meta: {} }),
  findOne: vi.fn().mockResolvedValue({ data: { accountId: 1 } }),
  create: vi.fn().mockResolvedValue({ data: { accountId: 1 } }),
  update: vi.fn().mockResolvedValue({ data: { accountId: 1 } }),
  updateStatus: vi.fn().mockResolvedValue({ data: { accountId: 1 } }),
};

const busCompaniesService = {
  findAll: vi.fn().mockResolvedValue({ data: [], meta: {} }),
  findOne: vi.fn().mockResolvedValue({ data: { busCompanyId: 1 } }),
  create: vi.fn().mockResolvedValue({ data: { busCompanyId: 1 } }),
  update: vi.fn().mockResolvedValue({ data: { busCompanyId: 1 } }),
  updateStatus: vi.fn().mockResolvedValue({ data: { busCompanyId: 1 } }),
};

const testAccessTokenGuard = {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: AuthPrincipal;
    }>();
    const authorization = request.headers.authorization;
    if (!authorization) return true;

    const principal = principalByToken.get(authorization);
    if (!principal) {
      throw new UnauthorizedException({
        error: 'ACCESS_TOKEN_INVALID',
        message: 'Cần đăng nhập để thực hiện thao tác này.',
      });
    }
    request.user = principal;
    return true;
  },
};

describe('platform endpoint permission enforcement', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AdminAccountsModule, BusCompaniesModule],
      providers: [{ provide: ConfigService, useValue: { get: () => undefined } }],
    })
      .overrideProvider(AdminAccountsService)
      .useValue(adminAccountsService)
      .overrideProvider(BusCompaniesService)
      .useValue(busCompaniesService)
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    app = moduleRef.createNestApplication();
    configureApi(app);
    app.useGlobalGuards(
      testAccessTokenGuard,
      new AuthorizationGuard(new Reflector()),
    );
    await app.init();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('requires admin-account:read for list and detail endpoints', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin-accounts')
      .set('Authorization', TOKENS.adminAccountRead)
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/admin-accounts/1')
      .set('Authorization', TOKENS.adminAccountRead)
      .expect(200);

    const denied = await request(app.getHttpServer())
      .get('/api/v1/admin-accounts')
      .set('Authorization', TOKENS.adminAccountCreate)
      .expect(403);

    expect(denied.body.error).toBe('PERMISSION_FORBIDDEN');
    expect(adminAccountsService.findAll).toHaveBeenCalledTimes(1);
    expect(adminAccountsService.findOne).toHaveBeenCalledTimes(1);
  });

  it('requires admin-account:create for account creation', async () => {
    const body = {
      fullName: 'Nguyễn Minh Anh',
      phoneNumber: '+84900000000',
      password: 'VexGo@123',
      busCompanyId: 1,
      employeeCode: 'EMP-001',
    };

    await request(app.getHttpServer())
      .post('/api/v1/admin-accounts')
      .set('Authorization', TOKENS.adminAccountCreate)
      .send(body)
      .expect(201);

    const denied = await request(app.getHttpServer())
      .post('/api/v1/admin-accounts')
      .set('Authorization', TOKENS.adminAccountRead)
      .send(body)
      .expect(403);

    expect(denied.body.error).toBe('PERMISSION_FORBIDDEN');
    expect(adminAccountsService.create).toHaveBeenCalledTimes(1);
  });

  it('requires admin-account:update for account and status updates', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/admin-accounts/1')
      .set('Authorization', TOKENS.adminAccountUpdate)
      .send({ fullName: 'Nguyễn Minh Anh mới' })
      .expect(200);
    await request(app.getHttpServer())
      .patch('/api/v1/admin-accounts/1/status')
      .set('Authorization', TOKENS.adminAccountUpdate)
      .send({ status: 'HOAT_DONG' })
      .expect(200);

    const denied = await request(app.getHttpServer())
      .patch('/api/v1/admin-accounts/1/status')
      .set('Authorization', TOKENS.adminAccountRead)
      .send({ status: 'TAM_KHOA' })
      .expect(403);

    expect(denied.body.error).toBe('PERMISSION_FORBIDDEN');
    expect(adminAccountsService.update).toHaveBeenCalledTimes(1);
    expect(adminAccountsService.updateStatus).toHaveBeenCalledTimes(1);
  });

  it('requires platform permission and authentication for admin account endpoints', async () => {
    const anonymous = await request(app.getHttpServer())
      .get('/api/v1/admin-accounts')
      .expect(401);
    expect(anonymous.body.error).toBe('ACCESS_TOKEN_INVALID');

    const tenant = await request(app.getHttpServer())
      .get('/api/v1/admin-accounts')
      .set('Authorization', TOKENS.tenant)
      .expect(403);
    expect(tenant.body.error).toBe('ROLE_FORBIDDEN');
  });

  it('keeps public bus-company reads available without Admin permission', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/bus-companies')
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/bus-companies/1')
      .expect(200);

    expect(busCompaniesService.findAll).toHaveBeenCalledTimes(1);
    expect(busCompaniesService.findOne).toHaveBeenCalledTimes(1);
  });

  it('requires bus-company:create to create a bus company', async () => {
    const body = {
      code: 'FUTA-NEW',
      name: 'Phương Trang',
      status: 'HOAT_DONG',
    };

    await request(app.getHttpServer())
      .post('/api/v1/bus-companies')
      .set('Authorization', TOKENS.busCompanyCreate)
      .send(body)
      .expect(201);

    const denied = await request(app.getHttpServer())
      .post('/api/v1/bus-companies')
      .set('Authorization', TOKENS.adminAccountCreate)
      .send(body)
      .expect(403);

    expect(denied.body.error).toBe('PERMISSION_FORBIDDEN');
    expect(busCompaniesService.create).toHaveBeenCalledTimes(1);
  });

  it('requires bus-company:update for edits and status changes', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/bus-companies/1')
      .set('Authorization', TOKENS.busCompanyUpdate)
      .send({ code: 'FUTA', name: 'Phương Trang' })
      .expect(200);
    await request(app.getHttpServer())
      .patch('/api/v1/bus-companies/1/status')
      .set('Authorization', TOKENS.busCompanyUpdate)
      .send({ status: 'TAM_NGUNG' })
      .expect(200);

    const denied = await request(app.getHttpServer())
      .patch('/api/v1/bus-companies/1/status')
      .set('Authorization', TOKENS.busCompanyRead)
      .send({ status: 'TAM_NGUNG' })
      .expect(403);

    expect(denied.body.error).toBe('PERMISSION_FORBIDDEN');
    expect(busCompaniesService.update).toHaveBeenCalledTimes(1);
    expect(busCompaniesService.updateStatus).toHaveBeenCalledTimes(1);
  });
});
