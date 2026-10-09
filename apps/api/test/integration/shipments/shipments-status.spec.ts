import { randomInt, randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type ExecutionContext,
  type INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
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

  let tenantOneId: number;
  let tenantTwoId: number;
  let testAccountId: number;
  let testEmployeeId: number;
  let testCustomerId: number;
  let preconditionShipmentId: number;
  const tenantFixtures = new Map<
    number,
    { chuyenXeId: number; diemGuiId: number; diemNhanId: number }
  >();

  beforeAll(async () => {
    const testDatabaseUrl = process.env.SHIPMENT_TEST_DATABASE_URL;
    if (!testDatabaseUrl) {
      throw new Error(
        'Set SHIPMENT_TEST_DATABASE_URL to a migrated, isolated MySQL test database.',
      );
    }

    const previousDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = testDatabaseUrl;
    try {
      const { AppModule } = await import('../../../src/app.module.js');
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(AccessTokenGuard)
        .useValue(testAccessTokenGuard)
        .compile();

      app = moduleRef.createNestApplication();
      configureApi(app);
      await app.init();

      prisma = app.get<PrismaService>(PrismaService);
    } finally {
      if (previousDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = previousDatabaseUrl;
      }
    }

    const token = randomUUID().replaceAll('-', '').slice(0, 12);
    const tenantOne = await createTenantFixture(`A-${token}`);
    const tenantTwo = await createTenantFixture(`B-${token}`);
    tenantOneId = tenantOne.nhaXeId;
    tenantTwoId = tenantTwo.nhaXeId;
    tenantFixtures.set(tenantOne.nhaXeId, tenantOne);
    tenantFixtures.set(tenantTwo.nhaXeId, tenantTwo);

    const employeeAccount = await prisma.taiKhoan.create({
      data: {
        hoTen: `Nhân viên test ${token}`,
        soDienThoai: `+849${randomInt(0, 1_000_000_000).toString().padStart(9, '0')}`,
        matKhau: 'test-only-password-hash',
        daXacThucSoDienThoai: true,
        trangThai: 'HOAT_DONG',
      },
    });
    testAccountId = employeeAccount.taiKhoanId;
    const employee = await prisma.nhanVien.create({
      data: {
        maNhanVien: `F09-STATUS-${token}`,
        trangThaiLamViec: 'DANG_LAM',
        nhaXeId: tenantOneId,
        taiKhoanId: testAccountId,
      },
    });
    testEmployeeId = employee.nhanVienId;

    const customerAccount = await prisma.taiKhoan.create({
      data: {
        hoTen: `Khách test ${token}`,
        soDienThoai: `+848${randomInt(0, 1_000_000_000).toString().padStart(9, '0')}`,
        matKhau: 'test-only-password-hash',
        daXacThucSoDienThoai: true,
        trangThai: 'HOAT_DONG',
      },
    });
    const customer = await prisma.khachHang.create({
      data: {
        maKhachHang: `F09-STATUS-${token}`,
        taiKhoanId: customerAccount.taiKhoanId,
      },
    });
    testCustomerId = customer.khachHangId;

    const preconditionShipment = await createTestShipment({
      nhaXeId: tenantOneId,
    });
    preconditionShipmentId = preconditionShipment.phieuGuiHangId;
  });

  afterAll(async () => {
    await app?.close();
  });

  async function createTenantFixture(label: string) {
    const company = await prisma.nhaXe.create({
      data: {
        maNhaXe: `F09-STATUS-${label}`,
        tenNhaXe: `Nhà xe test ${label}`,
        trangThai: 'HOAT_DONG',
      },
    });
    const vehicleType = await prisma.loaiXe.create({
      data: {
        nhaXeId: company.nhaXeId,
        tenLoai: `Loại xe test ${label}`,
      },
    });
    const vehicle = await prisma.xe.create({
      data: {
        bienSoXe: `F09${label.replace(/[^A-Z0-9]/gi, '').slice(0, 10)}`,
        trangThai: 'HOAT_DONG',
        nhaXeId: company.nhaXeId,
        loaiXeId: vehicleType.loaiXeId,
      },
    });
    const route = await prisma.tuyenXe.create({
      data: {
        maTuyenXe: `F09-STATUS-${label}`,
        diemDi: 'Điểm A test',
        diemDen: 'Điểm B test',
        trangThai: 'HOAT_DONG',
        nhaXeId: company.nhaXeId,
      },
    });
    const chuyenXe = await prisma.chuyenXe.create({
      data: {
        maChuyenXe: `F09-STATUS-${label}`,
        ngayKhoiHanh: new Date('2030-01-01T00:00:00.000Z'),
        gioKhoiHanh: new Date('1970-01-01T08:00:00.000Z'),
        nhanGuiHang: true,
        sucChuaXeMay: 0,
        sucChuaHangCongKenh: 0,
        sucChuaHangNhe: 0,
        trangThai: 'CHUA_KHOI_HANH',
        nhaXeId: company.nhaXeId,
        tuyenXeId: route.tuyenXeId,
        xeId: vehicle.xeId,
      },
    });
    const pickup = await prisma.diemGiaoNhanHang.create({
      data: {
        maDiem: `F09-STATUS-G-${label}`,
        tenDiem: `Điểm gửi ${label}`,
        diaChi: 'Địa chỉ test',
        tinhThanh: 'Thành phố Hồ Chí Minh',
        trangThai: 'HOAT_DONG',
        nhaXeId: company.nhaXeId,
      },
    });
    const dropoff = await prisma.diemGiaoNhanHang.create({
      data: {
        maDiem: `F09-STATUS-N-${label}`,
        tenDiem: `Điểm nhận ${label}`,
        diaChi: 'Địa chỉ test',
        tinhThanh: 'Thành phố Hồ Chí Minh',
        trangThai: 'HOAT_DONG',
        nhaXeId: company.nhaXeId,
      },
    });

    return {
      nhaXeId: company.nhaXeId,
      chuyenXeId: chuyenXe.chuyenXeId,
      diemGuiId: pickup.diemGiaoNhanHangId,
      diemNhanId: dropoff.diemGiaoNhanHangId,
    };
  }

  function setTenantAdmin(nhaXeId: number = tenantOneId, accountId?: number) {
    currentPrincipal = {
      taiKhoanId: accountId ?? testAccountId,
      sessionId: 'session-tenant-admin',
      roles: ['NHA_XE_ADMIN'],
      permissions: [...ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.NHA_XE_ADMIN],
      nhanVienId: testEmployeeId,
      nhaXeId,
    };
  }

  function setUnauthorizedRole(nhaXeId: number = tenantOneId) {
    currentPrincipal = {
      taiKhoanId: testAccountId,
      sessionId: 'session-no-perm',
      roles: ['NHAN_VIEN_BAN_VE'],
      permissions: [],
      nhanVienId: testEmployeeId,
      nhaXeId,
    };
  }

  function setSuperAdmin() {
    currentPrincipal = {
      taiKhoanId: testAccountId,
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
    const nhaXeId = options.nhaXeId ?? tenantOneId;
    const initialStatus = options.initialStatus ?? 'MOI_TAO';
    const isPaid = options.isPaid ?? false;

    // Tìm chuyến và điểm dừng của nhà xe
    const tenantFixture = tenantFixtures.get(nhaXeId);
    if (!tenantFixture) {
      throw new Error(`Missing shipment test fixture for tenant ${nhaXeId}.`);
    }
    const token = randomUUID().slice(0, 8);
    const maDonGiaoDich = `F09-STATUS-DON-${token}`;
    const maVanDon = `F09-STATUS-VD-${token}`;

    const donGiaoDich = await prisma.donGiaoDich.create({
      data: {
        maDonGiaoDich,
        ngayTao: new Date(),
        tongTien: 100000,
        trangThai: isPaid ? 'DA_THANH_TOAN' : 'CHO_THANH_TOAN',
        tenKhachHang: 'Khách Test Status',
        soDienThoaiKhachHang: '+84900111222',
        khachHangId: testCustomerId,
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
        chuyenXeId: tenantFixture.chuyenXeId,
        diemGuiId: tenantFixture.diemGuiId,
        diemNhanId: tenantFixture.diemNhanId,
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
        .patch(`/api/v1/shipments/${preconditionShipmentId}/status`)
        .send({ status: 'DA_TIEP_NHAN' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('ACCESS_TOKEN_INVALID');
    });

    it('returns 403 when user does not have shipment:update permission', async () => {
      setUnauthorizedRole();

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/shipments/${preconditionShipmentId}/status`)
        .send({ status: 'DA_TIEP_NHAN' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('PERMISSION_FORBIDDEN');
    });

    it('returns 403 when SUPER_ADMIN attempts operational shipment update', async () => {
      setSuperAdmin();

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/shipments/${preconditionShipmentId}/status`)
        .send({ status: 'DA_TIEP_NHAN' });

      expect(response.status).toBe(403);
    });

    it('returns 404 when shipment belongs to another tenant', async () => {
      const shipment = await createTestShipment({ nhaXeId: tenantTwoId });
      setTenantAdmin(); // Tenant one cannot update Tenant two

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/shipments/${shipment.phieuGuiHangId}/status`)
        .send({ status: 'DA_TIEP_NHAN' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('SHIPMENT_NOT_FOUND');
    });
  });

  describe('Validation & DTO constraints', () => {
    it('returns 400 when status is invalid enum', async () => {
      setTenantAdmin();

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/shipments/${preconditionShipmentId}/status`)
        .send({ status: 'TRANG_THAI_BAY_BA' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when note exceeds 500 characters', async () => {
      setTenantAdmin();

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/shipments/${preconditionShipmentId}/status`)
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
        nhaXeId: tenantOneId,
        initialStatus: 'MOI_TAO',
      });
      const id = shipment.phieuGuiHangId;
      setTenantAdmin();

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
      setTenantAdmin();
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
      setTenantAdmin();
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
        nhaXeId: tenantOneId,
        initialStatus: 'MOI_TAO',
        isPaid: false,
      });
      setTenantAdmin();

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
        nhaXeId: tenantOneId,
        initialStatus: 'MOI_TAO',
        isPaid: true,
      });
      setTenantAdmin();

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
      setTenantAdmin();

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/shipments/${shipment.phieuGuiHangId}/status`)
        .send({ status: 'DA_GIAO' });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('INVALID_STATUS_TRANSITION');
    });

    it('returns 409 when updating to the same status (repeat)', async () => {
      const shipment = await createTestShipment({ initialStatus: 'MOI_TAO' });
      setTenantAdmin();

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/shipments/${shipment.phieuGuiHangId}/status`)
        .send({ status: 'MOI_TAO' });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('INVALID_STATUS_TRANSITION');
    });

    it('returns 409 when trying to transition from terminal status DA_GIAO', async () => {
      const shipment = await createTestShipment({ initialStatus: 'MOI_TAO' });
      setTenantAdmin();

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
      setTenantAdmin();

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
