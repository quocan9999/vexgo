import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { ExecutionContext, INestApplication } from '@nestjs/common';
import { AppModule } from '../../../src/app.module.js';
import { AccessTokenGuard } from '../../../src/auth/guards/access-token.guard.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';
import { configureApi } from '../../../src/common/configure-api.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';

export type SeatHoldTestContext = {
  app: INestApplication;
  prisma: PrismaService;
  tripId: number;
  otherTripId: number;
  tripSeatIds: number[];
  otherTripSeatId: number;
  accountId: number;
  otherAccountId: number;
  customerId: number;
  sessionId: string;
  otherSessionId: string;
  setPrincipal: (value: AuthPrincipal | null) => void;
  close: () => Promise<void>;
};

async function cleanupPriorTestData(prisma: PrismaService) {
  const companies = await prisma.nhaXe.findMany({
    where: { maNhaXe: { startsWith: 'T-HOLD-' } },
    select: { nhaXeId: true },
  });
  const companyIds = companies.map(({ nhaXeId }) => nhaXeId);
  const trips = await prisma.chuyenXe.findMany({
    where: {
      nhaXeId: { in: companyIds },
      maChuyenXe: { startsWith: 'T-HOLD-' },
    },
    select: { chuyenXeId: true },
  });
  const tripIds = trips.map(({ chuyenXeId }) => chuyenXeId);
  if (tripIds.length > 0) {
    await prisma.giuCho.deleteMany({
      where: { chuyenXeId: { in: tripIds } },
    });
  }
  const accounts = await prisma.taiKhoan.findMany({
    where: { hoTen: { startsWith: 'Seat Hold Customer ' } },
    select: { taiKhoanId: true, khachHang: { select: { khachHangId: true } } },
  });
  const customerIds = accounts.flatMap(({ khachHang }) =>
    khachHang ? [khachHang.khachHangId] : [],
  );
  const orders = await prisma.donGiaoDich.findMany({
    where: { khachHangId: { in: customerIds } },
    select: { donGiaoDichId: true },
  });
  const orderIds = orders.map(({ donGiaoDichId }) => donGiaoDichId);
  if (orderIds.length > 0) {
    await prisma.ve.deleteMany({
      where: { phieuDatVe: { donGiaoDichId: { in: orderIds } } },
    });
    await prisma.phieuDatVe.deleteMany({
      where: { donGiaoDichId: { in: orderIds } },
    });
    await prisma.thanhToan.deleteMany({
      where: { donGiaoDichId: { in: orderIds } },
    });
    await prisma.hoaDon.deleteMany({
      where: { donGiaoDichId: { in: orderIds } },
    });
    await prisma.donGiaoDich.deleteMany({
      where: { donGiaoDichId: { in: orderIds } },
    });
  }
  if (customerIds.length > 0) {
    await prisma.khachHang.deleteMany({
      where: { khachHangId: { in: customerIds } },
    });
  }
  if (accounts.length > 0) {
    await prisma.taiKhoan.deleteMany({
      where: {
        taiKhoanId: { in: accounts.map(({ taiKhoanId }) => taiKhoanId) },
      },
    });
  }
  if (companyIds.length === 0) return;

  if (tripIds.length > 0) {
    await prisma.gheChuyenXe.deleteMany({
      where: { chuyenXeId: { in: tripIds } },
    });
    await prisma.chuyenXe.deleteMany({
      where: { chuyenXeId: { in: tripIds } },
    });
  }
  await prisma.bangGia.deleteMany({ where: { nhaXeId: { in: companyIds } } });
  const routes = await prisma.tuyenXe.findMany({
    where: {
      nhaXeId: { in: companyIds },
      maTuyenXe: { startsWith: 'T-HOLD-' },
    },
    select: { tuyenXeId: true },
  });
  await prisma.tuyenXe.deleteMany({
    where: { tuyenXeId: { in: routes.map(({ tuyenXeId }) => tuyenXeId) } },
  });
  const vehicles = await prisma.xe.findMany({
    where: { nhaXeId: { in: companyIds }, bienSoXe: { startsWith: 'T' } },
    select: { xeId: true },
  });
  const vehicleIds = vehicles.map(({ xeId }) => xeId);
  if (vehicleIds.length > 0) {
    await prisma.ghe.deleteMany({ where: { xeId: { in: vehicleIds } } });
    await prisma.xe.deleteMany({ where: { xeId: { in: vehicleIds } } });
  }
  await prisma.loaiXe.deleteMany({
    where: {
      nhaXeId: { in: companyIds },
      tenLoai: { startsWith: 'Hold Type ' },
    },
  });
  await prisma.nhaXe.deleteMany({ where: { nhaXeId: { in: companyIds } } });
}

