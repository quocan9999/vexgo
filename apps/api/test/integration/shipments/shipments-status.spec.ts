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

describe('Shipment Status Transition APIs (Phase 04)', () => {
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

  let testAccountId: number;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AccessTokenGuard)
      .useValue(testAccessTokenGuard)
      .compile();

    app = moduleRef.createNestApplication();
    configureApi(app);
    await app.init();

    prisma = app.get(PrismaService);

    const testAccount = await prisma.taiKhoan.findFirstOrThrow({
      where: { nhanVien: { nhaXeId: 1 } },
    });
    testAccountId = testAccount.taiKhoanId;
  });

  afterAll(async () => {
    await app?.close();
  });

  function setTenantAdmin(nhaXeId: number = 1, accountId?: number) {
    currentPrincipal = {
      taiKhoanId: accountId ?? testAccountId,
      sessionId: 'session-tenant-admin',
      roles: ['NHA_XE_ADMIN'],
      permissions: [...ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.NHA_XE_ADMIN],
      nhanVienId: 201,
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

  async function createTestShipment(options: {
    nhaXeId?: number;
    initialStatus?: 'MOI_TAO' | 'DA_TIEP_NHAN' | 'DANG_VAN_CHUYEN';
    isPaid?: boolean;
  } = {}) {
    const nhaXeId = options.nhaXeId ?? 1;
    const initialStatus = options.initialStatus ?? 'MOI_TAO';
    const isPaid = options.isPaid ?? false;

    // Tìm chuyến và điểm dừng của nhà xe
    const [chuyenXe, diemGui, diemNhan, khachHang] = await Promise.all([
      prisma.chuyenXe.findFirstOrThrow({ where: { nhaXeId } }),
      prisma.diemGiaoNhanHang.findFirstOrThrow({ where: { nhaXeId } }),
      prisma.diemGiaoNhanHang.findFirstOrThrow({
        where: { nhaXeId, diemGiaoNhanHangId: { not: undefined } },
        orderBy: { diemGiaoNhanHangId: 'desc' },
      }),
      prisma.khachHang.findFirstOrThrow(),
    ]);

    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const maDonGiaoDich = `TEST-DON-${randomSuffix}`;
    const maVanDon = `TEST-VD-${randomSuffix}`;

    const donGiaoDich = await prisma.donGiaoDich.create({
      data: {
        maDonGiaoDich,
        ngayTao: new Date(),
        tongTien: 100000,
        trangThai: isPaid ? 'DA_THANH_TOAN' : 'CHO_THANH_TOAN',
        tenKhachHang: 'Khách Test Status',
        soDienThoaiKhachHang: '+84900111222',
        khachHangId: khachHang.khachHangId,
        nhaXeId,
        thanhToans: isPaid
          ? {
              create: {
                soTien: 100000,
                phuongThuc: 'VNPAY',
                loaiGiaoDich: 'THANH_TOAN_DON_HANG',
                thoiGian: new Date(),
                trangThai: 'THANH_CONG',
              },
            }
          : undefined,
      },
    });

    const phieuGuiHang = await prisma.phieuGuiHang.create({
      data: {
        maVanDon,
        ngayGui: new Date(),
        tongPhi: 100000,
        cuocChinh: 100000,
        phiDichVu: 0,
        soTienGiam: 0,
        nguoiTraCuoc: 'NGUOI_GUI',
        trangThai: initialStatus,
        tenNguoiNhan: 'Người Nhận Test',
        soDienThoaiNguoiNhan: '+84900333444',
        donGiaoDichId: donGiaoDich.donGiaoDichId,
        chuyenXeId: chuyenXe.chuyenXeId,
        diemGuiId: diemGui.diemGiaoNhanHangId,
        diemNhanId: diemNhan.diemGiaoNhanHangId,
        lichSuTrangThais: {
          create: {
            trangThai: initialStatus,
            thoiGian: new Date(),
            ghiChu: 'Khởi tạo test',
          },
        },
      },
    });

    return phieuGuiHang;
  }

  describe('Authentication & Authorization', () => {
    it('returns 401 when request is unauthenticated', async () => {
      currentPrincipal = null;

      const response = await request(app.getHttpServer())
        .patch('/api/v1/shipments/1/status')
        .send({ status: 'DA_TIEP_NHAN' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('ACCESS_TOKEN_INVALID');
    });

    it('returns 403 when user does not have shipment:update permission', async () => {
      setUnauthorizedRole(1);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/shipments/1/status')
        .send({ status: 'DA_TIEP_NHAN' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('PERMISSION_FORBIDDEN');
    });

    it('returns 403 when SUPER_ADMIN attempts operational shipment update', async () => {
      setSuperAdmin();

      const response = await request(app.getHttpServer())
        .patch('/api/v1/shipments/1/status')
        .send({ status: 'DA_TIEP_NHAN' });

      expect(response.status).toBe(403);
    });

    it('returns 404 when shipment belongs to another tenant', async () => {
      const shipment = await createTestShipment({ nhaXeId: 2 });
      setTenantAdmin(1); // Tenant 1 trying to update Tenant 2

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/shipments/${shipment.phieuGuiHangId}/status`)
        .send({ status: 'DA_TIEP_NHAN' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('SHIPMENT_NOT_FOUND');
    });
  });

  describe('Validation & DTO constraints', () => {
    it('returns 400 when status is invalid enum', async () => {
      setTenantAdmin(1);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/shipments/1/status')
        .send({ status: 'TRANG_THAI_BAY_BA' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when note exceeds 500 characters', async () => {
      setTenantAdmin(1);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/shipments/1/status')
        .send({
          status: 'DA_TIEP_NHAN',
          note: 'a'.repeat(501),
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('Happy Path 3-Step Transitions & History Verification', () => {
    it('executes MOI_TAO -> DA_TIEP_NHAN -> DANG_VAN_CHUYEN -> DA_GIAO consecutively', async () => {
      const shipment = await createTestShipment({
        nhaXeId: 1,
        initialStatus: 'MOI_TAO',
      });
      const id = shipment.phieuGuiHangId;
      setTenantAdmin(1);

      // Step 1: MOI_TAO -> DA_TIEP_NHAN
      const res1 = await request(app.getHttpServer())
        .patch(`/api/v1/shipments/${id}/status`)
        .send({ status: 'DA_TIEP_NHAN', note: 'Đã nhận hàng tại quầy' });

      expect(res1.status).toBe(200);
      expect(res1.body.data.shipmentId).toBe(id);
      expect(res1.body.data.status).toBe('DA_TIEP_NHAN');
      expect(res1.body.data.updatedAt).toBeDefined();

      const db1 = await prisma.phieuGuiHang.findUniqueOrThrow({
        where: { phieuGuiHangId: id },
        include: { lichSuTrangThais: { orderBy: { lichSuTrangThaiId: 'asc' } } },
      });
      expect(db1.trangThai).toBe('DA_TIEP_NHAN');
      expect(db1.lichSuTrangThais).toHaveLength(2);
      expect(db1.lichSuTrangThais[1].trangThai).toBe('DA_TIEP_NHAN');
      expect(db1.lichSuTrangThais[1].taiKhoanId).toBe(testAccountId);
      expect(db1.lichSuTrangThais[1].ghiChu).toBe('Đã nhận hàng tại quầy');

      // Step 2: DA_TIEP_NHAN -> DANG_VAN_CHUYEN
      setTenantAdmin(1);
      const res2 = await request(app.getHttpServer())
        .patch(`/api/v1/shipments/${id}/status`)
        .send({ status: 'DANG_VAN_CHUYEN', note: 'Đã xếp lên xe' });

      expect(res2.status).toBe(200);
      expect(res2.body.data.status).toBe('DANG_VAN_CHUYEN');

      const db2 = await prisma.phieuGuiHang.findUniqueOrThrow({
        where: { phieuGuiHangId: id },
        include: { lichSuTrangThais: { orderBy: { lichSuTrangThaiId: 'asc' } } },
      });
      expect(db2.trangThai).toBe('DANG_VAN_CHUYEN');
      expect(db2.lichSuTrangThais).toHaveLength(3);
      expect(db2.lichSuTrangThais[2].trangThai).toBe('DANG_VAN_CHUYEN');
      expect(db2.lichSuTrangThais[2].taiKhoanId).toBe(testAccountId);
      expect(db2.lichSuTrangThais[2].ghiChu).toBe('Đã xếp lên xe');

      // Step 3: DANG_VAN_CHUYEN -> DA_GIAO
      setTenantAdmin(1);
      const res3 = await request(app.getHttpServer())
        .patch(`/api/v1/shipments/${id}/status`)
        .send({ status: 'DA_GIAO', note: 'Người nhận đã ký nhận' });

      expect(res3.status).toBe(200);
      expect(res3.body.data.status).toBe('DA_GIAO');

      const db3 = await prisma.phieuGuiHang.findUniqueOrThrow({
        where: { phieuGuiHangId: id },
        include: { lichSuTrangThais: { orderBy: { lichSuTrangThaiId: 'asc' } } },
      });
      expect(db3.trangThai).toBe('DA_GIAO');
      expect(db3.lichSuTrangThais).toHaveLength(4);
      expect(db3.lichSuTrangThais[3].trangThai).toBe('DA_GIAO');
      expect(db3.lichSuTrangThais[3].taiKhoanId).toBe(testAccountId);
      expect(db3.lichSuTrangThais[3].ghiChu).toBe('Người nhận đã ký nhận');
    });
  });

  describe('Cancellation Rules (MOI_TAO -> DA_HUY)', () => {
    it('allows cancelling unpaid shipment in MOI_TAO status', async () => {
      const shipment = await createTestShipment({
        nhaXeId: 1,
        initialStatus: 'MOI_TAO',
        isPaid: false,
      });
      setTenantAdmin(1);

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/shipments/${shipment.phieuGuiHangId}/status`)
        .send({ status: 'DA_HUY', note: 'Khách hàng hủy gửi' });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('DA_HUY');

      const db = await prisma.phieuGuiHang.findUniqueOrThrow({
        where: { phieuGuiHangId: shipment.phieuGuiHangId },
        include: { lichSuTrangThais: true },
      });
      expect(db.trangThai).toBe('DA_HUY');
    });

    it('returns 409 SHIPMENT_REFUND_REQUIRED when cancelling paid shipment', async () => {
      const shipment = await createTestShipment({
        nhaXeId: 1,
        initialStatus: 'MOI_TAO',
        isPaid: true,
      });
      setTenantAdmin(1);

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/shipments/${shipment.phieuGuiHangId}/status`)
        .send({ status: 'DA_HUY', note: 'Muốn hủy nhưng đã thanh toán' });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('SHIPMENT_REFUND_REQUIRED');

      const db = await prisma.phieuGuiHang.findUniqueOrThrow({
        where: { phieuGuiHangId: shipment.phieuGuiHangId },
      });
      expect(db.trangThai).toBe('MOI_TAO'); // Unchanged
    });
  });

  describe('Invalid Transitions, Jumps, Repeats and Terminal States', () => {
    it('returns 409 when jumping from MOI_TAO directly to DA_GIAO', async () => {
      const shipment = await createTestShipment({ initialStatus: 'MOI_TAO' });
      setTenantAdmin(1);

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/shipments/${shipment.phieuGuiHangId}/status`)
        .send({ status: 'DA_GIAO' });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('INVALID_STATUS_TRANSITION');
    });

    it('returns 409 when updating to the same status (repeat)', async () => {
      const shipment = await createTestShipment({ initialStatus: 'MOI_TAO' });
      setTenantAdmin(1);

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/shipments/${shipment.phieuGuiHangId}/status`)
        .send({ status: 'MOI_TAO' });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('INVALID_STATUS_TRANSITION');
    });

    it('returns 409 when trying to transition from terminal status DA_GIAO', async () => {
      const shipment = await createTestShipment({ initialStatus: 'MOI_TAO' });
      setTenantAdmin(1);

      // Đi tới DA_GIAO
      await request(app.getHttpServer())
        .patch(`/api/v1/shipments/${shipment.phieuGuiHangId}/status`)
        .send({ status: 'DA_TIEP_NHAN' });
      await request(app.getHttpServer())
        .patch(`/api/v1/shipments/${shipment.phieuGuiHangId}/status`)
        .send({ status: 'DANG_VAN_CHUYEN' });
      await request(app.getHttpServer())
        .patch(`/api/v1/shipments/${shipment.phieuGuiHangId}/status`)
        .send({ status: 'DA_GIAO' });

      // Cố cập nhật từ DA_GIAO
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/shipments/${shipment.phieuGuiHangId}/status`)
        .send({ status: 'DANG_VAN_CHUYEN' });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('INVALID_STATUS_TRANSITION');
    });
  });

  describe('Concurrency & Race Condition Handling', () => {
    it('handles concurrent status updates safely with only one winner', async () => {
      const shipment = await createTestShipment({ initialStatus: 'MOI_TAO' });
      setTenantAdmin(1);

      // Gửi 2 request đồng thời từ MOI_TAO sang DA_TIEP_NHAN
      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .patch(`/api/v1/shipments/${shipment.phieuGuiHangId}/status`)
          .send({ status: 'DA_TIEP_NHAN', note: 'Req 1' }),
        request(app.getHttpServer())
          .patch(`/api/v1/shipments/${shipment.phieuGuiHangId}/status`)
          .send({ status: 'DA_TIEP_NHAN', note: 'Req 2' }),
      ]);

      const statuses = [res1.status, res2.status];
      expect(statuses).toContain(200);
      expect(statuses).toContain(409);

      // Kiểm tra DB chỉ có đúng 1 record history mới
      const db = await prisma.phieuGuiHang.findUniqueOrThrow({
        where: { phieuGuiHangId: shipment.phieuGuiHangId },
        include: { lichSuTrangThais: true },
      });
      expect(db.trangThai).toBe('DA_TIEP_NHAN');
      expect(db.lichSuTrangThais).toHaveLength(2); // 1 khởi tạo + 1 từ winner
    });
  });
});
