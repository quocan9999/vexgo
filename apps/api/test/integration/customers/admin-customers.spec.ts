import type { ExecutionContext, INestApplication } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../../src/app.module.js';
import { AccessTokenGuard } from '../../../src/auth/guards/access-token.guard.js';
import { ADMIN_ROLE_DEFAULT_PERMISSION_KEYS } from '../../../src/auth/permissions/permission-catalog.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';
import { configureApi } from '../../../src/common/configure-api.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';

const NOW = new Date('2026-10-01T10:00:00.000Z');

const mockCustomer = {
  khachHangId: 101,
  maKhachHang: 'KH000101',
  diemTichLuy: 150,
  taiKhoanId: 201,
  createdAt: NOW,
  updatedAt: NOW,
  taiKhoan: {
    taiKhoanId: 201,
    hoTen: 'Nguyễn Văn A',
    soDienThoai: '+84901234567',
    matKhau: '$2b$10$supersecretpasswordhashthatmustneverleak',
    ngaySinh: new Date('1995-05-15T00:00:00.000Z'),
    cccd: '079195000001',
    email: 'nguyenvana@example.com',
    daXacThucSoDienThoai: true,
    trangThai: 'HOAT_DONG',
    createdAt: NOW,
    updatedAt: NOW,
  },
};

const mockPrisma = {
  khachHang: {
    findMany: vi.fn(),
    count: vi.fn(),
    findFirst: vi.fn(),
  },
};

let testPrincipal: AuthPrincipal | null = {
  taiKhoanId: 1,
  sessionId: 'admin-customer-session',
  roles: ['NHA_XE_ADMIN'],
  permissions: [...ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.NHA_XE_ADMIN],
  nhanVienId: 10,
  nhaXeId: 1,
};

const testAccessTokenGuard = {
  canActivate(context: ExecutionContext) {
    if (!testPrincipal) {
      throw new UnauthorizedException({
        error: 'ACCESS_TOKEN_INVALID',
        message: 'Cần đăng nhập để thực hiện thao tác này.',
      });
    }
    context.switchToHttp().getRequest<{ user?: AuthPrincipal }>().user = testPrincipal;
    return true;
  },
};

