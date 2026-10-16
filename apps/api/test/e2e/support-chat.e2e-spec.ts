import { createHash, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../src/app.module.js';
import { configureApi } from '../../src/common/configure-api.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

describe('Support Chat HTTP E2E Full Pipeline Tests (F-NEW-07)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let configService: ConfigService;
  let accessSecret: string;

  const testSuffix = randomUUID().replaceAll('-', '').slice(0, 8);

  // Entities
  let busCompanyAId: number;
  let busCompanyBId: number;

  let customerAccountId: number;
  let customerToken: string;

  let staffBAccountId: number;
  let staffBToken: string;

  let createdConversationId: number | null = null;
  const createdSessionIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApi(app);
    await app.init();

    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
    configService = app.get(ConfigService);
    accessSecret = configService.get<string>('JWT_ACCESS_SECRET') || 'test-jwt-secret';

    // 1. Tạo 2 nhà xe A và B
    const companyA = await prisma.nhaXe.create({
      data: {
        maNhaXe: `NX-E2E-A-${testSuffix}`,
        tenNhaXe: `Nhà Xe E2E A ${testSuffix}`,
        trangThai: 'HOAT_DONG',
      },
    });
    busCompanyAId = companyA.nhaXeId;

    const companyB = await prisma.nhaXe.create({
      data: {
        maNhaXe: `NX-E2E-B-${testSuffix}`,
        tenNhaXe: `Nhà Xe E2E B ${testSuffix}`,
        trangThai: 'HOAT_DONG',
      },
    });
    busCompanyBId = companyB.nhaXeId;

    // 2. Đảm bảo vai trò KHACH_HANG và NHAN_VIEN_CSKH tồn tại
    const customerRole = await prisma.vaiTro.upsert({
      where: { tenVaiTro: 'KHACH_HANG' },
      update: {},
      create: { tenVaiTro: 'KHACH_HANG', moTa: 'Khách hàng' },
    });

    const staffRole = await prisma.vaiTro.upsert({
      where: { tenVaiTro: 'NHAN_VIEN_CSKH' },
      update: {},
      create: { tenVaiTro: 'NHAN_VIEN_CSKH', moTa: 'Nhân viên CSKH' },
    });

    // 3. Tạo tài khoản Khách hàng
    const custAccount = await prisma.taiKhoan.create({
      data: {
        soDienThoai: `+8491${Date.now().toString().slice(-7)}`,
        matKhau: '$2b$10$hashedpasswordfore2etests1234567890',
        hoTen: `Khách Hàng E2E ${testSuffix}`,
        daXacThucSoDienThoai: true,
        trangThai: 'HOAT_DONG',
        taiKhoanVaiTros: {
          create: { vaiTroId: customerRole.vaiTroId },
        },
        khachHang: {
          create: {
            maKhachHang: `KH-E2E-${testSuffix}`,
          },
        },
      },
    });
    customerAccountId = custAccount.taiKhoanId;

    const custSessionId = randomUUID();
    createdSessionIds.push(custSessionId);
    await prisma.phienDangNhap.create({
      data: {
        sessionId: custSessionId,
        taiKhoanId: customerAccountId,
        refreshTokenHash: createHash('sha256').update(randomUUID()).digest('hex'),
        hetHanLuc: new Date(Date.now() + 3600000),
      },
    });
    customerToken = jwtService.sign(
      { sub: customerAccountId, sid: custSessionId, roles: ['KHACH_HANG'] },
      { secret: accessSecret, expiresIn: '1h' },
    );

    // 4. Tạo tài khoản Nhân viên CSKH Nhà Xe B
    const staffBAccount = await prisma.taiKhoan.create({
      data: {
        soDienThoai: `+8492${Date.now().toString().slice(-7)}`,
        matKhau: '$2b$10$hashedpasswordfore2etests1234567890',
        hoTen: `Nhân Viên B E2E ${testSuffix}`,
        daXacThucSoDienThoai: true,
        trangThai: 'HOAT_DONG',
        taiKhoanVaiTros: {
          create: { vaiTroId: staffRole.vaiTroId },
        },
        nhanVien: {
          create: {
            maNhanVien: `NV-B-${testSuffix}`,
            nhaXeId: busCompanyBId,
            trangThaiLamViec: 'DANG_LAM_VIEC',
          },
        },
      },
    });
    staffBAccountId = staffBAccount.taiKhoanId;

    const staffBSessionId = randomUUID();
    createdSessionIds.push(staffBSessionId);
    await prisma.phienDangNhap.create({
      data: {
        sessionId: staffBSessionId,
        taiKhoanId: staffBAccountId,
        refreshTokenHash: createHash('sha256').update(randomUUID()).digest('hex'),
        hetHanLuc: new Date(Date.now() + 3600000),
      },
    });
    staffBToken = jwtService.sign(
      { sub: staffBAccountId, sid: staffBSessionId, roles: ['NHAN_VIEN_CSKH'] },
      { secret: accessSecret, expiresIn: '1h' },
    );
  }, 45000);

  afterAll(async () => {
    if (prisma) {
      if (createdConversationId) {
        await prisma.tinNhanHoTro.deleteMany({
          where: { cuocTroChuyenId: createdConversationId },
        });
        await prisma.cuocTroChuyen.deleteMany({
          where: { cuocTroChuyenId: createdConversationId },
        });
      }

      if (createdSessionIds.length > 0) {
        await prisma.phienDangNhap.deleteMany({
          where: { sessionId: { in: createdSessionIds } },
        });
      }

      if (customerAccountId) {
        await prisma.khachHang.deleteMany({ where: { taiKhoanId: customerAccountId } });
        await prisma.taiKhoanVaiTro.deleteMany({ where: { taiKhoanId: customerAccountId } });
        await prisma.taiKhoan.deleteMany({ where: { taiKhoanId: customerAccountId } });
      }

      if (staffBAccountId) {
        await prisma.nhanVien.deleteMany({ where: { taiKhoanId: staffBAccountId } });
        await prisma.taiKhoanVaiTro.deleteMany({ where: { taiKhoanId: staffBAccountId } });
        await prisma.taiKhoan.deleteMany({ where: { taiKhoanId: staffBAccountId } });
      }

      if (busCompanyAId) {
        await prisma.nhaXe.deleteMany({ where: { nhaXeId: busCompanyAId } });
      }
      if (busCompanyBId) {
        await prisma.nhaXe.deleteMany({ where: { nhaXeId: busCompanyBId } });
      }
    }

    await app?.close();
  });

  describe('1. AccessTokenGuard (401 Unauthorized)', () => {
    it('rejects unauthenticated request without Bearer token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/support-chat/conversations')
        .expect(401);

      expect(res.body.error).toBe('ACCESS_TOKEN_INVALID');
    });

    it('rejects request with invalid token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/support-chat/conversations')
        .set('Authorization', 'Bearer invalid-token-xyz')
        .expect(401);

      expect(res.body.error).toBe('ACCESS_TOKEN_INVALID');
    });
  });

  describe('2. ValidationPipe (400 VALIDATION_ERROR)', () => {
    it('rejects POST /conversations when nhaXeId is missing or non-positive', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/support-chat/conversations')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ nhaXeId: -5, tieuDe: 'Test' })
        .expect(400);

      expect(res.body.error).toBe('VALIDATION_ERROR');
      expect(Array.isArray(res.body.details)).toBe(true);
      expect(res.body.details.some((d: any) => d.field === 'nhaXeId')).toBe(true);
    });

    it('rejects unexpected non-whitelisted fields in body (forbidNonWhitelisted: true)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/support-chat/conversations')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          nhaXeId: busCompanyAId,
          maliciousField: 'exploit',
        })
        .expect(400);

      expect(res.body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('3. Customer Full Flow: Create Conversation & Send Message', () => {
    it('creates a conversation successfully and returns standard envelope { data }', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/support-chat/conversations')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          nhaXeId: busCompanyAId,
          tieuDe: `Hỗ trợ hành khách E2E ${testSuffix}`,
          tinNhanDauTien: 'Xin chào, tôi cần hỗ trợ đổi chuyến.',
          clientMessageId: `client-e2e-first-${testSuffix}`,
        })
        .expect(201);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.cuocTroChuyenId).toBeGreaterThan(0);
      expect(res.body.data.nhaXeId).toBe(busCompanyAId);
      expect(res.body.data.trangThai).toBe('CHO_TIEP_NHAN');

      createdConversationId = res.body.data.cuocTroChuyenId;
    });

    it('sends an additional message in the conversation and returns { data }', async () => {
      expect(createdConversationId).not.toBeNull();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/support-chat/conversations/${createdConversationId}/messages`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          noiDung: 'Tôi muốn đổi chuyến sang 20h tối nay.',
          clientMessageId: `client-e2e-second-${testSuffix}`,
        })
        .expect(201);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.tinNhanId).toBeGreaterThan(0);
      expect(res.body.data.clientMessageId).toBe(`client-e2e-second-${testSuffix}`);
      expect(res.body.data.loaiNguoiGui).toBe('KHACH_HANG');
    });

    it('fetches message list and returns messages in chronological order', async () => {
      expect(createdConversationId).not.toBeNull();

      const res = await request(app.getHttpServer())
        .get(`/api/v1/support-chat/conversations/${createdConversationId}/messages`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
      expect(res.body.data[0].noiDung).toBe('Xin chào, tôi cần hỗ trợ đổi chuyến.');
    });
  });

  describe('4. Multi-Tenant Isolation Enforcement (403 TENANT_ACCESS_DENIED)', () => {
    it('forbids staff from Bus Company B from reading messages of Bus Company A conversation', async () => {
      expect(createdConversationId).not.toBeNull();

      const res = await request(app.getHttpServer())
        .get(`/api/v1/support-chat/conversations/${createdConversationId}/messages`)
        .set('Authorization', `Bearer ${staffBToken}`)
        .expect(403);

      expect(res.body.error).toBe('CHAT_PERMISSION_DENIED');
      expect(res.body.message).toMatch(/không có quyền truy cập/);
    });

    it('forbids staff from Bus Company B from sending a message to Bus Company A conversation', async () => {
      expect(createdConversationId).not.toBeNull();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/support-chat/conversations/${createdConversationId}/messages`)
        .set('Authorization', `Bearer ${staffBToken}`)
        .send({
          noiDung: 'Nhân viên nhà xe B can thiệp trái phép',
          clientMessageId: `client-e2e-unauthorized-${testSuffix}`,
        })
        .expect(403);

      expect(res.body.error).toBe('CHAT_PERMISSION_DENIED');
    });

    it('forbids staff from Bus Company B from closing Bus Company A conversation', async () => {
      expect(createdConversationId).not.toBeNull();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/support-chat/conversations/${createdConversationId}/close`)
        .set('Authorization', `Bearer ${staffBToken}`)
        .send({ lyDo: 'Đóng trái phép' })
        .expect(403);

      expect(res.body.error).toBe('TENANT_SCOPE_VIOLATION');
    });
  });
});
