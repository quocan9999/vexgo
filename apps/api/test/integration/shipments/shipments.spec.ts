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

describe('Shipment Read APIs (Phase 02)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let currentPrincipal: AuthPrincipal | null = null;
  let tenantOneId: number;
  let tenantTwoId: number;
  let testAccountId: number;
  let testEmployeeId: number;
  let testOperatorAccountId: number;
  let testOperatorEmployeeId: number;
  let customerId: number;
  let detailShipmentId: number;
  let filteredShipmentId: number;
  let otherTenantShipmentId: number;
  let detailWaybillCode: string;

  type TenantFixture = {
    nhaXeId: number;
    chuyenXeId: number;
    diemGuiId: number;
    diemNhanId: number;
  };

  const tenantFixtures = new Map<number, TenantFixture>();
  const fixtureIds = {
    nhaXe: new Set<number>(),
    loaiXe: new Set<number>(),
    xe: new Set<number>(),
    tuyenXe: new Set<number>(),
    chuyenXe: new Set<number>(),
    diem: new Set<number>(),
    taiKhoan: new Set<number>(),
    nhanVien: new Set<number>(),
    khachHang: new Set<number>(),
    donGiaoDich: new Set<number>(),
    phieuGuiHang: new Set<number>(),
    loaiHangHoa: new Set<number>(),
    bangCuocGuiHang: new Set<number>(),
  };

  const testAccessTokenGuard = {
    canActivate(context: ExecutionContext) {
      if (!currentPrincipal) {
        throw new UnauthorizedException({
          error: 'ACCESS_TOKEN_INVALID',
          message: 'Authentication is required for this operation.',
        });
      }
      context.switchToHttp().getRequest<{ user?: AuthPrincipal }>().user =
        currentPrincipal;
      return true;
    },
  };

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

    const admin = await createEmployeeFixture(tenantOneId, 'ADMIN', token);
    testAccountId = admin.taiKhoanId;
    testEmployeeId = admin.nhanVienId;
    const operator = await createEmployeeFixture(tenantOneId, 'OP', token);
    testOperatorAccountId = operator.taiKhoanId;
    testOperatorEmployeeId = operator.nhanVienId;

    const customerAccount = await prisma.taiKhoan.create({
      data: {
        hoTen: `F09 read customer ${token}`,
        email: `f09-read-customer-${token}@example.test`,
        soDienThoai: `+848${randomInt(0, 1_000_000_000).toString().padStart(9, '0')}`,
        matKhau: 'test-only-password-hash',
        daXacThucSoDienThoai: true,
        trangThai: 'HOAT_DONG',
      },
    });
    fixtureIds.taiKhoan.add(customerAccount.taiKhoanId);
    const customer = await prisma.khachHang.create({
      data: {
        maKhachHang: `F09-READ-KH-${token}`,
        taiKhoanId: customerAccount.taiKhoanId,
      },
    });
    customerId = customer.khachHangId;
    fixtureIds.khachHang.add(customerId);

    const cargoType = await prisma.loaiHangHoa.create({
      data: {
        tenLoai: `F09 read cargo ${token}`,
        trangThai: 'HOAT_DONG',
        nhomSucChua: 'HANG_NHE',
      },
    });
    fixtureIds.loaiHangHoa.add(cargoType.loaiHangHoaId);

    const detailShipment = await createShipment({
      nhaXeId: tenantOneId,
      status: 'MOI_TAO',
      cargoTypeId: cargoType.loaiHangHoaId,
    });
    detailShipmentId = detailShipment.phieuGuiHangId;
    detailWaybillCode = detailShipment.maVanDon;
    const filteredShipment = await createShipment({
      nhaXeId: tenantOneId,
      status: 'DA_TIEP_NHAN',
    });
    filteredShipmentId = filteredShipment.phieuGuiHangId;
    const otherTenantShipment = await createShipment({
      nhaXeId: tenantTwoId,
      status: 'MOI_TAO',
    });
    otherTenantShipmentId = otherTenantShipment.phieuGuiHangId;
  }, 30_000);

  async function cleanupFixtures() {
    if (!prisma) return;

    await prisma.$transaction(async (tx) => {
      const shipmentIds = [...fixtureIds.phieuGuiHang];
      if (shipmentIds.length > 0) {
        const cargoItems = await tx.hangHoa.findMany({
          where: { phieuGuiHangId: { in: shipmentIds } },
          select: { hangHoaId: true },
        });
        const cargoIds = cargoItems.map(({ hangHoaId }) => hangHoaId);
        if (cargoIds.length > 0) {
          await tx.hinhAnhHangHoa.deleteMany({
            where: { hangHoaId: { in: cargoIds } },
          });
          await tx.hangHoa.deleteMany({
            where: { hangHoaId: { in: cargoIds } },
          });
        }
        await tx.lichSuTrangThaiPhieuGuiHang.deleteMany({
          where: { phieuGuiHangId: { in: shipmentIds } },
        });
        await tx.chiTietCuocGuiHang.deleteMany({
          where: { phieuGuiHangId: { in: shipmentIds } },
        });
        await tx.phanHoi.deleteMany({
          where: { phieuGuiHangId: { in: shipmentIds } },
        });
        await tx.phieuGuiHang.deleteMany({
          where: { phieuGuiHangId: { in: shipmentIds } },
        });
      }
      await tx.thanhToan.deleteMany({
        where: { donGiaoDichId: { in: [...fixtureIds.donGiaoDich] } },
      });
      await tx.hoaDon.deleteMany({
        where: { donGiaoDichId: { in: [...fixtureIds.donGiaoDich] } },
      });
      await tx.donGiaoDich.deleteMany({
        where: { donGiaoDichId: { in: [...fixtureIds.donGiaoDich] } },
      });
      await tx.bangCuocGuiHang.deleteMany({
        where: { bangCuocGuiHangId: { in: [...fixtureIds.bangCuocGuiHang] } },
      });
      await tx.loaiHangHoa.deleteMany({
        where: { loaiHangHoaId: { in: [...fixtureIds.loaiHangHoa] } },
      });
      await tx.chuyenXe.deleteMany({
        where: { chuyenXeId: { in: [...fixtureIds.chuyenXe] } },
      });
      await tx.xe.deleteMany({ where: { xeId: { in: [...fixtureIds.xe] } } });
      await tx.tuyenXe.deleteMany({
        where: { tuyenXeId: { in: [...fixtureIds.tuyenXe] } },
      });
      await tx.diemGiaoNhanHang.deleteMany({
        where: { diemGiaoNhanHangId: { in: [...fixtureIds.diem] } },
      });
      await tx.nhanVien.deleteMany({
        where: { nhanVienId: { in: [...fixtureIds.nhanVien] } },
      });
      await tx.khachHang.deleteMany({
        where: { khachHangId: { in: [...fixtureIds.khachHang] } },
      });
      await tx.taiKhoan.deleteMany({
        where: { taiKhoanId: { in: [...fixtureIds.taiKhoan] } },
      });
      await tx.loaiXe.deleteMany({
        where: { loaiXeId: { in: [...fixtureIds.loaiXe] } },
      });
      await tx.nhaXe.deleteMany({
        where: { nhaXeId: { in: [...fixtureIds.nhaXe] } },
      });
    });

    for (const ids of Object.values(fixtureIds)) ids.clear();
    tenantFixtures.clear();
  }

  afterAll(async () => {
    try {
      await cleanupFixtures();
      if (prisma) {
        const residue = await prisma.$transaction([
          prisma.nhaXe.count({
            where: { maNhaXe: { startsWith: 'F09-READ-' } },
          }),
          prisma.loaiXe.count({
            where: { tenLoai: { startsWith: 'F09-READ-LOAI-' } },
          }),
          prisma.xe.count({ where: { bienSoXe: { startsWith: 'F09READ' } } }),
          prisma.tuyenXe.count({
            where: { maTuyenXe: { startsWith: 'F09-READ-' } },
          }),
          prisma.chuyenXe.count({
            where: { maChuyenXe: { startsWith: 'F09-READ-' } },
          }),
          prisma.diemGiaoNhanHang.count({
            where: { maDiem: { startsWith: 'F09-READ-' } },
          }),
          prisma.khachHang.count({
            where: { maKhachHang: { startsWith: 'F09-READ-KH-' } },
          }),
          prisma.phieuGuiHang.count({
            where: { maVanDon: { startsWith: 'F09-READ-VD-' } },
          }),
          prisma.donGiaoDich.count({
            where: { maDonGiaoDich: { startsWith: 'F09-READ-DON-' } },
          }),
          prisma.loaiHangHoa.count({
            where: { tenLoai: { startsWith: 'F09 read cargo ' } },
          }),
          prisma.taiKhoan.count({
            where: { email: { startsWith: 'f09-read-' } },
          }),
        ]);
        expect(residue).toEqual(Array.from({ length: 11 }, () => 0));
      }
    } finally {
      await app?.close();
    }
  });

  async function createTenantFixture(label: string): Promise<TenantFixture> {
    const company = await prisma.nhaXe.create({
      data: {
        maNhaXe: `F09-READ-${label}`,
        tenNhaXe: `F09 read bus company ${label}`,
        trangThai: 'HOAT_DONG',
      },
    });
    fixtureIds.nhaXe.add(company.nhaXeId);
    const vehicleType = await prisma.loaiXe.create({
      data: {
        nhaXeId: company.nhaXeId,
        tenLoai: `F09-READ-LOAI-${label}`,
      },
    });
    fixtureIds.loaiXe.add(vehicleType.loaiXeId);
    const vehicle = await prisma.xe.create({
      data: {
        bienSoXe: `F09READ${label.replace(/[^A-Z0-9]/gi, '').slice(0, 8)}`,
        trangThai: 'HOAT_DONG',
        nhaXeId: company.nhaXeId,
        loaiXeId: vehicleType.loaiXeId,
      },
    });
    fixtureIds.xe.add(vehicle.xeId);
    const route = await prisma.tuyenXe.create({
      data: {
        maTuyenXe: `F09-READ-${label}`,
        diemDi: 'Read test origin',
        diemDen: 'Read test destination',
        trangThai: 'HOAT_DONG',
        nhaXeId: company.nhaXeId,
      },
    });
    fixtureIds.tuyenXe.add(route.tuyenXeId);
    const trip = await prisma.chuyenXe.create({
      data: {
        maChuyenXe: `F09-READ-${label}`,
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
    fixtureIds.chuyenXe.add(trip.chuyenXeId);
    const origin = await prisma.diemGiaoNhanHang.create({
      data: {
        maDiem: `F09-READ-G-${label}`,
        tenDiem: `F09 read origin ${label}`,
        diaChi: '1 Test Street',
        tinhThanh: 'Ho Chi Minh City',
        trangThai: 'HOAT_DONG',
        nhaXeId: company.nhaXeId,
      },
    });
    fixtureIds.diem.add(origin.diemGiaoNhanHangId);
    const destination = await prisma.diemGiaoNhanHang.create({
      data: {
        maDiem: `F09-READ-N-${label}`,
        tenDiem: `F09 read destination ${label}`,
        diaChi: '2 Test Street',
        tinhThanh: 'Ho Chi Minh City',
        trangThai: 'HOAT_DONG',
        nhaXeId: company.nhaXeId,
      },
    });
    fixtureIds.diem.add(destination.diemGiaoNhanHangId);

    return {
      nhaXeId: company.nhaXeId,
      chuyenXeId: trip.chuyenXeId,
      diemGuiId: origin.diemGiaoNhanHangId,
      diemNhanId: destination.diemGiaoNhanHangId,
    };
  }

  async function createEmployeeFixture(
    nhaXeId: number,
    role: string,
    token: string,
  ) {
    const account = await prisma.taiKhoan.create({
      data: {
        hoTen: `F09 read ${role} ${token}`,
        email: `f09-read-${role.toLowerCase()}-${token}@example.test`,
        soDienThoai: `+849${randomInt(0, 1_000_000_000).toString().padStart(9, '0')}`,
        matKhau: 'test-only-password-hash',
        daXacThucSoDienThoai: true,
        trangThai: 'HOAT_DONG',
      },
    });
    fixtureIds.taiKhoan.add(account.taiKhoanId);
    const employee = await prisma.nhanVien.create({
      data: {
        maNhanVien: `F09-READ-${role}-${token}`,
        trangThaiLamViec: 'DANG_LAM',
        nhaXeId,
        taiKhoanId: account.taiKhoanId,
      },
    });
    fixtureIds.nhanVien.add(employee.nhanVienId);
    return { taiKhoanId: account.taiKhoanId, nhanVienId: employee.nhanVienId };
  }

  async function createShipment(options: {
    nhaXeId: number;
    status: 'MOI_TAO' | 'DA_TIEP_NHAN';
    cargoTypeId?: number;
  }) {
    const tenant = tenantFixtures.get(options.nhaXeId);
    if (!tenant)
      throw new Error(`Missing read fixture for tenant ${options.nhaXeId}.`);

    const token = randomUUID().replaceAll('-', '').slice(0, 10);
    const transaction = await prisma.donGiaoDich.create({
      data: {
        maDonGiaoDich: `F09-READ-DON-${token}`,
        ngayTao: new Date(),
        tongTien: 30000,
        trangThai: 'CHO_THANH_TOAN',
        tenKhachHang: 'F09 read sender',
        soDienThoaiKhachHang: '+84900000111',
        khachHangId: customerId,
        nhaXeId: options.nhaXeId,
      },
    });
    fixtureIds.donGiaoDich.add(transaction.donGiaoDichId);

    const shipment = await prisma.phieuGuiHang.create({
      data: {
        maVanDon: `F09-READ-VD-${token}`,
        ngayGui: new Date(),
        tongPhi: 30000,
        cuocChinh: 25000,
        phiDichVu: 5000,
        soTienGiam: 0,
        nguoiTraCuoc: 'NGUOI_GUI',
        trangThai: options.status,
        tenNguoiNhan: `F09 read receiver ${token}`,
        soDienThoaiNguoiNhan: '+84900000222',
        donGiaoDichId: transaction.donGiaoDichId,
        chuyenXeId: tenant.chuyenXeId,
        diemGuiId: tenant.diemGuiId,
        diemNhanId: tenant.diemNhanId,
        lichSuTrangThais: {
          create: {
            trangThai: options.status,
            thoiGian: new Date(),
            ghiChu: 'Created by shipment read integration test',
          },
        },
      },
    });
    fixtureIds.phieuGuiHang.add(shipment.phieuGuiHangId);

    if (options.cargoTypeId !== undefined) {
      const rate = await prisma.bangCuocGuiHang.create({
        data: {
          khoiLuongTu: 0,
          khoiLuongDen: 10,
          mucCuoc: 25000,
          tuNgay: new Date('2026-01-01T00:00:00.000Z'),
          trangThai: 'HOAT_DONG',
          diemGuiId: tenant.diemGuiId,
          diemNhanId: tenant.diemNhanId,
          loaiHangHoaId: options.cargoTypeId,
        },
      });
      fixtureIds.bangCuocGuiHang.add(rate.bangCuocGuiHangId);
      await prisma.hangHoa.create({
        data: {
          tenHang: 'F09 read cargo item',
          soLuong: 2,
          khoiLuong: 1.5,
          phieuGuiHangId: shipment.phieuGuiHangId,
          loaiHangHoaId: options.cargoTypeId,
        },
      });
      await prisma.chiTietCuocGuiHang.create({
        data: {
          phieuGuiHangId: shipment.phieuGuiHangId,
          loaiHangHoaId: options.cargoTypeId,
          bangCuocGuiHangId: rate.bangCuocGuiHangId,
          khoiLuongTinhCuoc: 1.5,
          soTienCuoc: 25000,
        },
      });
    }
    return shipment;
  }

  function setTenantAdmin(nhaXeId: number = tenantOneId) {
    currentPrincipal = {
      taiKhoanId: testAccountId,
      sessionId: 'session-tenant-admin',
      roles: ['NHA_XE_ADMIN'],
      permissions: [...ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.NHA_XE_ADMIN],
      nhanVienId: testEmployeeId,
      nhaXeId,
    };
  }

  function setTenantOperator(nhaXeId: number = tenantOneId) {
    currentPrincipal = {
      taiKhoanId: testOperatorAccountId,
      sessionId: 'session-tenant-op',
      roles: ['NHAN_VIEN_DIEU_HANH'],
      permissions: [...ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.NHAN_VIEN_DIEU_HANH],
      nhanVienId: testOperatorEmployeeId,
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

  describe('Authentication & Authorization', () => {
    it('returns 401 when request is unauthenticated', async () => {
      currentPrincipal = null;

      const response = await request(app.getHttpServer())
        .get('/api/v1/shipments')
        .expect(401);

      expect(response.body.error).toBe('ACCESS_TOKEN_INVALID');
    });

    it('returns 403 when authenticated user lacks shipment:read permission', async () => {
      setUnauthorizedRole();

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
    it('returns only fixture shipments for the authenticated tenant with accurate page metadata', async () => {
      setTenantAdmin();

      const firstPage = await request(app.getHttpServer())
        .get('/api/v1/shipments')
        .query({ page: 1, pageSize: 1 })
        .expect(200);
      const secondPage = await request(app.getHttpServer())
        .get('/api/v1/shipments')
        .query({ page: 2, pageSize: 1 })
        .expect(200);

      expect(firstPage.body.meta).toEqual({
        page: 1,
        pageSize: 1,
        totalItems: 2,
        totalPages: 2,
      });
      expect(secondPage.body.meta).toEqual({
        page: 2,
        pageSize: 1,
        totalItems: 2,
        totalPages: 2,
      });
      const returnedIds = [
        firstPage.body.data[0].shipmentId,
        secondPage.body.data[0].shipmentId,
      ];
      expect(new Set(returnedIds)).toEqual(
        new Set([detailShipmentId, filteredShipmentId]),
      );
      expect(returnedIds).not.toContain(otherTenantShipmentId);

      const dbShipments = await prisma.phieuGuiHang.findMany({
        where: { phieuGuiHangId: { in: returnedIds } },
        include: { donGiaoDich: true },
      });
      expect(dbShipments).toHaveLength(2);
      for (const shipment of dbShipments) {
        expect(shipment.donGiaoDich.nhaXeId).toBe(tenantOneId);
      }
    });

    it('returns 404 when querying a fixture shipment belonging to another tenant', async () => {
      setTenantAdmin();

      const response = await request(app.getHttpServer())
        .get(`/api/v1/shipments/${otherTenantShipmentId}`)
        .expect(404);

      expect(response.body.error).toBe('SHIPMENT_NOT_FOUND');
    });
  });

  describe('Validation & Query Parameters', () => {
    it('returns 400 for invalid page number', async () => {
      setTenantAdmin();

      const response = await request(app.getHttpServer())
        .get('/api/v1/shipments')
        .query({ page: 0 })
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for invalid pageSize (> 50)', async () => {
      setTenantAdmin();

      const response = await request(app.getHttpServer())
        .get('/api/v1/shipments')
        .query({ pageSize: 100 })
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for invalid status enum', async () => {
      setTenantAdmin();

      const response = await request(app.getHttpServer())
        .get('/api/v1/shipments')
        .query({ status: 'INVALID_STATUS' })
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('filters fixture shipments correctly by status', async () => {
      setTenantAdmin();

      const response = await request(app.getHttpServer())
        .get('/api/v1/shipments')
        .query({ status: 'DA_TIEP_NHAN' })
        .expect(200);

      expect(response.body.meta.totalItems).toBe(1);
      expect(
        response.body.data.map(
          (item: { shipmentId: number }) => item.shipmentId,
        ),
      ).toEqual([filteredShipmentId]);
      expect(response.body.data[0].status).toBe('DA_TIEP_NHAN');
    });

    it('searches the fixture by exact waybill code', async () => {
      setTenantAdmin();

      const response = await request(app.getHttpServer())
        .get('/api/v1/shipments')
        .query({ search: detailWaybillCode })
        .expect(200);

      expect(response.body.meta.totalItems).toBe(1);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].shipmentId).toBe(detailShipmentId);
      expect(response.body.data[0].waybillCode).toBe(detailWaybillCode);
    });

    it('returns empty array with accurate meta when search matches nothing', async () => {
      setTenantAdmin();

      const response = await request(app.getHttpServer())
        .get('/api/v1/shipments')
        .query({ search: `F09-READ-MISSING-${randomUUID()}` })
        .expect(200);

      expect(response.body.data).toEqual([]);
      expect(response.body.meta.totalItems).toBe(0);
      expect(response.body.meta.totalPages).toBe(0);
    });
  });

  describe('Detail Endpoint (GET /:id)', () => {
    it('returns detailed shipment data with cargo items, fee details, fee summary, and history', async () => {
      setTenantOperator();

      const sample = await prisma.phieuGuiHang.findUniqueOrThrow({
        where: { phieuGuiHangId: detailShipmentId },
        include: {
          hangHoas: true,
          chiTietCuocGuiHangs: true,
          lichSuTrangThais: true,
        },
      });
      const response = await request(app.getHttpServer())
        .get(`/api/v1/shipments/${detailShipmentId}`)
        .expect(200);

      const { data } = response.body;
      expect(data.shipmentId).toBe(sample.phieuGuiHangId);
      expect(data.waybillCode).toBe(sample.maVanDon);
      expect(data.status).toBe(sample.trangThai);
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

      expect(Array.isArray(data.cargoItems)).toBe(true);
      expect(data.cargoItems).toHaveLength(sample.hangHoas.length);
      expect(data.cargoItems).toHaveLength(1);
      expect(data.cargoItems[0]).toMatchObject({
        name: 'F09 read cargo item',
        weightKg: 1.5,
        quantity: 2,
      });
      expect(data.cargoItems[0]).toHaveProperty(
        'cargoId',
        sample.hangHoas[0].hangHoaId,
      );
      expect(data.cargoItems[0]).toHaveProperty('typeName');

      expect(Array.isArray(data.cargoFeeDetails)).toBe(true);
      expect(data.cargoFeeDetails).toHaveLength(
        sample.chiTietCuocGuiHangs.length,
      );
      expect(data.cargoFeeDetails).toHaveLength(1);
      expect(data.cargoFeeDetails[0]).toMatchObject({
        chargeableWeightKg: 1.5,
        fee: 25000,
      });
      expect(data.feeSummary).toEqual({
        mainFee: 25000,
        serviceFee: 5000,
        discountAmount: 0,
        totalFee: 30000,
        freightPayer: 'NGUOI_GUI',
      });

      expect(Array.isArray(data.history)).toBe(true);
      expect(data.history).toHaveLength(sample.lichSuTrangThais.length);
      expect(data.history).toHaveLength(1);
      expect(data.history[0]).toMatchObject({
        status: 'MOI_TAO',
        note: 'Created by shipment read integration test',
      });
      expect(data.history[0]).toHaveProperty(
        'historyId',
        sample.lichSuTrangThais[0].lichSuTrangThaiId,
      );
      expect(data.history[0]).toHaveProperty('time');
    });

    it('returns 404 for non-existent shipment ID', async () => {
      setTenantAdmin();

      const response = await request(app.getHttpServer())
        .get('/api/v1/shipments/9999999')
        .expect(404);

      expect(response.body.error).toBe('SHIPMENT_NOT_FOUND');
    });

    it('returns 400 for non-numeric ID', async () => {
      setTenantAdmin();

      await request(app.getHttpServer())
        .get('/api/v1/shipments/abc')
        .expect(400);
    });
  });
});