export async function createSeatHoldTestContext(): Promise<SeatHoldTestContext> {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase();
  const sessionId = randomUUID();
  const otherSessionId = randomUUID();
  let principal: AuthPrincipal | null = {
    taiKhoanId: 1,
    sessionId,
    roles: ['KHACH_HANG'],
    permissions: [],
    nhanVienId: null,
    nhaXeId: null,
  };
  const accessTokenGuard = {
    canActivate(context: ExecutionContext) {
      const request = context.switchToHttp().getRequest<{
        user?: AuthPrincipal;
      }>();
      if (principal) request.user = principal;
      return true;
    },
  };

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(AccessTokenGuard)
    .useValue(accessTokenGuard)
    .compile();
  const app = moduleRef.createNestApplication();
  configureApi(app);
  await app.init();

  const prisma = app.get(PrismaService);
  await cleanupPriorTestData(prisma);
  const company = await prisma.nhaXe.create({
    data: {
      maNhaXe: `T-HOLD-${suffix}`,
      tenNhaXe: `Seat Hold ${suffix}`,
      trangThai: 'HOAT_DONG',
    },
    select: { nhaXeId: true },
  });
  const vehicleType = await prisma.loaiXe.create({
    data: { nhaXeId: company.nhaXeId, tenLoai: `Hold Type ${suffix}` },
    select: { loaiXeId: true },
  });
  const route = await prisma.tuyenXe.create({
    data: {
      maTuyenXe: `T-HOLD-${suffix}`,
      diemDi: 'Điểm thử giữ ghế',
      diemDen: 'Điểm thử đích',
      trangThai: 'HOAT_DONG',
      nhaXeId: company.nhaXeId,
    },
    select: { tuyenXeId: true },
  });
  const vehicle = await prisma.xe.create({
    data: {
      bienSoXe: `T${suffix.slice(0, 10)}`,
      trangThai: 'HOAT_DONG',
      nhaXeId: company.nhaXeId,
      loaiXeId: vehicleType.loaiXeId,
    },
    select: { xeId: true },
  });
  const seats = await Promise.all([
    prisma.ghe.create({
      data: { soGhe: 'A1', viTri: '1A', xeId: vehicle.xeId },
      select: { gheId: true },
    }),
    prisma.ghe.create({
      data: { soGhe: 'A2', viTri: '1B', xeId: vehicle.xeId },
      select: { gheId: true },
    }),
  ]);
  const departure = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
  const departureDate = departure.toISOString().slice(0, 10);
  const trip = await prisma.chuyenXe.create({
    data: {
      maChuyenXe: `T-HOLD-${suffix}`,
      ngayKhoiHanh: new Date(`${departureDate}T00:00:00.000Z`),
      gioKhoiHanh: new Date('1970-01-01T23:00:00.000Z'),
      trangThai: 'CHUA_KHOI_HANH',
      nhaXeId: company.nhaXeId,
      tuyenXeId: route.tuyenXeId,
      xeId: vehicle.xeId,
    },
    select: { chuyenXeId: true },
  });
  const tripSeats = await Promise.all(
    seats.map((seat) =>
      prisma.gheChuyenXe.create({
        data: {
          trangThai: 'TRONG',
          chuyenXeId: trip.chuyenXeId,
          gheId: seat.gheId,
        },
        select: { gheChuyenXeId: true },
      }),
    ),
  );
  const otherTrip = await prisma.chuyenXe.create({
    data: {
      maChuyenXe: `T-HOLD-OTHER-${suffix}`,
      ngayKhoiHanh: new Date(`${departureDate}T00:00:00.000Z`),
      gioKhoiHanh: new Date('1970-01-01T23:30:00.000Z'),
      trangThai: 'CHUA_KHOI_HANH',
      nhaXeId: company.nhaXeId,
      tuyenXeId: route.tuyenXeId,
      xeId: vehicle.xeId,
    },
    select: { chuyenXeId: true },
  });
  const otherTripSeat = await prisma.gheChuyenXe.create({
    data: {
      trangThai: 'TRONG',
      chuyenXeId: otherTrip.chuyenXeId,
      gheId: seats[0]!.gheId,
    },
    select: { gheChuyenXeId: true },
  });
  const account = await prisma.taiKhoan.create({
    data: {
      hoTen: `Seat Hold Customer ${suffix}`,
      soDienThoai: `+849${suffix.slice(0, 9)}`,
      matKhau: 'test-only-not-a-login-secret',
      email: `seat-hold-${suffix.toLowerCase()}@example.test`,
      daXacThucSoDienThoai: true,
      trangThai: 'HOAT_DONG',
    },
    select: { taiKhoanId: true },
  });
  const customer = await prisma.khachHang.create({
    data: {
      maKhachHang: `T-HOLD-${suffix}`,
      taiKhoanId: account.taiKhoanId,
    },
    select: { khachHangId: true },
  });
  const otherAccount = await prisma.taiKhoan.create({
    data: {
      hoTen: `Seat Hold Customer Other ${suffix}`,
      soDienThoai: `+848${suffix.slice(0, 9)}`,
      matKhau: 'test-only-not-a-login-secret',
      email: `seat-hold-other-${suffix.toLowerCase()}@example.test`,
      daXacThucSoDienThoai: true,
      trangThai: 'HOAT_DONG',
    },
    select: { taiKhoanId: true },
  });
  await prisma.khachHang.create({
    data: {
      maKhachHang: `T-HOLD-OTHER-${suffix}`,
      taiKhoanId: otherAccount.taiKhoanId,
    },
    select: { khachHangId: true },
  });
  principal = {
    ...principal!,
    taiKhoanId: account.taiKhoanId,
  };

  async function close() {
    try {
      await prisma.giuCho.deleteMany({
        where: { chuyenXeId: { in: [trip.chuyenXeId, otherTrip.chuyenXeId] } },
      });
      const orders = await prisma.donGiaoDich.findMany({
        where: {
          khachHangId: { in: [customer.khachHangId] },
        },
        select: { donGiaoDichId: true },
      });
      const orderIds = orders.map(({ donGiaoDichId }) => donGiaoDichId);
      if (orderIds.length > 0) {
        await prisma.ve.deleteMany({
          where: {
            phieuDatVe: { donGiaoDichId: { in: orderIds } },
          },
        });
        await prisma.phieuDatVe.deleteMany({
          where: { donGiaoDichId: { in: orderIds } },
        });
        await prisma.thanhToan.deleteMany({
          where: { donGiaoDichId: { in: orderIds } },
        });
        await prisma.hoaDon.deleteMany({
          where: { donGiaoDichId: { in: orderIds } },
        });
        await prisma.donGiaoDich.deleteMany({
          where: { donGiaoDichId: { in: orderIds } },
        });
      }
      await prisma.bangGia.deleteMany({
        where: { tuyenXeId: route.tuyenXeId },
      });
      await prisma.giuCho.deleteMany({
        where: { chuyenXeId: { in: [trip.chuyenXeId, otherTrip.chuyenXeId] } },
      });
      await prisma.gheChuyenXe.deleteMany({
        where: { chuyenXeId: { in: [trip.chuyenXeId, otherTrip.chuyenXeId] } },
      });
      await prisma.chuyenXe.deleteMany({
        where: { chuyenXeId: { in: [trip.chuyenXeId, otherTrip.chuyenXeId] } },
      });
      await prisma.khachHang.delete({
        where: { khachHangId: customer.khachHangId },
      });
      await prisma.taiKhoan.delete({
        where: { taiKhoanId: account.taiKhoanId },
      });
      const otherCustomer = await prisma.khachHang.findUnique({
        where: { taiKhoanId: otherAccount.taiKhoanId },
        select: { khachHangId: true },
      });
      if (otherCustomer) {
        await prisma.khachHang.delete({
          where: { khachHangId: otherCustomer.khachHangId },
        });
      }
      await prisma.taiKhoan.delete({
        where: { taiKhoanId: otherAccount.taiKhoanId },
      });
      await prisma.ghe.deleteMany({ where: { xeId: vehicle.xeId } });
      await prisma.xe.delete({ where: { xeId: vehicle.xeId } });
      await prisma.tuyenXe.delete({ where: { tuyenXeId: route.tuyenXeId } });
      await prisma.loaiXe.delete({ where: { loaiXeId: vehicleType.loaiXeId } });
      await prisma.nhaXe.delete({ where: { nhaXeId: company.nhaXeId } });
    } finally {
      await app.close();
    }
  }

  return {
    app,
    prisma,
    tripId: trip.chuyenXeId,
    otherTripId: otherTrip.chuyenXeId,
    tripSeatIds: tripSeats.map(({ gheChuyenXeId }) => gheChuyenXeId),
    otherTripSeatId: otherTripSeat.gheChuyenXeId,
    accountId: account.taiKhoanId,
    otherAccountId: otherAccount.taiKhoanId,
    customerId: customer.khachHangId,
    sessionId,
    otherSessionId,
    setPrincipal(value) {
      principal = value;
    },
    close,
  };
}
