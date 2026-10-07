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
import { Prisma } from '../../../src/generated/prisma/client.js';
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
  donGiaoDich: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  ve: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  phieuGuiHang: {
    findMany: vi.fn(),
    count: vi.fn(),
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

    it('returns empty list with totalPages: 0 and totalItems: 0 when no customers exist', async () => {
      mockPrisma.khachHang.count.mockResolvedValue(0);
      mockPrisma.khachHang.findMany.mockResolvedValue([]);

      const response = await request(app.getHttpServer())
        .get('/api/v1/customers?page=1&pageSize=10')
        .expect(200);

      expect(response.body).toEqual({
        data: [],
        meta: {
          page: 1,
          pageSize: 10,
          totalItems: 0,
          totalPages: 0,
        },
      });
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

  describe('GET /api/v1/customers/:id/transactions', () => {
    const mockTransaction = {
      donGiaoDichId: 501,
      maDonGiaoDich: 'GD000501',
      ngayTao: NOW,
      tongTien: new Prisma.Decimal(320000),
      trangThai: 'THANH_CONG',
      tenKhachHang: 'Nguyễn Văn A',
      soDienThoaiKhachHang: '+84901234567',
      emailKhachHang: 'nguyenvana@example.com',
      khachHangId: 101,
      nhaXeId: 1,
      createdAt: NOW,
      updatedAt: NOW,
      phieuDatVe: {
        phieuDatVeId: 80,
        maPhieuDatVe: 'PDV000080',
        trangThai: 'DA_XAC_NHAN',
      },
      phieuGuiHang: null,
    };

    it('returns paginated transactions for tenant-visible customer with discriminator relation', async () => {
      mockPrisma.khachHang.findFirst.mockResolvedValue({ khachHangId: 101 });
      mockPrisma.donGiaoDich.count.mockResolvedValue(1);
      mockPrisma.donGiaoDich.findMany.mockResolvedValue([mockTransaction]);

      const response = await request(app.getHttpServer())
        .get('/api/v1/customers/101/transactions?page=1&pageSize=10')
        .expect(200);

      expect(response.body).toEqual({
        data: [
          {
            transactionId: 501,
            code: 'GD000501',
            createdDate: NOW.toISOString(),
            totalAmount: 320000,
            status: 'THANH_CONG',
            customerSnapshot: {
              fullName: 'Nguyễn Văn A',
              phoneNumber: '+84901234567',
              email: 'nguyenvana@example.com',
            },
            booking: {
              bookingId: 80,
              code: 'PDV000080',
              status: 'DA_XAC_NHAN',
            },
            shipment: null,
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

      expect(mockPrisma.donGiaoDich.findMany).toHaveBeenCalledWith({
        where: {
          khachHangId: 101,
          nhaXeId: 1,
        },
        orderBy: [
          { ngayTao: 'desc' },
          { donGiaoDichId: 'desc' },
        ],
        skip: 0,
        take: 10,
        include: {
          phieuDatVe: {
            select: {
              phieuDatVeId: true,
              maPhieuDatVe: true,
              trangThai: true,
            },
          },
          phieuGuiHang: {
            select: {
              phieuGuiHangId: true,
              maVanDon: true,
              trangThai: true,
            },
          },
        },
      });
    });

    it('returns empty list with totalPages: 0 and totalItems: 0 when customer has no transactions', async () => {
      mockPrisma.khachHang.findFirst.mockResolvedValue({ khachHangId: 101 });
      mockPrisma.donGiaoDich.count.mockResolvedValue(0);
      mockPrisma.donGiaoDich.findMany.mockResolvedValue([]);

      const response = await request(app.getHttpServer())
        .get('/api/v1/customers/101/transactions?page=1&pageSize=10')
        .expect(200);

      expect(response.body).toEqual({
        data: [],
        meta: {
          page: 1,
          pageSize: 10,
          totalItems: 0,
          totalPages: 0,
        },
      });
    });

    it('supports search by transaction code and custom sorting', async () => {
      mockPrisma.khachHang.findFirst.mockResolvedValue({ khachHangId: 101 });
      mockPrisma.donGiaoDich.count.mockResolvedValue(0);
      mockPrisma.donGiaoDich.findMany.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/api/v1/customers/101/transactions?search=GD000501&sortBy=totalAmount&sortDirection=asc')
        .expect(200);

      expect(mockPrisma.donGiaoDich.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            khachHangId: 101,
            nhaXeId: 1,
            maDonGiaoDich: { contains: 'GD000501' },
          },
          orderBy: [
            { tongTien: 'asc' },
            { donGiaoDichId: 'asc' },
          ],
        }),
      );
    });

    it('returns 404 CUSTOMER_NOT_FOUND if customer does not exist or has no transactions with current tenant', async () => {
      mockPrisma.khachHang.findFirst.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .get('/api/v1/customers/999/transactions')
        .expect(404);

      expect(response.body).toEqual({
        statusCode: 404,
        error: 'CUSTOMER_NOT_FOUND',
        message: 'Không tìm thấy khách hàng.',
      });

      expect(mockPrisma.donGiaoDich.findMany).not.toHaveBeenCalled();
    });

    it('rejects invalid or non-positive ID with 400', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/customers/invalid/transactions')
        .expect(400);

      const responseZero = await request(app.getHttpServer())
        .get('/api/v1/customers/0/transactions')
        .expect(400);

      expect(responseZero.body.error).toBe('INVALID_CUSTOMER_ID');
    });

    it('rejects unauthenticated request with 401', async () => {
      testPrincipal = null;

      await request(app.getHttpServer())
        .get('/api/v1/customers/101/transactions')
        .expect(401);
    });

    it('rejects unauthorized request without customer:read with 403', async () => {
      testPrincipal = {
        taiKhoanId: 2,
        sessionId: 'session-no-perm',
        roles: ['NHA_XE_ADMIN'],
        permissions: ['route:read'],
        nhanVienId: 10,
        nhaXeId: 1,
      };

      await request(app.getHttpServer())
        .get('/api/v1/customers/101/transactions')
        .expect(403);
    });
  });

  describe('GET /api/v1/customers/:id/tickets (Feature 06.3)', () => {
    const mockTicket = {
      veId: 901,
      maVe: 'VE000901',
      diemDon: 'Bến xe Miền Đông',
      giaNiemYet: new Prisma.Decimal('320000'),
      giaThucTe: new Prisma.Decimal('290000'),
      trangThai: 'DA_XUAT',
      phieuDatVeId: 80,
      gheChuyenXeId: 701,
      bangGiaApDungId: 601,
      createdAt: NOW,
      updatedAt: NOW,
      phieuDatVe: {
        phieuDatVeId: 80,
        maPhieuDatVe: 'PDV000080',
        ngayDat: NOW,
        trangThai: 'HOAN_TAT',
      },
      gheChuyenXe: {
        gheChuyenXeId: 701,
        trangThai: 'DA_DAT',
        chuyenXeId: 101,
        gheId: 501,
        ghe: {
          gheId: 501,
          soGhe: 'A01',
          viTri: 'Tầng dưới',
        },
        chuyenXe: {
          chuyenXeId: 101,
          maChuyenXe: 'FUTA-CX-0001',
          ngayKhoiHanh: new Date('2026-09-25T00:00:00.000Z'),
          gioKhoiHanh: new Date('1970-01-01T07:00:00.000Z'),
          trangThai: 'SAP_KHOI_HANH',
          tuyenXe: {
            tuyenXeId: 12,
            maTuyenXe: 'FUTA-TX-0001',
            diemDi: 'TP.HCM',
            diemDen: 'Đà Lạt',
          },
          xe: {
            xeId: 8,
            bienSoXe: '30F-123.45',
          },
        },
      },
    };

    it('returns paginated tickets belonging to current tenant and customer', async () => {
      mockPrisma.khachHang.findFirst.mockResolvedValue({ khachHangId: 101 });
      mockPrisma.ve.count.mockResolvedValue(1);
      mockPrisma.ve.findMany.mockResolvedValue([mockTicket]);

      const response = await request(app.getHttpServer())
        .get('/api/v1/customers/101/tickets?page=1&pageSize=10')
        .expect(200);

      expect(response.body).toEqual({
        data: [
          {
            ticketId: 901,
            ticketCode: 'VE000901',
            status: 'DA_XUAT',
            pickupPoint: 'Bến xe Miền Đông',
            listedPrice: 320000,
            actualPrice: 290000,
            booking: {
              bookingId: 80,
              code: 'PDV000080',
              bookedAt: NOW.toISOString(),
              status: 'HOAN_TAT',
            },
            trip: {
              tripId: 101,
              code: 'FUTA-CX-0001',
              departureDate: '2026-09-25',
              departureTime: '07:00:00',
              status: 'SAP_KHOI_HANH',
              route: {
                routeId: 12,
                code: 'FUTA-TX-0001',
                origin: 'TP.HCM',
                destination: 'Đà Lạt',
              },
              vehicle: {
                vehicleId: 8,
                licensePlate: '30F-123.45',
              },
            },
            seat: {
              seatId: 501,
              code: 'A01',
              position: 'Tầng dưới',
            },
          },
        ],
        meta: {
          page: 1,
          pageSize: 10,
          totalItems: 1,
          totalPages: 1,
        },
      });

      expect(mockPrisma.ve.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              {
                phieuDatVe: {
                  donGiaoDich: {
                    khachHangId: 101,
                    nhaXeId: 1,
                  },
                },
              },
            ],
          },
        }),
      );
    });

    it('returns empty list with totalPages: 0 and totalItems: 0 when customer has no tickets', async () => {
      mockPrisma.khachHang.findFirst.mockResolvedValue({ khachHangId: 101 });
      mockPrisma.ve.count.mockResolvedValue(0);
      mockPrisma.ve.findMany.mockResolvedValue([]);

      const response = await request(app.getHttpServer())
        .get('/api/v1/customers/101/tickets?page=1&pageSize=10')
        .expect(200);

      expect(response.body).toEqual({
        data: [],
        meta: {
          page: 1,
          pageSize: 10,
          totalItems: 0,
          totalPages: 0,
        },
      });
    });

    it('supports search across ticket code, booking code, and trip code', async () => {
      mockPrisma.khachHang.findFirst.mockResolvedValue({ khachHangId: 101 });
      mockPrisma.ve.count.mockResolvedValue(0);
      mockPrisma.ve.findMany.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/api/v1/customers/101/tickets?search=CX-0001')
        .expect(200);

      expect(mockPrisma.ve.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              {
                phieuDatVe: {
                  donGiaoDich: {
                    khachHangId: 101,
                    nhaXeId: 1,
                  },
                },
              },
              {
                OR: [
                  { maVe: { contains: 'CX-0001' } },
                  { phieuDatVe: { maPhieuDatVe: { contains: 'CX-0001' } } },
                  {
                    gheChuyenXe: {
                      chuyenXe: {
                        maChuyenXe: { contains: 'CX-0001' },
                      },
                    },
                  },
                ],
              },
            ],
          },
        }),
      );
    });

    it('returns 404 CUSTOMER_NOT_FOUND if customer is not visible to tenant', async () => {
      mockPrisma.khachHang.findFirst.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .get('/api/v1/customers/999/tickets')
        .expect(404);

      expect(response.body).toEqual({
        statusCode: 404,
        error: 'CUSTOMER_NOT_FOUND',
        message: 'Không tìm thấy khách hàng.',
      });

      expect(mockPrisma.ve.findMany).not.toHaveBeenCalled();
    });

    it('rejects invalid or non-positive ID with 400', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/customers/invalid/tickets')
        .expect(400);

      const responseZero = await request(app.getHttpServer())
        .get('/api/v1/customers/0/tickets')
        .expect(400);

      expect(responseZero.body.error).toBe('INVALID_CUSTOMER_ID');
    });

    it('rejects unauthenticated request with 401', async () => {
      testPrincipal = null;

      await request(app.getHttpServer())
        .get('/api/v1/customers/101/tickets')
        .expect(401);
    });

    it('rejects unauthorized request without customer:read with 403', async () => {
      testPrincipal = {
        taiKhoanId: 2,
        sessionId: 'session-no-perm',
        roles: ['NHA_XE_ADMIN'],
        permissions: ['route:read'],
        nhanVienId: 10,
        nhaXeId: 1,
      };

      await request(app.getHttpServer())
        .get('/api/v1/customers/101/tickets')
        .expect(403);
    });

    it('enforces tenant isolation: tenant A cannot query tickets belonging to tenant B', async () => {
      mockPrisma.khachHang.findFirst.mockResolvedValue({ khachHangId: 101 });
      mockPrisma.ve.count.mockResolvedValue(0);
      mockPrisma.ve.findMany.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/api/v1/customers/101/tickets')
        .expect(200);

      expect(mockPrisma.ve.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              {
                phieuDatVe: {
                  donGiaoDich: {
                    khachHangId: 101,
                    nhaXeId: 1, // Strictly tenant 1, never any other tenant
                  },
                },
              },
            ],
          },
        }),
      );
    });
  });

  describe('GET /api/v1/customers/:id/shipments (Feature 06.4)', () => {
    const mockShipment = {
      phieuGuiHangId: 301,
      maVanDon: 'VD000301',
      tenNguoiNhan: 'Trần Văn B',
      soDienThoaiNguoiNhan: '0912345678',
      ngayGui: NOW,
      cuocChinh: new Prisma.Decimal('80000'),
      phiDichVu: new Prisma.Decimal('10000'),
      soTienGiam: new Prisma.Decimal('5000'),
      tongPhi: new Prisma.Decimal('85000'),
      nguoiTraCuoc: 'NGUOI_GUI',
      ghiChu: 'Hàng dễ vỡ',
      trangThai: 'DANG_VAN_CHUYEN',
      chuyenXeId: 101,
      diemGuiId: 1,
      diemNhanId: 2,
      khuyenMaiId: null,
      donGiaoDichId: 502,
      createdAt: NOW,
      updatedAt: NOW,
      chuyenXe: {
        chuyenXeId: 101,
        maChuyenXe: 'FUTA-CX-0001',
      },
      diemGui: {
        diemGiaoNhanHangId: 1,
        maDiem: 'FUTA-BC-001',
        tenDiem: 'Điểm gửi Miền Đông',
        diaChi: '456 Mai Chí Thọ, TP.HCM',
      },
      diemNhan: {
        diemGiaoNhanHangId: 2,
        maDiem: 'FUTA-BC-002',
        tenDiem: 'Điểm nhận Đà Lạt',
        diaChi: '123 Lê Lợi, Đà Lạt',
      },
    };

    it('returns paginated shipments for tenant-visible customer with mapped relations', async () => {
      mockPrisma.khachHang.findFirst.mockResolvedValue({ khachHangId: 101 });
      mockPrisma.phieuGuiHang.count.mockResolvedValue(1);
      mockPrisma.phieuGuiHang.findMany.mockResolvedValue([mockShipment]);

      const response = await request(app.getHttpServer())
        .get('/api/v1/customers/101/shipments?page=1&pageSize=10')
        .expect(200);

      expect(response.body).toEqual({
        data: [
          {
            shipmentId: 301,
            waybillCode: 'VD000301',
            sentAt: NOW.toISOString(),
            status: 'DANG_VAN_CHUYEN',
            receiver: {
              fullName: 'Trần Văn B',
              phoneNumber: '0912345678',
            },
            mainFee: 80000,
            serviceFee: 10000,
            discountAmount: 5000,
            totalFee: 85000,
            freightPayer: 'NGUOI_GUI',
            trip: {
              tripId: 101,
              code: 'FUTA-CX-0001',
            },
            originPoint: {
              pointId: 1,
              code: 'FUTA-BC-001',
              name: 'Điểm gửi Miền Đông',
              address: '456 Mai Chí Thọ, TP.HCM',
            },
            destinationPoint: {
              pointId: 2,
              code: 'FUTA-BC-002',
              name: 'Điểm nhận Đà Lạt',
              address: '123 Lê Lợi, Đà Lạt',
            },
          },
        ],
        meta: {
          page: 1,
          pageSize: 10,
          totalItems: 1,
          totalPages: 1,
        },
      });

      const shipment = response.body.data[0];
      expect(shipment).not.toHaveProperty('pickupMethod');
      expect(shipment).not.toHaveProperty('deliveryMethod');
      expect(shipment).not.toHaveProperty('pickupAddress');
      expect(shipment.receiver).not.toHaveProperty('address');
      expect(shipment).not.toHaveProperty('originBranch');
      expect(shipment).not.toHaveProperty('destinationBranch');

      expect(mockPrisma.phieuGuiHang.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              {
                donGiaoDich: {
                  khachHangId: 101,
                  nhaXeId: 1,
                },
              },
            ],
          },
          include: {
            chuyenXe: {
              select: {
                chuyenXeId: true,
                maChuyenXe: true,
              },
            },
            diemGui: {
              select: {
                diemGiaoNhanHangId: true,
                maDiem: true,
                tenDiem: true,
                diaChi: true,
              },
            },
            diemNhan: {
              select: {
                diemGiaoNhanHangId: true,
                maDiem: true,
                tenDiem: true,
                diaChi: true,
              },
            },
          },
        }),
      );
    });

    it('returns empty list with totalPages: 0 and totalItems: 0 when customer has no shipments', async () => {
      mockPrisma.khachHang.findFirst.mockResolvedValue({ khachHangId: 101 });
      mockPrisma.phieuGuiHang.count.mockResolvedValue(0);
      mockPrisma.phieuGuiHang.findMany.mockResolvedValue([]);

      const response = await request(app.getHttpServer())
        .get('/api/v1/customers/101/shipments?page=1&pageSize=10')
        .expect(200);

      expect(response.body).toEqual({
        data: [],
        meta: {
          page: 1,
          pageSize: 10,
          totalItems: 0,
          totalPages: 0,
        },
      });
    });

    it('supports search by waybill code, receiver name, and phone number', async () => {
      mockPrisma.khachHang.findFirst.mockResolvedValue({ khachHangId: 101 });
      mockPrisma.phieuGuiHang.count.mockResolvedValue(0);
      mockPrisma.phieuGuiHang.findMany.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/api/v1/customers/101/shipments?search=Trần')
        .expect(200);

      expect(mockPrisma.phieuGuiHang.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              {
                donGiaoDich: {
                  khachHangId: 101,
                  nhaXeId: 1,
                },
              },
              {
                OR: [
                  { maVanDon: { contains: 'Trần' } },
                  { tenNguoiNhan: { contains: 'Trần' } },
                  { soDienThoaiNguoiNhan: { contains: 'Trần' } },
                ],
              },
            ],
          },
        }),
      );
    });

    it('returns 404 CUSTOMER_NOT_FOUND if customer is not visible to tenant', async () => {
      mockPrisma.khachHang.findFirst.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .get('/api/v1/customers/999/shipments')
        .expect(404);

      expect(response.body).toEqual({
        statusCode: 404,
        error: 'CUSTOMER_NOT_FOUND',
        message: 'Không tìm thấy khách hàng.',
      });

      expect(mockPrisma.phieuGuiHang.findMany).not.toHaveBeenCalled();
    });

    it('rejects invalid or non-positive ID with 400', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/customers/invalid/shipments')
        .expect(400);

      const responseZero = await request(app.getHttpServer())
        .get('/api/v1/customers/0/shipments')
        .expect(400);

      expect(responseZero.body.error).toBe('INVALID_CUSTOMER_ID');
    });

    it('rejects unauthenticated request with 401', async () => {
      testPrincipal = null;

      await request(app.getHttpServer())
        .get('/api/v1/customers/101/shipments')
        .expect(401);
    });

    it('rejects unauthorized request without customer:read with 403', async () => {
      testPrincipal = {
        taiKhoanId: 2,
        sessionId: 'session-no-perm',
        roles: ['NHA_XE_ADMIN'],
        permissions: ['route:read'],
        nhanVienId: 10,
        nhaXeId: 1,
      };

      await request(app.getHttpServer())
        .get('/api/v1/customers/101/shipments')
        .expect(403);
    });

    it('enforces tenant isolation: tenant A cannot query shipments belonging to tenant B', async () => {
      mockPrisma.khachHang.findFirst.mockResolvedValue({ khachHangId: 101 });
      mockPrisma.phieuGuiHang.count.mockResolvedValue(0);
      mockPrisma.phieuGuiHang.findMany.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/api/v1/customers/101/shipments')
        .expect(200);

      expect(mockPrisma.phieuGuiHang.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              {
                donGiaoDich: {
                  khachHangId: 101,
                  nhaXeId: 1, // Strictly tenant 1, never tenant B
                },
              },
            ],
          },
        }),
      );
    });
  });
});
