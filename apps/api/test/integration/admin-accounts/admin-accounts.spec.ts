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
const SUPER_ADMIN_READ_ONLY_TOKEN = 'Bearer test-super-admin-read-only';
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
          permissions: [
            'bus-company:read',
            'bus-company:create',
            'bus-company:update',
            'admin-account:read',
            'admin-account:create',
            'admin-account:update',
          ],
          nhanVienId: null,
          nhaXeId: null,
        };
        return true;
      }
      if (authorization === SUPER_ADMIN_READ_ONLY_TOKEN) {
        request.user = {
          taiKhoanId: 4,
          sessionId: 'test-super-admin-read-only-session',
          roles: ['SUPER_ADMIN'],
          permissions: ['admin-account:read'],
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

    for (const [name, description] of [
      ['NHA_XE_ADMIN', 'Quản trị nhà xe'],
      ['NHAN_VIEN_BAN_VE', 'Nhân viên bán vé'],
      ['NHAN_VIEN_CSKH', 'Nhân viên chăm sóc khách hàng'],
      ['NHAN_VIEN_PHU_XE', 'Nhân viên phụ xe'],
      ['NHAN_VIEN_KINH_DOANH', 'Nhân viên kinh doanh'],
      ['SUPER_ADMIN', 'Quản trị hệ thống'],
      ['KHACH_HANG', 'Khách hàng'],
    ]) {
      await prisma.vaiTro.upsert({
        where: { tenVaiTro: name },
        create: { tenVaiTro: name, moTa: description },
        update: {},
      });
    }

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

  function asSuperAdminReadOnly(call: SupertestRequest) {
    return call.set('Authorization', SUPER_ADMIN_READ_ONLY_TOKEN);
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

  async function createPlatformAccount(roleName = 'SUPER_ADMIN') {
    const { phoneNumber } = uniqueIdentity();
    const account = await prisma.taiKhoan.create({
      data: {
        hoTen: 'Tài khoản nền tảng kiểm thử',
        soDienThoai: phoneNumber,
        matKhau: 'not-a-real-login-hash',
        daXacThucSoDienThoai: true,
        trangThai: 'HOAT_DONG',
      },
      select: { taiKhoanId: true },
    });
    const role = await prisma.vaiTro.findUniqueOrThrow({
      where: { tenVaiTro: roleName },
      select: { vaiTroId: true },
    });
    await prisma.taiKhoanVaiTro.create({
      data: { taiKhoanId: account.taiKhoanId, vaiTroId: role.vaiTroId },
    });
    return account.taiKhoanId;
  }

  async function roleNamesForAccount(accountId: number) {
    const assignments = await prisma.taiKhoanVaiTro.findMany({
      where: { taiKhoanId: accountId },
      include: { vaiTro: { select: { tenVaiTro: true } } },
      orderBy: { vaiTroId: 'asc' },
    });
    return assignments.map(({ vaiTro }) => vaiTro.tenVaiTro);
  }

  async function activeSuperAdminCount() {
    const assignments = await prisma.taiKhoanVaiTro.findMany({
      where: { vaiTro: { is: { tenVaiTro: 'SUPER_ADMIN' } } },
      select: { taiKhoan: { select: { trangThai: true } } },
    });
    return assignments.filter(
      ({ taiKhoan }) => taiKhoan.trangThai === 'HOAT_DONG',
    ).length;
  }

  it('requires Super Admin role and admin-account:read permission for these endpoints', async () => {
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

  it('requires Super Admin role and admin-account:update permission for role replacement', async () => {
    const created = await createAdminAccount();
    const anonymous = await request(app.getHttpServer())
      .put(`/api/v1/admin-accounts/${created.accountId}/roles`)
      .send({ roleNames: [] })
      .expect(401);
    expect(anonymous.body.error).toBe('ACCESS_TOKEN_INVALID');

    const tenant = await asCarrierAdmin(
      request(app.getHttpServer()).put(
        `/api/v1/admin-accounts/${created.accountId}/roles`,
      ),
    )
      .send({ roleNames: [] })
      .expect(403);
    expect(tenant.body.error).toBe('ROLE_FORBIDDEN');

    const missingPermission = await asSuperAdminReadOnly(
      request(app.getHttpServer()).put(
        `/api/v1/admin-accounts/${created.accountId}/roles`,
      ),
    )
      .send({ roleNames: [] })
      .expect(403);
    expect(missingPermission.body.error).toBe('PERMISSION_FORBIDDEN');
    expect(await roleNamesForAccount(created.accountId)).toEqual([
      'NHA_XE_ADMIN',
    ]);
  });

  it('replaces only the selected account role assignments', async () => {
    const target = await createAdminAccount(firstCompanyId);
    const other = await createAdminAccount(secondCompanyId);
    const otherRolesBefore = await roleNamesForAccount(other.accountId);

    const response = await asSuperAdmin(
      request(app.getHttpServer()).put(
        `/api/v1/admin-accounts/${target.accountId}/roles`,
      ),
    )
      .send({ roleNames: ['NHAN_VIEN_BAN_VE', 'NHAN_VIEN_CSKH'] })
      .expect(200);

    expect(response.body.data.roles).toEqual(
      expect.arrayContaining(['NHAN_VIEN_BAN_VE', 'NHAN_VIEN_CSKH']),
    );
    expect(await roleNamesForAccount(target.accountId)).toEqual(
      expect.arrayContaining(['NHAN_VIEN_BAN_VE', 'NHAN_VIEN_CSKH']),
    );
    expect(await roleNamesForAccount(target.accountId)).toHaveLength(2);
    expect(await roleNamesForAccount(other.accountId)).toEqual(
      otherRolesBefore,
    );
  });

  it('allows explicit empty roles and keeps the employee-only account manageable', async () => {
    const target = await createAdminAccount();

    const response = await asSuperAdmin(
      request(app.getHttpServer()).put(
        `/api/v1/admin-accounts/${target.accountId}/roles`,
      ),
    )
      .send({ roleNames: [] })
      .expect(200);

    expect(response.body.data.roles).toEqual([]);
    expect(await roleNamesForAccount(target.accountId)).toEqual([]);
    const detail = await asSuperAdmin(
      request(app.getHttpServer()).get(
        `/api/v1/admin-accounts/${target.accountId}`,
      ),
    ).expect(200);
    expect(detail.body.data.roles).toEqual([]);
  });

  it.each([
    ['missing list', {}],
    ['null list', { roleNames: null }],
    ['non-array list', { roleNames: 'NHA_XE_ADMIN' }],
    ['platform role', { roleNames: ['SUPER_ADMIN'] }],
    ['customer role', { roleNames: ['KHACH_HANG'] }],
    ['unknown role', { roleNames: ['NOT_A_ROLE'] }],
    ['duplicate role', { roleNames: ['NHA_XE_ADMIN', 'NHA_XE_ADMIN'] }],
    ['client-selected role IDs', { roleNames: ['NHA_XE_ADMIN'], vaiTroId: 3 }],
  ])('rejects %s without changing assignments', async (_name, body) => {
    const target = await createAdminAccount();
    const rolesBefore = await roleNamesForAccount(target.accountId);

    const response = await asSuperAdmin(
      request(app.getHttpServer()).put(
        `/api/v1/admin-accounts/${target.accountId}/roles`,
      ),
    )
      .send(body)
      .expect(400);

    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(await roleNamesForAccount(target.accountId)).toEqual(rolesBefore);
  });

  it('cannot edit, re-role, or lock protected platform, mixed-scope, or tenantless accounts', async () => {
    const protectedSuperAdminId = await createPlatformAccount();
    const mixedScopeId = await createNonAdminEmployee([
      'NHA_XE_ADMIN',
      'SUPER_ADMIN',
    ]);
    const tenantlessPlatformId = await createPlatformAccount('NHA_XE_ADMIN');
    const protectedRolesBefore = await roleNamesForAccount(
      protectedSuperAdminId,
    );
    const activeSuperAdminCountBefore = await activeSuperAdminCount();
    const mixedRolesBefore = await roleNamesForAccount(mixedScopeId);
    const platformRolesBefore = await roleNamesForAccount(tenantlessPlatformId);
    const superAdminAssignmentsBefore = await prisma.taiKhoanVaiTro.findMany({
      where: { vaiTro: { is: { tenVaiTro: 'SUPER_ADMIN' } } },
      select: { taiKhoanId: true },
      orderBy: { taiKhoanId: 'asc' },
    });

    const protectedStatus = await asSuperAdmin(
      request(app.getHttpServer()).patch(
        `/api/v1/admin-accounts/${protectedSuperAdminId}/status`,
      ),
    )
      .send({ status: 'TAM_KHOA' })
      .expect(404);
    expect(protectedStatus.body.error).toBe('ADMIN_ACCOUNT_NOT_FOUND');

    for (const accountId of [
      protectedSuperAdminId,
      mixedScopeId,
      tenantlessPlatformId,
    ]) {
      const response = await asSuperAdmin(
        request(app.getHttpServer()).put(
          `/api/v1/admin-accounts/${accountId}/roles`,
        ),
      )
        .send({ roleNames: [] })
        .expect(404);
      expect(response.body.error).toBe('ADMIN_ACCOUNT_NOT_FOUND');
    }

    expect(await roleNamesForAccount(protectedSuperAdminId)).toEqual(
      protectedRolesBefore,
    );
    expect(await roleNamesForAccount(mixedScopeId)).toEqual(mixedRolesBefore);
    expect(await roleNamesForAccount(tenantlessPlatformId)).toEqual(
      platformRolesBefore,
    );
    expect(
      await prisma.taiKhoanVaiTro.findMany({
        where: { vaiTro: { is: { tenVaiTro: 'SUPER_ADMIN' } } },
        select: { taiKhoanId: true },
        orderBy: { taiKhoanId: 'asc' },
      }),
    ).toEqual(superAdminAssignmentsBefore);
    expect(await activeSuperAdminCount()).toBe(activeSuperAdminCountBefore);
    expect(
      await prisma.taiKhoan.findUniqueOrThrow({
        where: { taiKhoanId: protectedSuperAdminId },
        select: { trangThai: true },
      }),
    ).toEqual({ trangThai: 'HOAT_DONG' });
  });

  it('creates the account with the legacy default NHA_XE_ADMIN role without returning secrets', async () => {
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

  it('creates an employee account with explicitly selected tenant roles', async () => {
    const created = await createAdminAccount(firstCompanyId, {
      roleNames: ['NHAN_VIEN_BAN_VE', 'NHAN_VIEN_CSKH'],
    });
    const stored = await prisma.taiKhoan.findUniqueOrThrow({
      where: { taiKhoanId: created.accountId },
      include: { taiKhoanVaiTros: { include: { vaiTro: true } } },
    });

    expect(created.roles).toEqual(
      expect.arrayContaining(['NHAN_VIEN_BAN_VE', 'NHAN_VIEN_CSKH']),
    );
    expect(
      stored.taiKhoanVaiTros.map(({ vaiTro }) => vaiTro.tenVaiTro),
    ).toEqual(expect.arrayContaining(['NHAN_VIEN_BAN_VE', 'NHAN_VIEN_CSKH']));
    expect(stored.taiKhoanVaiTros).toHaveLength(2);
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

  it.each([{ roleNames: [] as string[] }, { roleNames: ['SUPER_ADMIN'] }])(
    'rejects invalid roleNames $roleNames before creating an account',
    async ({ roleNames }) => {
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
          roleNames,
        })
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(
        await prisma.taiKhoan.findUnique({
          where: { soDienThoai: identity.phoneNumber },
          select: { taiKhoanId: true },
        }),
      ).toBeNull();
    },
  );

  it('lists tenant employee accounts without admitting platform or customer scope', async () => {
    const first = await createAdminAccount(firstCompanyId);
    const secondCompanyAdmin = await createAdminAccount(secondCompanyId);
    const employeeId = await createNonAdminEmployee(['NHAN_VIEN_BAN_VE']);
    const noRoleEmployeeId = await createNonAdminEmployee([]);
    const mixedSuperAdminId = await createNonAdminEmployee([
      'NHA_XE_ADMIN',
      'SUPER_ADMIN',
    ]);
    const customerEmployeeId = await createNonAdminEmployee(['KHACH_HANG']);

    const response = await asSuperAdmin(
      request(app.getHttpServer())
        .get('/api/v1/admin-accounts')
        .query({ busCompanyId: firstCompanyId, status: 'HOAT_DONG', pageSize: 50 }),
    ).expect(200);
    const listedIds = response.body.data.map(
      (account: { accountId: number }) => account.accountId,
    );

    expect(listedIds).toContain(first.accountId);
    expect(listedIds).toContain(employeeId);
    expect(listedIds).toContain(noRoleEmployeeId);
    expect(listedIds).not.toContain(secondCompanyAdmin.accountId);
    expect(listedIds).not.toContain(mixedSuperAdminId);
    expect(listedIds).not.toContain(customerEmployeeId);
    expect(response.body.meta).toMatchObject({ page: 1, pageSize: 50 });
  });

  it('allows tenant employee and no-role account detail but hides conflicting scopes', async () => {
    const employeeId = await createNonAdminEmployee(['NHAN_VIEN_BAN_VE']);
    const noRoleEmployeeId = await createNonAdminEmployee([]);
    const mixedSuperAdminId = await createNonAdminEmployee([
      'NHA_XE_ADMIN',
      'SUPER_ADMIN',
    ]);
    const customerEmployeeId = await createNonAdminEmployee(['KHACH_HANG']);

    const employee = await asSuperAdmin(
      request(app.getHttpServer()).get(`/api/v1/admin-accounts/${employeeId}`),
    ).expect(200);
    expect(employee.body.data.roles).toEqual(['NHAN_VIEN_BAN_VE']);

    const noRoleEmployee = await asSuperAdmin(
      request(app.getHttpServer()).get(
        `/api/v1/admin-accounts/${noRoleEmployeeId}`,
      ),
    ).expect(200);
    expect(noRoleEmployee.body.data.roles).toEqual([]);

    for (const id of [mixedSuperAdminId, customerEmployeeId]) {
      const response = await asSuperAdmin(
        request(app.getHttpServer()).get(`/api/v1/admin-accounts/${id}`),
      ).expect(404);
      expect(response.body.error).toBe('ADMIN_ACCOUNT_NOT_FOUND');

      await asSuperAdmin(
        request(app.getHttpServer())
          .patch(`/api/v1/admin-accounts/${id}`)
          .send({ fullName: 'Không được cập nhật' }),
      ).expect(404);

      await asSuperAdmin(
        request(app.getHttpServer())
          .patch(`/api/v1/admin-accounts/${id}/status`)
          .send({ status: 'TAM_KHOA' }),
      ).expect(404);
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
