import { type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { config as loadDotenv } from 'dotenv';
import request from 'supertest';
import { AppModule } from '../../../src/app.module.js';
import { configureApi } from '../../../src/common/configure-api.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';

const rootEnvPath = resolve(process.cwd(), '../../.env');
loadDotenv({ path: rootEnvPath });

type PromotionApiResponse = {
  id: number;
  name: string;
  code: string;
  discountType: string;
  discountValue: string;
  maxDiscount: string | null;
  minimumTicketAmount: string | null;
  startsOn: string;
  endsOn: string;
  status: 'HOAT_DONG' | 'TAM_NGUNG';
  usageCount: number;
  usageLimit: number;
  remainingUses: number;
  effectiveState: string;
};

function assertPromotionDatabaseTarget(): void {
  const raw = process.env.DATABASE_URL;
  if (!raw)
    throw new Error('DATABASE_URL is required for promotion API tests.');

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('DATABASE_URL is invalid for promotion API tests.');
  }

  const database = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
  const username = decodeURIComponent(url.username);
  if (
    url.protocol !== 'mysql:' ||
    url.hostname !== '127.0.0.1' ||
    Number(url.port || 3306) !== 3306 ||
    database !== 'vexgo_promotion' ||
    username !== 'vexgo_promotion_app'
  ) {
    throw new Error(
      'Promotion API integration tests may connect only to vexgo_promotion at 127.0.0.1:3306 with its app user.',
    );
  }
}

