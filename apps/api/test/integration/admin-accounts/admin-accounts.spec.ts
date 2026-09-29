import { randomUUID, createHash } from 'node:crypto';
import {
  UnauthorizedException,
  type ExecutionContext,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request, { type Test as SupertestRequest } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../../src/app.module.js';
import { AccessTokenGuard } from '../../../src/auth/guards/access-token.guard.js';
import { configureApi } from '../../../src/common/configure-api.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';

const SUPER_ADMIN_TOKEN = 'Bearer test-super-admin';
const CARRIER_ADMIN_TOKEN = 'Bearer test-carrier-admin';
const ACCESS_TOKEN_ERROR = {
  error: 'ACCESS_TOKEN_INVALID',
  message: 'Cần đăng nhập để thực hiện thao tác này.',
};

describe('Admin account management API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let firstCompanyId: number;
  let secondCompanyId: number;
  const phoneNumbers = new Set<string>();

  const testAccessTokenGuard = {
    canActivate(context: ExecutionContext) {
      const request = context.switchToHttp().getRequest<{
        headers: { authorization?: string };
        user?: {
          taiKhoanId: number;
          sessionId: string;
          roles: string[];
          permissions: string[];
          nhanVienId: number | null;
          nhaXeId: number | null;
        };
      }>();
      const authorization = request.headers.authorization;

      if (authorization === SUPER_ADMIN_TOKEN) {
        request.user = {
          taiKhoanId: 1,
          sessionId: 'test-super-admin-session',
          roles: ['SUPER_ADMIN'],
          permissions: [],
          nhanVienId: null,
          nhaXeId: null,
        };
        return true;
      }
      if (authorization === CARRIER_ADMIN_TOKEN) {
        request.user = {
          taiKhoanId: 2,
          sessionId: 'test-carrier-admin-session',
          roles: ['NHA_XE_ADMIN'],
          permissions: [],
          nhanVienId: 3,
          nhaXeId: firstCompanyId,
        };
        return true;
      }
      throw new UnauthorizedException(ACCESS_TOKEN_ERROR);
    },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AccessTokenGuard)
      .useValue(testAccessTokenGuard)
      .compile();

    app = moduleRef.createNestApplication();
    configureApi(app);
    await app.init();
    prisma = app.get(PrismaService);

    const suffix = randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase();
    const firstCompany = await prisma.nhaXe.create({
      data: {
        maNhaXe: `T15-A-${suffix}`,
        tenNhaXe: `Test Admin Accounts A ${suffix}`,
        trangThai: 'HOAT_DONG',
      },
      select: { nhaXeId: true },
    });
    const secondCompany = await prisma.nhaXe.create({
      data: {
        maNhaXe: `T15-B-${suffix}`,
        tenNhaXe: `Test Admin Accounts B ${suffix}`,
        trangThai: 'TAM_NGUNG',
      },
      select: { nhaXeId: true },
    });
    firstCompanyId = firstCompany.nhaXeId;
    secondCompanyId = secondCompany.nhaXeId;

    const role = await prisma.vaiTro.findUnique({
      where: { tenVaiTro: 'NHA_XE_ADMIN' },
      select: { vaiTroId: true },
    });
    expect(role).not.toBeNull();
  }, 30_000);

  afterAll(async () => {
    try {
      const accounts = await prisma?.taiKhoan.findMany({
        where: { soDienThoai: { in: [...phoneNumbers] } },
        select: { taiKhoanId: true },
      });
      const accountIds = accounts.map(({ taiKhoanId }) => taiKhoanId);
      if (accountIds.length) {
        await prisma.phienDangNhap.deleteMany({
          where: { taiKhoanId: { in: accountIds } },
        });
        await prisma.taiKhoanVaiTro.deleteMany({
          where: { taiKhoanId: { in: accountIds } },
        });
        await prisma.nhanVien.deleteMany({
          where: { taiKhoanId: { in: accountIds } },
        });
        await prisma.taiKhoan.deleteMany({
          where: { taiKhoanId: { in: accountIds } },
        });
      }
      if (firstCompanyId && secondCompanyId) {
        await prisma.nhaXe.deleteMany({
          where: { nhaXeId: { in: [firstCompanyId, secondCompanyId] } },
        });
      }
    } finally {
      await app?.close();
    }
  }, 30_000);

  function uniqueIdentity() {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
    const phoneSuffix = String(parseInt(suffix, 16) % 100_000_000).padStart(
      8,
      '0',
    );
    const phoneNumber = `+849${phoneSuffix}`;
    const employeeCode = `TEST-${suffix}`;
    phoneNumbers.add(phoneNumber);
    return { phoneNumber, employeeCode };
  }

  function asSuperAdmin(call: SupertestRequest) {
    return call.set('Authorization', SUPER_ADMIN_TOKEN);
  }

  function asCarrierAdmin(call: SupertestRequest) {
    return call.set('Authorization', CARRIER_ADMIN_TOKEN);
  }

  async function createAdminAccount(
    companyId = firstCompanyId,
    overrides: Record<string, unknown> = {},
  ) {
    const identity = uniqueIdentity();
    const response = await asSuperAdmin(
      request(app.getHttpServer()).post('/api/v1/admin-accounts'),
    )
      .send({
        fullName: 'Nguyễn Minh Anh',
        phoneNumber: identity.phoneNumber,
        password: 'VexGo@123',
        busCompanyId: companyId,
        employeeCode: identity.employeeCode,
        ...overrides,
      })
      .expect(201);
    return response.body.data as {
      accountId: number;
      phoneNumber: string;
      status: string;
      roles: string[];
      employee: { employeeId: number; employeeCode: string };
      busCompany: { busCompanyId: number; status: string };
    };
  }

  async function createNonAdminEmployee(roleNames: string[]) {
    const { phoneNumber, employeeCode } = uniqueIdentity();
    const account = await prisma.taiKhoan.create({
      data: {
        hoTen: 'Nhân viên kiểm thử',
        soDienThoai: phoneNumber,
        matKhau: 'not-a-real-login-hash',
        daXacThucSoDienThoai: true,
        trangThai: 'HOAT_DONG',
      },
      select: { taiKhoanId: true },
    });
    await prisma.nhanVien.create({
      data: {
        maNhanVien: employeeCode,
        trangThaiLamViec: 'DANG_LAM_VIEC',
        nhaXeId: firstCompanyId,
        taiKhoanId: account.taiKhoanId,
      },
    });
    for (const roleName of roleNames) {
      const role = await prisma.vaiTro.findUniqueOrThrow({
        where: { tenVaiTro: roleName },
        select: { vaiTroId: true },
      });
      await prisma.taiKhoanVaiTro.create({
        data: { taiKhoanId: account.taiKhoanId, vaiTroId: role.vaiTroId },
      });
    }
    return account.taiKhoanId;
  }

  it('requires authentication and restricts these endpoints to SUPER_ADMIN', async () => {
    const anonymous = await request(app.getHttpServer())
      .get('/api/v1/admin-accounts')
      .expect(401);
    expect(anonymous.body.error).toBe('ACCESS_TOKEN_INVALID');

    const carrier = await asCarrierAdmin(
      request(app.getHttpServer()).get('/api/v1/admin-accounts'),
    ).expect(403);
    expect(carrier.body.error).toBe('ROLE_FORBIDDEN');

    await asSuperAdmin(
      request(app.getHttpServer()).get('/api/v1/admin-accounts'),
    ).expect(200);
  });

  it('creates the account, employee, and fixed tenant-admin role without returning secrets', async () => {
    const created = await createAdminAccount();
    const stored = await prisma.taiKhoan.findUniqueOrThrow({
      where: { taiKhoanId: created.accountId },
      include: {
        nhanVien: true,
        taiKhoanVaiTros: { include: { vaiTro: true } },
      },
    });

    expect(stored.trangThai).toBe('HOAT_DONG');
    expect(stored.daXacThucSoDienThoai).toBe(true);
    expect(stored.nhanVien).toMatchObject({
      nhaXeId: firstCompanyId,
      maNhanVien: created.employee.employeeCode,
      trangThaiLamViec: 'DANG_LAM_VIEC',
    });
    expect(
      stored.taiKhoanVaiTros.map(({ vaiTro }) => vaiTro.tenVaiTro),
    ).toEqual(['NHA_XE_ADMIN']);
    expect(await bcrypt.compare('VexGo@123', stored.matKhau)).toBe(true);

    const detail = await asSuperAdmin(
      request(app.getHttpServer()).get(
        `/api/v1/admin-accounts/${created.accountId}`,
      ),
    ).expect(200);
    expect(detail.body.data).toMatchObject({
      accountId: created.accountId,
      roles: ['NHA_XE_ADMIN'],
      busCompany: { busCompanyId: firstCompanyId },
    });
    expect(detail.body.data).not.toHaveProperty('password');
    expect(detail.body.data).not.toHaveProperty('matKhau');
    expect(JSON.stringify(detail.body)).not.toContain('refreshTokenHash');
  });

  it('rejects role injection and invalid creation fields before writing', async () => {
    const identity = uniqueIdentity();
    const response = await asSuperAdmin(
      request(app.getHttpServer()).post('/api/v1/admin-accounts'),
    )
      .send({
        fullName: 'Nguyễn Minh Anh',
        phoneNumber: identity.phoneNumber,
        password: 'VexGo@123',
        busCompanyId: firstCompanyId,
        employeeCode: identity.employeeCode,
        role: 'SUPER_ADMIN',
      })
      .expect(400);
    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(
      await prisma.taiKhoan.findUnique({
        where: { soDienThoai: identity.phoneNumber },
        select: { taiKhoanId: true },
      }),
    ).toBeNull();
  });

  it('lists only NHA_XE_ADMIN accounts and applies company and status filters', async () => {
    const first = await createAdminAccount(firstCompanyId);
    const secondCompanyAdmin = await createAdminAccount(secondCompanyId);
    const employeeId = await createNonAdminEmployee(['NHAN_VIEN_BAN_VE']);
    const mixedSuperAdminId = await createNonAdminEmployee([
      'NHA_XE_ADMIN',
      'SUPER_ADMIN',
    ]);

    const response = await asSuperAdmin(
      request(app.getHttpServer())
        .get('/api/v1/admin-accounts')
        .query({ busCompanyId: firstCompanyId, status: 'HOAT_DONG' }),
    ).expect(200);
    const listedIds = response.body.data.map(
      (account: { accountId: number }) => account.accountId,
    );

    expect(listedIds).toContain(first.accountId);
    expect(listedIds).not.toContain(secondCompanyAdmin.accountId);
    expect(listedIds).not.toContain(employeeId);
    expect(listedIds).not.toContain(mixedSuperAdminId);
    expect(response.body.meta).toMatchObject({ page: 1, pageSize: 10 });
  });

  it('hides employee and mixed Super Admin IDs outside its managed collection', async () => {
    const employeeId = await createNonAdminEmployee(['NHAN_VIEN_BAN_VE']);
    const mixedSuperAdminId = await createNonAdminEmployee([
      'NHA_XE_ADMIN',
      'SUPER_ADMIN',
    ]);

    for (const id of [employeeId, mixedSuperAdminId]) {
      const response = await asSuperAdmin(
        request(app.getHttpServer()).get(`/api/v1/admin-accounts/${id}`),
      ).expect(404);
      expect(response.body.error).toBe('ADMIN_ACCOUNT_NOT_FOUND');
    }
  });

  it('maps duplicate phone and per-company employee code to conflicts without partial writes', async () => {
    const created = await createAdminAccount();
    const duplicatePhoneIdentity = uniqueIdentity();
    const duplicatePhone = await asSuperAdmin(
      request(app.getHttpServer()).post('/api/v1/admin-accounts'),
    )
      .send({
        fullName: 'Khác người',
        phoneNumber: created.phoneNumber,
        password: 'VexGo@123',
        busCompanyId: firstCompanyId,
        employeeCode: duplicatePhoneIdentity.employeeCode,
      })
      .expect(409);
    expect(duplicatePhone.body.error).toBe('PHONE_ALREADY_REGISTERED');
    expect(
      await prisma.nhanVien.count({
        where: {
          nhaXeId: firstCompanyId,
          maNhanVien: duplicatePhoneIdentity.employeeCode,
        },
      }),
    ).toBe(0);

    const duplicateCodeIdentity = uniqueIdentity();
    const duplicateCode = await asSuperAdmin(
      request(app.getHttpServer()).post('/api/v1/admin-accounts'),
    )
      .send({
        fullName: 'Người khác',
        phoneNumber: duplicateCodeIdentity.phoneNumber,
        password: 'VexGo@123',
        busCompanyId: firstCompanyId,
        employeeCode: created.employee.employeeCode,
      })
      .expect(409);
    expect(duplicateCode.body.error).toBe('EMPLOYEE_CODE_EXISTS');
    expect(
      await prisma.taiKhoan.findUnique({
        where: { soDienThoai: duplicateCodeIdentity.phoneNumber },
        select: { taiKhoanId: true },
      }),
    ).toBeNull();
  });

  it('allows an employee code to be reused by another carrier and assigns suspended carriers explicitly', async () => {
    const first = await createAdminAccount(firstCompanyId);
    const second = await createAdminAccount(secondCompanyId, {
      employeeCode: first.employee.employeeCode,
    });

    expect(second.busCompany).toMatchObject({
      busCompanyId: secondCompanyId,
      status: 'TAM_NGUNG',
    });
    expect(second.employee.employeeCode).toBe(first.employee.employeeCode);
  });

  it('returns 404 for a missing company without creating an account', async () => {
    const identity = uniqueIdentity();
    const response = await asSuperAdmin(
      request(app.getHttpServer()).post('/api/v1/admin-accounts'),
    )
      .send({
        fullName: 'Nguyễn Minh Anh',
        phoneNumber: identity.phoneNumber,
        password: 'VexGo@123',
        busCompanyId: 2_147_483_647,
        employeeCode: identity.employeeCode,
      })
      .expect(404);

    expect(response.body.error).toBe('BUS_COMPANY_NOT_FOUND');
    expect(
      await prisma.taiKhoan.findUnique({
        where: { soDienThoai: identity.phoneNumber },
        select: { taiKhoanId: true },
      }),
    ).toBeNull();
  });

  it('updates only profile fields and allows clearing nullable fields', async () => {
    const created = await createAdminAccount();
    const response = await asSuperAdmin(
      request(app.getHttpServer()).patch(
        `/api/v1/admin-accounts/${created.accountId}`,
      ),
    )
      .send({
        fullName: 'Tên đã cập nhật',
        dateOfBirth: null,
        email: null,
        citizenId: null,
      })
      .expect(200);

    expect(response.body.data).toMatchObject({
      fullName: 'Tên đã cập nhật',
      dateOfBirth: null,
      email: null,
      citizenId: null,
    });

    const forbiddenField = await asSuperAdmin(
      request(app.getHttpServer()).patch(
        `/api/v1/admin-accounts/${created.accountId}`,
      ),
    )
      .send({ busCompanyId: secondCompanyId })
      .expect(400);
    expect(forbiddenField.body.error).toBe('VALIDATION_ERROR');
  });

  it('locks idempotently, revokes active sessions, and does not restore them on unlock', async () => {
    const created = await createAdminAccount();
    const activeSession = await prisma.phienDangNhap.create({
      data: {
        sessionId: randomUUID(),
        refreshTokenHash: createHash('sha256')
          .update(randomUUID())
          .digest('hex'),
        hetHanLuc: new Date('2099-01-01T00:00:00.000Z'),
        taiKhoanId: created.accountId,
      },
      select: { phienDangNhapId: true },
    });
    const alreadyRevokedSession = await prisma.phienDangNhap.create({
      data: {
        sessionId: randomUUID(),
        refreshTokenHash: createHash('sha256')
          .update(randomUUID())
          .digest('hex'),
        hetHanLuc: new Date('2099-01-01T00:00:00.000Z'),
        thuHoiLuc: new Date(),
        taiKhoanId: created.accountId,
      },
      select: { phienDangNhapId: true },
    });
    const expiredSession = await prisma.phienDangNhap.create({
      data: {
        sessionId: randomUUID(),
        refreshTokenHash: createHash('sha256')
          .update(randomUUID())
          .digest('hex'),
        hetHanLuc: new Date('2020-01-01T00:00:00.000Z'),
        taiKhoanId: created.accountId,
      },
      select: { phienDangNhapId: true },
    });

    const locked = await asSuperAdmin(
      request(app.getHttpServer()).patch(
        `/api/v1/admin-accounts/${created.accountId}/status`,
      ),
    )
      .send({ status: 'TAM_KHOA' })
      .expect(200);
    expect(locked.body.data.status).toBe('TAM_KHOA');

    const afterLock = await prisma.phienDangNhap.findMany({
      where: { taiKhoanId: created.accountId },
      select: { phienDangNhapId: true, thuHoiLuc: true },
    });
    expect(
      afterLock.find(
        ({ phienDangNhapId }) =>
          phienDangNhapId === activeSession.phienDangNhapId,
      )?.thuHoiLuc,
    ).not.toBeNull();
    expect(
      afterLock.find(
        ({ phienDangNhapId }) =>
          phienDangNhapId === alreadyRevokedSession.phienDangNhapId,
      )?.thuHoiLuc,
    ).not.toBeNull();
    expect(
      afterLock.find(
        ({ phienDangNhapId }) =>
          phienDangNhapId === expiredSession.phienDangNhapId,
      )?.thuHoiLuc,
    ).toBeNull();

    await asSuperAdmin(
      request(app.getHttpServer()).patch(
        `/api/v1/admin-accounts/${created.accountId}/status`,
      ),
    )
      .send({ status: 'TAM_KHOA' })
      .expect(200);
    const unlocked = await asSuperAdmin(
      request(app.getHttpServer()).patch(
        `/api/v1/admin-accounts/${created.accountId}/status`,
      ),
    )
      .send({ status: 'HOAT_DONG' })
      .expect(200);
    expect(unlocked.body.data.status).toBe('HOAT_DONG');
    const afterUnlock = await prisma.phienDangNhap.findMany({
      where: { taiKhoanId: created.accountId },
      select: { thuHoiLuc: true },
    });
    expect(afterUnlock).toHaveLength(3);
    expect(
      afterUnlock.find(({ thuHoiLuc }) => thuHoiLuc === null),
    ).toBeDefined();
    expect(
      afterUnlock.filter(({ thuHoiLuc }) => thuHoiLuc !== null),
    ).toHaveLength(2);
  });
});