describe('Admin Customers API (Feature 06.1)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AccessTokenGuard)
      .useValue(testAccessTokenGuard)
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile();

    app = moduleRef.createNestApplication();
    configureApi(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    testPrincipal = {
      taiKhoanId: 1,
      sessionId: 'admin-customer-session',
      roles: ['NHA_XE_ADMIN'],
      permissions: [...ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.NHA_XE_ADMIN],
      nhanVienId: 10,
      nhaXeId: 1,
    };
  });

  describe('Authentication & Authorization', () => {
    it('rejects unauthenticated requests with 401', async () => {
      testPrincipal = null;

      const response = await request(app.getHttpServer())
        .get('/api/v1/customers')
        .expect(401);

      expect(response.body.error).toBe('ACCESS_TOKEN_INVALID');
    });

    it('rejects platform SUPER_ADMIN without tenant principal role with 403', async () => {
      testPrincipal = {
        taiKhoanId: 99,
        sessionId: 'super-session',
        roles: ['SUPER_ADMIN'],
        permissions: ['customer:read'],
        nhanVienId: null,
        nhaXeId: null,
      };

      const response = await request(app.getHttpServer())
        .get('/api/v1/customers')
        .expect(403);

      expect(response.body.error).toBe('ROLE_FORBIDDEN');
    });

    it('rejects customer role accounts with 403', async () => {
      testPrincipal = {
        taiKhoanId: 50,
        sessionId: 'customer-session',
        roles: ['KHACH_HANG'],
        permissions: [],
        nhanVienId: null,
        nhaXeId: null,
      };

      const response = await request(app.getHttpServer())
        .get('/api/v1/customers')
        .expect(403);

      expect(response.body.error).toBe('ROLE_FORBIDDEN');
    });

    it('rejects tenant admin lacking customer:read permission with 403', async () => {
      testPrincipal = {
        taiKhoanId: 1,
        sessionId: 'no-perm-session',
        roles: ['NHA_XE_ADMIN'],
        permissions: ['vehicle:read'], // missing customer:read
        nhanVienId: 10,
        nhaXeId: 1,
      };

      const response = await request(app.getHttpServer())
        .get('/api/v1/customers')
        .expect(403);

      expect(response.body.error).toBe('PERMISSION_FORBIDDEN');
    });

    it('rejects tenant principal with missing/invalid nhaXeId with 403', async () => {
      testPrincipal = {
        taiKhoanId: 1,
        sessionId: 'no-tenant-session',
        roles: ['NHA_XE_ADMIN'],
        permissions: ['customer:read'],
        nhanVienId: 10,
        nhaXeId: null,
      };

      const response = await request(app.getHttpServer())
        .get('/api/v1/customers')
        .expect(403);

      expect(response.body.error).toBe('TENANT_SCOPE_REQUIRED');
    });
  });

  describe('GET /api/v1/customers (Directory listing)', () => {
    it('returns paginated tenant-scoped customer list', async () => {
      mockPrisma.khachHang.count.mockResolvedValue(1);
      mockPrisma.khachHang.findMany.mockResolvedValue([mockCustomer]);

      const response = await request(app.getHttpServer())
        .get('/api/v1/customers?page=1&pageSize=10')
        .expect(200);

      expect(response.body).toEqual({
        data: [
          {
            customerId: 101,
            customerCode: 'KH000101',
            fullName: 'Nguyễn Văn A',
            phoneNumber: '+84901234567',
            email: 'nguyenvana@example.com',
            loyaltyPoints: 150,
            account: {
              accountId: 201,
              status: 'HOAT_DONG',
              phoneVerified: true,
            },
            createdAt: NOW.toISOString(),
            updatedAt: NOW.toISOString(),
          },
        ],
        meta: {
          page: 1,
          pageSize: 10,
          totalItems: 1,
          totalPages: 1,
        },
      });

      // Verify tenant predicate is strictly enforced: donGiaoDichs.some.nhaXeId = principal.nhaXeId
      expect(mockPrisma.khachHang.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              {
                donGiaoDichs: {
                  some: {
                    nhaXeId: 1,
                  },
                },
              },
            ],
          },
          orderBy: [{ maKhachHang: 'asc' }, { khachHangId: 'asc' }],
          skip: 0,
          take: 10,
        }),
      );

      // Verify count uses the exact same where condition
      expect(mockPrisma.khachHang.count).toHaveBeenCalledWith({
        where: {
          AND: [
            {
              donGiaoDichs: {
                some: {
                  nhaXeId: 1,
                },
              },
            },
          ],
        },
      });

      // Verify no sensitive fields leaked
      const item = response.body.data[0];
      expect(item.matKhau).toBeUndefined();
      expect(item.account.matKhau).toBeUndefined();
      expect(item.refreshTokenHash).toBeUndefined();
      expect(item.sessionId).toBeUndefined();
    });

    it('applies search filters across customer code, full name, phone number, and email', async () => {
      mockPrisma.khachHang.count.mockResolvedValue(0);
      mockPrisma.khachHang.findMany.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/api/v1/customers?search=090123')
        .expect(200);

      expect(mockPrisma.khachHang.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              {
                donGiaoDichs: {
                  some: {
                    nhaXeId: 1,
                  },
                },
              },
              {
                OR: [
                  { maKhachHang: { contains: '090123' } },
                  { taiKhoan: { hoTen: { contains: '090123' } } },
                  { taiKhoan: { soDienThoai: { contains: '090123' } } },
                  { taiKhoan: { email: { contains: '090123' } } },
                ],
              },
            ],
          },
        }),
      );
    });

    it('filters by accountStatus and supports valid sort fields', async () => {
      mockPrisma.khachHang.count.mockResolvedValue(0);
      mockPrisma.khachHang.findMany.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/api/v1/customers?accountStatus=HOAT_DONG&sortBy=loyaltyPoints&sortDirection=desc')
        .expect(200);

      expect(mockPrisma.khachHang.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              {
                donGiaoDichs: {
                  some: {
                    nhaXeId: 1,
                  },
                },
              },
              {
                taiKhoan: {
                  trangThai: 'HOAT_DONG',
                },
              },
            ],
          },
          orderBy: [{ diemTichLuy: 'desc' }, { khachHangId: 'asc' }],
        }),
      );
    });

    it('rejects invalid sortBy field with 400', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/customers?sortBy=invalidField')
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid accountStatus with 400', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/customers?accountStatus=UNAUTHORIZED_STATUS')
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/customers/:id (Detail)', () => {
    it('returns detail of customer belonging to tenant transactions', async () => {
      mockPrisma.khachHang.findFirst.mockResolvedValue(mockCustomer);

      const response = await request(app.getHttpServer())
        .get('/api/v1/customers/101')
        .expect(200);

      expect(response.body).toEqual({
        data: {
          customerId: 101,
          customerCode: 'KH000101',
          fullName: 'Nguyễn Văn A',
          phoneNumber: '+84901234567',
          email: 'nguyenvana@example.com',
          loyaltyPoints: 150,
          account: {
            accountId: 201,
            status: 'HOAT_DONG',
            phoneVerified: true,
            createdAt: NOW.toISOString(),
            updatedAt: NOW.toISOString(),
          },
          createdAt: NOW.toISOString(),
          updatedAt: NOW.toISOString(),
        },
      });

      expect(mockPrisma.khachHang.findFirst).toHaveBeenCalledWith({
        where: {
          khachHangId: 101,
          donGiaoDichs: {
            some: {
              nhaXeId: 1,
            },
          },
        },
        include: {
          taiKhoan: true,
        },
      });

      // No sensitive fields leaked
      expect(response.body.data.matKhau).toBeUndefined();
      expect(response.body.data.account.matKhau).toBeUndefined();
    });

    it('returns 404 CUSTOMER_NOT_FOUND when customer does not exist or has no transactions with current tenant', async () => {
      mockPrisma.khachHang.findFirst.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .get('/api/v1/customers/999')
        .expect(404);

      expect(response.body).toEqual({
        statusCode: 404,
        error: 'CUSTOMER_NOT_FOUND',
        message: 'Không tìm thấy khách hàng.',
      });
    });

    it('rejects invalid or non-positive ID with 400', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/customers/abc')
        .expect(400);

      const responseZero = await request(app.getHttpServer())
        .get('/api/v1/customers/0')
        .expect(400);

      expect(responseZero.body.error).toBe('INVALID_CUSTOMER_ID');
    });
  });
});