describe('Tenant promotions API with real authentication and MySQL RBAC', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let accessSecret: string;
  const suffix = randomUUID().replaceAll('-', '').toUpperCase();
  const tenantCodes = [`P10-${suffix}-A`, `P10-${suffix}-B`];
  const accountIds: number[] = [];
  const sessionIds: string[] = [];
  let tenantAId = 0;
  let tenantBId = 0;
  let adminAToken: string;
  let adminBToken: string;
  let salesAToken: string;
  let salesBToken: string;
  let superAdminToken: string;
  let promotionAId: number;
  let accountOrdinal = 0;

  beforeAll(async () => {
    assertPromotionDatabaseTarget();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApi(app);
    await app.init();
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
    accessSecret = app
      .get(ConfigService)
      .getOrThrow<string>('JWT_ACCESS_SECRET');

    const [tenantA, tenantB] = await Promise.all(
      tenantCodes.map((maNhaXe, index) =>
        prisma.nhaXe.create({
          data: {
            maNhaXe,
            tenNhaXe: `Promotion API tenant ${index ? 'B' : 'A'} ${suffix}`,
            trangThai: 'HOAT_DONG',
          },
          select: { nhaXeId: true },
        }),
      ),
    );
    tenantAId = tenantA.nhaXeId;
    tenantBId = tenantB.nhaXeId;

    const createIdentity = async (
      tenantId: number | null,
      roleName: string,
      label: string,
    ): Promise<string> => {
      const account = await prisma.taiKhoan.create({
        data: {
          hoTen: `Promotion API ${label} ${suffix}`,
          soDienThoai: `P10${suffix.slice(0, 10)}${String(++accountOrdinal).padStart(3, '0')}`,
          matKhau: 'integration-test-only',
          daXacThucSoDienThoai: true,
          trangThai: 'HOAT_DONG',
        },
        select: { taiKhoanId: true },
      });
      accountIds.push(account.taiKhoanId);

      if (tenantId !== null) {
        await prisma.nhanVien.create({
          data: {
            maNhanVien: `P10-${suffix}-${label}`,
            trangThaiLamViec: 'DANG_LAM',
            nhaXeId: tenantId,
            taiKhoanId: account.taiKhoanId,
          },
        });
      }

      const role = await prisma.vaiTro.findUnique({
        where: { tenVaiTro: roleName },
        select: { vaiTroId: true },
      });
      if (!role) throw new Error(`Seeded role ${roleName} is missing.`);
      await prisma.taiKhoanVaiTro.create({
        data: { taiKhoanId: account.taiKhoanId, vaiTroId: role.vaiTroId },
      });

      const sessionId = randomUUID();
      sessionIds.push(sessionId);
      await prisma.phienDangNhap.create({
        data: {
          sessionId,
          refreshTokenHash: randomBytes(32).toString('hex'),
          hetHanLuc: new Date(Date.now() + 60 * 60 * 1000),
          taiKhoanId: account.taiKhoanId,
        },
      });

      return jwtService.signAsync(
        { sub: account.taiKhoanId, sid: sessionId, roles: [roleName] },
        { secret: accessSecret, algorithm: 'HS256', expiresIn: '10m' },
      );
    };

    [adminAToken, adminBToken, salesAToken, salesBToken, superAdminToken] =
      await Promise.all([
        createIdentity(tenantAId, 'NHA_XE_ADMIN', 'ADMIN-A'),
        createIdentity(tenantBId, 'NHA_XE_ADMIN', 'ADMIN-B'),
        createIdentity(tenantAId, 'NHAN_VIEN_KINH_DOANH', 'SALES-A'),
        createIdentity(tenantBId, 'NHAN_VIEN_KINH_DOANH', 'SALES-B'),
        createIdentity(null, 'SUPER_ADMIN', 'SUPER'),
      ]);

    const salesRole = await prisma.vaiTro.findUniqueOrThrow({
      where: { tenVaiTro: 'NHAN_VIEN_KINH_DOANH' },
      select: { vaiTroId: true },
    });
    const readPermission = await prisma.quyen.findUniqueOrThrow({
      where: { tenQuyen: 'promotion:read' },
      select: { quyenId: true },
    });
    await prisma.cauHinhQuyenVaiTroNhaXe.create({
      data: {
        nhaXeId: tenantAId,
        vaiTroId: salesRole.vaiTroId,
        chiTiets: { create: { quyenId: readPermission.quyenId } },
      },
    });
  }, 30_000);

  afterAll(async () => {
    try {
      if (prisma) {
        const fixtureTenantIds = [tenantAId, tenantBId].filter(
          (id): id is number => Number.isSafeInteger(id) && id > 0,
        );
        await prisma.khuyenMai.deleteMany({
          where: { nhaXeId: { in: fixtureTenantIds } },
        });
        await prisma.cauHinhQuyenVaiTroNhaXe.deleteMany({
          where: { nhaXeId: { in: fixtureTenantIds } },
        });
        await prisma.phienDangNhap.deleteMany({
          where: { sessionId: { in: sessionIds } },
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
        await prisma.nhaXe.deleteMany({
          where: { nhaXeId: { in: fixtureTenantIds } },
        });
      }
    } finally {
      await app?.close();
    }
  });

  const bearer = (token: string) => `Bearer ${token}`;

  function createBody(overrides: Record<string, unknown> = {}) {
    return {
      name: 'Promotion API test',
      code: `API${suffix.slice(0, 12)}`,
      discountType: 'PHAN_TRAM',
      discountValue: '15.00',
      maxDiscount: '50000.00',
      minimumTicketAmount: '100000.00',
      startsOn: '2026-01-01',
      endsOn: '2030-12-31',
      usageLimit: 10,
      ...overrides,
    };
  }

  it('filters inclusive validity overlap before pagination and rejects invalid date ranges', async () => {
    const code = 'DATE' + suffix.slice(0, 12);
    const created = await request(app.getHttpServer())
      .post('/api/v1/promotions').set('Authorization', bearer(adminAToken))
      .send(createBody({ code, startsOn: '2026-02-10', endsOn: '2026-02-20' })).expect(201);
    for (const date of ['2026-02-10', '2026-02-15', '2026-02-20']) {
      const response = await request(app.getHttpServer()).get('/api/v1/promotions')
        .query({ search: code, fromDate: date, toDate: date, pageSize: 1 })
        .set('Authorization', bearer(adminAToken)).expect(200);
      expect(response.body.data.map((p: PromotionApiResponse) => p.id)).toEqual([created.body.data.id]);
      expect(response.body.meta.totalItems).toBe(1);
    }
    for (const date of ['2026-02-09', '2026-02-21']) {
      const response = await request(app.getHttpServer()).get('/api/v1/promotions')
        .query({ search: code, fromDate: date, toDate: date })
        .set('Authorization', bearer(adminAToken)).expect(200);
      expect(response.body.meta.totalItems).toBe(0);
      expect(response.body.data).toEqual([]);
    }
    const otherTenant = await request(app.getHttpServer()).get('/api/v1/promotions')
      .query({ search: code, fromDate: '2026-02-01', toDate: '2026-02-28' })
      .set('Authorization', bearer(adminBToken)).expect(200);
    expect(otherTenant.body.data).toEqual([]);
    for (const query of [
      { fromDate: '2026-02-30' }, { toDate: 'invalid' },
      { fromDate: '2026-02-20', toDate: '2026-02-10' },
    ]) {
      await request(app.getHttpServer()).get('/api/v1/promotions').query(query)
        .set('Authorization', bearer(adminAToken)).expect(400)
        .expect(({ body }) => expect(body.error).toBe('VALIDATION_ERROR'));
    }
  }, 30000);

  it('requires a real session for admin APIs and retires the public legacy validator', async () => {
    const unauthenticated = await request(app.getHttpServer())
      .get('/api/v1/promotions')
      .expect(401);
    expect(unauthenticated.body.error).toBe('ACCESS_TOKEN_INVALID');

    const deprecated = await request(app.getHttpServer())
      .post('/api/v1/promotions/validate')
      .send({ code: 'UNTRUSTED', nhaXeId: tenantAId, totalAmount: 1 })
      .expect(410);
    expect(deprecated.body.error).toBe('PROMOTION_VALIDATE_DEPRECATED');

    await request(app.getHttpServer())
      .get('/api/v1/promotions')
      .set('Authorization', bearer(superAdminToken))
      .expect(403);
  });

  it('creates promotions, normalizes codes, scopes list/detail, and permits same code in another tenant', async () => {
    const first = await request(app.getHttpServer())
      .post('/api/v1/promotions')
      .set('Authorization', bearer(adminAToken))
      .send(createBody({ code: `shared${suffix.slice(0, 8)}` }))
      .expect(201);
    const promotionA = first.body.data as PromotionApiResponse;
    promotionAId = promotionA.id;
    expect(promotionA).toMatchObject({
      code: `SHARED${suffix.slice(0, 8)}`,
      discountType: 'PHAN_TRAM',
      discountValue: '15.00',
      maxDiscount: '50000.00',
      status: 'HOAT_DONG',
      usageCount: 0,
      usageLimit: 10,
      remainingUses: 10,
      effectiveState: 'ACTIVE',
    });

    await request(app.getHttpServer())
      .post('/api/v1/promotions')
      .set('Authorization', bearer(adminAToken))
      .send(createBody({ code: `SHARED${suffix.slice(0, 8)}` }))
      .expect(409)
      .expect(({ body }) => expect(body.error).toBe('PROMOTION_CODE_EXISTS'));

    const sameCodeTenantB = await request(app.getHttpServer())
      .post('/api/v1/promotions')
      .set('Authorization', bearer(adminBToken))
      .send(createBody({ code: `shared${suffix.slice(0, 8)}` }))
      .expect(201);
    expect(sameCodeTenantB.body.data.code).toBe(`SHARED${suffix.slice(0, 8)}`);

    const fixed = await request(app.getHttpServer())
      .post('/api/v1/promotions')
      .set('Authorization', bearer(adminAToken))
      .send(
        createBody({
          code: `FIXED${suffix.slice(0, 8)}`,
          discountType: 'SO_TIEN',
          discountValue: '25000',
          maxDiscount: undefined,
          minimumTicketAmount: undefined,
        }),
      )
      .expect(201);
    expect(fixed.body.data).toMatchObject({
      discountType: 'SO_TIEN',
      discountValue: '25000.00',
      maxDiscount: null,
      minimumTicketAmount: null,
    });

    const listA = await request(app.getHttpServer())
      .get('/api/v1/promotions?page=1&pageSize=10&search=shared')
      .set('Authorization', bearer(adminAToken))
      .expect(200);
    expect(listA.body.data.map(({ id }: PromotionApiResponse) => id)).toContain(
      promotionA.id,
    );
    expect(listA.body.meta).toMatchObject({ page: 1, pageSize: 10 });

    const listB = await request(app.getHttpServer())
      .get('/api/v1/promotions')
      .set('Authorization', bearer(adminBToken))
      .expect(200);
    expect(
      listB.body.data.some(
        ({ id }: PromotionApiResponse) => id === promotionA.id,
      ),
    ).toBe(false);

    await request(app.getHttpServer())
      .get(`/api/v1/promotions/${promotionA.id}`)
      .set('Authorization', bearer(adminBToken))
      .expect(404)
      .expect(({ body }) => expect(body.error).toBe('PROMOTION_NOT_FOUND'));

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/promotions/${promotionA.id}`)
      .set('Authorization', bearer(adminAToken))
      .expect(200);
    expect(detail.body.data).toMatchObject({
      id: promotionA.id,
      code: promotionA.code,
      remainingUses: 10,
    });
  });

  it('rejects invalid promotion inputs and keeps status changes status-only and fail-closed', async () => {
    const invalidCases = [
      { endsOn: '2026-02-30' },
      { startsOn: '2030-01-01', endsOn: '2029-12-31' },
      { discountValue: '0' },
      { discountValue: '100.01' },
      { discountValue: '101' },
      { maxDiscount: undefined },
      { usageLimit: 0 },
      { minimumTicketAmount: '-1' },
      { nhaXeId: tenantBId },
    ];
    for (const invalid of invalidCases) {
      const response = await request(app.getHttpServer())
        .post('/api/v1/promotions')
        .set('Authorization', bearer(adminAToken))
        .send(createBody(invalid))
        .expect(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    }

    const before = await prisma.khuyenMai.findUniqueOrThrow({
      where: { khuyenMaiId: promotionAId },
    });
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/promotions/${promotionAId}/status`)
      .set('Authorization', bearer(adminAToken))
      .send({ status: 'TAM_NGUNG', usageLimit: 999 })
      .expect(400);
    expect(response.body.error).toBe('VALIDATION_ERROR');

    await request(app.getHttpServer())
      .patch(`/api/v1/promotions/${promotionAId}/status`)
      .set('Authorization', bearer(adminAToken))
      .send({ status: 'TAM_NGUNG' })
      .expect(200);
    const after = await prisma.khuyenMai.findUniqueOrThrow({
      where: { khuyenMaiId: promotionAId },
    });
    expect(after).toMatchObject({
      tenChuongTrinh: before.tenChuongTrinh,
      maKhuyenMai: before.maKhuyenMai,
      giaTriGiam: before.giaTriGiam,
      giamToiDa: before.giamToiDa,
      tuNgay: before.tuNgay,
      denNgay: before.denNgay,
      soLuotToiDa: before.soLuotToiDa,
      trangThai: 'TAM_NGUNG',
    });

    await request(app.getHttpServer())
      .patch(`/api/v1/promotions/${promotionAId}/status`)
      .set('Authorization', bearer(adminAToken))
      .send({ status: 'HOAT_DONG' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/promotions/${promotionAId}`)
      .set('Authorization', bearer(adminAToken))
      .send({ name: 'Edited' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/api/v1/promotions/${promotionAId}`)
      .set('Authorization', bearer(adminAToken))
      .expect(404);

    const expired = await request(app.getHttpServer())
      .post('/api/v1/promotions')
      .set('Authorization', bearer(adminAToken))
      .send(
        createBody({
          code: `OLD${suffix.slice(0, 10)}`,
          startsOn: '2020-01-01',
          endsOn: '2020-12-31',
        }),
      )
      .expect(201);
    const expiredPromotionId = expired.body.data.id as number;
    const activatedExpired = await request(app.getHttpServer())
      .patch(`/api/v1/promotions/${expiredPromotionId}/status`)
      .set('Authorization', bearer(adminAToken))
      .send({ status: 'HOAT_DONG' })
      .expect(200);
    expect(activatedExpired.body.data.effectiveState).toBe('EXPIRED');

    const full = await request(app.getHttpServer())
      .post('/api/v1/promotions')
      .set('Authorization', bearer(adminAToken))
      .send(
        createBody({
          code: `FULL${suffix.slice(0, 9)}`,
          startsOn: '2026-01-01',
          endsOn: '2030-12-31',
        }),
      )
      .expect(201);
    const fullPromotionId = full.body.data.id as number;
    await prisma.khuyenMai.update({
      where: { khuyenMaiId: fullPromotionId },
      data: { soLuotDaSuDung: 10 },
    });
    const activatedExhausted = await request(app.getHttpServer())
      .patch(`/api/v1/promotions/${fullPromotionId}/status`)
      .set('Authorization', bearer(adminAToken))
      .send({ status: 'HOAT_DONG' })
      .expect(200);
    expect(activatedExhausted.body.data.effectiveState).toBe('EXHAUSTED');
  });

  it('enforces real per-tenant permission defaults and preserves employee overrides', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/promotions')
      .set('Authorization', bearer(salesAToken))
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/promotions')
      .set('Authorization', bearer(salesAToken))
      .send(createBody({ code: `SALES${suffix.slice(0, 8)}` }))
      .expect(403)
      .expect(({ body }) => expect(body.error).toBe('PERMISSION_FORBIDDEN'));

    await request(app.getHttpServer())
      .get('/api/v1/promotions')
      .set('Authorization', bearer(salesBToken))
      .expect(403)
      .expect(({ body }) => expect(body.error).toBe('PERMISSION_FORBIDDEN'));

    await request(app.getHttpServer())
      .patch(`/api/v1/promotions/${promotionAId}/status`)
      .set('Authorization', bearer(salesAToken))
      .send({ status: 'TAM_NGUNG' })
      .expect(403);
  });
});
