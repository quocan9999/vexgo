import { type INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { ConfigModule } from '@nestjs/config';
import { configureApi } from '../../../src/common/configure-api.js';
import { AuthModule } from '../../../src/auth/auth.module.js';
import { ContactsModule } from '../../../src/contacts/contacts.module.js';
import { ContactsService } from '../../../src/contacts/contacts.service.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';

describe('Contacts authentication and authorization HTTP pipeline', () => {
  let app: INestApplication;
  const jwtVerify = vi.fn();
  const sessionFindUnique = vi.fn();
  const rolePermissionFindMany = vi.fn().mockResolvedValue([]);
  const tenantRolePermissionFindMany = vi.fn().mockResolvedValue([]);

  const contactsService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    updateStatus: vi.fn(),
  };

  const roleIds: Record<string, number> = {
    SUPER_ADMIN: 1,
    NHA_XE_ADMIN: 2,
    KHACH_HANG: 7,
  };

  function sessionWithRoles(
    roles: string[],
    withEmployee = roles.includes('NHA_XE_ADMIN'),
  ) {
    return {
      sessionId: 'integration-session',
      taiKhoanId: 42,
      thuHoiLuc: null,
      hetHanLuc: new Date(Date.now() + 60_000),
      taiKhoan: {
        taiKhoanId: 42,
        trangThai: 'HOAT_DONG',
        nhanVien: withEmployee ? { nhanVienId: 77, nhaXeId: 901 } : null,
        taiKhoanVaiTros: [
          ...roles.map((tenVaiTro) => ({
            vaiTro: {
              vaiTroId: roleIds[tenVaiTro] || 99,
              tenVaiTro,
            },
          })),
        ],
      },
    };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              SMS_PROVIDER: 'console',
              OTP_HASH_SECRET: 'test-only-otp-secret-for-vexgo-unit-tests-2026',
              JWT_ACCESS_SECRET:
                'test-only-jwt-secret-for-vexgo-unit-tests-2026',
            }),
          ],
        }),
        AuthModule,
        ContactsModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({
        phienDangNhap: { findUnique: sessionFindUnique },
        vaiTroQuyen: { findMany: rolePermissionFindMany },
        cauHinhQuyenVaiTroNhaXe: {
          findMany: tenantRolePermissionFindMany,
        },
      })
      .overrideProvider(JwtService)
      .useValue({ verifyAsync: jwtVerify })
      .overrideProvider(ContactsService)
      .useValue(contactsService)
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
    jwtVerify.mockResolvedValue({
      sub: 42,
      sid: 'integration-session',
      roles: ['SUPER_ADMIN'],
    });
    sessionFindUnique.mockResolvedValue(sessionWithRoles(['SUPER_ADMIN']));

    contactsService.create.mockResolvedValue({
      data: {
        contactId: 1,
        fullName: 'Nguyễn Văn A',
        phoneNumber: '0912345678',
        email: 'a@example.com',
        subject: 'Hỗ trợ hủy vé',
        message: 'Cần hỗ trợ',
        status: 'CHO_XU_LY',
        createdAt: '2026-10-02T08:00:00.000Z',
        updatedAt: '2026-10-02T08:00:00.000Z',
      },
    });

    contactsService.findAll.mockResolvedValue({
      data: [
        {
          contactId: 1,
          fullName: 'Nguyễn Văn A',
          phoneNumber: '0912345678',
          email: 'a@example.com',
          subject: 'Hỗ trợ',
          message: 'Tin nhắn',
          status: 'CHO_XU_LY',
          createdAt: '2026-10-02T08:00:00.000Z',
          updatedAt: '2026-10-02T08:00:00.000Z',
        },
      ],
      meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    });

    contactsService.findOne.mockResolvedValue({
      data: {
        contactId: 1,
        fullName: 'Nguyễn Văn A',
        phoneNumber: '0912345678',
        email: 'a@example.com',
        subject: 'Hỗ trợ',
        message: 'Tin nhắn',
        status: 'CHO_XU_LY',
        createdAt: '2026-10-02T08:00:00.000Z',
        updatedAt: '2026-10-02T08:00:00.000Z',
      },
    });

    contactsService.updateStatus.mockResolvedValue({
      data: {
        contactId: 1,
        fullName: 'Nguyễn Văn A',
        phoneNumber: '0912345678',
        email: 'a@example.com',
        subject: 'Hỗ trợ',
        message: 'Tin nhắn',
        status: 'DA_XU_LY',
        createdAt: '2026-10-02T08:00:00.000Z',
        updatedAt: '2026-10-02T08:00:00.000Z',
      },
    });
  });

  describe('Anonymous requests', () => {
    it('allows anonymous POST /api/v1/contacts (public contact submission)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/contacts')
        .send({
          fullName: 'Nguyễn Văn A',
          phoneNumber: '0912345678',
          email: 'a@example.com',
          subject: 'Hỗ trợ hủy vé',
          message: 'Cần hỗ trợ',
        })
        .expect(201);

      expect(response.body).toEqual({
        data: expect.objectContaining({
          contactId: 1,
          fullName: 'Nguyễn Văn A',
        }),
      });
      expect(contactsService.create).toHaveBeenCalled();
      expect(jwtVerify).not.toHaveBeenCalled();
    });

    it('rejects anonymous GET /api/v1/contacts with 401', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/contacts')
        .expect(401);

      expect(response.body.error).toBe('ACCESS_TOKEN_INVALID');
      expect(contactsService.findAll).not.toHaveBeenCalled();
    });

    it('rejects anonymous GET /api/v1/contacts/:id with 401', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/contacts/1')
        .expect(401);

      expect(response.body.error).toBe('ACCESS_TOKEN_INVALID');
      expect(contactsService.findOne).not.toHaveBeenCalled();
    });

    it('rejects anonymous PATCH /api/v1/contacts/:id/status with 401', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/v1/contacts/1/status')
        .send({ status: 'DA_XU_LY' })
        .expect(401);

      expect(response.body.error).toBe('ACCESS_TOKEN_INVALID');
      expect(contactsService.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('Customer role requests (KHACH_HANG)', () => {
    beforeEach(() => {
      jwtVerify.mockResolvedValue({
        sub: 42,
        sid: 'integration-session',
        roles: ['KHACH_HANG'],
      });
      sessionFindUnique.mockResolvedValue(
        sessionWithRoles(['KHACH_HANG'], false),
      );
    });

    it('rejects customer GET /api/v1/contacts with 403', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/contacts')
        .set('Authorization', 'Bearer customer-token')
        .expect(403);

      expect(response.body.error).toBe('ROLE_FORBIDDEN');
      expect(contactsService.findAll).not.toHaveBeenCalled();
    });

    it('rejects customer GET /api/v1/contacts/:id with 403', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/contacts/1')
        .set('Authorization', 'Bearer customer-token')
        .expect(403);

      expect(response.body.error).toBe('ROLE_FORBIDDEN');
      expect(contactsService.findOne).not.toHaveBeenCalled();
    });

    it('rejects customer PATCH /api/v1/contacts/:id/status with 403', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/v1/contacts/1/status')
        .set('Authorization', 'Bearer customer-token')
        .send({ status: 'DA_XU_LY' })
        .expect(403);

      expect(response.body.error).toBe('ROLE_FORBIDDEN');
      expect(contactsService.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('Tenant Admin role requests (NHA_XE_ADMIN)', () => {
    beforeEach(() => {
      jwtVerify.mockResolvedValue({
        sub: 42,
        sid: 'integration-session',
        roles: ['NHA_XE_ADMIN'],
      });
      sessionFindUnique.mockResolvedValue(
        sessionWithRoles(['NHA_XE_ADMIN'], true),
      );
    });

    it('rejects tenant admin GET /api/v1/contacts with 403', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/contacts')
        .set('Authorization', 'Bearer tenant-token')
        .expect(403);

      expect(response.body.error).toBe('ROLE_FORBIDDEN');
      expect(contactsService.findAll).not.toHaveBeenCalled();
    });

    it('rejects tenant admin GET /api/v1/contacts/:id with 403', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/contacts/1')
        .set('Authorization', 'Bearer tenant-token')
        .expect(403);

      expect(response.body.error).toBe('ROLE_FORBIDDEN');
      expect(contactsService.findOne).not.toHaveBeenCalled();
    });

    it('rejects tenant admin PATCH /api/v1/contacts/:id/status with 403', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/v1/contacts/1/status')
        .set('Authorization', 'Bearer tenant-token')
        .send({ status: 'DA_XU_LY' })
        .expect(403);

      expect(response.body.error).toBe('ROLE_FORBIDDEN');
      expect(contactsService.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('Super Admin role requests (SUPER_ADMIN)', () => {
    beforeEach(() => {
      jwtVerify.mockResolvedValue({
        sub: 42,
        sid: 'integration-session',
        roles: ['SUPER_ADMIN'],
      });
      sessionFindUnique.mockResolvedValue(
        sessionWithRoles(['SUPER_ADMIN'], false),
      );
    });

    it('allows super admin GET /api/v1/contacts and returns pagination envelope', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/contacts')
        .set('Authorization', 'Bearer super-admin-token')
        .expect(200);

      expect(response.body).toEqual({
        data: [
          expect.objectContaining({
            contactId: 1,
            fullName: 'Nguyễn Văn A',
          }),
        ],
        meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
      });
      expect(contactsService.findAll).toHaveBeenCalled();
    });

    it('allows super admin GET /api/v1/contacts/:id and returns single data envelope', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/contacts/1')
        .set('Authorization', 'Bearer super-admin-token')
        .expect(200);

      expect(response.body).toEqual({
        data: expect.objectContaining({
          contactId: 1,
          fullName: 'Nguyễn Văn A',
        }),
      });
      expect(contactsService.findOne).toHaveBeenCalledWith(1);
    });

    it('allows super admin PATCH /api/v1/contacts/:id/status and returns updated data envelope', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/v1/contacts/1/status')
        .set('Authorization', 'Bearer super-admin-token')
        .send({ status: 'DA_XU_LY' })
        .expect(200);

      expect(response.body).toEqual({
        data: expect.objectContaining({
          contactId: 1,
          status: 'DA_XU_LY',
        }),
      });
      expect(contactsService.updateStatus).toHaveBeenCalledWith(1, 'DA_XU_LY');
    });
  });
});
