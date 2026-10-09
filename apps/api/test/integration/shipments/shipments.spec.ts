import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type ExecutionContext,
  type INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../../src/app.module.js';
import { AccessTokenGuard } from '../../../src/auth/guards/access-token.guard.js';
import { ADMIN_ROLE_DEFAULT_PERMISSION_KEYS } from '../../../src/auth/permissions/permission-catalog.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';
import { configureApi } from '../../../src/common/configure-api.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';

describe('Shipment Read APIs (Phase 02)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let currentPrincipal: AuthPrincipal | null = null;

  const testAccessTokenGuard = {
    canActivate(context: ExecutionContext) {
      if (!currentPrincipal) {
        throw new UnauthorizedException({
          error: 'ACCESS_TOKEN_INVALID',
          message: 'Cần đăng nhập để thực hiện thao tác này.',
        });
      }
      context.switchToHttp().getRequest<{ user?: AuthPrincipal }>().user =
        currentPrincipal;
      return true;
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
  });

  afterAll(async () => {
    await app?.close();
  });

  function setTenantAdmin(nhaXeId: number = 1) {
    currentPrincipal = {
      taiKhoanId: 101,
      sessionId: 'session-tenant-admin',
      roles: ['NHA_XE_ADMIN'],
      permissions: [...ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.NHA_XE_ADMIN],
      nhanVienId: 201,
      nhaXeId,
    };
  }

  function setTenantOperator(nhaXeId: number = 1) {
    currentPrincipal = {
      taiKhoanId: 102,
      sessionId: 'session-tenant-op',
      roles: ['NHAN_VIEN_DIEU_HANH'],
      permissions: [...ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.NHAN_VIEN_DIEU_HANH],
      nhanVienId: 202,
      nhaXeId,
    };
  }

  function setUnauthorizedRole(nhaXeId: number = 1) {
    currentPrincipal = {
      taiKhoanId: 103,
      sessionId: 'session-no-perm',
      roles: ['NHAN_VIEN_BAN_VE'],
      permissions: [],
      nhanVienId: 203,
      nhaXeId,
    };
  }

  function setSuperAdmin() {
    currentPrincipal = {
      taiKhoanId: 1,
      sessionId: 'session-super-admin',
      roles: ['SUPER_ADMIN'],
      permissions: [...ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.SUPER_ADMIN],
      nhanVienId: null,
      nhaXeId: null,
    };
  }

  describe('Authentication & Authorization', () => {
    it('returns 401 when request is unauthenticated', async () => {
      currentPrincipal = null;

      const response = await request(app.getHttpServer())
        .get('/api/v1/shipments')
        .expect(401);

      expect(response.body.error).toBe('ACCESS_TOKEN_INVALID');
    });

    it('returns 403 when authenticated user lacks shipment:read permission', async () => {
      setUnauthorizedRole(1);

      const response = await request(app.getHttpServer())
        .get('/api/v1/shipments')
        .expect(403);

      expect(response.body.error).toBe('PERMISSION_FORBIDDEN');
    });

    it('returns 403 when SUPER_ADMIN attempts to access tenant operational shipments', async () => {
      setSuperAdmin();

      const response = await request(app.getHttpServer())
        .get('/api/v1/shipments')
        .expect(403);

      expect(['ROLE_FORBIDDEN', 'PERMISSION_DENIED']).toContain(
        response.body.error,
      );
    });
  });

  describe('Tenant Scoping & Isolation', () => {
    it('returns only shipments belonging to the authenticated tenant', async () => {
      setTenantAdmin(1); // FUTA

      const response = await request(app.getHttpServer())
        .get('/api/v1/shipments')
        .query({ page: 1, pageSize: 50 })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      // Verify every returned shipment belongs to tenant 1
      const shipmentIds: number[] = response.body.data.map(
        (s: { shipmentId: number }) => s.shipmentId,
      );
      const dbShipments = await prisma.phieuGuiHang.findMany({
        where: { phieuGuiHangId: { in: shipmentIds } },
        include: { donGiaoDich: true },
      });

      for (const s of dbShipments) {
        expect(s.donGiaoDich.nhaXeId).toBe(1);
      }
    });

    it('returns 404 when querying a shipment belonging to another tenant', async () => {
      // Find a shipment belonging to tenant 2 (TB)
      const tbShipment = await prisma.phieuGuiHang.findFirst({
        where: { donGiaoDich: { nhaXeId: 2 } },
      });
      expect(tbShipment).toBeDefined();

      // Access as tenant 1 (FUTA)
      setTenantAdmin(1);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/shipments/${tbShipment!.phieuGuiHangId}`)
        .expect(404);

      expect(response.body.error).toBe('SHIPMENT_NOT_FOUND');
    });
  });

  describe('Validation & Query Parameters', () => {
    it('returns 400 for invalid page number', async () => {
      setTenantAdmin(1);

      const response = await request(app.getHttpServer())
        .get('/api/v1/shipments')
        .query({ page: 0 })
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for invalid pageSize (> 50)', async () => {
      setTenantAdmin(1);

      const response = await request(app.getHttpServer())
        .get('/api/v1/shipments')
        .query({ pageSize: 100 })
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for invalid status enum', async () => {
      setTenantAdmin(1);

      const response = await request(app.getHttpServer())
        .get('/api/v1/shipments')
        .query({ status: 'INVALID_STATUS' })
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('filters correctly by status', async () => {
      setTenantAdmin(1);

      const response = await request(app.getHttpServer())
        .get('/api/v1/shipments')
        .query({ status: 'MOI_TAO' })
        .expect(200);

      for (const item of response.body.data) {
        expect(item.status).toBe('MOI_TAO');
      }
    });

    it('searches by waybill code', async () => {
      setTenantAdmin(1);

      // Find an existing waybill code for tenant 1
      const sample = await prisma.phieuGuiHang.findFirst({
        where: { donGiaoDich: { nhaXeId: 1 } },
      });
      expect(sample).toBeDefined();

      const response = await request(app.getHttpServer())
        .get('/api/v1/shipments')
        .query({ search: sample!.maVanDon })
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data[0].waybillCode).toBe(sample!.maVanDon);
    });

    it('returns empty array with accurate meta when search matches nothing', async () => {
      setTenantAdmin(1);

      const response = await request(app.getHttpServer())
        .get('/api/v1/shipments')
        .query({ search: 'KHONG_TON_TAI_999999' })
        .expect(200);

      expect(response.body.data).toEqual([]);
      expect(response.body.meta.totalItems).toBe(0);
      expect(response.body.meta.totalPages).toBe(0);
    });
  });

  describe('Detail Endpoint (GET /:id)', () => {
    it('returns detailed shipment data with cargo items, fee details, fee summary, and history', async () => {
      setTenantOperator(1);

      const sample = await prisma.phieuGuiHang.findFirst({
        where: { donGiaoDich: { nhaXeId: 1 } },
        include: {
          hangHoas: true,
          chiTietCuocGuiHangs: true,
          lichSuTrangThais: true,
        },
      });
      expect(sample).toBeDefined();

      const response = await request(app.getHttpServer())
        .get(`/api/v1/shipments/${sample!.phieuGuiHangId}`)
        .expect(200);

      const { data } = response.body;
      expect(data.shipmentId).toBe(sample!.phieuGuiHangId);
      expect(data.waybillCode).toBe(sample!.maVanDon);
      expect(data.status).toBe(sample!.trangThai);
      expect(data.sender).toHaveProperty('fullName');
      expect(data.sender).toHaveProperty('phoneNumber');
      expect(data.receiver).toHaveProperty('fullName');
      expect(data.receiver).toHaveProperty('phoneNumber');
      expect(data.trip).toHaveProperty('tripId');
      expect(data.trip).toHaveProperty('code');
      expect(data.trip).toHaveProperty('departureDate');
      expect(data.trip).toHaveProperty('departureTime');
      expect(data.originPoint).toHaveProperty('name');
      expect(data.destinationPoint).toHaveProperty('name');

      // Cargo items
      expect(Array.isArray(data.cargoItems)).toBe(true);
      expect(data.cargoItems.length).toBe(sample!.hangHoas.length);
      if (data.cargoItems.length > 0) {
        expect(data.cargoItems[0]).toHaveProperty('cargoId');
        expect(data.cargoItems[0]).toHaveProperty('name');
        expect(data.cargoItems[0]).toHaveProperty('typeName');
        expect(data.cargoItems[0]).toHaveProperty('weightKg');
        expect(data.cargoItems[0]).toHaveProperty('quantity');
      }

      // Fee details & summary
      expect(Array.isArray(data.cargoFeeDetails)).toBe(true);
      expect(data.cargoFeeDetails.length).toBe(
        sample!.chiTietCuocGuiHangs.length,
      );
      expect(data.feeSummary).toHaveProperty('mainFee');
      expect(data.feeSummary).toHaveProperty('serviceFee');
      expect(data.feeSummary).toHaveProperty('discountAmount');
      expect(data.feeSummary).toHaveProperty('totalFee');
      expect(data.feeSummary).toHaveProperty('freightPayer');

      // History timeline
      expect(Array.isArray(data.history)).toBe(true);
      expect(data.history.length).toBe(sample!.lichSuTrangThais.length);
      if (data.history.length > 0) {
        expect(data.history[0]).toHaveProperty('historyId');
        expect(data.history[0]).toHaveProperty('status');
        expect(data.history[0]).toHaveProperty('time');
      }
    });

    it('returns 404 for non-existent shipment ID', async () => {
      setTenantAdmin(1);

      const response = await request(app.getHttpServer())
        .get('/api/v1/shipments/9999999')
        .expect(404);

      expect(response.body.error).toBe('SHIPMENT_NOT_FOUND');
    });

    it('returns 400 for non-numeric ID', async () => {
      setTenantAdmin(1);

      await request(app.getHttpServer())
        .get('/api/v1/shipments/abc')
        .expect(400);
    });
  });
});
